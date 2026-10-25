import type { AudioClip, Track } from './types';
import { clipRate, clipSeconds } from './types';
import { uid } from './presets';

/** Paste material, not channel settings; even the source channel is a valid target. */
export function pasteTrackContent(target: Track, source: Track, at: number, stepDuration: number): Track {
  const origin = Math.min(...(source.clips ?? []).map(c => c.start ?? 0), ...(source.notes ?? []).map(n => n.step), ...(source.pads?.some(p => p.steps.some(v => v > 0)) ? [0] : []));
  const shift = Math.max(0, at) - (Number.isFinite(origin) ? origin : 0);
  const clips = (source.clips ?? []).map(c => ({ ...structuredClone(c), id: uid(), start: (c.start ?? 0) + shift }));
  const end = Math.max(at + source.steps, ...clips.map(c => (c.start ?? 0) + clipSeconds(c) / stepDuration), ...(source.notes ?? []).map(n => n.step + shift + n.length));
  const notes = (source.notes ?? []).map(n => ({ ...n, id: uid(), step: n.step + shift, recordedEnd: n.recordedEnd !== undefined ? n.recordedEnd + shift : end }));
  const steps = Math.max(target.steps, Math.ceil(end));
  const pads = target.pads?.map((pad, i) => {
    const values = Array.from({ length: steps }, (_, s) => pad.steps[s % Math.max(1, pad.steps.length)] ?? 0);
    source.pads?.[i]?.steps.forEach((v, s) => { if (v > 0) values[Math.max(0, Math.round(at) + s)] = v; });
    return { ...pad, steps: values };
  });
  return { ...target, steps, notes: [...(target.notes ?? []), ...notes], clips: [...(target.clips ?? []), ...clips], pads,
    activeClipId: clips[0]?.id ?? target.activeClipId,
    ...(clips.length && ['instrument', 'midi', 'drum', 'sampler'].includes(target.kind) ? { printedAudio: true } : {}) };
}

export function materialEnd(track: Track, stepDuration: number): number {
  return Math.max(track.steps, ...(track.notes ?? []).map(n => n.step + n.length), ...(track.clips ?? []).map(c => (c.start ?? 0) + clipSeconds(c) / stepDuration));
}

/** Reveal source audio when available; beyond the source end, stretch the selected audio. */
export function rightEdgeEdit(clip: AudioClip, deltaSeconds: number, barSeconds: number, fine: boolean) {
  const current = clipSeconds(clip);
  const raw = current + deltaSeconds;
  const seconds = Math.max(0.05, fine ? raw : Math.max(barSeconds, Math.round(raw / barSeconds) * barSeconds));
  const available = (clip.duration - (clip.offset ?? 0)) / clipRate(clip);
  return { seconds, length: Math.min(clip.duration - (clip.offset ?? 0), seconds * clipRate(clip)), stretch: seconds > available + 0.001 ? seconds / current : null };
}