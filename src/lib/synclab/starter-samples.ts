import { encodeWav, type Capture } from "./bounce";

/**
 * Starter one-shot samples for the pad sampler, synthesized offline with the
 * Web Audio API and encoded as real WAV blobs — no downloaded files, no
 * placeholders. Each sound is rendered through OfflineAudioContext so the pad
 * holds genuine audio the engine can play, trim and chop.
 */

const SR = 44100;

type Voice = (ctx: OfflineAudioContext, out: GainNode) => void;

const noiseBuffer = (ctx: OfflineAudioContext, seconds: number) => {
  const buf = ctx.createBuffer(1, Math.ceil(SR * seconds), SR);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
};

const env = (ctx: OfflineAudioContext, peak: number, decay: number, start = 0) => {
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  return g;
};

const kick: Voice = (ctx, out) => {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, 0);
  osc.frequency.exponentialRampToValueAtTime(45, 0.12);
  osc.connect(env(ctx, 0.95, 0.35)).connect(out);
  osc.start(0);
  osc.stop(0.4);
  // click transient
  const click = ctx.createBufferSource();
  click.buffer = noiseBuffer(ctx, 0.02);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2000;
  click
    .connect(hp)
    .connect(env(ctx, 0.4, 0.02))
    .connect(out);
  click.start(0);
};

const snare: Voice = (ctx, out) => {
  const tone = ctx.createOscillator();
  tone.type = "triangle";
  tone.frequency.value = 190;
  tone.connect(env(ctx, 0.5, 0.12)).connect(out);
  tone.start(0);
  tone.stop(0.15);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.25);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2800;
  bp.Q.value = 0.8;
  noise
    .connect(bp)
    .connect(env(ctx, 0.7, 0.2))
    .connect(out);
  noise.start(0);
};

const clap: Voice = (ctx, out) => {
  for (const t of [0, 0.012, 0.026, 0.05]) {
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx, 0.3);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1500;
    bp.Q.value = 1.5;
    noise
      .connect(bp)
      .connect(env(ctx, t === 0.05 ? 0.8 : 0.5, t === 0.05 ? 0.25 : 0.03, t))
      .connect(out);
    noise.start(t);
  }
};

const closedHat: Voice = (ctx, out) => {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.08);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7500;
  noise
    .connect(hp)
    .connect(env(ctx, 0.5, 0.05))
    .connect(out);
  noise.start(0);
};

const openHat: Voice = (ctx, out) => {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.4);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  noise
    .connect(hp)
    .connect(env(ctx, 0.45, 0.35))
    .connect(out);
  noise.start(0);
};

const rim: Voice = (ctx, out) => {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = 1720;
  osc.connect(env(ctx, 0.5, 0.03)).connect(out);
  osc.start(0);
  osc.stop(0.05);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.02);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 4000;
  noise
    .connect(hp)
    .connect(env(ctx, 0.3, 0.015))
    .connect(out);
  noise.start(0);
};

const shaker: Voice = (ctx, out) => {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.15);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 5500;
  bp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, 0);
  g.gain.exponentialRampToValueAtTime(0.45, 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, 0.14);
  noise.connect(bp).connect(g).connect(out);
  noise.start(0);
};

const tom: Voice = (ctx, out) => {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, 0);
  osc.frequency.exponentialRampToValueAtTime(90, 0.25);
  osc.connect(env(ctx, 0.8, 0.3)).connect(out);
  osc.start(0);
  osc.stop(0.35);
};

const STARTERS: { name: string; voice: Voice; seconds: number }[] = [
  { name: "Starter Kick", voice: kick, seconds: 0.5 },
  { name: "Starter Snare", voice: snare, seconds: 0.4 },
  { name: "Starter Clap", voice: clap, seconds: 0.4 },
  { name: "Starter Closed Hat", voice: closedHat, seconds: 0.15 },
  { name: "Starter Open Hat", voice: openHat, seconds: 0.5 },
  { name: "Starter Rim", voice: rim, seconds: 0.15 },
  { name: "Starter Shaker", voice: shaker, seconds: 0.25 },
  { name: "Starter Tom", voice: tom, seconds: 0.45 },
];

export interface StarterSample {
  name: string;
  blob: Blob;
}

/** Renders all starter one-shots to WAV blobs. */
export async function renderStarterSamples(): Promise<StarterSample[]> {
  const out: StarterSample[] = [];
  for (const s of STARTERS) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * s.seconds), SR);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    s.voice(ctx, master);
    const rendered = await ctx.startRendering();
    const mono = rendered.getChannelData(0);
    const cap: Capture = { left: mono, right: mono, sampleRate: SR };
    out.push({ name: s.name, blob: encodeWav(cap) });
  }
  return out;
}
