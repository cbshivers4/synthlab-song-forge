import type { AutomationLane, AutomationParam, AutomationPoint, Track } from "./types";

/** Channel controls (fader, pan, sends) that automation lanes can record from live moves. */
export const LIVE_PARAMS = ["volume", "pan", "sendReverb", "sendDelay"] as const satisfies readonly AutomationParam[];
type LiveParam = (typeof LIVE_PARAMS)[number];
export const isLiveParam = (param: AutomationParam): param is LiveParam => (LIVE_PARAMS as readonly string[]).includes(param);

/** The control's current value in lane units: volume/sends 0..1.2, pan -1..1. */
export function liveValue(track: Pick<Track, "volume" | "pan" | "sends">, param: LiveParam): number {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
  if (param === "volume") return clamp(track.volume, 0, 1.2);
  if (param === "pan") return clamp(track.pan, -1, 1);
  if (param === "sendReverb") return clamp(track.sends?.reverb ?? 0, 0, 1.2);
  return clamp(track.sends?.delay ?? 0, 0, 1.2);
}

/** Which live controls a track edit moved. */
export function movedLiveParams(prev: Track, patch: Partial<Track>): LiveParam[] {
  const out: LiveParam[] = [];
  if (patch.volume !== undefined && patch.volume !== prev.volume) out.push("volume");
  if (patch.pan !== undefined && patch.pan !== prev.pan) out.push("pan");
  if (patch.sends && patch.sends.reverb !== prev.sends?.reverb) out.push("sendReverb");
  if (patch.sends && patch.sends.delay !== prev.sends?.delay) out.push("sendDelay");
  return out;
}

/** Write records continuously; Latch from the first touch until Stop; Touch only while the control moves. */
export function laneWrites(lane: Pick<AutomationLane, "mode" | "locked">, touching: boolean, latched: boolean): boolean {
  if (lane.locked) return false;
  return lane.mode === "write" || (lane.mode === "latch" && latched) || (lane.mode === "touch" && touching);
}

/** Read plays the curve; Touch and Latch play it whenever they aren't recording. */
export function laneReads(lane: Pick<AutomationLane, "mode" | "locked">, touching: boolean, latched: boolean): boolean {
  if (lane.mode === "read") return true;
  if (lane.mode === "touch") return !touching;
  if (lane.mode === "latch") return !latched && !touching;
  return false;
}

export function writePoint(points: AutomationPoint[], step: number, value: number): AutomationPoint[] {
  return [...points.filter((p) => p.step !== step), { step, value }].sort((a, b) => a.step - b.step);
}
