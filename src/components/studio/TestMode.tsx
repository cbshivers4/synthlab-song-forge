import { useEffect, useRef } from "react";
import { FlaskConical } from "lucide-react";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { getReelRecorder } from "@/lib/synclab/reel-recorder";
import { getPlayStep } from "@/lib/synclab/playhead";
import { BASS_TEMPLATES, PROGRESSIONS, cleanBassPatch, riffBass, rootsFromKey } from "@/lib/synclab/bass-gen";
import { applyPreset } from "@/lib/synclab/presets";
import { TEST_MODE, TEST_MODE_MESSAGE } from "@/lib/synclab/test-mode";
import type { DrumPad, MidiNote } from "@/lib/synclab/types";

// Test mode only (?test=1). This file must never import account, payment, cloud or backend modules.

/** Always-visible badge while test mode is on. */
export function TestModeBadge() {
  return (
    <div role="status" className="pointer-events-none fixed left-1/2 top-1 z-[9999] -translate-x-1/2 rounded-full border border-destructive bg-background/95 px-3 py-1 font-mono text-xs font-bold tracking-wider text-destructive shadow-lg">
      <FlaskConical className="mr-1 inline size-3.5" aria-hidden />TEST MODE — nothing is saved
    </div>
  );
}

/** Shown instead of AI tools in test mode (they need the network). */
export function TestModeOff({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-2 p-6 text-center">
      <p className="font-display text-lg">{name}</p>
      <p className="text-sm text-muted-foreground">{TEST_MODE_MESSAGE}</p>
    </div>
  );
}

const BARS = 4;
const BAR_STEPS = 16;

const toDb = (v: number) => (v > 0 ? Math.round(20 * Math.log10(v) * 10) / 10 : -Infinity);
function levels(buf: Float32Array | null) {
  if (!buf || !buf.length) return { peakDb: -Infinity, rmsDb: -Infinity };
  let peak = 0;
  let sum = 0;
  for (const s of buf) {
    const a = Math.abs(s);
    if (a > peak) peak = a;
    sum += s * s;
  }
  return { peakDb: toDb(peak), rmsDb: toDb(Math.sqrt(sum / buf.length)) };
}
function base64Float32(data: Float32Array) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** A short melody for the synth track (A minor, one note per beat pair). */
const MELODY: Omit<MidiNote, "id">[] = [69, 72, 76, 74, 72, 69, 67, 69].map((pitch, i) => ({ step: i * 8, length: 6, pitch, velocity: 0.8 }));

function fourOnTheFloor(pad: DrumPad): DrumPad {
  const on = (list: number[]) => Array.from({ length: BAR_STEPS }, (_, i) => (list.includes(i) ? 0.9 : 0));
  const steps = pad.kind === "kick" ? on([0, 4, 8, 12]) : pad.kind === "snare" || pad.kind === "clap" ? on([4, 12]) : pad.kind === "hat" ? on([2, 6, 10, 14]) : on([]);
  return { ...pad, steps };
}

/**
 * Loads the fixed demo once and exposes window.__synclabTest. Rendered only in test mode.
 * Uses the studio's own actions (the same ones the transport and Mixer buttons call); no audio processing is added.
 */
export function TestModeHarness() {
  const studio = useStudio();
  const ref = useRef(studio);
  ref.current = studio;
  const drumId = useRef<string | null>(null);
  const loaded = useRef(false);

  // 1. Build the demo song in memory.
  useEffect(() => {
    if (!TEST_MODE || loaded.current) return;
    loaded.current = true;
    const s = ref.current;
    for (const t of s.tracks) s.removeTrack(t.id);
    s.setTransport({ bpm: 120, bars: BARS, loop: true, loopStart: 0, loopEnd: BARS * BAR_STEPS, step: 0, playing: false, recording: false });
    drumId.current = s.addTrack("drum", "DRUMS", undefined, { keepPanel: true });
    const tpl = BASS_TEMPLATES.find((t) => t.id === "detroit-techno")!;
    const degrees = PROGRESSIONS.find((p) => p.id === tpl.prog)!.degrees;
    const bassNotes = riffBass(rootsFromKey(tpl.tonic, tpl.minor, degrees, BARS), tpl.riff, BAR_STEPS, tpl.octave);
    const bass = s.addTrack("instrument", `BASS · ${tpl.label}`, tpl.sound, { keepPanel: true });
    s.updateTrack(bass, { steps: BARS * BAR_STEPS, notes: bassNotes, patch: cleanBassPatch(applyPreset(tpl.sound)) });
    const synth = s.addTrack("instrument", "SYNTH", undefined, { keepPanel: true });
    s.updateTrack(synth, { steps: BARS * BAR_STEPS, notes: MELODY.map((n, i) => ({ ...n, id: `test-melody-${i}` })) });
    s.setPanel("reel-recorder");
  }, []);

  // 2. Fill the drum pattern once its pads exist.
  const drum = studio.tracks.find((t) => t.id === drumId.current);
  const drumFilled = useRef(false);
  useEffect(() => {
    if (drumFilled.current || !drum?.pads?.length) return;
    drumFilled.current = true;
    ref.current.updateTrack(drum.id, { steps: BAR_STEPS, pads: drum.pads.map(fourOnTheFloor) });
  }, [drum]);

  // 3. The automation API.
  useEffect(() => {
    if (!TEST_MODE) return;
    const engine = getEngine();
    const api = {
      getState: () => {
        const s = ref.current;
        return {
          transport: { ...s.transport, step: s.transport.playing ? getPlayStep() : s.transport.step },
          tracks: s.tracks.map((t) => ({ id: t.id, name: t.name, kind: t.kind, muted: t.muted, solo: t.solo, armed: t.armed, volume: t.volume, pan: t.pan, notes: t.notes?.length ?? 0 })),
        };
      },
      play: () => { if (!ref.current.transport.playing) ref.current.togglePlay(); },
      stop: () => ref.current.stop(),
      setLoop: (on: boolean) => ref.current.setTransport({ loop: !!on }),
      record: () => { if (!ref.current.transport.recording) ref.current.toggleRecord(); },
      seek: (step: number) => ref.current.setTransport({ step: Math.max(0, Math.floor(step)) }),
      // Recording checks: add a microphone channel, arm channels, set the count-in and read takes.
      addAudioTrack: () => ref.current.addTrack("audio", "VOCAL", undefined, { keepPanel: true }),
      arm: (trackId: string, on: boolean) => ref.current.updateTrack(trackId, { armed: !!on }),
      setCountIn: (bars: number) => ref.current.setTransport({ countIn: bars > 0, countInBars: Math.max(1, Math.floor(bars) || 1) }),
      getClips: (trackId: string) => (ref.current.tracks.find((t) => t.id === trackId)?.clips ?? []).map((c) => ({ name: c.name, start: c.start, offset: c.offset, length: c.length, duration: c.duration })),
      // Same calls as the Mixer's M and S buttons.
      setMute: (trackId: string, on: boolean) => ref.current.updateTrack(trackId, { muted: !!on }),
      setSolo: (trackId: string, on: boolean) => ref.current.updateTrack(trackId, { solo: !!on }),
      getMasterMeter: () => ({ L: levels(engine.getMasterChannel(0, "wave")), R: levels(engine.getMasterChannel(1, "wave")) }),
      captureMaster: async (seconds: number) => {
        const secs = Math.min(30, Math.max(0.1, Number(seconds) || 1));
        if (engine.capturing) throw new Error("The master output is already being captured (an export or bounce is running).");
        engine.startCapture();
        await new Promise((r) => setTimeout(r, secs * 1000));
        const cap = engine.stopCapture();
        if (!cap) throw new Error("Audio is not running yet — call play() first.");
        return { sampleRate: cap.sampleRate, left: base64Float32(cap.left), right: base64Float32(cap.right) };
      },
      getReelState: () => ({ ...getReelRecorder().getSnapshot() }),
    };
    const w = window as typeof window & { __synclabTest?: typeof api };
    w.__synclabTest = api;
    return () => { delete w.__synclabTest; };
  }, []);

  return null;
}
