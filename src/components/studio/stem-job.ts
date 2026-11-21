/**
 * The AI stem separation job, kept outside the Separate Stems panel so it keeps going when you
 * switch tools, and saved on this device so it is picked up again after the page reloads
 * (phones can restart a tab that runs low on memory). Parts are downloaded and decoded one at a
 * time and handed to the bleed cleaner without copies, so a whole song fits in a phone's memory.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { encodeWav } from "@/lib/synclab/bounce";
import { peaksOf } from "@/lib/synclab/stems";
import {
  cancelStemSplitFn,
  checkStemSplitFn,
  fetchStemFn,
  startDrumSplitFn,
  startStemSplitFn,
} from "@/utils/stem-split.functions";
import {
  AI_STEMS,
  DRUM_PIECES,
  partsFor,
  qualityFor,
  type AiQuality,
  type AiStemId,
  type DrumPieceId,
} from "@/lib/synclab/ai-stems";
import type { BleedStrength } from "@/lib/synclab/bleed-cleanup";
import type { StereoPcm } from "@/lib/synclab/stem-separation";
import { announceAiUse } from "./AiUsesLeft";
import { decodeAudioFile } from "@/lib/synclab/aiff-decode";

export type StemResult = {
  id: string;
  label: string;
  url: string;
  peaks: number[];
  duration: number;
  added: boolean;
};
export type StemSource = { name: string; buffer: AudioBuffer; start: number; blob: Blob };

export type StemJobState = {
  source: StemSource | null;
  busy: string | null;
  progress: number | null;
  /** when the current waiting step began (shown as elapsed time) */
  since: number | null;
  /** song length in seconds, for the "usually takes" hint */
  songSeconds: number | null;
  results: StemResult[];
  /** name of the song the results came from (also after a reload, when the file itself is gone) */
  resultName: string | null;
  resultStart: number;
  /** true when the shown job was picked up again after the page reloaded */
  resumed: boolean;
};

let state: StemJobState = {
  source: null,
  busy: null,
  progress: null,
  since: null,
  songSeconds: null,
  results: [],
  resultName: null,
  resultStart: 0,
  resumed: false,
};
const listeners = new Set<() => void>();
export const stemJob = {
  get: () => state,
  set(patch: Partial<StemJobState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
export const useStemJob = () => useSyncExternalStore(stemJob.subscribe, stemJob.get, stemJob.get);

export const clearResults = () => {
  for (const r of state.results) if (!r.added) URL.revokeObjectURL(r.url);
  stemJob.set({ results: [] });
};
export const markAdded = (id: string) =>
  stemJob.set({ results: state.results.map((x) => (x.id === id ? { ...x, added: true } : x)) });

// ---------------------------------------------------------------- saved job (survives a reload)

const KEY = "synclab.stem-job.v1";
/** Finished parts stay downloadable for about an hour, so older jobs are not picked up. */
const MAX_AGE = 55 * 60_000;
type Pending = {
  v: 1;
  at: number;
  name: string;
  start: number;
  seconds: number;
  quality: AiQuality | null;
  stemIds: AiStemId[];
  pieces: DrumPieceId[];
  cleanup: BleedStrength;
  drumsOnly: boolean;
  splitId?: string;
  drumsLink?: string | null;
  drumJobs?: { piece: string; id: string }[];
};
const savePending = (p: Pending | null) => {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the job just isn't resumable */
  }
};
const readPending = (): Pending | null => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null") as Pending | null;
    if (!p || p.v !== 1 || Date.now() - p.at > MAX_AGE) return null;
    return p;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------- helpers

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = (b64: string, type: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new Blob([out], { type });
};
export const decodeBytes = async (data: ArrayBuffer) => {
  const ctx = new AudioContext();
  try {
    return await decodeAudioFile(ctx, data);
  } finally {
    void ctx.close();
  }
};
export const pcmOf = (b: AudioBuffer): StereoPcm => ({
  left: b.getChannelData(0).slice(),
  right: (b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0)).slice(),
});
const sumPcm = (list: StereoPcm[]): StereoPcm => {
  if (list.length === 1) return list[0]!;
  const len = Math.max(...list.map((p) => p.left.length));
  const left = new Float32Array(len),
    right = new Float32Array(len);
  for (const p of list)
    for (let i = 0; i < p.left.length; i++) {
      left[i] = left[i]! + p.left[i]!;
      right[i] = right[i]! + p.right[i]!;
    }
  return { left, right };
};
export const stereoPeaks = ({ left, right }: StereoPcm) =>
  peaksOf(left, 512).map((v, i) =>
    Math.max(v, Math.abs(right[Math.floor((i * right.length) / 512)] ?? 0)),
  );

/** Finished parts are on Replicate's download host, which lets the browser fetch them directly. */
const DIRECT = /^https:\/\/(?:[a-z0-9-]+\.)?replicate\.delivery\//;
async function stemBlob(url: string): Promise<Blob> {
  if (DIRECT.test(url)) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.blob();
    } catch {
      /* fall back to downloading through the app */
    }
  }
  const got = await fetchStemFn({ data: { url } });
  if (!got.ok) throw new Error(got.error);
  return fromBase64(got.mp3, "audio/mpeg");
}
async function decodeBlob(blob: Blob) {
  const buffer = await decodeBytes(await blob.arrayBuffer());
  return { pcm: pcmOf(buffer), rate: buffer.sampleRate };
}

let cancelled = false;
let running = false;
export const isRunning = () => running;
export const stopJob = () => {
  cancelled = true;
};

/** Waits for one AI job; null when you pressed Stop. */
async function waitFor(id: string) {
  const deadline = Date.now() + 15 * 60_000;
  for (;;) {
    if (cancelled) {
      void cancelStemSplitFn({ data: { id } }).catch(() => {});
      return null;
    }
    if (Date.now() > deadline) {
      void cancelStemSplitFn({ data: { id } }).catch(() => {});
      throw new Error(
        "The separator took longer than 15 minutes, so it was stopped. Try a shorter song or an MP3.",
      );
    }
    const res = await checkStemSplitFn({ data: { id } });
    if (!res.ok) throw new Error(res.error);
    if (res.status.state === "failed") throw new Error(res.status.error);
    if (res.status.state === "done") return res.status.stems;
    await new Promise((r) => setTimeout(r, 4000));
  }
}

/** Downloads and decodes the given links one at a time (keeps memory low on phones). */
async function downloadAll(links: string[], what: string) {
  const blobs: Blob[] = [];
  const pcm: StereoPcm[] = [];
  let rate = 44100;
  for (let i = 0; i < links.length; i++) {
    stemJob.set({ busy: what, progress: i / links.length, since: null });
    const blob = await stemBlob(links[i]!);
    const d = await decodeBlob(blob);
    blobs.push(blob);
    pcm.push(d.pcm);
    rate = d.rate;
  }
  stemJob.set({ progress: null });
  return { blobs, pcm, rate };
}

/** Cleans bleed in the background; if that fails the parts are decoded again as the AI returned them. */
async function cleanParts(
  parts: StereoPcm[],
  strength: BleedStrength,
  blobs: Blob[],
  rivals: StereoPcm[] = [],
): Promise<StereoPcm[]> {
  if (strength === "off" || parts.length + rivals.length < 2) return parts;
  stemJob.set({ busy: "Cleaning bleed…", progress: 0, since: null });
  try {
    const { cleanBleedInBackground } = await import("@/lib/synclab/bleed-run");
    return await cleanBleedInBackground(parts, strength, rivals, (p) =>
      stemJob.set({ progress: p }),
    );
  } catch {
    toast("Bleed cleanup couldn't run on this device", {
      description: "You get the parts exactly as the AI returned them.",
    });
    const again: StereoPcm[] = [];
    for (const b of blobs) again.push((await decodeBlob(b)).pcm);
    return again;
  } finally {
    stemJob.set({ progress: null });
  }
}

const toResult = (
  id: string,
  label: string,
  pcm: StereoPcm,
  rate: number,
  blob?: Blob,
): StemResult => ({
  id,
  label,
  url: URL.createObjectURL(blob ?? encodeWav({ ...pcm, sampleRate: rate })),
  peaks: stereoPeaks(pcm),
  duration: pcm.left.length / rate,
  added: false,
});

const showError = (e: unknown, onDevice?: () => void) => {
  const msg = e instanceof Error ? e.message : "";
  const serviceDown = /credit|billing|402|busy|429|unavailable/i.test(msg);
  const description = /unauthor|401|jwt|session/i.test(msg)
    ? "Sign in to use AI stem separation."
    : serviceDown
      ? `${msg} Your AI use was given back. You can separate on this device for free instead.`
      : msg;
  toast.error("Couldn't separate this song", {
    ...(description ? { description } : {}),
    ...(serviceDown && onDevice
      ? { duration: 15000, action: { label: "Separate on this device", onClick: onDevice } }
      : {}),
  });
};

/** Runs (or continues) a saved job until every part is ready. */
async function execute(p: Pending, sourcePcm: StereoPcm | null) {
  const out: StemResult[] = [];
  const quality = p.quality;
  let drumsLink = p.drumsLink ?? null;
  let drumsBlob: Blob | null = null;

  if (p.splitId && quality) {
    stemJob.set({ busy: "Separating with AI…", progress: null, since: p.at });
    const stems = await waitFor(p.splitId);
    if (!stems) return "stopped" as const;
    // Bleed cleanup compares every part, so all of them are needed then.
    const need = new Set(
      p.cleanup !== "off" ? Object.keys(stems) : p.stemIds.flatMap((id) => partsFor(id, quality)),
    );
    if (p.pieces.length) need.add("drums");
    const names = [...need].filter((n) => stems[n]);
    const got = await downloadAll(
      names.map((n) => stems[n]!),
      "Downloading stems…",
    );
    drumsLink = stems["drums"] ?? null;
    if (p.pieces.length) {
      drumsBlob = got.blobs[names.indexOf("drums")] ?? null;
      savePending({ ...p, drumsLink });
    }
    const cleaned = await cleanParts(got.pcm, p.cleanup, got.blobs);
    const part: Record<string, StereoPcm> = {};
    names.forEach((n, i) => (part[n] = cleaned[i]!));
    for (const id of p.stemIds) {
      const use = partsFor(id, quality).filter((n) => part[n]);
      if (!use.length) continue;
      const label = AI_STEMS.find((s) => s.id === id)!.label;
      const single =
        use.length === 1 && p.cleanup === "off" ? got.blobs[names.indexOf(use[0]!)] : undefined;
      out.push(toResult(id, label, sumPcm(use.map((n) => part[n]!)), got.rate, single));
    }
    stemJob.set({ results: [...out] });
  }

  if (p.pieces.length) {
    let jobs = p.drumJobs;
    if (!jobs) {
      if (!drumsLink) throw new Error("The separator returned no drums to split.");
      stemJob.set({ busy: "Splitting the drums…", since: Date.now() });
      const started = await startDrumSplitFn({ data: { url: drumsLink, pieces: p.pieces } });
      announceAiUse();
      if (!started.ok) throw new Error(started.error);
      jobs = started.jobs;
      savePending({ ...p, drumsLink, drumJobs: jobs });
    }
    stemJob.set({ busy: "Splitting the drums…", since: state.since ?? Date.now() });
    const done = await Promise.all(jobs.map((j) => waitFor(j.id)));
    if (done.some((d) => !d)) return "stopped" as const;
    const links = jobs.map((_, i) => {
      const link = done[i]?.["target"];
      if (!link) throw new Error("The drum splitter returned nothing for one piece.");
      return link;
    });
    const got = await downloadAll(links, "Downloading drum pieces…");
    // What none of the pieces took (room, other drums) competes too, so it doesn't bleed in.
    let rivals: StereoPcm[] = [];
    if (p.cleanup !== "off") {
      let whole = sourcePcm;
      if (!whole && (drumsBlob || drumsLink))
        whole = (await decodeBlob(drumsBlob ?? (await stemBlob(drumsLink!)))).pcm;
      if (whole && whole.left.length) {
        const { leftover } = await import("@/lib/synclab/bleed-cleanup");
        rivals = [leftover(whole, got.pcm)];
      }
    }
    const cleaned = await cleanParts(got.pcm, p.cleanup, got.blobs, rivals);
    jobs.forEach((j, i) => {
      const label = DRUM_PIECES.find((d) => d.id === j.piece)?.label ?? j.piece;
      out.push(
        toResult(
          `drum-${j.piece}`,
          label,
          cleaned[i]!,
          got.rate,
          p.cleanup === "off" ? got.blobs[i] : undefined,
        ),
      );
    });
  }
  stemJob.set({ results: out });
  return out;
}

async function guarded(p: Pending, sourcePcm: StereoPcm | null, onDevice?: () => void) {
  running = true;
  cancelled = false;
  try {
    const out = await execute(p, sourcePcm);
    savePending(null);
    if (out === "stopped") toast("Separation stopped");
    else if (out.length)
      toast.success("Stems separated with AI", {
        description:
          "They're listed under the Separate button. Play each one, then add it to the timeline.",
      });
    else toast.error("The separator returned no stems");
  } catch (e) {
    savePending(null);
    showError(e, onDevice);
  } finally {
    running = false;
    stemJob.set({ busy: null, progress: null, since: null });
  }
}

export type AiPicks = {
  stemIds: AiStemId[];
  pieces: DrumPieceId[];
  cleanup: BleedStrength;
  drumsOnly: boolean;
};

/** Uploads the loaded song and runs the whole AI separation. */
export async function runAiJob(source: StemSource, picks: AiPicks, onDevice: () => void) {
  if (running) return;
  clearResults();
  running = true;
  cancelled = false;
  stemJob.set({
    busy: "Uploading…",
    progress: null,
    since: null,
    resultName: source.name,
    resultStart: source.start,
    songSeconds: source.buffer.duration,
    resumed: false,
  });
  const quality = picks.drumsOnly ? null : qualityFor(picks.stemIds);
  const base: Pending = {
    v: 1,
    at: Date.now(),
    name: source.name,
    start: source.start,
    seconds: source.buffer.duration,
    quality,
    ...picks,
  };
  let p: Pending;
  try {
    const audio = await toBase64(source.blob);
    const fileName = `${source.name}.${source.blob.type.includes("wav") ? "wav" : "mp3"}`;
    const mime = source.blob.type || "audio/mpeg";
    if (quality) {
      const started = await startStemSplitFn({ data: { audio, name: fileName, mime, quality } });
      announceAiUse();
      if (!started.ok) throw new Error(started.error);
      p = { ...base, at: Date.now(), splitId: started.id };
    } else {
      stemJob.set({ busy: "Splitting the drums…", since: Date.now() });
      const started = await startDrumSplitFn({
        data: { audio, name: fileName, mime, pieces: picks.pieces },
      });
      announceAiUse();
      if (!started.ok) throw new Error(started.error);
      p = { ...base, at: Date.now(), drumJobs: started.jobs };
    }
    savePending(p);
  } catch (e) {
    running = false;
    stemJob.set({ busy: null, progress: null, since: null });
    showError(e, onDevice);
    return;
  }
  await guarded(p, picks.drumsOnly ? pcmOf(source.buffer) : null, onDevice);
}

/** Picks up a job that was still running when the page reloaded. True when one was found. */
export function resumeSavedJob(): boolean {
  if (running) return false;
  const p = readPending();
  if (!p) {
    savePending(null);
    return false;
  }
  stemJob.set({
    resultName: p.name,
    resultStart: p.start,
    songSeconds: p.seconds,
    resumed: true,
  });
  toast("Picking up your separation", {
    description: `"${p.name}" was still being separated when the page reloaded.`,
  });
  void guarded(p, null);
  return true;
}
