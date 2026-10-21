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
  if (pad.voice) return { ...pad, kit, decay, sample: undefined, sampleUrl: undefined, name: VOICE_DEFS[pad.voice]?.name ?? pad.name };
  return { ...pad, kit, decay, sample: undefined, sampleUrl: undefined, name: (kit === '727' || kit === 'latin' ? LATIN_NAMES : kit === 'jazz' ? JAZZ_NAMES : STANDARD_NAMES)[pad.kind] };
}

/** Extra kit-specific voices: each is its own synthesized sound, not a renamed copy. */
export const VOICE_DEFS: Record<string, { name: string; kind: DrumPad['kind'] }> = {
  conga_hi: { name: 'HIGH CONGA OPEN', kind: 'tom' }, conga_lo: { name: 'TUMBA', kind: 'kick' }, quinto: { name: 'QUINTO', kind: 'tom' },
  conga_slap: { name: 'CONGA SLAP', kind: 'rim' }, conga_mute: { name: 'CONGA MUTE', kind: 'perc' },
  bongo_hi: { name: 'BONGO HIGH', kind: 'tom' }, bongo_lo: { name: 'BONGO LOW', kind: 'tom' },
  timbale_hi: { name: 'TIMBALE HIGH', kind: 'snare' }, timbale_lo: { name: 'TIMBALE LOW', kind: 'snare' },
  maracas: { name: 'MARACAS', kind: 'hat' }, woodblock: { name: 'WOOD BLOCK', kind: 'rim' }, chacha: { name: 'CHA-CHA BELL', kind: 'perc' },
  cowbell: { name: 'COWBELL', kind: 'perc' }, claves: { name: 'CLAVES', kind: 'rim' }, triangle: { name: 'TRIANGLE', kind: 'perc' },
  tom_lo: { name: 'LOW TOM', kind: 'tom' }, tom_mid: { name: 'MID TOM', kind: 'tom' }, tom_hi: { name: 'HIGH TOM', kind: 'tom' }, floor_tom: { name: 'FLOOR TOM', kind: 'tom' },
  brush_tom_lo: { name: 'BRUSH FLOOR TOM', kind: 'tom' }, brush_tom_hi: { name: 'BRUSH RACK TOM', kind: 'tom' }, brush_stir: { name: 'BRUSH STIR', kind: 'perc' },
  ride_bell: { name: 'RIDE BELL', kind: 'ride' }, sizzle: { name: 'SIZZLE RIDE', kind: 'ride' }, splash: { name: 'SPLASH', kind: 'crash' }, china: { name: 'CHINA', kind: 'crash' },
  hat_foot: { name: 'FOOT HAT', kind: 'hat' }, cross_stick: { name: 'CROSS STICK', kind: 'rim' }, snap: { name: 'FINGER SNAP', kind: 'clap' },
  shaker: { name: 'SHAKER', kind: 'hat' }, sub_boom: { name: '808 BOOM', kind: 'kick' }, tambourine: { name: 'TAMBOURINE', kind: 'openhat' },
  talking_drum: { name: 'TALKING DRUM', kind: 'tom' }, metal_hit: { name: 'METAL HIT', kind: 'fx' }, reverse_cym: { name: 'REVERSE CYMBAL', kind: 'fx' },
};
const MACHINE = ['tom_lo', 'tom_mid', 'tom_hi', 'cowbell', 'claves'];
export const KIT_EXTRA_VOICES: Partial<Record<DrumKitId, string[]>> = {
  latin: ['conga_hi', 'quinto', 'conga_lo', 'conga_slap', 'conga_mute', 'bongo_hi', 'bongo_lo', 'timbale_hi', 'timbale_lo', 'maracas', 'woodblock', 'chacha'],
  '727': ['conga_hi', 'conga_lo', 'bongo_hi', 'bongo_lo', 'timbale_hi', 'maracas', 'woodblock', 'chacha'],
  jazz: ['brush_tom_lo', 'brush_tom_hi', 'brush_stir', 'ride_bell', 'sizzle', 'splash', 'hat_foot', 'cross_stick', 'snap'],
  acoustic: ['floor_tom', 'tom_mid', 'tom_hi', 'ride_bell', 'splash', 'hat_foot', 'cross_stick', 'tambourine'],
  rock: ['floor_tom', 'tom_mid', 'tom_hi', 'china', 'splash', 'ride_bell', 'cowbell', 'hat_foot'],
  afrobeat: ['talking_drum', 'conga_hi', 'conga_lo', 'shaker', 'cowbell', 'woodblock', 'claves'],
  '808': [...MACHINE, 'conga_hi', 'conga_lo', 'maracas'],
  '909': [...MACHINE, 'ride_bell'], '707': [...MACHINE, 'tambourine'], '606': ['tom_lo', 'tom_hi', 'cowbell'],
  cr78: ['bongo_hi', 'bongo_lo', 'conga_lo', 'maracas', 'claves', 'cowbell', 'tambourine'],
  linn: [...MACHINE, 'tambourine', 'conga_hi', 'conga_lo'], dmx: [...MACHINE, 'tambourine'], simmons: ['floor_tom', 'tom_lo', 'tom_mid', 'tom_hi'],
  r8: [...MACHINE, 'ride_bell', 'splash', 'tambourine'], mpc60: [...MACHINE, 'snap', 'shaker'],
  detroit: [...MACHINE, 'shaker', 'metal_hit'], techno: ['tom_lo', 'tom_hi', 'metal_hit', 'shaker', 'reverse_cym'], house: ['tom_lo', 'tom_hi', 'shaker', 'tambourine', 'cowbell', 'snap'],
  ghettotech: ['cowbell', 'snap', 'tom_lo', 'tom_hi', 'claves'], lofi: ['snap', 'shaker', 'tambourine', 'tom_lo', 'tom_hi'], boombap: ['snap', 'tambourine', 'shaker', 'tom_lo', 'tom_hi'],
  trap: ['sub_boom', 'snap', 'triangle', 'tom_lo', 'tom_hi', 'reverse_cym'], drill: ['sub_boom', 'snap', 'triangle', 'tom_lo', 'reverse_cym'],
  jungle: ['tom_lo', 'tom_mid', 'tom_hi', 'ride_bell', 'tambourine', 'shaker'], industrial: ['metal_hit', 'tom_lo', 'tom_hi', 'reverse_cym', 'china'],
};
export const kitExtraPads = (kit: DrumKitId, steps: number, decay: number, make: (voice: string) => string): DrumPad[] =>
  (KIT_EXTRA_VOICES[kit] ?? []).map((voice) => ({ id: make(voice), name: VOICE_DEFS[voice]!.name, kind: VOICE_DEFS[voice]!.kind, voice, kit, volume: 0.8, pan: 0, pitch: 0, decay, muted: false, solo: false, steps: Array(steps).fill(0) }));

const DEFAULT_PROFILE: Profile = { family: 'analog', kick: 50, sweep: 150, tail: .4, snap: .6, shell: 200, bright: 1, bits: 16, rate: 48000 };
function renderVoice(kit: DrumKitId, voice: string, decay: number, sampleRate: number): Float32Array {
  const p = VINTAGE_PROFILES[kit] ?? DEFAULT_PROFILE;
  const d = Math.max(.1, Math.min(2, decay + .1));
  const long = ['sizzle', 'splash', 'china', 'ride_bell', 'reverse_cym', 'sub_boom', 'triangle', 'brush_stir'].includes(voice);
  const pcm = new Float32Array(Math.ceil(Math.min(4, (long ? 2.4 : 1) * d) * sampleRate));
  let seed = 2166136261;
  for (const c of kit + voice) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
  const sin = (f: number, t: number) => Math.sin(2 * Math.PI * f * t);
  const env = (t: number, tail: number) => Math.exp(-t / (tail * d));
  const modal = (f: number, t: number, tail: number) => sin(f, t) * env(t, tail) + .4 * sin(f * 1.593, t) * env(t, tail * .5) + .2 * sin(f * 2.137, t) * env(t, tail * .3);
  const membrane = (f: number, t: number, tail: number, bend = .08) => sin(f * (1 + bend * Math.exp(-t / .03)), t) * env(t, tail) + .3 * sin(f * 1.505, t) * env(t, tail * .4);
  const metal = (fs: number[], t: number, tail: number) => fs.reduce((a, f) => a + sin(f * p.bright, t), 0) / fs.length * env(t, tail);
  let low = 0, held = 0, phase = 0;
  const holdFrames = Math.max(1, Math.round(sampleRate / p.rate));
  const levels = 2 ** (p.bits - 1);
  for (let i = 0; i < pcm.length; i++) {
    const t = i / sampleRate, n = random();
    low += (n - low) * .2; const hiss = n - low;
    let s = 0;
    switch (voice) {
      case 'conga_hi': s = membrane(330, t, .22) * .8 + hiss * .3 * env(t, .006); break;
      case 'quinto': s = membrane(420, t, .17) * .8 + hiss * .35 * env(t, .005); break;
      case 'conga_lo': s = membrane(210, t, .3) * .85 + hiss * .25 * env(t, .007); break;
      case 'conga_slap': s = membrane(360, t, .05) * .6 + hiss * .7 * env(t, .025); break;
      case 'conga_mute': s = membrane(300, t, .045) * .8 + low * .4 * env(t, .02); break;
      case 'bongo_hi': s = membrane(620, t, .1) * .75 + hiss * .3 * env(t, .004); break;
      case 'bongo_lo': s = membrane(440, t, .13) * .75 + hiss * .3 * env(t, .004); break;
      case 'timbale_hi': s = modal(720, t, .28) * .5 + hiss * .45 * env(t, .03); break;
      case 'timbale_lo': s = modal(520, t, .32) * .5 + hiss * .45 * env(t, .035); break;
      case 'maracas': s = hiss * (t < .012 ? 1 : env(t - .012, .03)) * .7; break;
      case 'shaker': s = hiss * Math.min(1, t / .015) * env(t, .07) * .6; break;
      case 'woodblock': s = modal(1250, t, .03) * .9; break;
      case 'claves': s = sin(2500, t) * env(t, .035) * .85; break;
      case 'chacha': s = metal([590, 870, 1410], t, .12) * 1.1; break;
      case 'cowbell': s = (Math.sign(sin(545, t)) + Math.sign(sin(815, t))) * .28 * env(t, .14); break;
      case 'triangle': s = metal([4100, 7300, 9900], t, .9) * .7; break;
      case 'tom_lo': case 'floor_tom': phase += 2 * Math.PI * ((voice === 'floor_tom' ? 82 : 100) * (1 + .5 * Math.exp(-t / .05))) / sampleRate; s = Math.sin(phase) * env(t, .35) * .9 + hiss * .15 * env(t, .008); break;
      case 'tom_mid': phase += 2 * Math.PI * (140 * (1 + .45 * Math.exp(-t / .045))) / sampleRate; s = Math.sin(phase) * env(t, .3) * .9 + hiss * .15 * env(t, .008); break;
      case 'tom_hi': phase += 2 * Math.PI * (190 * (1 + .4 * Math.exp(-t / .04))) / sampleRate; s = Math.sin(phase) * env(t, .25) * .9 + hiss * .15 * env(t, .008); break;
      case 'brush_tom_lo': s = membrane(95, t, .3) * .5 + low * 1.2 * env(t, .12); break;
      case 'brush_tom_hi': s = membrane(165, t, .25) * .5 + low * 1.2 * env(t, .1); break;
      case 'brush_stir': s = (low * 1.6 + hiss * .3) * (.6 + .4 * sin(2.2, t)) * Math.min(1, t / .2) * env(t, .9); break;
      case 'ride_bell': s = metal([2300, 3450, 5100], t, .9) * .8 + hiss * .1 * env(t, .3); break;
      case 'sizzle': s = metal([3400, 5000, 6200, 8200], t, 1.1) * .35 + hiss * .45 * (.7 + .3 * Math.sign(sin(28, t))) * env(t, 1.1); break;
      case 'splash': s = metal([4200, 6100, 8800], t, .35) * .3 + hiss * .6 * env(t, .4); break;
      case 'china': s = Math.tanh((metal([1900, 2700, 3900, 5600], t, .7) * 2 + hiss) * 1.5) * .5 * env(t, .7); break;
      case 'hat_foot': s = (metal([3400, 5000, 6200], t, .02) * .4 + hiss * .4 * env(t, .015)) + low * .3 * env(t, .01); break;
      case 'cross_stick': s = modal(1800, t, .02) * .6 + modal(420, t, .04) * .35; break;
      case 'snap': for (const o of [0, .006]) if (t >= o) s += hiss * .7 * Math.exp(-(t - o) / .018); s += sin(1900, t) * .2 * env(t, .015); break;
      case 'tambourine': s = (metal([5200, 7400, 9300], t, .2) * .5 + hiss * .5 * env(t, .2)) * (t < .01 ? t / .01 : 1); break;
      case 'sub_boom': phase += 2 * Math.PI * (45 + 90 * Math.exp(-t / .03)) / sampleRate; s = Math.tanh(Math.sin(phase) * 1.4) * env(t, 1.2) * .9; break;
      case 'talking_drum': phase += 2 * Math.PI * (180 + 90 * Math.min(1, t / .12)) / sampleRate; s = Math.sin(phase) * env(t, .3) * .85 + hiss * .2 * env(t, .006); break;
      case 'metal_hit': s = Math.tanh(metal([310, 777, 1290, 2410], t, .35) * 3 + hiss * env(t, .05)) * .55; break;
      case 'reverse_cym': { const total = pcm.length / sampleRate; s = (metal([3400, 5100, 7700], t, 10) * .4 + hiss * .5) * Math.pow(t / total, 2.2); break; }
      default: s = hiss * env(t, .1);
    }
    s *= Math.min(1, t * sampleRate / 8);
    if (i % holdFrames === 0) held = Math.round(Math.tanh(s) * levels) / levels;
    pcm[i] = held * .85;
  }
  for (let i = Math.max(0, pcm.length - 128); i < pcm.length; i++) pcm[i] = (pcm[i] ?? 0) * (pcm.length - i) / 128;
  return pcm;
}

/** Deterministic PCM, also used by the live engine inside offline renders. */
export function renderVintageDrum(kit: DrumKitId, kind: DrumPad['kind'], decay: number, sampleRate: number, voice?: string): Float32Array | null {
  if (voice && VOICE_DEFS[voice]) return renderVoice(kit, voice, decay, sampleRate);
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
