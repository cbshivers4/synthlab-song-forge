/**
 * One place for microphone access, so every part of SYNCLAB fails the same
 * honest way instead of silently doing nothing.
 */

export type MicResult = { stream: MediaStream } | { error: string; canOpenTab: boolean };

let activeStream: MediaStream | null = null;
let activeOwner: string | null = null;
let requestGeneration = 0;

/** Release a stream only if it still owns the shared hardware input. */
export function releaseMic(stream: MediaStream | null | undefined) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  if (activeStream === stream) {
    activeStream = null;
    activeOwner = null;
  }
}

function inFrame() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** The preview is embedded; embedded pages only get the mic if the frame allows it. */
export function micBlockedByFrame(): boolean {
  if (typeof document === "undefined" || !inFrame()) return false;
  const fp = (document as unknown as { featurePolicy?: { allowsFeature(f: string): boolean } }).featurePolicy;
  if (fp?.allowsFeature) {
    try {
      return !fp.allowsFeature("microphone");
    } catch {
      /* unsupported */
    }
  }
  return false;
}

export function micUnavailableReason(): string | null {
  if (typeof navigator === "undefined") return "Audio input is not available here.";
  if (typeof window !== "undefined" && !window.isSecureContext)
    return "Your browser only allows recording on secure (https) pages.";
  if (!navigator.mediaDevices?.getUserMedia)
    return "This browser cannot open a microphone. Use Chrome, Edge or Safari.";
  if (micBlockedByFrame())
    return "The preview window is not allowed to use your microphone. Open the app in its own tab and try again.";
  return null;
}

function describe(err: unknown): string {
  const e = err as { name?: string; message?: string };
  switch (e?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return inFrame()
        ? "Microphone access was blocked. Open the app in its own browser tab, then choose Allow when asked."
        : "Microphone access was blocked. Click the padlock in the address bar and allow the microphone for this site.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone or audio interface was found. Plug one in, then try again.";
    case "NotReadableError":
      return "Another app is using your microphone or interface. Close it and try again.";
    default:
      return e?.message ? `Microphone error: ${e.message}` : "The microphone could not be opened.";
  }
}

/* ---------------- chosen input device (audio interface support) ---------------- */

const INPUT_KEY = "synclab.input.device";

export type AudioDeviceInfo = { id: string; label: string; kind: "audioinput" | "audiooutput" };

/** deviceId of the input the user picked (e.g. a Volt 1), or null for the system default. */
export function getPreferredInput(): string | null {
  try {
    return localStorage.getItem(INPUT_KEY) || null;
  } catch {
    return null;
  }
}

export function setPreferredInput(deviceId: string | null) {
  try {
    if (deviceId) localStorage.setItem(INPUT_KEY, deviceId);
    else localStorage.removeItem(INPUT_KEY);
  } catch {
    /* storage blocked */
  }
}

/* ---------------- input channel, gain and output routing ---------------- */

export type InputChannel = "stereo" | "in1" | "in2";
const CH_KEY = "synclab.input.channel";
const GAIN_KEY = "synclab.input.gainDb";
const OUT_KEY = "synclab.output.device";

const readLs = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLs = (k: string, v: string | null) => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* blocked */ }
};

export function getInputChannel(): InputChannel {
  const v = readLs(CH_KEY);
  return v === "in1" || v === "in2" ? v : "stereo";
}
export function setInputChannel(c: InputChannel) { writeLs(CH_KEY, c); }
export function getInputGainDb(): number {
  const n = Number(readLs(GAIN_KEY));
  return Number.isFinite(n) ? Math.max(-24, Math.min(24, n)) : 0;
}
export function setInputGainDb(db: number) { writeLs(GAIN_KEY, String(db)); }
export function getOutputDevice(): string | null { return readLs(OUT_KEY) || null; }
export function setOutputDevice(id: string | null) { writeLs(OUT_KEY, id); }

/** List audio inputs and outputs. Names only appear once microphone access is allowed. */
export async function listAudioDevices(): Promise<AudioDeviceInfo[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    return list
      .filter((d) => d.kind === "audioinput" || d.kind === "audiooutput")
      .map((d, i) => ({
        id: d.deviceId,
        label: d.label || (d.kind === "audioinput" ? `Input ${i + 1}` : `Output ${i + 1}`),
        kind: d.kind as "audioinput" | "audiooutput",
      }))
      .filter((d) => d.id !== "");
  } catch {
    return [];
  }
}

/** Re-run when hardware is plugged in or removed. */
export function onDeviceChange(cb: () => void): () => void {
  const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  if (!md?.addEventListener) return () => {};
  md.addEventListener("devicechange", cb);
  return () => md.removeEventListener("devicechange", cb);
}

export async function openMic(constraints?: MediaTrackConstraints, owner = "shared"): Promise<MicResult> {
  const blocked = micUnavailableReason();
  if (blocked) return { error: blocked, canOpenTab: inFrame() };
  const base: MediaTrackConstraints = constraints ?? {};
  const wanted = getPreferredInput();
  if (activeStream?.active) {
    if (activeOwner === owner) return { stream: activeStream };
    return { error: "The audio input is already in use by another SYNCLAB recording tool. Stop it first, then try again.", canOpenTab: false };
  }
  const generation = ++requestGeneration;
  try {
    const audio: MediaTrackConstraints = wanted ? { ...base, deviceId: { exact: wanted } } : base;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: Object.keys(audio).length ? audio : true,
    });
    if (generation !== requestGeneration) {
      releaseMic(stream);
      return { error: "Another recording tool took control of the audio input.", canOpenTab: false };
    }
    activeStream = stream;
    activeOwner = owner;
    stream.getAudioTracks()[0]?.addEventListener("ended", () => {
      if (activeStream === stream) {
        activeStream = null;
        activeOwner = null;
      }
    }, { once: true });
    return { stream };
  } catch (err) {
    const name = (err as { name?: string })?.name;
    // The chosen interface went away — fall back to the default input instead of failing.
    if (wanted && (name === "OverconstrainedError" || name === "NotFoundError")) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: Object.keys(base).length ? base : true,
        });
        if (generation !== requestGeneration) {
          releaseMic(stream);
          return { error: "Another recording tool took control of the audio input.", canOpenTab: false };
        }
        activeStream = stream;
        activeOwner = owner;
        return { stream };
      } catch (err2) {
        return { error: describe(err2), canOpenTab: inFrame() };
      }
    }
    return { error: describe(err), canOpenTab: inFrame() };
  }
}

/** Prefer the recording container supported by the current browser (Safari uses MP4). */
export function preferredRecordingMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  // WebM/Opus first: Chrome can record MP4 but often can't decode its own fragmented MP4 back.
  // Safari only records MP4, so it falls through to that.
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

/** Throwing flavour for code paths that already handle failures. */
export async function openMicOrThrow(constraints?: MediaTrackConstraints, owner?: string): Promise<MediaStream> {
  const r = await openMic(constraints, owner);
  if ("stream" in r) return r.stream;
  throw new Error(r.error);
}

export function openInOwnTab() {
  if (typeof window === "undefined") return;
  window.open(window.location.href, "_blank", "noopener");
}
