import type { BusState, PluginInstance, Track, VcaId } from "./types";
import { FADER_MAX_GAIN } from "./fader-taper";

/**
 * VCA linking: moving a VCA control moves every member channel's own control by the same
 * amount (fader in dB, pan, channel EQ bands), so the channel faders/knobs visibly follow.
 * Each member keeps a "virtual" position so pulling the VCA to the bottom and back
 * restores the original balance instead of flattening every channel to the same level.
 */

export const DB_FLOOR = -100;
const EPS = 1e-4;

export const gainToDb = (g: number) => (g <= 0 ? DB_FLOOR : Math.max(DB_FLOOR, 20 * Math.log10(g)));
export const dbToGain = (db: number) => (db <= DB_FLOOR ? 0 : Math.pow(10, db / 20));

export interface LinkMemory {
  virtual: number;
  applied: number;
}

/** Shifts one value by delta, clamped; a value moved by hand since the last link restarts from where it is. */
export function linkStep(
  current: number,
  delta: number,
  min: number,
  max: number,
  memory?: LinkMemory,
): { value: number; memory: LinkMemory } {
  const base = memory && Math.abs(memory.applied - current) < EPS ? memory.virtual : current;
  const virtual = base + delta;
  const value = Math.min(max, Math.max(min, virtual));
  return { value, memory: { virtual, applied: value } };
}

export type VcaLinkParam = "volume" | "pan" | "eqLow" | "eqMid" | "eqHigh";
export const VCA_EQ_BANDS: [VcaLinkParam, "low" | "mid" | "high"][] = [
  ["eqLow", "low"],
  ["eqMid", "mid"],
  ["eqHigh", "high"],
];
export const EQ_RANGE = 18;

const eqBand = (t: Track, band: string) =>
  (t.plugins ?? []).find((p) => p.kind === "eq")?.params.find((p) => p.id === band)?.value ?? 0;

/**
 * Applies a VCA change to its member channels. `memory` is session-only and keyed by
 * `${vca}:${param}:${trackId}`. Returns the same array when nothing moves.
 */
export function applyVcaLink(
  tracks: Track[],
  vca: VcaId,
  prev: BusState,
  next: BusState,
  memory: Map<string, LinkMemory>,
  makeEq: () => PluginInstance | null,
): Track[] {
  const dVol = gainToDb(next.volume) - gainToDb(prev.volume);
  const dPan = (next.pan ?? 0) - (prev.pan ?? 0);
  const dEq = VCA_EQ_BANDS.map(
    ([key, band]) => [key, band, (next[key] ?? 0) - (prev[key] ?? 0)] as const,
  ).filter(([, , d]) => d !== 0);
  if (dVol === 0 && dPan === 0 && dEq.length === 0) return tracks;
  let changed = false;
  const out = tracks.map((t) => {
    if (t.vca !== vca) return t;
    const patch: Partial<Track> = {};
    if (dVol !== 0) {
      const key = `${vca}:volume:${t.id}`;
      const r = linkStep(
        gainToDb(t.volume),
        dVol,
        DB_FLOOR,
        gainToDb(FADER_MAX_GAIN),
        memory.get(key),
      );
      memory.set(key, r.memory);
      patch.volume = Math.min(FADER_MAX_GAIN, dbToGain(r.value));
    }
    if (dPan !== 0) {
      const key = `${vca}:pan:${t.id}`;
      const r = linkStep(t.pan, dPan, -1, 1, memory.get(key));
      memory.set(key, r.memory);
      patch.pan = r.value;
    }
    if (dEq.length) {
      let plugins = t.plugins ?? [];
      if (!plugins.some((p) => p.kind === "eq")) {
        const eq = makeEq();
        if (eq) plugins = [...plugins, eq];
      }
      for (const [key, band, d] of dEq) {
        const mk = `${vca}:${key}:${t.id}`;
        const r = linkStep(eqBand({ ...t, plugins }, band), d, -EQ_RANGE, EQ_RANGE, memory.get(mk));
        memory.set(mk, r.memory);
        let done = false;
        plugins = plugins.map((p) => {
          if (done || p.kind !== "eq") return p;
          done = true;
          return {
            ...p,
            params: p.params.map((x) => (x.id === band ? { ...x, value: r.value } : x)),
          };
        });
      }
      patch.plugins = plugins;
    }
    changed = true;
    return { ...t, ...patch };
  });
  return changed ? out : tracks;
}

/**
 * Older projects stored a VCA level that scaled its channels behind their faders. Bake that
 * level into the channel faders and reset the VCA to 0 dB, so the mix sounds exactly the same
 * now that VCAs move the faders themselves.
 */
export function bakeLegacyVca(
  tracks: Track[],
  vcas: Record<VcaId, BusState>,
): { tracks: Track[]; vcas: Record<VcaId, BusState> } {
  const scaled = (Object.keys(vcas) as VcaId[]).filter((id) => vcas[id].volume !== 1);
  if (!scaled.length) return { tracks, vcas };
  const nextTracks = tracks.map((t) =>
    t.vca && scaled.includes(t.vca)
      ? { ...t, volume: Math.min(FADER_MAX_GAIN, Math.max(0, t.volume * vcas[t.vca].volume)) }
      : t,
  );
  const nextVcas = { ...vcas };
  for (const id of scaled) nextVcas[id] = { ...vcas[id], volume: 1 };
  return { tracks: nextTracks, vcas: nextVcas };
}
