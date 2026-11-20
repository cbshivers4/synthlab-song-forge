/**
 * "Hear it in…" playback rooms for the Mastering panel.
 *
 * Each room is a real Web Audio chain modelling how a playback system and its
 * space colour a mix: speaker range (high/low-pass), EQ bumps and dips,
 * mono/narrow imaging, small-speaker compression or distortion, a generated
 * room reverb, tape wow/flutter and optional background noise. These are
 * approximations of typical systems — not measurements of any one car, club
 * or speaker — and they never change the mastered file.
 */

export type RoomNoise = "road" | "crowd" | "hiss" | "hvac";

export interface RoomEq {
  type: "lowshelf" | "highshelf" | "peaking";
  freq: number;
  gain: number;
  q?: number;
}

export interface ListenRoom {
  id: string;
  name: string;
  note: string;
  /** speaker low cut, Hz (24 dB/oct) */
  highpass?: number;
  /** speaker high cut, Hz (24 dB/oct) */
  lowpass?: number;
  eq: RoomEq[];
  /** 0 = mono, 1 = as mixed */
  width?: number;
  /** small-speaker / tape saturation, 0..1 */
  drive?: number;
  compress?: { threshold: number; ratio: number };
  reverb?: { seconds: number; predelayMs: number; wet: number; damp: number };
  noise?: { kind: RoomNoise; db: number };
  /** cassette wow & flutter */
  wow?: { depthMs: number; rateHz: number; flutterMs: number; flutterHz: number };
  /** level trim so rooms compare at a similar loudness, dB */
  level: number;
}

export const LISTEN_ROOMS: ListenRoom[] = [
  {
    id: "studio",
    name: "Studio monitors",
    note: "Flat reference — exactly what you mastered.",
    eq: [],
    level: 0,
  },
  {
    id: "car",
    name: "Car stereo",
    note: "Cabin bass boost, door-speaker mids, seats off-centre, road noise.",
    highpass: 35,
    eq: [
      { type: "lowshelf", freq: 80, gain: 6 },
      { type: "peaking", freq: 250, gain: 2, q: 1 },
      { type: "peaking", freq: 1000, gain: -2, q: 0.8 },
      { type: "peaking", freq: 3000, gain: 2, q: 1.2 },
      { type: "highshelf", freq: 9000, gain: -4 },
    ],
    width: 0.75,
    reverb: { seconds: 0.25, predelayMs: 2, wet: 0.12, damp: 4000 },
    noise: { kind: "road", db: -30 },
    level: -2,
  },
  {
    id: "club",
    name: "Club PA",
    note: "Mono system, huge subs, big room, crowd chatter.",
    highpass: 30,
    eq: [
      { type: "lowshelf", freq: 60, gain: 7 },
      { type: "peaking", freq: 120, gain: 2, q: 1 },
      { type: "peaking", freq: 400, gain: -2, q: 0.8 },
      { type: "peaking", freq: 3500, gain: 2, q: 1 },
      { type: "highshelf", freq: 10000, gain: -3 },
    ],
    width: 0,
    compress: { threshold: -12, ratio: 3 },
    reverb: { seconds: 1.4, predelayMs: 25, wet: 0.22, damp: 3500 },
    noise: { kind: "crowd", db: -32 },
    level: -3,
  },
  {
    id: "walkman",
    name: "Walkman",
    note: "Cassette on foam headphones — wow, flutter, tape hiss, soft highs.",
    highpass: 60,
    lowpass: 11000,
    eq: [
      { type: "lowshelf", freq: 100, gain: 3 },
      { type: "peaking", freq: 2500, gain: 2, q: 1 },
    ],
    drive: 0.35,
    wow: { depthMs: 0.6, rateHz: 0.8, flutterMs: 0.08, flutterHz: 9 },
    noise: { kind: "hiss", db: -44 },
    level: 0,
  },
  {
    id: "home",
    name: "Home stereo",
    note: "Bookshelf speakers in a living room.",
    highpass: 35,
    eq: [
      { type: "lowshelf", freq: 100, gain: 2 },
      { type: "peaking", freq: 200, gain: 1.5, q: 1 },
      { type: "highshelf", freq: 8000, gain: -1.5 },
    ],
    reverb: { seconds: 0.5, predelayMs: 8, wet: 0.14, damp: 6000 },
    level: -1,
  },
  {
    id: "theater",
    name: "Movie theater",
    note: "Big screen room: deep sub, rolled-off highs, long hall, air handling.",
    highpass: 25,
    eq: [
      { type: "lowshelf", freq: 45, gain: 5 },
      { type: "peaking", freq: 80, gain: 2, q: 1 },
      { type: "highshelf", freq: 2000, gain: -3 },
      { type: "highshelf", freq: 10000, gain: -3 },
    ],
    width: 1.2,
    reverb: { seconds: 2.2, predelayMs: 40, wet: 0.28, damp: 3000 },
    noise: { kind: "hvac", db: -46 },
    level: -3,
  },
  {
    id: "phone",
    name: "Phone speaker",
    note: "Tiny mono speaker — no real bass, pushy mids.",
    highpass: 450,
    lowpass: 12000,
    eq: [
      { type: "peaking", freq: 900, gain: 2, q: 1 },
      { type: "peaking", freq: 1800, gain: 5, q: 1.2 },
    ],
    width: 0,
    drive: 0.15,
    compress: { threshold: -20, ratio: 4 },
    level: 2,
  },
  {
    id: "earbuds",
    name: "Earbuds",
    note: "Sealed in-ears — extra bass and a bright edge.",
    highpass: 25,
    eq: [
      { type: "lowshelf", freq: 60, gain: 4 },
      { type: "peaking", freq: 3000, gain: 3, q: 2 },
      { type: "highshelf", freq: 9000, gain: -2 },
    ],
    level: -1,
  },
  {
    id: "laptop",
    name: "Laptop",
    note: "Small built-in speakers close together.",
    highpass: 220,
    lowpass: 15000,
    eq: [
      { type: "peaking", freq: 900, gain: 3, q: 1 },
      { type: "peaking", freq: 4000, gain: 2, q: 1 },
    ],
    width: 0.4,
    level: 1,
  },
  {
    id: "tv",
    name: "TV speakers",
    note: "Down-firing TV speakers in a lounge.",
    highpass: 130,
    lowpass: 13000,
    eq: [
      { type: "peaking", freq: 300, gain: 2, q: 1 },
      { type: "peaking", freq: 2500, gain: 3, q: 1 },
    ],
    width: 0.6,
    reverb: { seconds: 0.45, predelayMs: 6, wet: 0.12, damp: 5000 },
    level: 0,
  },
  {
    id: "radio",
    name: "FM radio",
    note: "Broadcast processing squashes the dynamics, 15 kHz top end.",
    highpass: 30,
    lowpass: 15000,
    eq: [
      { type: "lowshelf", freq: 80, gain: 2 },
      { type: "peaking", freq: 3000, gain: 2, q: 1 },
    ],
    compress: { threshold: -24, ratio: 6 },
    drive: 0.1,
    level: 0,
  },
  {
    id: "bluetooth",
    name: "Bluetooth speaker",
    note: "One small box with a bass port.",
    highpass: 80,
    lowpass: 16000,
    eq: [
      { type: "lowshelf", freq: 120, gain: 4 },
      { type: "peaking", freq: 2000, gain: 1, q: 1 },
    ],
    width: 0,
    compress: { threshold: -16, ratio: 3 },
    level: 0,
  },
];

export const roomById = (id: string) => LISTEN_ROOMS.find((r) => r.id === id) ?? LISTEN_ROOMS[0]!;

/** Deterministic PRNG so a room's reverb and noise are the same every time. */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) / 4294967296) * 2 - 1;
  };
}

/** Stereo room impulse: decorrelated noise with an exponential decay that darkens over time. */
export function roomImpulse(
  sampleRate: number,
  seconds: number,
  damp: number,
): [Float32Array, Float32Array] {
  const n = Math.max(1, Math.floor(sampleRate * seconds));
  const out: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const rand = rng(1234 + c * 7919);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      // cutoff falls from `damp` towards a quarter of it as the tail ages
      const fc = damp * (1 - 0.75 * t);
      const a = Math.exp((-2 * Math.PI * fc) / sampleRate);
      lp = (1 - a) * rand() + a * lp;
      out[c]![i] = lp * Math.pow(1 - t, 2) * Math.exp(-3 * t);
    }
  }
  return out;
}

/** Background noise of a given colour, normalised to ~unit RMS. */
export function roomNoise(
  kind: RoomNoise,
  sampleRate: number,
  seconds = 4,
): [Float32Array, Float32Array] {
  const n = Math.max(1, Math.floor(sampleRate * seconds));
  const out: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const rand = rng(99 + c * 31 + kind.length * 101);
    const ch = out[c]!;
    let brown = 0;
    let lp = 0;
    let hpPrev = 0;
    let hpOut = 0;
    for (let i = 0; i < n; i++) {
      const w = rand();
      if (kind === "road" || kind === "hvac") {
        brown = (brown + 0.02 * w) * 0.995;
        const fc = kind === "road" ? 300 : 160;
        const a = Math.exp((-2 * Math.PI * fc) / sampleRate);
        lp = (1 - a) * brown + a * lp;
        ch[i] = lp;
      } else if (kind === "hiss") {
        // first-order high-pass around 4 kHz
        const a = Math.exp((-2 * Math.PI * 4000) / sampleRate);
        hpOut = a * (hpOut + w - hpPrev);
        hpPrev = w;
        ch[i] = hpOut;
      } else {
        // crowd: band-limited noise with slow, voice-like swells
        const a = Math.exp((-2 * Math.PI * 1800) / sampleRate);
        lp = (1 - a) * w + a * lp;
        const b = Math.exp((-2 * Math.PI * 350) / sampleRate);
        hpOut = b * (hpOut + lp - hpPrev);
        hpPrev = lp;
        const t = i / sampleRate;
        const swell =
          0.6 +
          0.25 * Math.sin(2 * Math.PI * 0.7 * t + c) +
          0.15 * Math.sin(2 * Math.PI * 2.3 * t + 2 * c);
        ch[i] = hpOut * swell;
      }
    }
    let sum = 0;
    for (let i = 0; i < n; i++) sum += (ch[i] ?? 0) ** 2;
    const rms = Math.sqrt(sum / n) || 1;
    // fade the loop edges so the repeat never clicks
    const edge = Math.min(n >> 1, Math.floor(sampleRate * 0.05));
    for (let i = 0; i < n; i++) {
      const f = Math.min(1, i / edge, (n - 1 - i) / edge);
      ch[i] = ((ch[i] ?? 0) / rms) * (edge > 0 ? f : 1);
    }
  }
  return out;
}

const dbToGain = (d: number) => Math.pow(10, d / 20);

function saturation(amount: number) {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = 1 + amount * 12;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

export interface RoomChain {
  input: AudioNode;
  output: AudioNode;
  /** starts noise/LFO sources at a context time */
  start: (when: number) => void;
  dispose: () => void;
}

/** Builds a room's playback chain on a live context. Nothing here touches the mix or the master. */
export function buildRoomChain(
  ctx: BaseAudioContext,
  room: ListenRoom,
  withNoise: boolean,
): RoomChain {
  const input = ctx.createGain();
  const output = ctx.createGain();
  output.gain.value = dbToGain(room.level);
  const nodes: AudioNode[] = [input, output];
  const sources: AudioScheduledSourceNode[] = [];
  let node: AudioNode = input;
  const chain = (next: AudioNode) => {
    node.connect(next);
    nodes.push(next);
    node = next;
  };
  const filter = (type: BiquadFilterType, freq: number, gain = 0, q = Math.SQRT1_2) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.gain.value = gain;
    f.Q.value = q;
    return f;
  };

  if (room.wow) {
    const d = ctx.createDelay(0.05);
    d.delayTime.value = 0.008;
    chain(d);
    for (const [ms, hz] of [
      [room.wow.depthMs, room.wow.rateHz],
      [room.wow.flutterMs, room.wow.flutterHz],
    ] as const) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = hz;
      const depth = ctx.createGain();
      depth.gain.value = ms / 1000;
      lfo.connect(depth).connect(d.delayTime);
      sources.push(lfo);
      nodes.push(depth);
    }
  }
  if (room.highpass) {
    chain(filter("highpass", room.highpass));
    chain(filter("highpass", room.highpass));
  }
  if (room.lowpass) {
    chain(filter("lowpass", room.lowpass));
    chain(filter("lowpass", room.lowpass));
  }
  for (const b of room.eq) chain(filter(b.type, b.freq, b.gain, b.q ?? 1));

  const width = room.width ?? 1;
  if (width !== 1) {
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    node.connect(split);
    // L' = L(1+w)/2 + R(1-w)/2 ; R' = R(1+w)/2 + L(1-w)/2
    const same = (1 + width) / 2;
    const cross = (1 - width) / 2;
    const gains = [same, cross, cross, same].map((v) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    });
    split.connect(gains[0]!, 0).connect(merge, 0, 0);
    split.connect(gains[1]!, 1).connect(merge, 0, 0);
    split.connect(gains[2]!, 0).connect(merge, 0, 1);
    split.connect(gains[3]!, 1).connect(merge, 0, 1);
    nodes.push(split, merge, ...gains);
    node = merge;
  }
  if (room.compress) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = room.compress.threshold;
    c.ratio.value = room.compress.ratio;
    c.knee.value = 6;
    c.attack.value = 0.005;
    c.release.value = 0.15;
    chain(c);
    const makeup = ctx.createGain();
    makeup.gain.value = dbToGain(
      Math.min(9, (-room.compress.threshold * (1 - 1 / room.compress.ratio)) / 3),
    );
    chain(makeup);
  }
  if (room.drive) {
    const ws = ctx.createWaveShaper();
    ws.curve = saturation(room.drive);
    ws.oversample = "2x";
    chain(ws);
  }
  if (room.reverb) {
    const sum = ctx.createGain();
    node.connect(sum);
    const pre = ctx.createDelay(0.2);
    pre.delayTime.value = room.reverb.predelayMs / 1000;
    const conv = ctx.createConvolver();
    const [l, r] = roomImpulse(ctx.sampleRate, room.reverb.seconds, room.reverb.damp);
    const buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
    buf.getChannelData(0).set(l);
    buf.getChannelData(1).set(r);
    conv.buffer = buf;
    const wet = ctx.createGain();
    wet.gain.value = room.reverb.wet;
    node.connect(pre).connect(conv).connect(wet).connect(sum);
    nodes.push(sum, pre, conv, wet);
    node = sum;
  }
  node.connect(output);

  if (withNoise && room.noise) {
    const [l, r] = roomNoise(room.noise.kind, ctx.sampleRate);
    const buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
    buf.getChannelData(0).set(l);
    buf.getChannelData(1).set(r);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = dbToGain(room.noise.db);
    src.connect(g).connect(output);
    sources.push(src);
    nodes.push(g);
  }

  let started = false;
  return {
    input,
    output,
    start(when) {
      if (started) return;
      started = true;
      for (const s of sources) s.start(when);
    },
    dispose() {
      for (const s of sources) {
        try {
          if (started) s.stop();
        } catch {
          /* already stopped */
        }
      }
      for (const n of nodes) n.disconnect();
    },
  };
}
