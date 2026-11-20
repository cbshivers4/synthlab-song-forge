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

/** Read-only access to an input another SYNCLAB tool already opened (the caller must not stop it). */
export function borrowActiveMic(): MediaStream | null {
  return activeStream?.active ? activeStream : null;
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
  const fp = (document as unknown as { featurePolicy?: { allowsFeature(f: string): boolean } })
    .featurePolicy;
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

/** True on iPhone/iPad. iPadOS reports itself as a Mac with a touchscreen. */
export function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1)
  );
}

/**
 * Where to send SYNCLAB's sound when the browser cannot pick an output.
 * iOS/iPadOS routes audio per app in Control Centre, and on iPadOS the
 * setSinkId symbol exists but every call rejects, so the browser is not the
 * place to look.
 */
export function outputRoutingHint(apple: boolean = isAppleMobile()): string {
  return apple
    ? "iPhone and iPad choose the output themselves: open Control Centre, tap the audio card, then pick your interface for this app."
    : "This browser plays through your computer's selected output — change it in system sound settings.";
}

function describe(err: unknown): string {
  const e = err as { name?: string; message?: string };
  switch (e?.name) {
    case "NotAllowedError":
    case "SecurityError":
      if (isAppleMobile())
        return "Microphone blocked. On iPhone or iPad: Settings › Safari (or Chrome) › Microphone › Allow, or tap aA in Safari's address bar › Website Settings › Microphone › Allow. Then reload and tap Enable microphone.";
      if (typeof navigator !== "undefined" && /Android/.test(navigator.userAgent))
        return "Microphone blocked. On Android Chrome: tap the icon left of the address › Permissions › Microphone › Allow (also check Android Settings › Apps › Chrome › Permissions). Then reload and tap Enable microphone.";
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

/** Fired on window when the chosen recording input changes, so an armed channel can switch to it. */
export const INPUT_CHANGED_EVENT = "synclab:input-changed";

export function setPreferredInput(deviceId: string | null) {
  const before = getPreferredInput();
  if (before !== deviceId && typeof window !== "undefined")
    queueMicrotask(() => window.dispatchEvent(new CustomEvent(INPUT_CHANGED_EVENT)));
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

const readLs = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeLs = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* blocked */
  }
};

export function getInputChannel(): InputChannel {
  const v = readLs(CH_KEY);
  return v === "in1" || v === "in2" ? v : "stereo";
}
export function setInputChannel(c: InputChannel) {
  writeLs(CH_KEY, c);
}
export function getInputGainDb(): number {
  const n = Number(readLs(GAIN_KEY));
  return Number.isFinite(n) ? Math.max(-24, Math.min(24, n)) : 0;
}
export function setInputGainDb(db: number) {
  writeLs(GAIN_KEY, String(db));
}
export function getOutputDevice(): string | null {
  return readLs(OUT_KEY) || null;
}
export function setOutputDevice(id: string | null) {
  writeLs(OUT_KEY, id);
}

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

/** Fired on window when the open input stops (unplugged interface, revoked permission…). */
export const INPUT_LOST_EVENT = "synclab:input-lost";
/** Fired when the chosen input is missing and the default input was opened instead. */
export const INPUT_FALLBACK_EVENT = "synclab:input-fallback";

function adopt(stream: MediaStream, owner: string) {
  activeStream = stream;
  activeOwner = owner;
  stream.getAudioTracks()[0]?.addEventListener(
    "ended",
    () => {
      if (activeStream === stream) {
        activeStream = null;
        activeOwner = null;
      }
      window.dispatchEvent(
        new CustomEvent(INPUT_LOST_EVENT, {
          detail: { owner, label: stream.getAudioTracks()[0]?.label },
        }),
      );
    },
    { once: true },
  );
}

export async function openMic(
  constraints?: MediaTrackConstraints,
  owner = "shared",
): Promise<MicResult> {
  const blocked = micUnavailableReason();
  if (blocked) return { error: blocked, canOpenTab: inFrame() };
  const base: MediaTrackConstraints = constraints ?? {};
  const wanted = getPreferredInput();
  if (activeStream?.active) {
    if (activeOwner === owner) return { stream: activeStream };
    // Another tool left the input open. Hand it over instead of blocking this one.
    releaseMic(activeStream);
  }
  const generation = ++requestGeneration;
  try {
    const audio: MediaTrackConstraints = wanted ? { ...base, deviceId: { exact: wanted } } : base;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: Object.keys(audio).length ? audio : true,
    });
    if (generation !== requestGeneration) {
      releaseMic(stream);
      return {
        error: "Another recording tool took control of the audio input.",
        canOpenTab: false,
      };
    }
    adopt(stream, owner);
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
          return {
            error: "Another recording tool took control of the audio input.",
            canOpenTab: false,
          };
        }
        adopt(stream, owner);
        // Say so instead of silently recording from a different microphone.
        const label = stream.getAudioTracks()[0]?.label;
        window.dispatchEvent(new CustomEvent(INPUT_FALLBACK_EVENT, { detail: { label } }));
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
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function")
    return undefined;
  // WebM/Opus first: Chrome can record MP4 but often can't decode its own fragmented MP4 back.
  // Safari only records MP4, so it falls through to that.
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find(
    (type) => MediaRecorder.isTypeSupported(type),
  );
}

/** Throwing flavour for code paths that already handle failures. */
export async function openMicOrThrow(
  constraints?: MediaTrackConstraints,
  owner?: string,
): Promise<MediaStream> {
  const r = await openMic(constraints, owner);
  if ("stream" in r) return r.stream;
  throw new Error(r.error);
}

export function openInOwnTab() {
  if (typeof window === "undefined") return;
  window.open(window.location.href, "_blank", "noopener");
}
