import type { PluginInstance, PluginKind, PluginParam } from "./types";

/**
 * Some devices share a DSP kind (Stereo Delay and Tape Echo are both "delay").
 * Each gets its own extra controls here so they never sound alike; the engine
 * reads the same defaults for older saved inserts that predate these knobs.
 */
const p = (id: string, name: string, value: number, min: number, max: number, unit?: string): PluginParam => ({ id, name, value, min, max, ...(unit ? { unit } : {}) });

type Device = Pick<PluginInstance, "kind" | "name">;
export const isTapeEcho = (pl: Device) => pl.kind === "delay" && pl.name.toLowerCase().includes("echo");
export const isStereoDelay = (pl: Device) => pl.kind === "delay" && pl.name === "Stereo Delay";

export function deviceExtras(pl: { kind: PluginKind; name?: string | undefined }): PluginParam[] {
  const device = { kind: pl.kind, name: pl.name ?? "" };
  if (isTapeEcho(device)) return [p("heads", "Heads", 3, 1, 3), p("wow", "Wow & Flutter", 0.35, 0, 1), p("saturation", "Tape Saturation", 0.45, 0, 1)];
  if (isStereoDelay(device)) return [p("pingpong", "Ping-Pong", 1, 0, 1)];
  return [];
}

/** Default for a device-only knob, used when an older saved insert has no value for it. */
export function deviceDefault(pl: Device, id: string, fallback: number): number {
  return deviceExtras(pl).find(x => x.id === id)?.value ?? fallback;
}
