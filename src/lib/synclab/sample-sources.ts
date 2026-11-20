/**
 * Where a sampler recording comes from — Koala-style "sample anything":
 *  - mic:    the chosen microphone / audio interface (shared mic.ts ownership)
 *  - system: sound playing on the computer (YouTube, Spotify, another app), shared through the
 *            browser's screen-share picker. Chrome/Edge on a computer only; phones never allow it.
 *  - studio: SYNCLAB's own main mix (resampling), works everywhere including phones.
 *
 * Computer sound stays connected until the user disconnects or presses the browser's
 * "Stop sharing", so hold-to-record can start instantly without reopening the picker.
 * Captured sound is never routed to the speakers (no doubled playback or feedback).
 */
import { useSyncExternalStore } from "react";
import { isAppleMobile, openMic, preferredRecordingMime, releaseMic } from "./mic";
import { getEngine } from "./audio-engine";

export type SampleSource = "mic" | "system" | "studio";

export const SOURCE_LABEL: Record<SampleSource, string> = {
  mic: "Mic",
  system: "Computer sound",
  studio: "SYNCLAB sound",
};

export type SystemEnv = {
  hasDisplayMedia: boolean;
  apple: boolean;
  android: boolean;
  touchOnly: boolean;
  framed: boolean;
};

export type Support = { ok: true; tip: string } | { ok: false; reason: string };

/** Pure: can this device record other apps' sound, and what should the user tick in the picker? */
export function systemAudioSupport(env: SystemEnv, platform = ""): Support {
  if (env.apple)
    return {
      ok: false,
      reason:
        "iPhone and iPad don't let any website or web app hear other apps. Use SYNCLAB sound, or screen-record with Control Centre and load that recording here.",
    };
  if (env.android)
    return {
      ok: false,
      reason:
        "Android doesn't let websites hear other apps. Use SYNCLAB sound, or use Android's screen recorder with device audio and load that recording here.",
    };
  if (!env.hasDisplayMedia || env.touchOnly)
    return {
      ok: false,
      reason: "This browser can't share computer sound. Use Chrome or Edge on a computer.",
    };
  const mac = /Mac/i.test(platform);
  return {
    ok: true,
    tip: mac
      ? 'In the picker choose a Chrome tab and keep "Also share tab audio" on. Whole-computer sound on a Mac needs macOS 14.2 or newer with a recent Chrome.'
      : 'In the picker choose Entire screen and tick "Also share system audio" — or choose a tab and keep "Also share tab audio" on.',
  };
}

function currentEnv(): SystemEnv {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const md = nav?.mediaDevices as (MediaDevices & { getDisplayMedia?: unknown }) | undefined;
  let framed = false;
  try {
    framed = typeof window !== "undefined" && window.self !== window.top;
  } catch {
    framed = true;
  }
  return {
    hasDisplayMedia: typeof md?.getDisplayMedia === "function",
    apple: isAppleMobile(),
    android: !!nav && /Android/i.test(nav.userAgent),
    touchOnly:
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(pointer: coarse)").matches &&
      !window.matchMedia?.("(any-pointer: fine)").matches,
    framed,
  };
}

export function deviceSystemSupport(): Support {
  return systemAudioSupport(
    currentEnv(),
    typeof navigator !== "undefined" ? navigator.platform || navigator.userAgent : "",
  );
}

/* ---------------- shared state: chosen source + connected computer sound ---------------- */

const SOURCE_KEY = "synclab.sampler.source";
let source = "mic" as SampleSource;
let sourceLoaded = false;
let system: { display: MediaStream; audio: MediaStream; label: string } | null = null;
const listeners = new Set<() => void>();
let snapshot: { source: SampleSource; connected: boolean; label: string } = {
  source,
  connected: false,
  label: "",
};
const emit = () => {
  snapshot = { source, connected: !!system, label: system?.label ?? "" };
  listeners.forEach((l) => l());
};

function loadSource() {
  if (sourceLoaded) return;
  sourceLoaded = true;
  try {
    const v = localStorage.getItem(SOURCE_KEY);
    if (v === "mic" || v === "system" || v === "studio") source = v;
  } catch {
    /* storage blocked */
  }
  snapshot = { source, connected: !!system, label: system?.label ?? "" };
}

export function setSampleSource(next: SampleSource) {
  source = next;
  try {
    localStorage.setItem(SOURCE_KEY, next);
  } catch {
    /* storage blocked */
  }
  emit();
}

const SERVER_SNAPSHOT = { source: "mic" as SampleSource, connected: false, label: "" };
export function useSampleSource() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      loadSource();
      return snapshot;
    },
    () => SERVER_SNAPSHOT,
  );
}

export function systemConnected() {
  return !!system?.audio.active;
}

export function disconnectSystemAudio() {
  if (!system) return;
  system.display.getTracks().forEach((t) => t.stop());
  system = null;
  emit();
}

function describeShareError(err: unknown, framed: boolean): string {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return framed
      ? "Sharing was cancelled or this preview window isn't allowed to share. Open SYNCLAB in its own tab and try again."
      : "Sharing was cancelled. Press Connect again and choose what to share.";
  if (name === "NotSupportedError" || name === "TypeError")
    return "This browser can't share computer sound. Use Chrome or Edge on a computer.";
  return (err as { message?: string })?.message || "Computer sound couldn't be shared.";
}

/** Opens the browser's share picker. Must be called straight from a click. */
export async function connectSystemAudio(): Promise<
  { ok: true; label: string } | { ok: false; error: string; canOpenTab: boolean }
> {
  const support = deviceSystemSupport();
  if (!support.ok) return { ok: false, error: support.reason, canOpenTab: false };
  if (systemConnected() && system) return { ok: true, label: system.label };
  const env = currentEnv();
  const md = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia: (o: unknown) => Promise<MediaStream>;
  };
  let display: MediaStream;
  try {
    display = await md.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: false,
      },
      systemAudio: "include",
      windowAudio: "system",
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
    });
  } catch (err) {
    return { ok: false, error: describeShareError(err, env.framed), canOpenTab: env.framed };
  }
  const audioTracks = display.getAudioTracks();
  if (!audioTracks.length) {
    display.getTracks().forEach((t) => t.stop());
    const tip = support.tip;
    return { ok: false, error: `No sound was shared. ${tip}`, canOpenTab: false };
  }
  // The picture isn't used: drop it to one frame a second so sharing costs almost nothing.
  for (const v of display.getVideoTracks()) {
    v.enabled = false;
    void v.applyConstraints?.({ frameRate: 1 }).catch(() => {});
  }
  const audio = new MediaStream(audioTracks);
  const surface = (
    display.getVideoTracks()[0]?.getSettings() as { displaySurface?: string } | undefined
  )?.displaySurface;
  const label =
    surface === "monitor"
      ? "Entire screen"
      : surface === "browser"
        ? "Browser tab"
        : surface === "window"
          ? "App window"
          : "Computer sound";
  system = { display, audio, label };
  const lost = () => {
    if (system?.display === display) {
      system = null;
      emit();
    }
  };
  audioTracks.forEach((t) => t.addEventListener("ended", lost, { once: true }));
  display.getVideoTracks().forEach((t) =>
    t.addEventListener(
      "ended",
      () => {
        display.getTracks().forEach((x) => x.stop());
        lost();
      },
      { once: true },
    ),
  );
  emit();
  return { ok: true, label };
}

/* ---------------- opening a source for one recording ---------------- */

export type OpenedSource = { stream: MediaStream; release: () => void };
export type SourceError = { error: string; canOpenTab: boolean };

/** Opens the chosen source. Computer sound must be connected first (or this call must come from a click). */
export async function openSampleSource(
  which: SampleSource,
  owner: string,
): Promise<OpenedSource | SourceError> {
  if (which === "mic") {
    const res = await openMic(undefined, owner);
    if ("error" in res) return res;
    return { stream: res.stream, release: () => releaseMic(res.stream) };
  }
  if (which === "system") {
    if (!systemConnected()) {
      const c = await connectSystemAudio();
      if (!c.ok) return { error: c.error, canOpenTab: c.canOpenTab };
    }
    // Recording borrows the shared connection; the connection stays open for the next take.
    return { stream: system!.audio, release: () => {} };
  }
  const engine = getEngine();
  const ctx = engine.init();
  void ctx.resume?.();
  const tap = engine.songTap;
  if (!tap)
    return {
      error: "SYNCLAB's sound isn't running yet. Press Play once, then try again.",
      canOpenTab: false,
    };
  const dest = ctx.createMediaStreamDestination();
  tap.connect(dest);
  return {
    stream: dest.stream,
    release: () => {
      try {
        tap.disconnect(dest);
      } catch {
        /* already detached */
      }
      dest.stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/** Records a stream at high quality until stop() resolves with the take. */
export function recordStream(stream: MediaStream): { stop: () => Promise<Blob>; mimeType: string } {
  const mimeType = preferredRecordingMime();
  const rec = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: 256000,
  });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  rec.start(200);
  return {
    mimeType: rec.mimeType || mimeType || "audio/webm",
    stop: () =>
      new Promise<Blob>((resolve) => {
        if (rec.state === "inactive")
          return resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        rec.stop();
      }),
  };
}

/** File extension that matches what MediaRecorder produced. */
export function recordingExt(mime: string) {
  return /mp4/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : "webm";
}
