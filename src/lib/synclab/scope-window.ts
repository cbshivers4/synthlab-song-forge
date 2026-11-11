import { useSyncExternalStore } from "react";
import type { Track } from "./types";

/** Which signal the expanded scope window watches. `modular` taps only carry a waveform. */
export type ScopeSource = { id: string; label: string; kind?: "engine" | "modular" };
export type ScopeView = "spectrum" | "wave";
export type ScopeWindowState = { open: boolean; source: ScopeSource; view: ScopeView; follow: boolean };

export const MASTER_SOURCE: ScopeSource = { id: "master", label: "Master Section" };
export const SCOPE_BUS_IDS = ["drums", "vocals", "instruments", "synths", "fx"] as const;

/** Frequency range and labels of the big analyzer (log scale, matching the reference window). */
export const SPECTRUM_MIN_HZ = 20;
export const SPECTRUM_MAX_HZ = 20000;
export const SPECTRUM_FREQ_MARKS = [20, 80, 320, 1300, 5100, 20000] as const;
export const SPECTRUM_MINOR_MARKS = [30, 40, 50, 60, 100, 200, 500, 700, 2000, 3000, 8000, 10000, 15000] as const;
/** Real dBFS range of the analyzer; levels are never boosted for display. */
export const SPECTRUM_DB_TOP = 0;
export const SPECTRUM_DB_BOTTOM = -96;
export const SPECTRUM_DB_MARKS = [0, -12, -24, -36, -48, -60, -72, -84] as const;

const LOG_SPAN = Math.log(SPECTRUM_MAX_HZ / SPECTRUM_MIN_HZ);

/** 0..1 across the window for a frequency. */
export function freqToFrac(hz: number): number {
  const f = Math.max(SPECTRUM_MIN_HZ, Math.min(SPECTRUM_MAX_HZ, hz));
  return Math.log(f / SPECTRUM_MIN_HZ) / LOG_SPAN;
}

export function fracToFreq(frac: number): number {
  return SPECTRUM_MIN_HZ * Math.exp(Math.max(0, Math.min(1, frac)) * LOG_SPAN);
}

/** 0 at the top (0 dBFS) to 1 at the bottom (−96 dBFS). */
export function dbToFrac(db: number): number {
  const v = Number.isFinite(db) ? db : SPECTRUM_DB_BOTTOM;
  return Math.max(0, Math.min(1, (SPECTRUM_DB_TOP - v) / (SPECTRUM_DB_TOP - SPECTRUM_DB_BOTTOM)));
}

export function binForFreq(hz: number, sampleRate: number, bins: number): number {
  return Math.max(0, Math.min(bins - 1, Math.round((hz / (sampleRate / 2)) * bins)));
}

export function formatFreq(hz: number): string {
  if (hz >= 1000) {
    const k = hz / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)} kHz`;
  }
  return `${Math.round(hz)} Hz`;
}

/** Start the waveform view on a rising zero crossing so the trace stands still. */
export function triggerIndex(data: ArrayLike<number>, span: number): number {
  const limit = Math.max(0, data.length - span);
  for (let i = 1; i < limit; i++) if ((data[i - 1] ?? 0) < 0 && (data[i] ?? 0) >= 0) return i;
  return 0;
}

/** Every signal you can pick in the window, grouped the way the mixer lists them. */
export function scopeSourceGroups(tracks: Track[]): { label: string; sources: ScopeSource[] }[] {
  return [
    { label: "Main", sources: [MASTER_SOURCE] },
    { label: "Buses", sources: SCOPE_BUS_IDS.map((id) => ({ id: `bus:${id}`, label: `${id[0]!.toUpperCase()}${id.slice(1)} bus` })) },
    { label: "Channels", sources: tracks.map((t) => ({ id: `ch:${t.id}`, label: t.name })) },
    {
      label: "Effects",
      sources: tracks.flatMap((t) => (t.plugins ?? []).map((p) => ({ id: p.id, label: `${t.name} · ${p.name}` }))),
    },
  ].filter((g) => g.sources.length > 0);
}

/** Name a small scope's tap for the window title; bypassed scopes point at their effect. */
export function scopeSourceFor(scopeId: string, tracks: Track[]): ScopeSource {
  const id = scopeId.startsWith("bypassed:") ? scopeId.slice("bypassed:".length) : scopeId;
  const found = scopeSourceGroups(tracks).flatMap((g) => g.sources).find((s) => s.id === id);
  if (found) return found;
  if (id === "bus:master") return MASTER_SOURCE;
  return { id, label: id.startsWith("bus:") ? `${id.slice(4)} bus` : "Scope" };
}

/** Follow Selection: the selected channel, or the master when nothing is selected. */
export function followedSource(selectedId: string | null, tracks: Track[]): ScopeSource {
  const t = selectedId ? tracks.find((x) => x.id === selectedId) : undefined;
  return t ? { id: `ch:${t.id}`, label: t.name } : MASTER_SOURCE;
}

/** A bypassed effect has no live output tap of its own. */
export function bypassedEffect(sourceId: string, tracks: Track[]): boolean {
  return tracks.some((t) => (t.plugins ?? []).some((p) => p.id === sourceId && p.bypass));
}

// ---- tiny shared store: one window per layout, opened from any small scope ----
let state: ScopeWindowState = { open: false, source: MASTER_SOURCE, view: "spectrum", follow: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openScopeWindow(source: ScopeSource, view?: ScopeView) {
  const nextView: ScopeView = source.kind === "modular" ? "wave" : view ?? state.view;
  state = { open: true, source, view: nextView, follow: false };
  emit();
}

export function updateScopeWindow(patch: Partial<ScopeWindowState>) {
  state = { ...state, ...patch };
  if (state.source.kind === "modular") state.view = "wave";
  emit();
}

export function closeScopeWindow() {
  state = { ...state, open: false };
  emit();
}

export function getScopeWindow(): ScopeWindowState {
  return state;
}

export function useScopeWindow(): ScopeWindowState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}
