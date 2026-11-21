import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Plus, Split, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { encodeWav } from "@/lib/synclab/bounce";
import {
  isStereo,
  MAX_STEM_SECONDS,
  peaksOf,
  separateStems,
  STEMS,
  type StemId,
} from "@/lib/synclab/stems";
import { retainMediaInBackground } from "@/lib/synclab/media-library";
import { GeneratedWaveform } from "./GeneratedWaveform";
import { useServerFn } from "@tanstack/react-start";
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
  type AiStemId,
  type DrumPieceId,
} from "@/lib/synclab/ai-stems";
import type { BleedStrength } from "@/lib/synclab/bleed-cleanup";
import type { StereoPcm } from "@/lib/synclab/stem-separation";
import { AiUsesLeft, announceAiUse } from "./AiUsesLeft";
import { decodeAudioFile } from "@/lib/synclab/aiff-decode";

const MAX_AI_BYTES = 40 * 1024 * 1024;
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
const pcmOf = (b: AudioBuffer): StereoPcm => ({
  left: b.getChannelData(0).slice(),
  right: (b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0)).slice(),
});
const sumPcm = (list: StereoPcm[]): StereoPcm => {
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
const stereoPeaks = ({ left, right }: StereoPcm) =>
  peaksOf(left, 512).map((v, i) =>
    Math.max(v, Math.abs(right[Math.floor((i * right.length) / 512)] ?? 0)),
  );
const CLEANUP: { id: BleedStrength; label: string; hint: string }[] = [
  { id: "off", label: "Off", hint: "Exactly what the AI returned." },
  { id: "light", label: "Light", hint: "Turns down sound that clearly belongs to another part." },
  {
    id: "strong",
    label: "Strong",
    hint: "Least bleed. Quiet tails and reverb can sound thinner.",
  },
];
const AI_DEFAULT: Record<AiStemId, boolean> = {
  vocals: true,
  drums: false,
  bass: false,
  guitar: false,
  piano: false,
  other: false,
  instrumental: false,
};

type Source = { name: string; buffer: AudioBuffer; start: number; blob: Blob };

export function StemSplitter() {
  const skin = useSkin("stemsplit");
  const skinDrop = useImageDrop("stemsplit");
  const skinned = !!(skin.image || skin.color);
  const { tracks, addTrack, addClip } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [picked, setPicked] = useState<Record<StemId, boolean>>({
    vocals: true,
    drums: false,
    bass: false,
    music: false,
    instrumental: false,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [mode, setMode] = useState<"ai" | "device">("ai");
  const [aiPicked, setAiPicked] = useState<Record<AiStemId, boolean>>(AI_DEFAULT);
  const [drumPicked, setDrumPicked] = useState<Partial<Record<DrumPieceId, boolean>>>({});
  const [drumsOnly, setDrumsOnly] = useState(false);
  const [cleanup, setCleanup] = useState<BleedStrength>("light");
  const startDrums = useServerFn(startDrumSplitFn);
  const startAi = useServerFn(startStemSplitFn);
  const checkAi = useServerFn(checkStemSplitFn);
  const fetchAi = useServerFn(fetchStemFn);
  const cancelAi = useServerFn(cancelStemSplitFn);
  const cancelRef = useRef(false);

  const clips = useMemo(
    () =>
      tracks.flatMap((t) =>
        (t.clips ?? []).filter((c) => c.url).map((c) => ({ track: t.name, clip: c })),
      ),
    [tracks],
  );

  const decode = async (data: ArrayBuffer) => {
    const ctx = new AudioContext();
    try {
      return await decodeAudioFile(ctx, data);
    } finally {
      void ctx.close();
    }
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    retainMediaInBackground(file, file.name);
    setBusy("Reading file…");
    try {
      setSource({
        name: file.name.replace(/\.[^.]+$/, ""),
        buffer: await decode(await file.arrayBuffer()),
        start: 0,
        blob: file,
      });
    } catch {
      toast.error("Couldn't read that audio file");
    } finally {
      setBusy(null);
    }
  };

  const loadClip = async (idx: number) => {
    const item = clips[idx];
    if (!item?.clip.url) return;
    setBusy("Reading clip…");
    try {
      const blob = await (await fetch(item.clip.url)).blob();
      const buf = await decode(await blob.arrayBuffer());
      setSource({ name: item.clip.name, buffer: buf, start: item.clip.start ?? 0, blob });
    } catch {
      toast.error("Couldn't read that clip");
    } finally {
      setBusy(null);
    }
  };

  type Result = {
    id: string;
    label: string;
    url: string;
    peaks: number[];
    duration: number;
    added: boolean;
  };
  const [results, setResults] = useState<Result[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  };
  useEffect(() => () => stopAudio(), []);

  const run = async (useMode: "ai" | "device" = mode) => {
    if (!source) return;
    if (useMode === "ai") {
      if (source.buffer.duration > MAX_STEM_SECONDS) {
        toast("Song too long", { description: "Separate up to 6 minutes at a time." });
        return;
      }
      await runAi();
      return;
    }
    const ids = STEMS.filter((s) => picked[s.id]).map((s) => s.id);
    if (!ids.length) {
      toast("Pick at least one stem");
      return;
    }
    if (source.buffer.duration > MAX_STEM_SECONDS) {
      toast("Song too long", { description: "Separate up to 6 minutes at a time." });
      return;
    }
    if (!isStereo(source.buffer) && (picked.vocals || picked.instrumental)) {
      toast("This audio is mono", {
        description:
          "Vocals are found by their centre position in a stereo mix, so a mono file will leave them mixed with other sounds.",
      });
    }
    stopAudio();
    results.forEach((r) => {
      if (!r.added) URL.revokeObjectURL(r.url);
    });
    setResults([]);
    setBusy("Separating…");
    setProgress(0);
    try {
      const parts = await separateStems(source.buffer, ids, (p) => setProgress(p));
      const sr = source.buffer.sampleRate;
      const out: Result[] = [];
      for (const id of ids) {
        const part = parts[id];
        if (!part) continue;
        const label = STEMS.find((s) => s.id === id)!.label;
        const { left, right } = part;
        const peaks = peaksOf(left, 512).map((v, i) =>
          Math.max(v, Math.abs(right[Math.floor((i * right.length) / 512)] ?? 0)),
        );
        out.push({
          id,
          label,
          url: URL.createObjectURL(encodeWav({ left, right, sampleRate: sr })),
          peaks,
          duration: left.length / sr,
          added: false,
        });
      }
      setResults(out);
      if (out.length)
        toast.success("Stems separated", {
          description: "Play each one, then add the ones you want to the timeline.",
        });
    } catch (e) {
      toast.error("Couldn't separate this song", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  /** Waits for one AI job; null when you pressed Stop. */
  const waitFor = async (id: string) => {
    const deadline = Date.now() + 15 * 60_000;
    for (;;) {
      await new Promise((r) => setTimeout(r, 4000));
      if (cancelRef.current) {
        void cancelAi({ data: { id } }).catch(() => {});
        return null;
      }
      if (Date.now() > deadline) {
        void cancelAi({ data: { id } }).catch(() => {});
        throw new Error(
          "The separator took longer than 15 minutes, so it was stopped. Try a shorter song or an MP3.",
        );
      }
      const res = await checkAi({ data: { id } });
      if (!res.ok) throw new Error(res.error);
      if (res.status.state === "failed") throw new Error(res.status.error);
      if (res.status.state === "done") return res.status.stems;
    }
  };
  const download = async (url: string) => {
    const got = await fetchAi({ data: { url } });
    if (!got.ok) throw new Error(got.error);
    const blob = fromBase64(got.mp3, "audio/mpeg");
    const buffer = await decode(await blob.arrayBuffer());
    return { blob, pcm: pcmOf(buffer), rate: buffer.sampleRate };
  };
  /** Cleans bleed in the background; if that fails the parts are kept as the AI returned them. */
  const cleanParts = async (parts: StereoPcm[], rivals: StereoPcm[] = []) => {
    if (cleanup === "off") return parts;
    setBusy("Cleaning bleed…");
    setProgress(0);
    try {
      const { cleanBleedInBackground } = await import("@/lib/synclab/bleed-run");
      return await cleanBleedInBackground(parts, cleanup, rivals, setProgress);
    } catch {
      toast("Bleed cleanup couldn't run on this device", {
        description: "You get the parts exactly as the AI returned them.",
      });
      return parts;
    } finally {
      setProgress(null);
    }
  };

  const runAi = async () => {
    if (!source) return;
    const stemIds = AI_STEMS.filter((s) => aiPicked[s.id]).map((s) => s.id);
    const pieces = DRUM_PIECES.filter((p) => drumPicked[p.id]).map((p) => p.id);
    if (drumsOnly ? !pieces.length : !stemIds.length && !pieces.length) {
      toast(drumsOnly ? "Pick at least one drum piece" : "Pick at least one part");
      return;
    }
    if (source.blob.size > MAX_AI_BYTES) {
      toast("File too large for AI separation", {
        description: "Use a file under 40 MB (an MP3 works best), or switch to On-device.",
      });
      return;
    }
    stopAudio();
    results.forEach((r) => {
      if (!r.added) URL.revokeObjectURL(r.url);
    });
    setResults([]);
    cancelRef.current = false;
    setProgress(null);
    const sr = { rate: source.buffer.sampleRate };
    const toResult = (id: string, label: string, pcm: StereoPcm, blob?: Blob): Result => ({
      id,
      label,
      url: URL.createObjectURL(blob ?? encodeWav({ ...pcm, sampleRate: sr.rate })),
      peaks: stereoPeaks(pcm),
      duration: pcm.left.length / sr.rate,
      added: false,
    });
    const stopped = () => {
      toast("Separation stopped");
    };
    try {
      setBusy("Uploading…");
      const audio = await toBase64(source.blob);
      const fileName = `${source.name}.${source.blob.type.includes("wav") ? "wav" : "mp3"}`;
      const mime = source.blob.type || "audio/mpeg";
      const out: Result[] = [];
      let drumsLink: string | null = null;
      let drumsWhole: StereoPcm | null = drumsOnly ? pcmOf(source.buffer) : null;

      if (!drumsOnly) {
        const quality = qualityFor(stemIds);
        const started = await startAi({ data: { audio, name: fileName, mime, quality } });
        announceAiUse();
        if (!started.ok) throw new Error(started.error);
        setBusy("Separating with AI…");
        const stems = await waitFor(started.id);
        if (!stems) return stopped();
        setBusy("Downloading stems…");
        // Bleed cleanup compares every part, so all of them are needed then.
        const need = new Set(
          cleanup !== "off" ? Object.keys(stems) : stemIds.flatMap((id) => partsFor(id, quality)),
        );
        if (pieces.length) need.add("drums");
        const names = [...need].filter((n) => stems[n]);
        const got = await Promise.all(names.map((n) => download(stems[n]!)));
        const raw: Record<string, { blob: Blob; pcm: StereoPcm }> = {};
        names.forEach((n, i) => (raw[n] = got[i]!));
        if (got[0]) sr.rate = got[0].rate;
        drumsLink = stems["drums"] ?? null;
        drumsWhole = raw["drums"]?.pcm ?? null;
        const cleaned = await cleanParts(names.map((n) => raw[n]!.pcm));
        const part: Record<string, StereoPcm> = {};
        names.forEach((n, i) => (part[n] = cleaned[i]!));
        for (const id of stemIds) {
          const use = partsFor(id, quality).filter((n) => part[n]);
          if (!use.length) continue;
          const label = AI_STEMS.find((s) => s.id === id)!.label;
          const single = use.length === 1 && cleanup === "off" ? raw[use[0]!]?.blob : undefined;
          out.push(toResult(id, label, sumPcm(use.map((n) => part[n]!)), single));
        }
        setResults([...out]);
      }

      if (pieces.length) {
        if (!drumsOnly && !drumsLink) throw new Error("The separator returned no drums to split.");
        setBusy("Splitting the drums…");
        const started = await startDrums({
          data: drumsOnly ? { audio, name: fileName, mime, pieces } : { url: drumsLink!, pieces },
        });
        announceAiUse();
        if (!started.ok) throw new Error(started.error);
        const done = await Promise.all(started.jobs.map((j) => waitFor(j.id)));
        if (done.some((d) => !d)) return stopped();
        setBusy("Downloading drum pieces…");
        const got = await Promise.all(
          started.jobs.map((j, i) => {
            const link = done[i]?.["target"];
            if (!link) throw new Error("The drum splitter returned nothing for one piece.");
            return download(link);
          }),
        );
        if (drumsOnly && got[0]) sr.rate = got[0].rate;
        const piecePcm = got.map((g) => g.pcm);
        // What none of the pieces took (room, other drums) competes too, so it doesn't bleed in.
        const { leftover } = await import("@/lib/synclab/bleed-cleanup");
        const rivals = drumsWhole && drumsWhole.left.length ? [leftover(drumsWhole, piecePcm)] : [];
        const cleaned = await cleanParts(piecePcm, rivals);
        started.jobs.forEach((j, i) => {
          const label = DRUM_PIECES.find((p) => p.id === j.piece)?.label ?? j.piece;
          out.push(
            toResult(
              `drum-${j.piece}`,
              label,
              cleaned[i]!,
              cleanup === "off" ? got[i]!.blob : undefined,
            ),
          );
        });
      }

      setResults(out);
      if (out.length)
        toast.success("Stems separated with AI", {
          description: "Play each one, then add the ones you want to the timeline.",
        });
      else toast.error("The separator returned no stems");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const serviceDown = /credit|billing|402|busy|429|unavailable/i.test(msg);
      const description = /unauthor|401|jwt|session/i.test(msg)
        ? "Sign in to use AI stem separation."
        : serviceDown
          ? `${msg} Your AI use was given back. You can separate on this device for free instead.`
          : msg;
      toast.error("Couldn't separate this song", {
        ...(description ? { description } : {}),
        ...(serviceDown
          ? {
              duration: 15000,
              action: {
                label: "Separate on this device",
                onClick: () => {
                  setMode("device");
                  void run("device");
                },
              },
            }
          : {}),
      });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const togglePlay = (r: Result) => {
    if (playingId === r.id) {
      stopAudio();
      return;
    }
    stopAudio();
    const a = new Audio(r.url);
    a.onended = () => setPlayingId(null);
    audioRef.current = a;
    setPlayingId(r.id);
    void a.play().catch(() => {
      setPlayingId(null);
      toast.error("Couldn't play this stem");
    });
  };

  const addToTimeline = (r: Result) => {
    if (!source || r.added) return;
    const trackId = addTrack(
      "audio",
      `${r.label.toUpperCase()} · ${source.name}`.slice(0, 40),
      undefined,
      { keepPanel: true },
    );
    addClip(trackId, {
      id: `stem-${r.id}-${Date.now()}`,
      name: `${source.name} (${r.label})`,
      url: r.url,
      peaks: r.peaks,
      duration: r.duration,
      start: source.start,
      offset: 0,
      length: r.duration,
    });
    setResults((rs) => rs.map((x) => (x.id === r.id ? { ...x, added: true } : x)));
    toast.success(`${r.label} added to the timeline`);
  };

  return (
    <section
      className={`space-y-4 rounded-md border border-border bg-surface-1 p-4${skinned ? " studio-wallpaper" : ""}`}
      data-skin-panel="stemsplit"
      style={skinBackground(skin)}
      {...skinDrop}
    >
      <SkinControls skinKey="stemsplit" image />
      <header>
        <h2 className="font-mono text-sm font-bold tracking-[0.18em]">SEPARATE STEMS</h2>
        <p className="text-xs text-muted-foreground">
          {mode === "ai"
            ? "AI separation splits a song into Vocals, Drums, Bass, Guitar, Piano and Other instruments, and can split the drums into kick, snare, hi-hat, toms, crash, ride and percussion. Bleed cleanup then turns down sound that leaked into the wrong part. Your song is uploaded to Replicate for processing, which costs a few cents per song on the connected Replicate account. A 3-minute song takes about 2–5 minutes. No separator can promise zero bleed from a finished mix: loud parts can leave a faint trace, and sounds that share the same notes and moment are the hardest to pull apart."
            : "On-device separation analyses the sound spectrum: hits go to Drums, centre sounds in the voice range go to Vocals, low notes go to Bass. Free and private, but expect bleed between parts."}
        </p>
        {mode === "ai" && <AiUsesLeft />}
      </header>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Separation method">
        {(
          [
            ["ai", "AI — clean stems"],
            ["device", "On-device — free"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            role="radio"
            aria-checked={mode === id}
            variant={mode === id ? "default" : "outline"}
            className="min-h-11"
            disabled={!!busy}
            onClick={() => setMode(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="min-h-12"
          onClick={() => inputRef.current?.click()}
          disabled={!!busy}
        >
          <Upload className="size-4" /> Load a song
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => void loadFile(e.target.files?.[0])}
        />
        {clips.length > 0 && (
          <select
            className="min-h-12 max-w-full rounded-md border border-border bg-surface-2 px-3 text-sm"
            defaultValue=""
            disabled={!!busy}
            onChange={(e) => e.target.value !== "" && void loadClip(Number(e.target.value))}
            aria-label="Use a clip from the timeline"
          >
            <option value="" disabled>
              …or use a timeline clip
            </option>
            {clips.map((c, i) => (
              <option key={c.clip.id} value={i}>
                {c.track} — {c.clip.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {source && (
        <p className="font-mono text-xs text-primary">
          {source.name} · {source.buffer.duration.toFixed(1)}s ·{" "}
          {isStereo(source.buffer) ? "stereo" : "mono"}
        </p>
      )}

      {mode === "ai" ? (
        <>
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border p-3">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={drumsOnly}
              disabled={!!busy}
              onChange={(e) => setDrumsOnly(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">My file is only drums</span>
              <span className="block text-xs text-muted-foreground">
                Skip the song split and go straight to splitting the kit into pieces.
              </span>
            </span>
          </label>

          {!drumsOnly && (
            <>
              <div className="flex flex-wrap items-center gap-2" aria-label="Get just one part">
                <span className="font-mono text-xs font-bold tracking-widest text-muted-foreground">
                  JUST ONE:
                </span>
                {AI_STEMS.map((s) => {
                  const only = AI_STEMS.every((o) => aiPicked[o.id] === (o.id === s.id));
                  return (
                    <Button
                      key={s.id}
                      size="sm"
                      className="min-h-11"
                      variant={only ? "default" : "outline"}
                      aria-pressed={only}
                      disabled={!!busy}
                      onClick={() =>
                        setAiPicked({
                          ...Object.fromEntries(AI_STEMS.map((o) => [o.id, false])),
                          [s.id]: true,
                        } as Record<AiStemId, boolean>)
                      }
                    >
                      Just {s.id === "instrumental" ? "the instrumental" : s.label.toLowerCase()}
                    </Button>
                  );
                })}
              </div>
              <div className="grid gap-2 sm:grid-cols-2" aria-label="Parts to separate">
                {AI_STEMS.map((s) => (
                  <label
                    key={s.id}
                    className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-md border p-3 ${aiPicked[s.id] ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      checked={aiPicked[s.id]}
                      disabled={!!busy}
                      onChange={(e) => setAiPicked((p) => ({ ...p, [s.id]: e.target.checked }))}
                    />
                    <span>
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">{s.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          <fieldset className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 font-mono text-xs font-bold tracking-widest text-muted-foreground">
              SPLIT THE DRUMS INTO PIECES
            </legend>
            <div className="flex flex-wrap gap-2">
              {DRUM_PIECES.map((d) => (
                <Button
                  key={d.id}
                  size="sm"
                  className="min-h-11"
                  variant={drumPicked[d.id] ? "default" : "outline"}
                  aria-pressed={!!drumPicked[d.id]}
                  disabled={!!busy}
                  onClick={() => setDrumPicked((p) => ({ ...p, [d.id]: !p[d.id] }))}
                >
                  {d.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11"
                disabled={!!busy}
                onClick={() =>
                  setDrumPicked(
                    DRUM_PIECES.every((d) => drumPicked[d.id])
                      ? {}
                      : Object.fromEntries(DRUM_PIECES.map((d) => [d.id, true])),
                  )
                }
              >
                {DRUM_PIECES.every((d) => drumPicked[d.id]) ? "None" : "All pieces"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Each piece is pulled out of the drums by its own AI pass, so every piece you pick adds
              time (about a minute each, run side by side). The whole kit split counts as one AI
              use.
            </p>
          </fieldset>

          <div className="space-y-1">
            <div
              className="flex flex-wrap items-center gap-2"
              role="radiogroup"
              aria-label="Bleed cleanup"
            >
              <span className="font-mono text-xs font-bold tracking-widest text-muted-foreground">
                BLEED CLEANUP:
              </span>
              {CLEANUP.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  role="radio"
                  aria-checked={cleanup === c.id}
                  className="min-h-11"
                  variant={cleanup === c.id ? "default" : "outline"}
                  disabled={!!busy}
                  onClick={() => setCleanup(c.id)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {CLEANUP.find((c) => c.id === cleanup)!.hint} Runs on this device after the AI is
              done.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" aria-label="Get just one part">
            <span className="font-mono text-xs font-bold tracking-widest text-muted-foreground">
              JUST ONE:
            </span>
            {STEMS.map((s) => {
              const only = STEMS.every((o) => picked[o.id] === (o.id === s.id));
              return (
                <Button
                  key={s.id}
                  size="sm"
                  className="min-h-11"
                  variant={only ? "default" : "outline"}
                  aria-pressed={only}
                  disabled={!!busy}
                  onClick={() =>
                    setPicked({
                      vocals: false,
                      drums: false,
                      bass: false,
                      music: false,
                      instrumental: false,
                      [s.id]: true,
                    })
                  }
                >
                  Just {s.id === "instrumental" ? "the instrumental" : s.label.toLowerCase()}
                </Button>
              );
            })}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {STEMS.map((s) => (
              <label
                key={s.id}
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-md border p-3 ${picked[s.id] ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  checked={picked[s.id]}
                  onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.checked }))}
                />
                <span>
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      <Button
        size="lg"
        className="min-h-12"
        disabled={!source || !!busy}
        onClick={() => void run()}
      >
        <Split className="size-4" />{" "}
        {busy ? `${busy}${progress !== null ? ` ${Math.round(progress * 100)}%` : ""}` : "Separate"}
      </Button>
      {(busy?.startsWith("Separating with AI") || busy?.startsWith("Splitting the drums")) && (
        <Button
          variant="outline"
          className="ml-2 min-h-12"
          onClick={() => {
            cancelRef.current = true;
          }}
        >
          Stop
        </Button>
      )}
      {progress !== null && (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Separation progress"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2" aria-label="Separated stems">
          {results.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2 p-2"
            >
              <GeneratedWaveform peaks={r.peaks} label={`${r.label} waveform`} />
              <span className="min-w-24 flex-1 text-sm font-medium">
                {r.label}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {r.duration.toFixed(1)}s
                </span>
              </span>
              <Button
                variant="secondary"
                className="min-h-11"
                onClick={() => togglePlay(r)}
                aria-label={`${playingId === r.id ? "Stop" : "Play"} ${r.label}`}
              >
                {playingId === r.id ? (
                  <Square className="size-4 fill-current" />
                ) : (
                  <Play className="size-4" />
                )}{" "}
                {playingId === r.id ? "Stop" : "Play"}
              </Button>
              <Button
                className="min-h-11"
                disabled={r.added}
                onClick={() => addToTimeline(r)}
                aria-label={`Add ${r.label} to timeline`}
              >
                <Plus className="size-4" /> {r.added ? "Added" : "Add to timeline"}
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            className="min-h-11"
            disabled={results.every((r) => r.added)}
            onClick={() => results.forEach(addToTimeline)}
          >
            Add all to timeline
          </Button>
        </div>
      )}
    </section>
  );
}
