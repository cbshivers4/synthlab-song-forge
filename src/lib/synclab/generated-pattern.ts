import { SyncLabEngine } from "./audio-engine";
import { applyPreset, defaultPads } from "./presets";
import type { MidiNote, SynthPatch } from "./types";

export interface GeneratedPattern {
  notes?: Pick<MidiNote, "step" | "length" | "pitch" | "velocity">[] | undefined;
  hits?: { step: number; kind: string; velocity: number }[] | undefined;
  instrument?: string | undefined;
  /** Exact sound to draw with (e.g. the cleaned bass patch); otherwise the named preset. */
  patch?: SynthPatch | undefined;
  steps: number;
}

/** Reuses the real voice graph in an isolated, silent offline context. */
class PatternEngine extends SyncLabEngine {
  constructor(private offline: OfflineAudioContext) {
    super();
    this.master = offline.createGain();
    this.master.connect(offline.destination);
    this.reverbSend = offline.createGain();
    this.delaySend = offline.createGain();
    this.chorusSend = offline.createGain();
  }
  override init(): AudioContext {
    // Voice methods use only the shared BaseAudioContext surface. Never resume,
    // select devices, register listeners or initialize the live singleton here.
    return this.offline as unknown as AudioContext;
  }
  override busNode(): GainNode {
    if (!this.master) throw new Error("Pattern output unavailable");
    return this.master;
  }
}

export async function renderGeneratedPattern(pattern: GeneratedPattern, bpm: number): Promise<AudioBuffer> {
  const stepSec = 60 / Math.max(1, bpm) / 4;
  const patch = pattern.patch ?? applyPreset(pattern.instrument ?? "Init Saw");
  const duration = Math.min(120, pattern.steps * stepSec + Math.max(2, patch.amp.release + 0.25));
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * 44100), 44100);
  const engine = new PatternEngine(ctx);
  const id = "offline-generated-pattern";
  for (const note of pattern.notes ?? []) {
    if (note.step < 0 || note.step >= pattern.steps) continue;
    engine.playNote(id, patch, note.pitch, Math.max(0.01, note.length * stepSec), note.velocity, note.step * stepSec + 0.002);
  }
  const pads = defaultPads(pattern.steps);
  for (const hit of pattern.hits ?? []) {
    const pad = pads.find((p) => p.kind === hit.kind);
    if (pad && hit.step >= 0 && hit.step < pattern.steps) engine.playDrum(id, pad, hit.velocity, hit.step * stepSec + 0.002);
  }
  return ctx.startRendering();
}