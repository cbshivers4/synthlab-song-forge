import type { PluginInstance, PluginKind } from "./types";
import { AMP_KINDS, PEDAL_KINDS } from "./creative-fx";

/**
 * Amp Room helpers: the guitar rig is not a separate audio path. Amps and pedals stay ordinary
 * inserts in the track's effect chain (so saving, the mixer, the FX Rack and export all agree);
 * these pure helpers only decide where a new device goes and which inserts the rig shows.
 */
export const isPedal = (kind: PluginKind) => (PEDAL_KINDS as readonly string[]).includes(kind);
export const isAmp = (kind: PluginKind) => (AMP_KINDS as readonly string[]).includes(kind);
export const isRigDevice = (kind: PluginKind) => isPedal(kind) || isAmp(kind);

/** Pedals plug in before the amp (guitar → pedals → amp); amps go after the last rig device. */
export function insertRigDevice(chain: PluginInstance[], inst: PluginInstance): PluginInstance[] {
  const list = [...chain];
  if (isPedal(inst.kind)) {
    const amp = list.findIndex((p) => isAmp(p.kind));
    if (amp >= 0) { list.splice(amp, 0, inst); return list; }
  }
  let last = -1;
  list.forEach((p, i) => { if (isRigDevice(p.kind)) last = i; });
  list.splice(last + 1, 0, inst);
  return list;
}

/** The rig devices on a track, in signal order, with their real position in the whole chain. */
export function rigDevices(chain: PluginInstance[] = []): { plugin: PluginInstance; index: number }[] {
  return chain.map((plugin, index) => ({ plugin, index })).filter((x) => isRigDevice(x.plugin.kind));
}

/** Other inserts on the same track (EQ, reverb…) that the sound also passes through. */
export const otherInserts = (chain: PluginInstance[] = []) => chain.filter((p) => !isRigDevice(p.kind)).length;
