/**
 * Bassline Generator player (rule-based, no AI). A bassline is mixed from two built-in banks of
 * source phrases: ON-BEAT lines (notes on the 8th-note grid, steps 1, 3, 5…) and OFF-BEAT lines
 * (the 16ths in between). Each lane picks one of 64 sources per bank — low numbers are sparse
 * root lines, high numbers are busy, melodic lines. Variators briefly swap in other sources during
 * the cycle; Note Range stretches intervals; Minorness forces major intervals to minor ones.
 * Everything here is pure and deterministic so the note display, preview and timeline agree.
 */
import type { MidiNote } from "./types";

export const BLG_SOURCES = 64;
export const BLG_SLOTS = 8;
export type BlgBank = "A" | "B";
export type BlgLaneId = "on" | "off";

export const BLG_RATES = [
  { id: "1/4", label: "1/4", len: 4 },
  { id: "1/8", label: "1/8", len: 2 },
  { id: "1/8T", label: "1/8T", len: 4 / 3 },
  { id: "1/16", label: "1/16", len: 1 },
  { id: "1/16T", label: "1/16T", len: 2 / 3 },
  { id: "1/32", label: "1/32", len: 0.5 },
] as const;
export type BlgRate = (typeof BLG_RATES)[number]["id"];
export const rateLen = (r: BlgRate) => BLG_RATES.find((x) => x.id === r)?.len ?? 1;

const SHAPE_BASES = ["square", "pulse", "ramp"] as const;
export const VARIATOR_SHAPES: { id: string; label: string }[] = [
  { id: "off", label: "Off" },
  ...SHAPE_BASES.flatMap((b) =>
    [1, 2, 4].flatMap((m) => {
      const name = `${b[0]!.toUpperCase()}${b.slice(1)}${m > 1 ? ` x${m}` : ""}`;
      return [
        { id: `${b}${m > 1 ? m : ""}`, label: name },
        { id: `${b}${m > 1 ? m : ""}-inv`, label: `${name} inv` },
      ];
    }),
  ),
];

export interface BlgLane {
  bank: BlgBank;
  /** Source phrase 0–63: low = sparse root notes, high = busy melodic lines. */
  index: number;
  /** 0 turns the lane off; 1 = full velocity. */
  velocity: number;
  /** 0.1–1: share of each source note's natural length. */
  length: number;
  variator: string;
  /** −1…1: how far the variator moves the source selection (negative = simpler). */
  amount: number;
}

/** One step of the finished mono line. `iv` is semitones above the root. */
export interface BlgCell {
  iv: number;
  vel: number;
  len: number;
  lane: BlgLaneId;
  tie: boolean;
}

export interface BlgPattern {
  steps: number; // 16–64
  rate: BlgRate;
  /** 50 = straight, 66 = triplet swing, 75 = dotted. */
  shuffle: number;
  /** Pitch class 0–11 of the root. */
  root: number;
  shift: number; // −32…32
  on: BlgLane;
  off: BlgLane;
  /** −1…1: shrinks or stretches intervals away from the root. */
  range: number;
  /** 0–4: forces 7ths, 3rds, 6ths, then 2nds to their minor versions. */
  minorness: number;
  /** Hand edits from the note display; replaces the generated line while set. */
  edits: (BlgCell | null)[] | null;
}

export const defaultLane = (lane: BlgLaneId): BlgLane =>
  lane === "on"
    ? { bank: "A", index: 12, velocity: 0.9, length: 0.55, variator: "off", amount: 0 }
    : { bank: "A", index: 6, velocity: 0.75, length: 0.6, variator: "off", amount: 0 };

export const defaultBlgPattern = (root = 9): BlgPattern => ({
  steps: 16,
  rate: "1/16",
  shuffle: 50,
  root,
  shift: 0,
  on: defaultLane("on"),
  off: defaultLane("off"),
  range: 0,
  minorness: 2,
  edits: null,
});

// ---------- source phrases ----------
interface SrcSlot {
  hit: boolean;
  iv: number;
  len: number;
  acc: boolean;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]): T =>
  xs[Math.floor(r() * xs.length) % xs.length]!;

// Intervals are stored in their "major" form (3rd = 4, 6th = 9, 7th = 11, 2nd = 2); Minorness flattens them.
const ON_POOLS = [
  [0],
  [0, 0, 0, 12],
  [0, 0, 12, 7],
  [0, 12, 7, 11, 5],
  [0, 12, 7, 4, 11, 5, 9],
  [0, 12, 7, 4, 11, 5, 9, 2, 14, -5],
];
const OFF_POOLS = [
  [12],
  [12, 0],
  [12, 0, 7],
  [12, 0, 7, 11, 5, -1],
  [12, 7, 0, 11, 4, 14, -1, 5],
  [12, 7, 11, 4, 9, 14, 2, -1, 16, 19],
];

const sourceCache = new Map<string, SrcSlot[]>();

/** One 64-step source phrase as 32 slots (on-beat slot k = step 2k, off-beat slot k = step 2k+1). */
export function sourceSlots(lane: BlgLaneId, bank: BlgBank, index: number): SrcSlot[] {
  const idx = Math.max(0, Math.min(BLG_SOURCES - 1, Math.round(index)));
  const key = `${lane}${bank}${idx}`;
  const hit = sourceCache.get(key);
  if (hit) return hit;
  const r = mulberry(
    ((lane === "on" ? 1 : 7) * 1009 + (bank === "A" ? 0 : 50021) + idx * 7919) ^ 0x5bd1e995,
  );
  const c = idx / (BLG_SOURCES - 1);
  const b = bank === "B";
  const pools = lane === "on" ? ON_POOLS : OFF_POOLS;
  const tier = Math.min(
    pools.length - 1,
    Math.floor(c * (pools.length - 0.01)) + (b && c > 0.2 ? 1 : 0),
  );
  const pool = pools[tier]!;
  const density =
    lane === "on" ? (b ? 0.16 + 0.6 * c : 0.25 + 0.72 * c) : b ? 0.06 + 0.62 * c : 0.05 + 0.8 * c;

  const makeCell = (fillFrom: number, base?: SrcSlot[]): SrcSlot[] => {
    const cell: SrcSlot[] = base ? base.map((s) => ({ ...s })) : [];
    let prev = 0;
    for (let k = fillFrom; k < BLG_SLOTS; k++) {
      // Quarter-note slots (on-beat) and the "a" pickups (off-beat) are the strongest positions.
      const weight = lane === "on" ? (k % 2 === 0 ? 1.25 : 0.78) : k % 2 === 1 ? 1.3 : 0.7;
      let on = r() < Math.min(0.98, density * weight);
      if (lane === "on" && k === 0 && !base) on = b ? r() > 0.45 : true;
      // The downbeat and beat 3 lean on the root so every line still sounds anchored.
      const strong = lane === "on" && (k === 0 || k === 4) && r() < 0.75 - 0.4 * c;
      const iv = strong ? 0 : r() < 0.35 + 0.3 * (1 - c) ? prev : pick(r, pool);
      const len = b ? pick(r, [1, 1, 2, 2, 3]) : c > 0.6 && r() < 0.2 ? 2 : 1;
      cell[k] = { hit: on, iv: on ? iv : 0, len, acc: k === 0 || r() < 0.28 };
      if (on) prev = iv;
    }
    return cell;
  };
  const a = makeCell(0);
  const answer = makeCell(c < 0.25 ? 7 : 5, a);
  const answer2 = makeCell(3, a);
  const bars = b ? [a, answer, a, answer2] : [a, a, a, answer];
  const out = bars.flat();
  sourceCache.set(key, out);
  return out;
}

// ---------- variators ----------
/** Variator value 0–1 at pattern step `pos` of `len` steps. */
export function variatorValue(shape: string, pos: number, len: number): number {
  if (!shape || shape === "off") return 0;
  const inv = shape.endsWith("-inv");
  const id = inv ? shape.slice(0, -4) : shape;
  const base = SHAPE_BASES.find((s) => id.startsWith(s));
  if (!base) return 0;
  const mult = Number(id.slice(base.length)) || 1;
  const cycle = Math.max(1, len / mult);
  const within = pos % cycle;
  const phase = (inv ? cycle - 1e-6 - within : within) / cycle;
  if (base === "square") return phase >= 0.5 ? 1 : 0;
  if (base === "pulse") return phase >= 0.75 ? 1 : 0;
  return Math.floor(phase * 4) / 3;
}

// ---------- pitch shaping ----------
const SCALE_MAJ = [0, 2, 4, 5, 7, 9, 11];
const snapToScale = (iv: number) => {
  const oct = Math.floor(iv / 12);
  const pc = iv - oct * 12;
  let best = SCALE_MAJ[0]!;
  for (const s of SCALE_MAJ) if (Math.abs(s - pc) < Math.abs(best - pc)) best = s;
  if (Math.abs(12 - pc) < Math.abs(best - pc)) best = 12;
  return oct * 12 + best;
};

/** Note Range: −1 shrinks (an octave becomes a fifth), +1 stretches (an octave becomes an octave + fifth). */
export function stretchInterval(iv: number, range: number): number {
  if (iv === 0 || range === 0) return iv;
  const out = snapToScale(Math.round(iv * (1 + range * 0.58)));
  return out === 0 ? Math.sign(iv) * 2 : out;
}

/** Minorness 1: maj7→min7, 2: + maj3→min3, 3: + maj6→min6, 4: + maj2→min2. */
export function applyMinorness(iv: number, minorness: number): number {
  const pc = ((iv % 12) + 12) % 12;
  const rules: [number, number][] = [
    [11, 1],
    [4, 2],
    [9, 3],
    [2, 4],
  ];
  for (const [from, level] of rules) if (pc === from && minorness >= level) return iv - 1;
  return iv;
}

// ---------- the line ----------
/** The generated mono line for one pattern (ignores hand edits). */
export function generateLine(p: BlgPattern): (BlgCell | null)[] {
  const L = clampSteps(p.steps);
  const raw: { pos: number; cell: BlgCell; natural: number }[] = [];
  for (let s = 0; s < L; s++) {
    const laneId: BlgLaneId = s % 2 === 0 ? "on" : "off";
    const lane = p[laneId];
    if (!(lane.velocity > 0)) continue;
    const idx = lane.index + lane.amount * (BLG_SOURCES - 1) * variatorValue(lane.variator, s, L);
    const src = sourceSlots(laneId, lane.bank, idx)[Math.floor(s / 2) % 32]!;
    if (!src.hit) continue;
    const iv = applyMinorness(stretchInterval(src.iv, p.range), p.minorness);
    const natural = Math.max(0.25, src.len * 2 * Math.max(0.1, Math.min(1, lane.length)));
    raw.push({
      pos: (((s + Math.round(p.shift)) % L) + L) % L,
      natural,
      cell: {
        iv,
        vel: Math.min(1, lane.velocity * (src.acc ? 1 : 0.78)),
        len: natural,
        lane: laneId,
        tie: false,
      },
    });
  }
  raw.sort((a, b) => a.pos - b.pos);
  const line: (BlgCell | null)[] = Array.from({ length: L }, () => null);
  raw.forEach((n, i) => {
    if (line[n.pos]) return; // two lanes landing on one step after a shift: first wins
    const next = raw.slice(i + 1).find((m) => m.pos > n.pos)?.pos ?? L;
    const gap = next - n.pos;
    const tie = n.natural >= gap;
    line[n.pos] = { ...n.cell, len: tie ? gap : n.natural, tie };
  });
  return line;
}

export const clampSteps = (n: number) => Math.max(16, Math.min(64, Math.round(n) || 16));

/** The line that plays: hand edits when present, otherwise the generated line. */
export function currentLine(p: BlgPattern): (BlgCell | null)[] {
  if (!p.edits) return generateLine(p);
  return fitTies(
    p.edits
      .slice(0, clampSteps(p.steps))
      .concat(Array(Math.max(0, clampSteps(p.steps) - p.edits.length)).fill(null)),
  );
}

/** Tied notes run up to the next note; others never overlap it (the line is mono). */
export function fitTies(line: (BlgCell | null)[]): (BlgCell | null)[] {
  const L = line.length;
  return line.map((c, i) => {
    if (!c) return null;
    let next = L;
    for (let j = i + 1; j < L; j++)
      if (line[j]) {
        next = j;
        break;
      }
    const gap = next - i;
    return { ...c, len: c.tie ? gap : Math.min(c.len, gap) };
  });
}

/** Start editing by hand from what is currently shown. */
export const editableLine = (p: BlgPattern) => currentLine(p).map((c) => (c ? { ...c } : null));

export interface BlgRenderOptions {
  bars: number;
  barSteps: number;
  octave: number;
  rootsPerBar?: number[] | null;
}

/** Render a pattern into timeline notes (16th-note steps; fractional steps for triplets/shuffle). */
export function blgNotes(p: BlgPattern, o: BlgRenderOptions): MidiNote[] {
  const L = clampSteps(p.steps);
  const rl = rateLen(p.rate);
  const total = Math.max(1, o.bars) * o.barSteps;
  const swing =
    Math.max(0, Math.min(0.5, (Math.max(50, Math.min(75, p.shuffle)) * 2 - 100) / 100)) * rl;
  const line = currentLine(p);
  const nonce = Date.now().toString(36);
  const out: MidiNote[] = [];
  for (let k = 0; k * rl < total; k++) {
    const s = k % L;
    const cell = line[s];
    if (!cell) continue;
    const off = s % 2 === 1 ? swing : 0;
    const t = k * rl + off;
    if (t >= total) break;
    const bar = Math.floor((k * rl) / o.barSteps);
    const root =
      o.rootsPerBar && o.rootsPerBar.length ? o.rootsPerBar[bar % o.rootsPerBar.length]! : p.root;
    const pitch = Math.max(12, Math.min(96, 12 * (o.octave + 1) + root + cell.iv));
    const len = Math.max(0.1, Math.min(cell.len * rl - off, total - t));
    out.push({
      id: `blg-${nonce}-${k}`,
      step: Math.round(t * 1000) / 1000,
      length: Math.round(len * 1000) / 1000,
      pitch,
      velocity: Math.round(cell.vel * 100) / 100,
    });
  }
  return out;
}

// ---------- randomize ----------
export function randomLane(lane: BlgLaneId, rand = Math.random): BlgLane {
  const shapes = VARIATOR_SHAPES.map((s) => s.id);
  return {
    bank: rand() < 0.5 ? "A" : "B",
    index: Math.floor(rand() * (lane === "on" ? 56 : 48)) + (lane === "on" ? 4 : 0),
    velocity: lane === "off" && rand() < 0.15 ? 0 : 0.65 + rand() * 0.35,
    length: 0.3 + rand() * 0.7,
    variator: rand() < 0.45 ? "off" : shapes[1 + Math.floor(rand() * (shapes.length - 1))]!,
    amount: Math.round((rand() * 1.4 - 0.5) * 100) / 100,
  };
}

export function randomizeBlg(p: BlgPattern, rand = Math.random): BlgPattern {
  return {
    ...p,
    on: randomLane("on", rand),
    off: randomLane("off", rand),
    range: Math.round((rand() * 1.2 - 0.4) * 100) / 100,
    minorness: Math.floor(rand() * 5),
    edits: null,
  };
}

// ---------- patches ----------
export interface BlgPreset {
  id: string;
  label: string;
  genre: string;
  sound: string;
  bpm: number;
  octave: number;
  pattern: Omit<BlgPattern, "edits" | "root"> & { root: number };
}
const P = (
  id: string,
  label: string,
  genre: string,
  sound: string,
  bpm: number,
  root: number,
  on: [BlgBank, number, number, number, string?, number?],
  off: [BlgBank, number, number, number, string?, number?],
  extra: Partial<
    Pick<BlgPattern, "steps" | "rate" | "shuffle" | "shift" | "range" | "minorness">
  > = {},
  octave = 1,
): BlgPreset => ({
  id,
  label,
  genre,
  sound,
  bpm,
  octave,
  pattern: {
    steps: 16,
    rate: "1/16",
    shuffle: 50,
    shift: 0,
    range: 0,
    minorness: 2,
    root,
    ...extra,
    on: {
      bank: on[0],
      index: on[1],
      velocity: on[2],
      length: on[3],
      variator: on[4] ?? "off",
      amount: on[5] ?? 0,
    },
    off: {
      bank: off[0],
      index: off[1],
      velocity: off[2],
      length: off[3],
      variator: off[4] ?? "off",
      amount: off[5] ?? 0,
    },
  },
});

export const BLG_PRESETS: BlgPreset[] = [
  P(
    "techno-roller",
    "Techno Roller",
    "Techno",
    "Sub Pressure",
    130,
    5,
    ["A", 2, 0, 0.5],
    ["A", 30, 0.9, 0.55, "square", 0.3],
    { minorness: 3 },
  ),
  P(
    "techno-peak",
    "Peak Time Pulse",
    "Techno",
    "Analog Mono Bass",
    134,
    7,
    ["A", 10, 0.85, 0.35],
    ["A", 44, 0.8, 0.4, "pulse2", 0.25],
    { minorness: 4, steps: 32 },
  ),
  P(
    "detroit-strings",
    "Detroit Motor City",
    "Detroit Techno",
    "Moog Mono",
    128,
    5,
    ["A", 22, 0.9, 0.5, "pulse", 0.35],
    ["A", 26, 0.75, 0.5],
    { steps: 32, minorness: 2 },
  ),
  P(
    "detroit-deep",
    "Deep Detroit",
    "Detroit Techno",
    "Round Bass",
    124,
    0,
    ["B", 18, 0.9, 0.8],
    ["A", 14, 0.7, 0.6, "ramp", 0.3],
    { minorness: 2, range: -0.2 },
  ),
  P(
    "ghetto-tech",
    "Ghetto Tech Bounce",
    "Ghetto Tech",
    "808 Sub Glide",
    150,
    7,
    ["A", 30, 1, 0.9, "square2", 0.2],
    ["A", 20, 0.85, 0.45],
    { minorness: 3 },
  ),
  P(
    "electro-drexciya",
    "Electro Deep Sea",
    "Electro",
    "Sine Thump Bass",
    126,
    0,
    ["B", 34, 0.95, 0.6, "square", 0.4],
    ["A", 18, 0.75, 0.4],
    { minorness: 2, steps: 32, shuffle: 54 },
  ),
  P(
    "electro-funk",
    "Electro Funk",
    "Electro",
    "FM-Style Bass",
    118,
    2,
    ["A", 40, 0.9, 0.45],
    ["B", 28, 0.8, 0.5, "pulse2", 0.3],
    { minorness: 1, shuffle: 58 },
  ),
  P(
    "house-classic",
    "Classic House",
    "House",
    "Round Bass",
    124,
    9,
    ["A", 19, 0.95, 0.75],
    ["A", 10, 0.6, 0.4, "pulse", 0.3],
    { minorness: 2, shift: 2 },
  ),
  P(
    "house-organ",
    "Organ House Walk",
    "House",
    "Punch Bass",
    122,
    2,
    ["A", 26, 0.85, 0.6],
    ["A", 22, 0.85, 0.7, "square", 0.3],
    { minorness: 1, shuffle: 56, steps: 32 },
  ),
  P(
    "deep-house",
    "Deep House Groove",
    "House",
    "Analog Mono Bass",
    120,
    3,
    ["B", 24, 0.85, 0.85],
    ["B", 16, 0.7, 0.6, "ramp-inv", 0.3],
    { minorness: 3, shuffle: 58, range: 0.2 },
  ),
  P(
    "tech-house",
    "Tech House Rumble",
    "Tech House",
    "Sub Bass",
    126,
    10,
    ["A", 6, 0.9, 0.4],
    ["B", 38, 0.85, 0.45, "pulse4", 0.2],
    { minorness: 4, shuffle: 55 },
  ),
  P(
    "minimal",
    "Minimal Click",
    "Minimal",
    "Pluck Bass",
    125,
    4,
    ["A", 4, 0.8, 0.25],
    ["A", 36, 0.75, 0.3, "square4", -0.3],
    { minorness: 4, steps: 32 },
  ),
  P(
    "trance-gallop",
    "Trance Gallop",
    "Trance",
    "Fat Unison Bass",
    138,
    9,
    ["A", 19, 0.9, 0.45],
    ["A", 40, 0.8, 0.4],
    { minorness: 2, range: -0.3, shift: 2 },
  ),
  P(
    "acid-squelch",
    "Acid Line",
    "Acid",
    "Acid Bass II",
    128,
    0,
    ["A", 50, 0.9, 0.4, "square2", 0.25],
    ["A", 52, 0.8, 0.5, "ramp", 0.2],
    { minorness: 3, range: 0.4, steps: 32 },
  ),
  P(
    "disco-octaves",
    "Disco Octaves",
    "Disco",
    "Pick Bass",
    118,
    4,
    ["A", 20, 0.9, 0.45],
    ["A", 12, 0.85, 0.45],
    { minorness: 0, range: 0, shuffle: 52 },
  ),
  P(
    "nu-disco",
    "Nu-Disco Strut",
    "Disco",
    "Slap Bass",
    116,
    9,
    ["B", 40, 0.9, 0.5, "pulse", 0.3],
    ["A", 32, 0.8, 0.45],
    { minorness: 1, shuffle: 56, steps: 32 },
  ),
  P(
    "funk-slap",
    "Funk Slap",
    "Funk",
    "Slap Bass",
    104,
    4,
    ["A", 46, 0.95, 0.4, "pulse2", 0.25],
    ["B", 44, 0.85, 0.35],
    { minorness: 1, shuffle: 60, range: 0.3 },
  ),
  P(
    "neo-soul",
    "Neo Soul Lazy",
    "Neo Soul",
    "Upright Bass",
    88,
    5,
    ["B", 42, 0.85, 0.8, "ramp", 0.25],
    ["B", 30, 0.65, 0.7],
    { minorness: 1, shuffle: 64, range: 0.35, steps: 32 },
  ),
  P(
    "rnb-smooth",
    "R&B Smooth",
    "R&B",
    "Round Bass",
    92,
    3,
    ["B", 30, 0.9, 0.9],
    ["B", 20, 0.65, 0.8, "square-inv", 0.3],
    { minorness: 2, shuffle: 62 },
  ),
  P(
    "hiphop-boom",
    "Boom Bap",
    "Hip-Hop",
    "Upright-ish",
    90,
    2,
    ["B", 14, 0.95, 0.8],
    ["B", 10, 0.75, 0.6, "pulse", 0.4],
    { minorness: 3, shuffle: 64 },
  ),
  P(
    "trap-808",
    "Trap 808",
    "Trap",
    "808 Sub Glide",
    140,
    6,
    ["B", 8, 1, 1, "square", 0.35],
    ["B", 6, 0.8, 0.9],
    { minorness: 4, rate: "1/16", steps: 32 },
    0,
  ),
  P(
    "drill-slide",
    "Drill Slide",
    "Drill",
    "Drill Slide",
    142,
    1,
    ["B", 16, 1, 1, "pulse2", 0.4],
    ["B", 22, 0.85, 1],
    { minorness: 4, steps: 32, range: 0.15 },
    0,
  ),
  P(
    "afrobeat",
    "Afrobeat Talk",
    "Afrobeat",
    "Pick Bass",
    108,
    7,
    ["B", 36, 0.9, 0.5, "square2", 0.2],
    ["A", 40, 0.85, 0.45],
    { minorness: 2, shuffle: 57 },
  ),
  P(
    "afro-house",
    "Afro House Rolling",
    "Afro House",
    "Sub Bass",
    122,
    9,
    ["A", 18, 0.9, 0.5],
    ["B", 34, 0.85, 0.5, "ramp2", 0.25],
    { minorness: 3, steps: 32 },
  ),
  P(
    "reggae-dub",
    "Dub Reggae",
    "Reggae",
    "Deep Sub Drone",
    76,
    7,
    ["B", 20, 0.95, 0.9],
    ["A", 4, 0.6, 0.6],
    { minorness: 2, rate: "1/8", shuffle: 60 },
  ),
  P(
    "ukg-2step",
    "UK Garage 2-Step",
    "UK Garage",
    "Reese Bass",
    132,
    1,
    ["B", 26, 0.9, 0.7, "pulse", 0.35],
    ["B", 36, 0.85, 0.5],
    { minorness: 3, shuffle: 62 },
  ),
  P(
    "dnb-roller",
    "DnB Roller",
    "Drum & Bass",
    "Reese Growl",
    174,
    2,
    ["B", 12, 0.95, 1],
    ["B", 18, 0.75, 0.8, "square", 0.3],
    { minorness: 3, rate: "1/8", steps: 32 },
  ),
  P(
    "jungle-sub",
    "Jungle Sub",
    "Drum & Bass",
    "Sub Bass",
    170,
    7,
    ["A", 30, 0.95, 0.7],
    ["A", 46, 0.75, 0.4, "pulse2", 0.3],
    { minorness: 4, rate: "1/16", steps: 32, range: -0.2 },
  ),
  P(
    "dubstep-halftime",
    "Halftime Wobble",
    "Dubstep",
    "Wobble Bass",
    140,
    5,
    ["B", 10, 1, 1],
    ["B", 4, 0.8, 1, "pulse", 0.5],
    { minorness: 4, rate: "1/8", steps: 16 },
    0,
  ),
  P(
    "synthwave",
    "Synthwave Drive",
    "Synthwave",
    "Analog Mono Bass",
    100,
    9,
    ["A", 16, 0.9, 0.6, "square", 0.25],
    ["A", 16, 0.85, 0.6],
    { minorness: 2, rate: "1/16", range: -0.1 },
  ),
  P(
    "pop-eighths",
    "Pop Eighths",
    "Pop",
    "Pick Bass",
    112,
    0,
    ["A", 14, 0.9, 0.85, "pulse4", 0.2],
    ["A", 0, 0, 0.5],
    { minorness: 0, range: 0.1 },
  ),
  P(
    "jazz-walk",
    "Jazz Walk",
    "Jazz",
    "Upright Bass",
    120,
    5,
    ["B", 60, 0.85, 0.9, "ramp", 0.15],
    ["A", 2, 0, 0.5],
    { minorness: 1, rate: "1/8", shuffle: 66, range: 0.2, steps: 32 },
  ),
  P(
    "latin-tumbao",
    "Latin Tumbao",
    "Latin",
    "Pluck Bass",
    100,
    7,
    ["A", 8, 0.9, 0.6],
    ["B", 50, 0.85, 0.6, "square-inv", 0.25],
    { minorness: 0, shift: 3 },
  ),
  P(
    "melodic-lead",
    "Melodic Line",
    "Melodic",
    "Moog Mono",
    120,
    9,
    ["B", 62, 0.9, 0.55, "ramp2", 0.15],
    ["B", 58, 0.8, 0.5, "square4", -0.2],
    { minorness: 2, range: 0.6, steps: 32 },
  ),
];

export const BLG_GENRES = [...new Set(BLG_PRESETS.map((p) => p.genre))];

export const presetPattern = (p: BlgPreset): BlgPattern => ({
  ...p.pattern,
  on: { ...p.pattern.on },
  off: { ...p.pattern.off },
  edits: null,
});
