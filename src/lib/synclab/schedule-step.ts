import { chainedPads } from "./drum-chain";
import { arpHitOffset, arpStepSeconds } from "./synth-timing";
import { arpLiveNote } from "./live-arp";
import type { getEngine } from "./audio-engine";
import { clipRate, laneValueAt, type SynthPatch, type Track, type Transport } from "./types";
import { songSteps, stepSeconds, stepsPerBar, STEPS_PER_BEAT } from "./timebase";
import { playbackPreferences } from "./preferences";
import { processMidiThroughPlugins } from "./plugins";

type Engine = ReturnType<typeof getEngine>;

/** Live-take bookkeeping the realtime scheduler supplies; offline renders use none of it. */
export interface ScheduleLive {
  /** step handed to the audio clock just before this one, null after a start/jump */
  lastScheduled: number | null;
  /** true once for a clip that must pick up mid-way (e.g. after an edit during playback) */
  pickupClip: (clipId: string) => boolean;
  /** a hit just played live into this take was already heard */
  liveHit: (trackId: string, padId: string, step: number) => boolean;
  /** a note played live into this take (or replaced by it) was already heard */
  skipNote: (noteId: string) => boolean;
}

export const OFFLINE_LIVE: ScheduleLive = { lastScheduled: null, pickupClip: () => false, liveHit: () => false, skipNote: () => false };

/** Plays one note: a sampler channel uses its loaded file, everything else the synth. */
export function triggerNote(engine: Engine, t: Track, midi: number, dur: number, vel: number, when?: number, hold_?: number) {
  if (t.kind === "sampler" && t.sampler) {
    const s = t.sampler;
    const chops = s.slices ?? [];
    const idx = midi - s.rootNote;
    const shifted = midi + (t.octave ?? 0) * 12;
    if (chops.length > 0 && idx >= 0 && idx < chops.length) {
      // each key from the root upwards plays one chop at its original pitch
      const start = chops[idx] as number;
      const end = (chops[idx + 1] ?? s.end) as number;
      engine.playSample(t.id, { ...s, start, end, loop: false }, s.rootNote, dur, vel, when, s.chopChoke ? `chop-choke-${s.chopChoke}` : `chop-${idx}`);
      return;
    }
    engine.playSample(t.id, s, shifted, dur, vel, when);
    return;
  }
  if (!t.patch) return;
  const pitches = processMidiThroughPlugins(midi + (t.octave ?? 0) * 12, t.plugins);
  // Hand-played notes (no scheduled time) go through the live arpeggiator when ARP is on;
  // a quick tap still runs at least four arp steps so it is audible.
  if (when === undefined && t.patch.arp?.on && !t.patch.modular) {
    const hold = hold_ ?? Math.max(dur, 4 * arpStepSeconds(t.patch.arp, 60 / Math.max(20, engine.tempo || 120) / 4));
    if (pitches.every((p) => arpLiveNote(engine, t.id, t.patch as SynthPatch, p, hold, vel))) return;
  }
  for (const pitch of pitches) engine.playNote(t.id, t.patch, pitch, dur, vel, when);
}

/**
 * Queue everything that makes sound for one step at an exact audio time. Shared by live
 * playback and the offline song render, so an export plays exactly what you hear.
 */
export function scheduleStep(engine: Engine, list: Track[], tp: Transport, n: number, when: number, live: ScheduleLive) {
  const stepDur = stepSeconds(tp.bpm);
  engine.tempo = tp.bpm;
  const anySolo = list.some((t) => t.solo);
  const totalSteps = songSteps(tp.bars);
  // swing pushes every off-beat 16th later, up to half a step — the shuffle
  // a drum machine gives you. Arrangement clips keep their exact position.
  const swung = when + (n % 2 === 1 ? Math.min(0.9, Math.max(0, tp.swing ?? 0)) * 0.5 * stepDur : 0);
  for (const t of list) {
    if (t.muted || t.deviceBypassed || t.frozen || (anySolo && !t.solo)) continue;
    const len = Math.max(1, t.steps);
    const s = n % len;
    // arrangement clips fire at their own position on the timeline
    if (t.clips?.length && !t.recording &&
        (!(["instrument", "midi", "drum"].includes(t.kind)) || t.printedAudio)) {
      const at = n % totalSteps;
      // after a start or jump (loop wrap), pick up clips already in progress
      const jumpedAll = live.lastScheduled === null || at !== (live.lastScheduled + 1) % totalSteps;
      for (const c of t.clips) {
        if (!c.url) continue;
        const jumped = live.pickupClip(c.id) || jumpedAll;
        const cs = c.start ?? 0;
        const rate = clipRate(c);
        const fullLen = c.length ?? c.duration ?? 0;
        let skip = 0;
        let startWhen = when;
        if (cs >= at && cs < at + 1) {
          // A replacement can leave a clip starting between grid steps.
          startWhen += (cs - at) * stepDur;
        } else if (jumped && at > cs) {
          skip = (at - cs) * stepDur * rate;
          if (skip >= fullLen - 0.02) continue;
        } else continue;
        // A clip never rings past the loop end: when the loop wraps it is
        // started again, and a still-playing tail would sound doubled.
        let playLen = fullLen - skip;
        if (tp.loop) {
          const lo = Math.max(0, Math.min(totalSteps - 1, tp.loopStart ?? 0));
          const hi = Math.min(totalSteps, Math.max(lo + 1, tp.loopEnd ?? totalSteps));
          if (at < hi) {
            const room = ((hi - at) * stepDur - (startWhen - when)) * rate;
            playLen = Math.min(playLen, room);
          }
        }
        if (playLen < 0.02) continue;
        engine.playClip(
          t.id,
          {
            url: c.url,
            // Reversed playback starts at the far end of the trim window:
            // shortening its length advances the heard start, not its offset.
            offset: (c.offset ?? 0) + (c.reverse ? 0 : skip),
            length: playLen,
            gain: c.gain ?? 1,
            fadeIn: skip ? 0.01 : (c.fadeIn ?? 0.004),
            fadeOut: c.fadeOut ?? 0.01,
            rate,
            reverse: c.reverse ?? false,
          },
          startWhen,
        );
      }
    }
    if (t.printedAudio && t.clips?.length && !t.recording) continue;
    if (t.kind === "drum" && t.pads) {
      // A pattern chain decides which pattern plays at this bar; otherwise the pads loop as usual.
      const chained = chainedPads(t, n, stepsPerBar());
      if (!chained && t.patternRegion && (n < t.patternRegion[0] || n >= t.patternRegion[1])) continue;
      const pads = chained?.pads ?? t.pads;
      const s = chained ? chained.s : n % Math.max(1, t.steps);
      const padSolo = t.pads.some((p) => p.solo);
      for (const pad of pads) {
        if (pad.muted || (padSolo && !pad.solo)) continue;
        const v = pad.steps[s] ?? 0;
        if (v <= 0) continue;
        // a hit just played live into this take was already heard — don't double it
        if (live.liveHit(t.id, pad.id, s)) continue;
        // a step with a chance below 100% only fires that often
        const chance = pad.probability?.[s];
        if (typeof chance === "number" && chance < 1 && Math.random() > chance) continue;
        const retrig = Math.max(1, Math.min(4, Math.round(pad.retrig?.[s] ?? 1)));
        const flam = Math.max(0, Math.min(1, pad.flam?.[s] ?? 0));
        const glitch = Math.max(0, Math.min(1, pad.glitch?.[s] ?? 0));
        const stepPad = {
          ...pad,
          pitch: pad.pitch + (pad.stepPitch?.[s] ?? 0) + (glitch > 0 && Math.random() < glitch ? (Math.random() < 0.5 ? -12 : 12) : 0),
          decay: Math.max(0, pad.decay * (pad.stepDecay?.[s] ?? 1) * (glitch > 0 ? 1 - Math.random() * glitch * 0.7 : 1)),
          crush: Math.max(pad.crush ?? 0, glitch > 0 && Math.random() < glitch ? glitch : 0),
        };
        const spacing = stepDur / retrig;
        for (let hit = 0; hit < retrig; hit++) engine.playDrum(t.id, stepPad, v * Math.pow(0.88, hit), swung + hit * spacing);
        if (flam > 0) engine.playDrum(t.id, stepPad, v * (0.35 + flam * 0.4), swung + 0.012 + flam * 0.035);
      }
    } else if (t.kind === "sampler" && t.sampler && t.notes) {
      for (const note of t.notes) {
        // recorded notes keep a sub-step fraction for quantize; the
        // scheduler fires on whole steps only, so compare the floored step
        const step0 = Math.floor(note.step);
        if (live.skipNote(note.id)) continue;
        if (step0 % len === s && (note.recordedEnd == null || (n >= step0 && n < note.recordedEnd))) triggerNote(engine, t, note.pitch, note.length * stepDur, note.velocity, swung + (note.step - step0) * stepDur);
      }
    } else if (t.patch && t.notes) {
      // piano-roll pitch-bend / mod-wheel lanes, interpolated per step
      const bend = laneValueAt(t.bendLane, s);
      if (bend != null) engine.setPitchBend(t.id, bend * 200, swung);
      const mod = laneValueAt(t.modLane, s);
      if (mod != null) engine.setModWheel(t.id, mod, swung);
      for (const note of t.notes) {
        const step0 = Math.floor(note.step);
        // notes played live into this take were already heard — don't double them
        if (live.skipNote(note.id)) continue;
        if (step0 % len !== s || (note.recordedEnd != null && (n < step0 || n >= note.recordedEnd))) continue;
        const dur = (note.length * stepDur) / (t.patch.arp.on ? 2 : 1);
        const octShift = (t.octave ?? 0) * 12;
        if (t.patch.arp.on) {
          const arp = t.patch.arp;
          const oct = Math.max(1, Math.round(arp.octaves));
          const rate = Math.max(0.25, arp.rate || 1);
          const arpStep = arpStepSeconds(arp, stepDur);
          const hits = Math.max(1, Math.round((note.length * stepDur) / arpStep));
          const up = Array.from({ length: oct }, (_, k) => k);
          const seq = arp.direction === "down" ? [...up].reverse()
            : arp.direction === "updown" ? (oct > 1 ? [...up, ...up.slice(1, -1).reverse()] : up)
            : arp.direction === "alternate" ? up.flatMap((k) => (k === 0 ? [0] : [k, 0]))
            : up;
          for (let i = 0; i < hits; i++) {
            const k = arp.direction === "random" ? Math.floor(Math.random() * oct) : seq[i % seq.length] ?? 0;
            engine.playNote(t.id, t.patch, note.pitch + octShift + k * 12, arpStep * arp.gate, note.velocity, swung + arpHitOffset(i, arpStep, arp.swing));
          }
        } else {
          engine.playNote(t.id, t.patch, note.pitch + octShift, dur, note.velocity, swung + (note.step - step0) * stepDur);
        }
      }
    }
  }
  if (tp.metronome && (tp.recording || playbackPreferences().clickWhilePlaying) && n % STEPS_PER_BEAT === 0) {
    const downbeat = n % stepsPerBar() === 0;
    engine.playClick(downbeat, when);
  }
}
