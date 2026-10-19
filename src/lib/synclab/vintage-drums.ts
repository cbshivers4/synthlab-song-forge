import type { DrumKitId, DrumPad } from './types';

/** Original procedural voices, inspired by machines; no factory sample ROMs. */
type Profile = { family: 'analog' | 'digital' | 'shell' | 'latin'; kick: number; sweep: number; tail: number; snap: number; shell: number; bright: number; bits: number; rate: number; brush?: boolean; room?: number };
export const VINTAGE_PROFILES: Partial<Record<DrumKitId, Profile>> = {
  '808': { family: 'analog', kick: 34, sweep: 105, tail: 1.15, snap: .12, shell: 185, bright: 1.25, bits: 16, rate: 48000 },
  '909': { family: 'analog', kick: 49, sweep: 185, tail: .32, snap: .8, shell: 220, bright: 1.05, bits: 16, rate: 48000 },
  '707': { family: 'digital', kick: 58, sweep: 115, tail: .2, snap: .8, shell: 260, bright: .8, bits: 8, rate: 25000 },
  '727': { family: 'latin', kick: 180, sweep: 230, tail: .24, snap: .5, shell: 310, bright: 1.4, bits: 8, rate: 25000 },
  linn: { family: 'digital', kick: 62, sweep: 95, tail: .25, snap: .7, shell: 175, bright: .72, bits: 8, rate: 28000 },
  r8: { family: 'shell', kick: 55, sweep: 125, tail: .38, snap: .95, shell: 205, bright: 1.12, bits: 16, rate: 32000, room: .08 },
  jazz: { family: 'shell', kick: 72, sweep: 92, tail: .28, snap: .15, shell: 245, bright: .55, bits: 16, rate: 48000, brush: true, room: .04 },
  rock: { family: 'shell', kick: 47, sweep: 155, tail: .55, snap: 1.1, shell: 155, bright: .92, bits: 16, rate: 48000, room: .24 },
  acoustic: { family: 'shell', kick: 60, sweep: 110, tail: .4, snap: .6, shell: 195, bright: .85, bits: 16, rate: 48000, room: .09 },
  latin: { family: 'latin', kick: 155, sweep: 210, tail: .42, snap: .35, shell: 280, bright: .95, bits: 16, rate: 48000 },
  dmx: { family: 'digital', kick: 52, sweep: 140, tail: .32, snap: 1, shell: 198, bright: .95, bits: 8, rate: 24000 },
  mpc60: { family: 'digital', kick: 43, sweep: 100, tail: .4, snap: .55, shell: 165, bright: .6, bits: 12, rate: 40000 },
};

export const LATIN_NAMES: Record<DrumPad['kind'], string> = { kick: 'LOW CONGA', snare: 'TIMBALE', clap: 'CABASA', hat: 'SHAKER', openhat: 'TAMBOURINE', tom: 'HIGH CONGA', perc: 'COWBELL', rim: 'CLAVE', crash: 'AGOGO', ride: 'BONGO', fx: 'GUIRO' };
export const JAZZ_NAMES: Record<DrumPad['kind'], string> = { kick: 'BRUSH KICK', snare: 'BRUSH SNARE', clap: 'BRUSH TAP', hat: 'BRUSH HAT', openhat: 'BRUSH SWISH', tom: 'TOM', perc: 'BRUSH SWIRL', rim: 'RIM CLICK', crash: 'CRASH', ride: 'BRUSH RIDE', fx: 'BRUSH SLIDE' };
const STANDARD_NAMES: Record<DrumPad['kind'], string> = { kick: 'KICK', snare: 'SNARE', clap: 'CLAP', hat: 'HI-HAT', openhat: 'OPEN HAT', tom: 'TOM', perc: 'PERC', rim: 'RIM', crash: 'CRASH', ride: 'RIDE', fx: 'FX' };
export function factoryKitPad(pad: DrumPad, kit: DrumKitId, decay: number): DrumPad {
  return { ...pad, kit, decay, sample: undefined, sampleUrl: undefined, name: (kit === '727' || kit === 'latin' ? LATIN_NAMES : kit === 'jazz' ? JAZZ_NAMES : STANDARD_NAMES)[pad.kind] };
}

/** Deterministic PCM, also used by the live engine inside offline renders. */
export function renderVintageDrum(kit: DrumKitId, kind: DrumPad['kind'], decay: number, sampleRate: number): Float32Array | null {
  const p = VINTAGE_PROFILES[kit];
  if (!p) return null;
  const d = Math.max(.1, Math.min(2, decay + .1));
  const cymbal = kind === 'crash' || kind === 'ride' || kind === 'openhat';
  const seconds = Math.min(4, kind === 'kick' ? p.tail * d * 5 : cymbal ? 2.8 * d : 1.5 * d);
  const pcm = new Float32Array(Math.max(32, Math.ceil(seconds * sampleRate)));
  let seed = 2166136261;
  for (const c of kit + kind) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
  const sin = (f: number, t: number) => Math.sin(2 * Math.PI * f * t);
  const modal = (f: number, t: number, tail: number) => sin(f, t) * Math.exp(-t / tail) + .38 * sin(f * 1.593, t) * Math.exp(-t / (tail * .52)) + .18 * sin(f * 2.137, t) * Math.exp(-t / (tail * .29));
  let low = 0, phase = 0, held = 0;
  const holdFrames = Math.max(1, Math.round(sampleRate / p.rate));
  const levels = 2 ** (p.bits - 1);
  for (let i = 0; i < pcm.length; i++) {
    const t = i / sampleRate, n = random();
    low += (n - low) * Math.min(.95, .18 * p.bright);
    const hiss = n - low;
    let s = 0;
    if (p.family === 'latin') {
      if (kind === 'kick' || kind === 'tom' || kind === 'ride') {
        const f = kind === 'kick' ? p.kick : kind === 'tom' ? p.kick * 1.65 : p.kick * 2.15;
        s = modal(f, t, .16 * d) * .75 + hiss * .45 * Math.exp(-t / .009);
      } else if (kind === 'perc' || kind === 'crash') {
        const f = kind === 'perc' ? 540 : 880;
        s = (Math.sign(sin(f * p.bright, t)) + .6 * Math.sign(sin(f * 1.48, t))) * .35 * Math.exp(-t / (.16 * d));
      } else if (kind === 'rim') s = modal(2400 * p.bright, t, .025 * d) * .8;
      else if (kind === 'snare') s = modal(p.shell * 2.1, t, .18 * d) * .7 + hiss * .3 * Math.exp(-t / .015);
      else if (kind === 'fx') s = hiss * Math.pow(.5 + .5 * sin(55, t), 8) * Math.exp(-t / (.2 * d));
      else s = hiss * (kind === 'openhat' ? .5 + .5 * sin(95, t) : 1) * Math.exp(-t / ((kind === 'hat' ? .055 : .15) * d)) * .7;
    } else if (kind === 'kick') {
      const sweepTime = p.family === 'digital' ? .012 : kit === '808' ? .045 : .018;
      phase += 2 * Math.PI * (p.kick + (p.sweep - p.kick) * Math.exp(-t / sweepTime)) / sampleRate;
      s = Math.sin(phase) * Math.exp(-t / (p.tail * d)) + hiss * p.snap * Math.exp(-t / .009);
      if (p.family !== 'analog') s += modal(p.kick * 2.7, t, .045 * d) * .25;
      if (kit === '909') s = Math.tanh(s * 1.65) * .85;
    } else if (kind === 'snare') {
      const tail = (p.brush ? .19 : p.family === 'digital' ? .08 : .13) * d;
      s = modal(p.shell, t, .06 * d) * (p.brush ? .16 : .6) + (p.brush ? low * 2 : hiss) * Math.exp(-t / tail) * (p.brush ? .65 : .75);
      if (p.room) s += low * p.room * Math.exp(-t / (.3 * d)) * (1 - Math.exp(-t / .012));
    } else if (kind === 'tom') s = modal(p.shell * .67, t, .19 * d) * .85 + hiss * p.snap * .18 * Math.exp(-t / .008);
    else if (kind === 'clap') {
      if (p.brush) {
        // Brush tap: a short soft drag across the head instead of a stick clap.
        s = low * 1.4 * Math.exp(-t / (.09 * d)) + hiss * .3 * Math.exp(-t / (.05 * d));
      } else {
        for (const offset of [0, .011, .023]) if (t >= offset) s += hiss * .52 * Math.exp(-(t - offset) / (.034 * d));
        s += low * .6 * Math.exp(-t / (.12 * d));
      }
    } else if (kind === 'rim') s = modal(p.shell * 5.3, t, .019 * d) * .65;
    else if (kind === 'perc') {
      if (p.brush) {
        // Brush swirl: a long circular sweep with a slow swell and fall.
        const swirl = Math.min(1, t / (.12 * d));
        s = (low * 1.6 + hiss * .5) * swirl * Math.exp(-t / (.55 * d));
      } else s = modal(p.shell * 3.1, t, .07 * d) * .8;
    }
    else if (kind === 'fx') {
      if (p.brush) {
        // Brush slide: one long drag with a gentle pitch-less noise sweep.
        const slide = Math.min(1, t / (.05 * d));
        s = (low * 1.8 + hiss * .4) * slide * Math.exp(-t / (.8 * d));
      } else s = sin(420 + 1600 * Math.exp(-t / .06), t) * Math.exp(-t / (.18 * d)) * .5;
    }
    else {
      // Inharmonic metal partials: analog hats are oscillator metal, shell cymbals are noisy modes.
      const freqs = kit === '808' ? [205, 369, 522, 800, 1169, 1483] : [3421, 4973, 6137, 8231, 10103, 11713];
      let metal = 0;
      for (const f of freqs) metal += (p.family === 'analog' ? Math.sign(sin(f * p.bright, t)) : sin(f * p.bright, t)) / 6;
      const tail = (kind === 'hat' ? .025 : kind === 'openhat' ? .22 : kind === 'ride' ? .48 : .65) * d;
      s = (metal * (kit === '808' ? .65 : .38) + hiss * (kit === '808' ? .15 : .55)) * Math.exp(-t / tail);
      if (kind === 'ride') s += sin(2700 * p.bright, t) * .26 * Math.exp(-t / (.4 * d));
      if (p.brush) {
        // Brushed cymbals: softer metal, more noisy wash, longer swish on hats.
        const washTail = (kind === 'hat' ? .06 : kind === 'openhat' ? .5 : kind === 'ride' ? .7 : .8) * d;
        s = s * .35 + (low * 1.5 + hiss * .5) * Math.exp(-t / washTail) * .8;
      }
    }
    s *= Math.min(1, t * sampleRate / 8); // eliminate discontinuity at onset
    if (i % holdFrames === 0) held = Math.round(Math.tanh(s) * levels) / levels;
    pcm[i] = held * .85;
  }
  // End taper avoids discontinuity even with very long 808 decay.
  for (let i = Math.max(0, pcm.length - 128); i < pcm.length; i++) pcm[i] = (pcm[i] ?? 0) * (pcm.length - i) / 128;
  return pcm;
}
