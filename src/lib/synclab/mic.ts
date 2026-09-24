/**
 * One place for microphone access, so every part of SYNCLAB fails the same
 * honest way instead of silently doing nothing.
 */

export type MicResult = { stream: MediaStream } | { error: string; canOpenTab: boolean };

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

export async function openMic(constraints?: MediaTrackConstraints): Promise<MicResult> {
  const blocked = micUnavailableReason();
  if (blocked) return { error: blocked, canOpenTab: inFrame() };
  const base: MediaTrackConstraints = constraints ?? {};
  const wanted = getPreferredInput();
  try {
    const audio: MediaTrackConstraints = wanted ? { ...base, deviceId: { exact: wanted } } : base;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: Object.keys(audio).length ? audio : true,
    });
    return { stream };
  } catch (err) {
    const name = (err as { name?: string })?.name;
    // The chosen interface went away — fall back to the default input instead of failing.
    if (wanted && (name === "OverconstrainedError" || name === "NotFoundError")) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: Object.keys(base).length ? base : true,
        });
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
export async function openMicOrThrow(constraints?: MediaTrackConstraints): Promise<MediaStream> {
  const r = await openMic(constraints);
  if ("stream" in r) return r.stream;
  throw new Error(r.error);
}

export function openInOwnTab() {
  if (typeof window === "undefined") return;
  window.open(window.location.href, "_blank", "noopener");
}
