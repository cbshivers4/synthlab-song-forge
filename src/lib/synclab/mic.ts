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

export async function openMic(constraints?: MediaTrackConstraints): Promise<MicResult> {
  const blocked = micUnavailableReason();
  if (blocked) return { error: blocked, canOpenTab: inFrame() };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints ?? true });
    return { stream };
  } catch (err) {
    return { error: describe(err), canOpenTab: inFrame() };
  }
}

/** Prefer the recording container supported by the current browser (Safari uses MP4). */
export function preferredRecordingMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) =>
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
