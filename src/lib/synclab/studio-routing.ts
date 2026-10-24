import type { Track } from "./types";

export type StudioJack = { device: string; port: string };
export const STUDIO_SENDS = ["reverb", "delay", "chorus"] as const;

/** Only expose routes the existing mixer/insert model can actually represent. */
export function studioCablePatch(track: Pick<Track, "id" | "plugins" | "sends">, from: StudioJack, to: StudioJack): Partial<Track> | null {
  const plugins = track.plugins ?? [];
  const sourceFx = from.device.startsWith("fx:") ? from.device.slice(3) : undefined;
  if (from.port !== "out" || (from.device !== `track:${track.id}` && !plugins.some(p => p.id === sourceFx)) || from.device === to.device) return null;
  if (to.device.startsWith("fx:") && to.port === "in") {
    const targetId = to.device.slice(3);
    const target = plugins.find(p => p.id === targetId);
    if (!target) return null;
    const ordered = plugins.filter(p => p.id !== targetId);
    const index = sourceFx ? ordered.findIndex(p => p.id === sourceFx) + 1 : 0;
    ordered.splice(index, 0, { ...target, bypass: false });
    return { plugins: ordered };
  }
  if (to.device === "master" && to.port === `in:${track.id}`) {
    const index = sourceFx ? plugins.findIndex(p => p.id === sourceFx) + 1 : 0;
    return { plugins: plugins.map((p, i) => i >= index ? { ...p, bypass: true } : p) };
  }
  const bus = STUDIO_SENDS.find(b => to.device === `bus:${b}`);
  if (bus && to.port === "in" && !sourceFx) return { sends: { reverb: 0, delay: 0, chorus: 0, ...track.sends, [bus]: 0.5 } };
  return null;
}