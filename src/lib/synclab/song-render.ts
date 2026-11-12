import { SyncLabEngine, getEngine } from "./audio-engine";
import type { Capture } from "./bounce";
import { laneReads, valueAt } from "./automation-write";
import { OFFLINE_LIVE, scheduleStep } from "./schedule-step";
import { switchStateAt } from "./switch-automation";
import { stepSeconds } from "./timebase";
import { ensureVocalTune } from "./vocal-tune";
import type { PluginInstance, Track, Transport } from "./types";

/** The live engine's mixer, voices and effects, built on a silent offline context. */
class SongEngine extends SyncLabEngine {
  constructor(offline: OfflineAudioContext, live: SyncLabEngine) {
    super();
    this.ctx = offline as unknown as AudioContext;
    this.buildGraph(offline);
    // Decoded audio is context-independent, so clips and samples reuse what the studio already loaded.
    for (const [url, buf] of live.decodedAudio()) this.sampleBuffers.set(url, buf);
  }
  override init(): AudioContext {
    // Never resume, pick devices or install listeners: this context only renders.
    return this.ctx!;
  }
}

export interface SongRenderInput {
  tracks: Track[];
  transport: Transport;
  buses: Record<string, { volume: number; muted: boolean; gain?: number | undefined }>;
  vcas: Record<string, { volume: number; muted: boolean }>;
  auxReturns: Record<string, { volume: number; muted: boolean }>;
  fxChains: Record<string, PluginInstance[]>;
  startStep: number;
  lengthSteps: number;
  /** seconds of tail after the last step, for reverb/delay/release */
  tail: number;
  sampleRate: number;
}


/** Track state at a step: recorded mute/solo presses applied. */
export function tracksAtStep(tracks: Track[], step: number): Track[] {
  return tracks.map((t) => {
    const muted = switchStateAt(t.muteEvents, step);
    const solo = switchStateAt(t.soloEvents, step);
    return muted === undefined && solo === undefined ? t : { ...t, muted: muted ?? t.muted, solo: solo ?? t.solo };
  });
}

/** Every audio file the song needs decoded before rendering. */
export function songAudioUrls(tracks: Track[]): string[] {
  const urls = new Set<string>();
  for (const t of tracks) {
    for (const c of t.clips ?? []) if (c.url) urls.add(c.url);
    if (t.sampler?.url) urls.add(t.sampler.url);
    if (t.patch?.granular?.source === "sample" && t.patch.granular.sampleUrl) urls.add(t.patch.granular.sampleUrl);
    for (const p of t.pads ?? []) if (p.sampleUrl) urls.add(p.sampleUrl);
  }
  return [...urls];
}

/**
 * Renders the arrangement faster than real time through the same scheduler, voices, mixer,
 * inserts and buses as live playback. Returns null when the browser has no offline rendering.
 */
export async function renderSong(input: SongRenderInput): Promise<Capture | null> {
  if (typeof OfflineAudioContext === "undefined") return null;
  const live = getEngine();
  live.init();
  await Promise.all(songAudioUrls(input.tracks).map((url) => live.ensureBuffer(url)));

  const stepDur = stepSeconds(input.transport.bpm);
  const seconds = input.lengthSteps * stepDur + Math.max(0, input.tail);
  const frames = Math.max(1, Math.ceil(seconds * input.sampleRate));
  const ctx = new OfflineAudioContext(2, frames, input.sampleRate);
  const engine = new SongEngine(ctx, live);
  engine.tempo = input.transport.bpm;

  for (const [id, b] of Object.entries(input.buses)) engine.setBus(id, b.volume, b.muted, b.gain ?? 1);
  engine.setVcaStates(input.vcas, input.tracks);
  for (const [id, a] of Object.entries(input.auxReturns)) engine.setAuxReturn(id, a.volume, a.muted);
  // Channels with recorded mute/solo presses stay open in the mixer; the scheduler skips their
  // notes and clips while they're muted, so the presses land at their step.
  const anyRecordedSolo = input.tracks.some((t) => t.soloEvents?.length);
  engine.syncMix(input.tracks.map((t) => ({
    ...t,
    ...(t.muteEvents?.length ? { muted: false } : {}),
    ...(anyRecordedSolo ? { solo: false } : {}),
  })));
  // Vocal Tune runs in an audio worklet; load it on this context first so exports are corrected too.
  const usesTune = [...input.tracks.flatMap((t) => t.plugins ?? []), ...Object.values(input.fxChains).flat()].some((pl) => pl.kind === "vocaltune" && !pl.bypass);
  if (usesTune) await ensureVocalTune(ctx).catch(() => { /* no worklet support: the export carries the dry voice */ });
  for (const t of input.tracks) engine.setInserts(t.id, t.plugins ?? []);
  for (const [target, list] of Object.entries(input.fxChains)) engine.setFxInserts(target, list);

  // Export plays the range straight through: no loop wrap, no metronome.
  const tp: Transport = { ...input.transport, loop: false, metronome: false, recording: false };
  for (let i = 0; i < input.lengthSteps; i++) {
    const n = input.startStep + i;
    const when = i * stepDur;
    const list = tracksAtStep(input.tracks, n);
    scheduleStep(engine, list, tp, n, when, { ...OFFLINE_LIVE, lastScheduled: i === 0 ? null : n - 1 });
    const anySolo = list.some((t) => t.solo);
    for (const t of list) {
      if (t.muted || t.deviceBypassed || t.frozen || (anySolo && !t.solo) || !t.automation?.length) continue;
      const ride: Record<string, number> = {};
      for (const lane of t.automation) {
        if (lane.points.length && laneReads(lane, false, false)) ride[lane.param] = valueAt(lane.points, n);
      }
      if (Object.keys(ride).length) engine.automate(t.id, ride, when);
    }
  }

  const rendered = await ctx.startRendering();
  const left = new Float32Array(rendered.getChannelData(0));
  const right = new Float32Array(rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0));
  return { left, right, sampleRate: rendered.sampleRate };
}
