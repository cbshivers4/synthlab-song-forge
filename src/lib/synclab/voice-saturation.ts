/**
 * Built-in synth voice warmth (the stage after the filter).
 *
 * The old curve was so strong that even the default patch was squashed into the same loud,
 * fuzzy tone, so most presets sounded alike. This one stays almost clean at low settings,
 * only gets gritty as DRIVE / DISTORTION / SATURATION go up, and never hard-clips: the shaper
 * input is scaled by VOICE_SHAPER_IN so the curve covers ±4 instead of ±1.
 */
import type { SynthPatch } from "./types";

/** Gain in front of the voice shaper; the curve covers ±1/VOICE_SHAPER_IN of real signal. */
export const VOICE_SHAPER_IN = 0.25;
/** Fixed make-up so lighter saturation does not leave every synth much quieter than before. */
export const VOICE_MAKEUP = 1.6;
const POINTS = 4097;

/** Combined drive amount (0..1.5) from the patch's grit knobs; clean voices skip the base warmth. */
export function voiceDriveAmount(
  patch: Pick<SynthPatch, "drive" | "clean"> & {
    fx: Pick<SynthPatch["fx"], "distortion"> & { saturation?: number };
  },
): number {
  const amount =
    (patch.fx.distortion ?? 0) + (patch.fx.saturation ?? 0) * 0.6 + (patch.drive ?? 0) * 0.8;
  return Math.min(1.5, Math.max(0, patch.clean ? amount : 0.05 + amount));
}

/** Tanh drive factor: ~0 = clean, 1 = soft warmth, 4+ = heavy distortion. */
export function voiceDriveFactor(amount: number): number {
  return 4 * Math.pow(Math.max(0, amount), 1.5);
}

/** Output of the curve for a real (unscaled) input sample — exported for tests. */
export function voiceSaturate(input: number, amount: number): number {
  const d = voiceDriveFactor(amount);
  if (d < 1e-3) return input * VOICE_MAKEUP;
  return (VOICE_MAKEUP * Math.tanh(d * input)) / Math.tanh(d);
}

/** WaveShaper curve: index i covers real input (2i/(n-1) - 1) / VOICE_SHAPER_IN. */
export function voiceSaturationCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(POINTS);
  for (let i = 0; i < POINTS; i++) {
    const x = ((i * 2) / (POINTS - 1) - 1) / VOICE_SHAPER_IN;
    curve[i] = voiceSaturate(x, amount);
  }
  return curve;
}

/**
 * Gain into the voice shaper. Narrow band-pass voices (talk box, choir, oboe) lose most of their
 * harmonics, so they get make-up that grows with resonance instead of relying on heavy saturation.
 */
export function voiceInputGain(patch: Pick<SynthPatch, "filterType" | "resonance">): number {
  const bp =
    patch.filterType === "bandpass"
      ? Math.min(4, Math.max(1, Math.sqrt(Math.max(1, patch.resonance))))
      : 1;
  return VOICE_SHAPER_IN * bp;
}

/** Per-copy level for unison: detuned copies add up by roughly √n, so dividing by n made big stacks too quiet. */
export function unisonCopyScale(voices: number): number {
  return 1 / Math.pow(Math.max(1, voices), 0.75);
}
