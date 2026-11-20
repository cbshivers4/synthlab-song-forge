import type { PluginInstance } from "./types";

/** Live-update hooks the engine hands every built-in hardware effect. */
export interface FxHelpers {
  val: (id: string, fallback: number) => number;
  live: (id: string, fn: (v: number, t: number) => void) => void;
  /** Rebuild this chain later (e.g. once an audio worklet has finished loading). */
  rebuild?: () => void;
}

export type FxBuilder = (
  ctx: BaseAudioContext,
  pl: PluginInstance,
  h: FxHelpers,
) => { input: GainNode; output: GainNode };

const glide = (param: AudioParam, v: number, t: number) => param.setTargetAtTime(v, t, 0.015);

/** Delay-line pitch shifter: two crossfaded taps swept by phase-opposed ramps. */
export function shifter(
  ctx: BaseAudioContext,
  input: AudioNode,
  out: AudioNode,
  semis: number,
  started?: (o: OscillatorNode) => void,
) {
  const W = 0.05;
  const H = 32;
  const re = new Float32Array(H),
    imA = new Float32Array(H),
    imB = new Float32Array(H);
  for (let n = 1; n < H; n++) {
    imA[n] = -2 / (Math.PI * n);
    imB[n] = imA[n]! * (n % 2 ? -1 : 1);
  }
  const sawA = ctx.createPeriodicWave(re, imA, { disableNormalization: true });
  const sawB = ctx.createPeriodicWave(re, imB, { disableNormalization: true });
  const winRe = new Float32Array(2);
  const winIm = new Float32Array(2);
  winRe[1] = -0.5;
  const winA = ctx.createPeriodicWave(winRe, winIm, { disableNormalization: true });
  const winRe2 = new Float32Array(2);
  winRe2[1] = 0.5;
  const winB = ctx.createPeriodicWave(winRe2, winIm, { disableNormalization: true });
  const oscs: OscillatorNode[] = [];
  const amps: GainNode[] = [];
  for (const [saw, win] of [
    [sawA, winA],
    [sawB, winB],
  ] as const) {
    const d = ctx.createDelay(0.2);
    d.delayTime.value = W / 2 + 0.002;
    const ramp = ctx.createOscillator();
    ramp.setPeriodicWave(saw);
    const amt = ctx.createGain();
    ramp.connect(amt);
    amt.connect(d.delayTime);
    const vca = ctx.createGain();
    vca.gain.value = 0.5;
    const w = ctx.createOscillator();
    w.setPeriodicWave(win);
    w.connect(vca.gain);
    input.connect(d);
    d.connect(vca);
    vca.connect(out);
    oscs.push(ramp, w);
    amps.push(amt);
  }
  const set = (s: number, t?: number) => {
    const ratio = Math.pow(2, s / 12);
    const f = Math.max(0.001, Math.abs(1 - ratio) / W);
    const a = (((ratio > 1 ? -1 : 1) * W) / 2) * (Math.abs(1 - ratio) < 1e-4 ? 0 : 1);
    for (const o of oscs) {
      if (t === undefined) o.frequency.value = f;
      else glide(o.frequency, f, t);
    }
    for (const g of amps) {
      if (t === undefined) g.gain.value = a;
      else glide(g.gain, a, t);
    }
  };
  set(semis);
  const t0 = ctx.currentTime + 0.01;
  for (const o of oscs) {
    o.start(t0);
    started?.(o);
  }
  return set;
}

/** Runs when the engine retires an effect's nodes (stops its oscillators and worklets). */
const disposers = new WeakMap<AudioNode, () => void>();
export function onDispose(node: AudioNode, fn: () => void) {
  const prev = disposers.get(node);
  disposers.set(
    node,
    prev
      ? () => {
          prev();
          fn();
        }
      : fn,
  );
}
export function disposeFx(node: AudioNode) {
  const fn = disposers.get(node);
  if (!fn) return;
  disposers.delete(node);
  try {
    fn();
  } catch {
    /* already stopped */
  }
}

/**
 * Live readings from running effects, keyed by plugin id: analysers (tuner, VU meter) and
 * gain-reduction readers (de-esser, expander, multiband, channel strip). Only the studio's
 * live context registers here; offline exports never overwrite what the screen shows.
 */
export const fxAnalysers = new Map<string, AnalyserNode[]>();
export const fxReadings = new Map<string, () => number[]>();
export const isOfflineContext = (ctx: BaseAudioContext) =>
  typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext;
