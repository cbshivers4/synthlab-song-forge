import type { DrumPad, SynthPatch, Track } from "./types";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function makeDistortionCurve(amount: number) {
  const k = amount * 100;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

interface ChannelStrip {
  input: GainNode;
  gain: GainNode;
  pan: StereoPannerNode;
}

export class SyncLabEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  reverb: ConvolverNode | null = null;
  reverbSend: GainNode | null = null;
  private channels = new Map<string, ChannelStrip>();
  private analyser: AnalyserNode | null = null;

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    const Ctor: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      window.AudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.85;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    this.analyser = analyser;
    this.master = master;

    // simple algorithmic reverb
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    conv.buffer = buf;
    const send = ctx.createGain();
    send.gain.value = 1;
    send.connect(conv);
    conv.connect(master);
    this.reverb = conv;
    this.reverbSend = send;
    return ctx;
  }

  getLevel() {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs((data[i] ?? 128) - 128) / 128);
    return peak;
  }

  channel(id: string): ChannelStrip {
    const ctx = this.init();
    let ch = this.channels.get(id);
    if (!ch) {
      const input = ctx.createGain();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      input.connect(gain);
      gain.connect(pan);
      pan.connect(this.master!);
      ch = { input, gain, pan };
      this.channels.set(id, ch);
    }
    return ch;
  }

  syncMix(tracks: Track[]) {
    if (!this.ctx) return;
    const anySolo = tracks.some((t) => t.solo);
    for (const t of tracks) {
      const ch = this.channel(t.id);
      const audible = !t.muted && (!anySolo || t.solo);
      ch.gain.gain.setTargetAtTime(audible ? t.volume : 0, this.ctx.currentTime, 0.02);
      ch.pan.pan.setTargetAtTime(clamp(t.pan, -1, 1), this.ctx.currentTime, 0.02);
    }
  }

  removeChannel(id: string) {
    const ch = this.channels.get(id);
    if (ch) {
      ch.pan.disconnect();
      this.channels.delete(id);
    }
  }

  /* ---------------- synth voice ---------------- */
  playNote(trackId: string, patch: SynthPatch, midi: number, duration: number, velocity = 1, when?: number) {
    const ctx = this.init();
    const t0 = when ?? ctx.currentTime;
    const ch = this.channel(trackId);

    const voiceOut = ctx.createGain();
    voiceOut.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = patch.filterType;
    filter.Q.value = patch.resonance;
    filter.frequency.value = patch.cutoff;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(0.05 + patch.fx.distortion);

    filter.connect(shaper);
    shaper.connect(voiceOut);
    voiceOut.connect(ch.input);

    if (patch.fx.delay > 0) {
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.28;
      const fb = ctx.createGain();
      fb.gain.value = clamp(patch.fx.delayFeedback, 0, 0.8);
      const wet = ctx.createGain();
      wet.gain.value = patch.fx.delay * 0.6;
      voiceOut.connect(wet);
      wet.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(ch.input);
    }
    if (patch.fx.reverb > 0 && this.reverbSend) {
      const wet = ctx.createGain();
      wet.gain.value = patch.fx.reverb * 0.5;
      voiceOut.connect(wet);
      wet.connect(this.reverbSend);
    }

    const voices = clamp(patch.unison.voices, 1, 7);
    const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];

    patch.oscillators.forEach((osc) => {
      if (!osc.on || osc.level <= 0) return;
      for (let u = 0; u < voices; u++) {
        const o = ctx.createOscillator();
        o.type = osc.wave;
        const spread = voices === 1 ? 0 : (u / (voices - 1) - 0.5) * 2;
        const freq = midiToFreq(midi + osc.octave * 12 + osc.semitone);
        o.frequency.setValueAtTime(freq, t0);
        o.detune.setValueAtTime(osc.detune + spread * patch.unison.detune, t0);
        const g = ctx.createGain();
        g.gain.value = (osc.level / voices) * velocity;
        const p = ctx.createStereoPanner();
        p.pan.value = clamp(osc.pan + spread * patch.unison.width, -1, 1);
        o.connect(g);
        g.connect(p);
        p.connect(filter);
        o.start(t0);
        o.stop(t0 + duration + patch.amp.release + 0.1);
        nodes.push(o);
      }
    });

    if (patch.noise > 0) {
      const len = Math.ceil(ctx.sampleRate * (duration + patch.amp.release + 0.1));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = patch.noise * 0.4 * velocity;
      src.connect(g);
      g.connect(filter);
      src.start(t0);
      nodes.push(src);
    }

    // LFOs
    patch.lfos.forEach((lfo) => {
      if (!lfo.on) return;
      const o = ctx.createOscillator();
      o.type = lfo.wave;
      o.frequency.value = lfo.rate;
      const g = ctx.createGain();
      if (lfo.destination === "filter") {
        g.gain.value = lfo.amount * 2000;
        g.connect(filter.frequency);
      } else if (lfo.destination === "volume") {
        g.gain.value = lfo.amount * 0.4;
        g.connect(voiceOut.gain);
      } else if (lfo.destination === "pan") {
        g.gain.value = lfo.amount;
        g.connect(ch.pan.pan);
      } else {
        g.gain.value = lfo.amount * 50;
        nodes.forEach((n) => {
          if ("detune" in n && n.detune) g.connect((n as OscillatorNode).detune);
        });
      }
      o.connect(g);
      o.start(t0);
      o.stop(t0 + duration + patch.amp.release + 0.1);
    });

    // amp envelope
    const a = patch.amp;
    const peak = 0.35 * velocity;
    voiceOut.gain.cancelScheduledValues(t0);
    voiceOut.gain.setValueAtTime(0.0001, t0);
    voiceOut.gain.linearRampToValueAtTime(peak, t0 + Math.max(0.001, a.attack));
    voiceOut.gain.linearRampToValueAtTime(peak * a.sustain + 0.0001, t0 + a.attack + a.decay);
    const relStart = t0 + Math.max(duration, a.attack + a.decay);
    voiceOut.gain.setValueAtTime(Math.max(0.0001, peak * a.sustain), relStart);
    voiceOut.gain.exponentialRampToValueAtTime(0.0001, relStart + Math.max(0.02, a.release));

    // filter envelope
    const fe = patch.filterEnv;
    const base = patch.cutoff;
    filter.frequency.cancelScheduledValues(t0);
    filter.frequency.setValueAtTime(base, t0);
    filter.frequency.linearRampToValueAtTime(clamp(base + fe.amount, 40, 18000), t0 + Math.max(0.001, fe.attack));
    filter.frequency.linearRampToValueAtTime(
      clamp(base + fe.amount * fe.sustain, 40, 18000),
      t0 + fe.attack + fe.decay,
    );
    filter.frequency.setTargetAtTime(base, relStart, Math.max(0.02, fe.release));
  }

  /* ---------------- drum voices ---------------- */
  playDrum(trackId: string, pad: DrumPad, velocity = 1, when?: number) {
    const ctx = this.init();
    const t = when ?? ctx.currentTime;
    const ch = this.channel(trackId);
    const out = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pad.pan, -1, 1);
    out.connect(p);
    p.connect(ch.input);
    const vol = pad.volume * velocity;
    const tune = Math.pow(2, pad.pitch / 12);
    const dec = 0.1 + pad.decay;

    const noiseBurst = (dur: number, freq: number, type: BiquadFilterType, q = 1) => {
      const len = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq * tune;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(t);
    };

    const tone = (start: number, end: number, dur: number, type: OscillatorType = "sine", level = 1) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(start * tune, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, end * tune), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + dur + 0.02);
    };

    switch (pad.kind) {
      case "kick":
        tone(130, 42, 0.35 * dec * 2);
        noiseBurst(0.02, 1800, "highpass");
        break;
      case "snare":
        tone(210, 120, 0.12 * dec * 2, "triangle", 0.6);
        noiseBurst(0.22 * dec * 2, 1600, "highpass");
        break;
      case "clap":
        [0, 0.012, 0.024].forEach((o) => setTimeoutBurst(() => noiseBurst(0.16, 1400, "bandpass", 1.6), o));
        break;
      case "hat":
        noiseBurst(0.06 * dec * 2, 7500, "highpass");
        break;
      case "openhat":
        noiseBurst(0.35 * dec * 2, 6800, "highpass");
        break;
      case "tom":
        tone(200, 90, 0.4 * dec * 2, "sine");
        break;
      case "perc":
        tone(600, 300, 0.12 * dec * 2, "square", 0.5);
        break;
      case "rim":
        tone(1700, 900, 0.05, "square", 0.5);
        break;
      case "crash":
        noiseBurst(1.2 * dec, 5200, "highpass");
        break;
      case "ride":
        noiseBurst(0.6 * dec, 9000, "bandpass", 0.8);
        break;
      default:
        noiseBurst(0.4 * dec, 900, "bandpass", 3);
    }
  }
}

function setTimeoutBurst(fn: () => void, delay: number) {
  if (delay === 0) fn();
  else setTimeout(fn, delay * 1000);
}

let engine: SyncLabEngine | null = null;
export const getEngine = () => {
  if (!engine) engine = new SyncLabEngine();
  return engine;
};
