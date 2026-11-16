import { getPlayStep } from "@/lib/synclab/playhead";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowRightToLine, ChevronLeft, ChevronRight, Circle, Dices, Eraser, Hand, ListMusic, Lock, Pencil, Play, Save, Square, Trash2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Knob } from './Knob';
import { useStudio } from '@/lib/synclab/store';
import { applyPreset } from '@/lib/synclab/presets';
import { getEngine } from '@/lib/synclab/audio-engine';
import {
  eraseLoopNote, eraseLoopStep, gateArpById, gateArpHit, gateDegree, laneById, loopStepsFor, loopsToNotes, placeLoopNote, resizeLoops,
  touchCutoff, touchDrumAt, touchDrumColor, touchPitch, touchX, TOUCH_DRUM, TOUCH_DRUM_COLUMNS, TOUCH_DRUM_LABELS, TOUCH_GATE_ARPS,
  TOUCH_LANES, TOUCH_LOOP_BARS, TOUCH_SCALE_GROUPS, TOUCH_SCALES, type TouchLoops,
} from '@/lib/synclab/touch-synth';
import { ARP_PROGRAM_GATES, kitName, programGroupOf, TOUCH_KIT_PROGRAMS, TOUCH_PROGRAM_GROUPS } from '@/lib/synclab/touch-programs';
import type { DrumKitId, Track } from '@/lib/synclab/types';
import { createLoopPattern, genreLoops, loadGenreLoops, TOUCH_LOOP_GENRES, TOUCH_LOOP_LIBRARY } from '@/lib/synclab/touch-loop-library';
import { deleteTouchSet, onTouchSetsChange, readTouchSets, saveTouchSet, type TouchUserSet } from '@/lib/synclab/touch-user-sets';
import { PresetNavigator } from './PresetNavigator';
import { HardwareBypass } from './HardwareBypass';

/** Colour display order: kick, closed hat, open hat, snare, clap. */
const DRUM_DISPLAY = [TOUCH_DRUM.kick, TOUCH_DRUM.closedHat, TOUCH_DRUM.openHat, TOUCH_DRUM.snare, TOUCH_DRUM.clap];
/** Loop editor rows, top to bottom. */
const DRUM_ROWS = [TOUCH_DRUM.kick, TOUCH_DRUM.closedHat, TOUCH_DRUM.openHat, TOUCH_DRUM.snare, TOUCH_DRUM.clap, TOUCH_DRUM.tom];
const KEYS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const PART_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const PAD_COLS = 16;
const PAD_ROWS = 8;
const MY_SETS = '__my_sets';
const KIT_GROUPS = [...new Set(TOUCH_KIT_PROGRAMS.map((k) => k.category))];
const drumPad = (kind: string, kit?: string) => ({ id: `touch-${kind}`, name: kind, kind: kind as 'kick', kit: (kit ?? '909') as DrumKitId, volume: 1, pan: 0, pitch: 0, decay: kind === 'openhat' ? .55 : .4, muted: false, solo: false, steps: [] as number[] });
const noteName = (pitch: number) => `${KEYS[pitch % 12]}${Math.floor(pitch / 12) - 1}`;

export function TouchSynth({ track }: { track: Track }) {
  const { previewNote, updatePatch, transport, updateTrack, setTransport } = useStudio();
  const settings = track.patch?.touch ?? { root: 0, octave: 3, scale: 'Minor pentatonic', rate: 2, gate: .65 };
  const lane = laneById(settings.lane ?? 'bass');
  const loops: TouchLoops = settings.loops ?? {};
  const steps = loopStepsFor(settings.bars);
  const range = settings.range ?? 2;
  const muted = settings.muted ?? {};
  /** Each part keeps its own instrument; falls back to the part's default sound. */
  const laneSound = (id: string) => settings.sounds?.[id] ?? laneById(id).sound;
  const latest = useRef({ track, settings, lane, loops, previewNote, updatePatch, updateTrack, transport });
  latest.current = { track, settings, lane, loops, previewNote, updatePatch, updateTrack, transport };

  const pointer = useRef<number | null>(null);
  const sounding = useRef(false);
  const holdRef = useRef(false);
  const erasing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStart = useRef<number | null>(null);
  const loopStart = useRef<number | null>(null);
  const padStart = useRef(0);
  const padCount = useRef(0);
  const pos = useRef({ x: .5, y: .5 });
  const marker = useRef<HTMLDivElement>(null);
  const leds = useRef<HTMLDivElement>(null);
  const readoutEl = useRef<HTMLOutputElement>(null);
  const cells = useRef<(HTMLDivElement | null)[]>([]);
  const lastMove = useRef(0);
  const root = useRef<HTMLElement>(null);
  const litTimers = useRef(new Map<Element, number>());

  const [active, setActive] = useState(false);
  const [hold, setHold] = useState(false);
  const [recording, setRecording] = useState(false);
  const [playingLoops, setPlayingLoops] = useState(false);
  const [editMode, setEditMode] = useState<'draw' | 'erase'>('draw');
  const [genre, setGenre] = useState('Detroit Techno');
  const [presetId, setPresetId] = useState('0-0');
  const [userSets, setUserSets] = useState<TouchUserSet[]>([]);
  const [naming, setNaming] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; bpm: number } | null>(null);
  const [group, setGroup] = useState(() => programGroupOf(laneSound(lane.id))?.id ?? 'lead');
  useEffect(() => { setUserSets(readTouchSets()); return onTouchSetsChange(() => setUserSets(readTouchSets())); }, []);
  useEffect(() => { const g = programGroupOf(laneSound(lane.id)); if (g) setGroup(g.id); }, [lane.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = genre === MY_SETS;
  const choices = mine ? [] : TOUCH_LOOP_LIBRARY.filter(p => p.genre === genre);
  const selectedPreset = choices.find(p => p.id === presetId) ?? choices[0];
  const selectedUserSet = mine ? userSets.find(s => s.id === presetId) ?? userSets[0] : undefined;
  const setBpm = created?.bpm ?? (mine ? selectedUserSet?.bpm : selectedPreset?.pattern.bpm);

  const say = (text: string) => { if (readoutEl.current) readoutEl.current.textContent = text; };
  const save = (values: Partial<typeof settings>) => {
    const next = { ...latest.current.settings, ...values };
    latest.current = { ...latest.current, settings: next, loops: next.loops ?? {} };
    updatePatch(track.id, { touch: next });
  };
  const commitLoops = (next: TouchLoops) => {
    const s = latest.current;
    latest.current = { ...s, loops: next, settings: { ...s.settings, loops: next } };
    s.updatePatch(s.track.id, { touch: { ...s.settings, loops: next } });
  };

  /** Lights a drum's pad cell and colour-display window for a moment when it actually plays. */
  const flashDrum = (drum: number) => {
    root.current?.querySelectorAll(`[data-drum="${drum}"]`).forEach((el) => {
      el.setAttribute('data-lit', '');
      window.clearTimeout(litTimers.current.get(el));
      litTimers.current.set(el, window.setTimeout(() => el.removeAttribute('data-lit'), 140));
    });
  };
  /** Glowing trail square on the pad, like the hardware's lit grid. */
  const lightCell = (x: number, y: number, color: string) => {
    const col = Math.max(0, Math.min(PAD_COLS - 1, Math.floor(x * PAD_COLS)));
    const row = Math.max(0, Math.min(PAD_ROWS - 1, Math.floor((1 - y) * PAD_ROWS)));
    const el = cells.current[row * PAD_COLS + col];
    if (!el) return;
    el.style.setProperty('--cell-color', color);
    el.setAttribute('data-lit', '');
    window.clearTimeout(litTimers.current.get(el));
    litTimers.current.set(el, window.setTimeout(() => el.removeAttribute('data-lit'), 260));
  };

  const stopPad = () => {
    pointer.current = null;
    sounding.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setActive(false);
  };
  const stopLoops = () => {
    if (loopTimer.current) clearInterval(loopTimer.current);
    loopTimer.current = null;
    loopStart.current = null;
    recStart.current = null;
    setRecording(false);
    setPlayingLoops(false);
    leds.current?.querySelectorAll('[data-on]').forEach(el => el.removeAttribute('data-on'));
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (loopTimer.current) clearInterval(loopTimer.current);
    litTimers.current.forEach(t => window.clearTimeout(t));
  }, []);

  // Changing sounds, parts or sets never stops the loops or a held pad: the loop clock and pad read latest.current every step.
  const selectSound = (name: string) => {
    const patch = applyPreset(name);
    const gate = ARP_PROGRAM_GATES[name];
    const touch = { ...latest.current.settings, sounds: { ...latest.current.settings.sounds, [lane.id]: name }, ...(gate ? { gateArp: gate } : {}) };
    latest.current = { ...latest.current, settings: touch };
    updatePatch(track.id, { ...patch, touch });
    previewNote(track.id, 60 + settings.root, .4, false, { ...patch, touch });
    say(`${PART_LETTERS[TOUCH_LANES.indexOf(lane)] ?? ''} · ${name.toUpperCase()}${gate ? ` · GATE ARP ${gateArpById(gate).label.toUpperCase()}` : ''}`);
  };
  const selectKit = (kit: string) => {
    save({ kit: kit as DrumKitId });
    getEngine().playDrum(track.id, drumPad('kick', kit), .9);
    say(`DRUM KIT · ${kitName(kit).toUpperCase()}`);
  };

  const recordNote = (step: number, pitch: number, length: number) => {
    const s = latest.current;
    const total = loopStepsFor(s.settings.bars);
    const tone = s.lane.drums ? undefined : Math.round(pos.current.y * 100) / 100;
    commitLoops(placeLoopNote(s.loops, s.lane.id, { step: ((step % total) + total) % total, pitch, length, vel: .9, ...(tone != null ? { tone } : {}) }, total));
  };
  const recStep = () => {
    if (recStart.current == null) return null;
    const stepDur = 60 / latest.current.transport.bpm / 4;
    return Math.round((performance.now() - recStart.current) / 1000 / stepDur) % loopStepsFor(latest.current.settings.bars);
  };

  const playHit = (pitch: number, length: number, vel = .9) => {
    const s = latest.current;
    if (!s.track.patch) return;
    if (s.lane.drums) {
      const kinds = s.lane.drums;
      const drum = Math.max(0, Math.min(kinds.length - 1, Math.round(pitch)));
      getEngine().playDrum(s.track.id, drumPad(kinds[drum] ?? 'kick', s.settings.kit), vel);
      flashDrum(drum);
      say(`${TOUCH_DRUM_LABELS[drum] ?? 'DRUM'} · ${kitName(s.settings.kit).toUpperCase()}`);
      return;
    }
    const cutoff = touchCutoff(pos.current.y);
    const patch = { ...s.track.patch, voiceMode: 'poly' as const, cutoff, resonance: 1 + pos.current.y * 5, arp: { ...s.track.patch.arp, on: false } };
    s.previewNote(s.track.id, pitch, length, false, patch);
    lightCell(pos.current.x, pos.current.y, s.lane.color);
    say(`${noteName(pitch)} · ${Math.round(cutoff)} Hz · ${laneSound(s.lane.id).toUpperCase()}`);
  };

  /** One pad step: plays the touched note, or the gate-arp rhythm locked to the loop grid, then schedules the next step. */
  const fire = () => {
    const s = latest.current;
    if (!s.track.patch || !sounding.current) return;
    const bpm = s.transport.bpm;
    const stepDur = 60 / bpm / 4;
    const arp = gateArpById(s.settings.gateArp);
    const scaleLen = TOUCH_SCALES[s.settings.scale]?.length ?? 7;
    const r = s.settings.range ?? 2;
    const pitchFor = (degree = 0) => s.lane.drums ? touchDrumAt(pos.current.x, pos.current.y) : touchPitch(pos.current.x, s.settings.root, s.settings.octave, s.settings.scale, r, degree);
    if (!arp.steps.length) {
      const length = (60 / bpm / s.settings.rate) * s.settings.gate;
      const pitch = pitchFor();
      playHit(pitch, length);
      const step = recStep();
      if (step != null) recordNote(step, pitch, length / stepDur);
      timer.current = setTimeout(fire, (60 / bpm / s.settings.rate) * 1000);
      return;
    }
    const now = performance.now();
    const base = loopStart.current ?? padStart.current;
    const elapsed = (now - base) / 1000 / stepDur;
    const abs = loopStart.current != null ? Math.round(elapsed) : padCount.current++;
    const hit = gateArpHit(arp, abs);
    if (hit) {
      const length = hit.len * stepDur * (s.settings.gate / .65);
      const pitches = s.lane.drums ? [pitchFor()] : hit.deg.map(d => pitchFor(gateDegree(d, scaleLen)));
      for (const pitch of pitches) {
        playHit(pitch, length, hit.vel);
        if (recStart.current != null && loopStart.current != null) recordNote(abs, pitch, length / stepDur);
      }
    }
    const next = loopStart.current != null ? base + (Math.round(elapsed) + 1) * stepDur * 1000 : now + stepDur * 1000;
    timer.current = setTimeout(fire, Math.max(5, next - now));
  };

  const startLoops = () => {
    stopLoops();
    const s = latest.current;
    const stepDur = 60 / s.transport.bpm / 4;
    let step = 0;
    loopStart.current = performance.now();
    setPlayingLoops(true);
    const tick = () => {
      const cur = latest.current;
      const total = loopStepsFor(cur.settings.bars);
      step %= total;
      const ledEls = leds.current?.children;
      if (ledEls) {
        leds.current?.querySelector('[data-on]')?.removeAttribute('data-on');
        ledEls[step]?.setAttribute('data-on', '');
      }
      if (erasing.current) {
        const next = eraseLoopStep(cur.loops, cur.lane.id, step);
        if (next !== cur.loops) commitLoops(next);
      }
      const now = latest.current;
      const mutedParts = now.settings.muted ?? {};
      for (const l of TOUCH_LANES) {
        if (mutedParts[l.id]) continue;
        for (const n of now.loops[l.id] ?? []) {
          if (Math.round(n.step) !== step) continue;
          if (l.drums) {
            const drum = Math.max(0, Math.min(l.drums.length - 1, Math.round(n.pitch)));
            getEngine().playDrum(now.track.id, drumPad(l.drums[drum] ?? 'kick', now.settings.kit), n.vel);
            flashDrum(drum);
          } else if (now.track.patch) {
            const soundName = now.settings.sounds?.[l.id] ?? l.sound;
            // The part being edited plays the live track patch (that sound plus any knob tweaks) so edits are heard while the loop runs.
            const sound = l.id === now.lane.id && now.track.patch.name === soundName ? now.track.patch : applyPreset(soundName);
            const toned = n.tone != null ? { cutoff: touchCutoff(n.tone), resonance: 1 + n.tone * 5 } : {};
            const patch = { ...sound, ...toned, voiceMode: 'poly' as const, arp: { ...now.track.patch.arp, on: false } };
            now.previewNote(now.track.id, n.pitch, n.length * stepDur, false, patch);
            if (l.id === now.lane.id) lightCell(touchX(n.pitch, now.settings.root, now.settings.octave, now.settings.scale, now.settings.range ?? 2), n.tone ?? .5, l.color);
          }
        }
      }
      step = (step + 1) % total;
    };
    tick();
    loopTimer.current = setInterval(tick, stepDur * 1000);
  };

  const toggleRecord = () => {
    if (recording) { recStart.current = null; setRecording(false); return; }
    if (!playingLoops) startLoops();
    recStart.current = loopStart.current ?? performance.now();
    setRecording(true);
  };
  const toggleMute = (id: string) => save({ muted: { ...latest.current.settings.muted, [id]: !latest.current.settings.muted?.[id] } });
  const clearLane = () => {
    const next = { ...latest.current.loops };
    delete next[latest.current.lane.id];
    commitLoops(next);
  };
  const clearAll = () => {
    if (!window.confirm('Clear all five parts and start a new set?')) return;
    stopPad();
    commitLoops({});
    setCreated(null);
    say('NEW SET · ALL PARTS EMPTY');
  };
  const setBars = (bars: number) => {
    const s = latest.current;
    const from = loopStepsFor(s.settings.bars);
    save({ bars, loops: resizeLoops(s.loops, from, bars * 16) });
    say(`LOOP LENGTH · ${bars} BAR${bars > 1 ? 'S' : ''}`);
  };
  const sendToTimeline = () => {
    const s = latest.current;
    const notes = loopsToNotes(s.loops, Math.max(0, Math.floor(getPlayStep())), Date.now(), loopStepsFor(s.settings.bars), s.settings.muted ?? {});
    if (!notes.length) return;
    s.updateTrack(s.track.id, { notes: [...(s.track.notes ?? []), ...notes] });
    say(`${notes.length} NOTES SENT TO TIMELINE`);
  };

  const anyNotes = (l: TouchLoops, onlyLane?: string) => onlyLane ? (l[onlyLane]?.length ?? 0) > 0 : Object.values(l).some(n => n.length > 0);
  /** Loads a whole set (or one part of it) with its sounds and drum kit, keeping the parts you didn't ask to replace. */
  const applySet = (name: string, incoming: TouchLoops, extra: { scale?: string; root?: number; bars?: number; sounds?: Record<string, string>; kit?: string }, onlyLane: boolean) => {
    const s = latest.current;
    if (anyNotes(s.loops, onlyLane ? s.lane.id : undefined) && !window.confirm(`Replace ${onlyLane ? 'part ' + (PART_LETTERS[TOUCH_LANES.indexOf(s.lane)] ?? '') : 'all five parts'} with ${name}?`)) return;
    // Keep the loop clock (and any held pad) running so a new set takes over on the next step; only an in-progress recording pass ends.
    if (recStart.current != null) { recStart.current = null; setRecording(false); }
    const sounds = onlyLane ? { ...s.settings.sounds, ...(extra.sounds?.[s.lane.id] ? { [s.lane.id]: extra.sounds[s.lane.id]! } : {}) } : { ...s.settings.sounds, ...extra.sounds };
    const nextSettings = {
      ...s.settings,
      loops: loadGenreLoops(s.loops, incoming, onlyLane ? s.lane.id : undefined),
      sounds,
      ...(onlyLane ? {} : { scale: extra.scale ?? s.settings.scale, root: extra.root ?? s.settings.root, bars: extra.bars ?? s.settings.bars }),
      ...((!onlyLane || s.lane.drums) && extra.kit ? { kit: extra.kit as DrumKitId } : {}),
    };
    latest.current = { ...s, settings: nextSettings, loops: nextSettings.loops };
    const lanePatch = s.lane.drums ? {} : applyPreset(sounds[s.lane.id] ?? s.lane.sound);
    s.updatePatch(s.track.id, { ...lanePatch, touch: nextSettings });
    say(`${name.toUpperCase()} · ${onlyLane ? 'PART ' + (PART_LETTERS[TOUCH_LANES.indexOf(s.lane)] ?? '') : '5 PARTS'} LOADED`);
  };
  const loadSelected = (onlyLane: boolean) => {
    const s = latest.current;
    if (mine) {
      const set = selectedUserSet;
      if (!set) return;
      applySet(set.name, structuredClone(set.loops), { scale: set.scale, root: set.root, bars: set.bars, sounds: set.sounds, ...(set.kit ? { kit: set.kit } : {}) }, onlyLane);
      return;
    }
    if (!selectedPreset) return;
    const bars = s.settings.bars ?? 2;
    const scale = onlyLane ? s.settings.scale : selectedPreset.scale;
    applySet(selectedPreset.name, genreLoops(selectedPreset, s.settings.root, scale, bars), { scale: selectedPreset.scale, sounds: { ...selectedPreset.pattern.sounds }, kit: selectedPreset.pattern.kit }, onlyLane);
    setCreated(null);
  };
  const createSet = () => {
    const base = (mine ? TOUCH_LOOP_LIBRARY[0] : selectedPreset) ?? TOUCH_LOOP_LIBRARY[0];
    if (!base) return;
    const seed = Math.floor(Math.random() * 1e9);
    const pattern = createLoopPattern(base.pattern, seed);
    const s = latest.current;
    const name = pattern.names[0];
    applySet(name, genreLoops({ variation: seed % 2, pattern }, s.settings.root, pattern.scale, s.settings.bars ?? 2), { scale: pattern.scale, sounds: { ...pattern.sounds }, kit: pattern.kit }, false);
    setCreated({ name, bpm: pattern.bpm });
  };
  const saveSet = () => {
    if (naming == null) return;
    const s = latest.current;
    const saved = saveTouchSet({ name: naming, root: s.settings.root, scale: s.settings.scale, bars: s.settings.bars ?? 2, bpm: s.transport.bpm, sounds: Object.fromEntries(TOUCH_LANES.filter(l => !l.drums).map(l => [l.id, laneSound(l.id)])), loops: s.loops, ...(s.settings.kit ? { kit: s.settings.kit } : {}) });
    setNaming(null);
    setGenre(MY_SETS);
    setPresetId(saved.id);
    say(`SAVED TO MY SETS · ${saved.name.toUpperCase()}`);
  };
  const browsePreset = (direction: number) => {
    const ids = mine ? userSets.map(s => s.id) : choices.map(p => p.id);
    if (!ids.length) return;
    const index = ids.indexOf(mine ? selectedUserSet?.id ?? '' : selectedPreset?.id ?? '');
    setPresetId(ids[(index + direction + ids.length) % ids.length]!);
    setCreated(null);
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = canvasRect(e.currentTarget);
    const pt = canvasPoint(e.clientX, e.clientY);
    pos.current = { x: Math.max(0, Math.min(1, (pt.x - r.left) / r.width)), y: Math.max(0, Math.min(1, 1 - (pt.y - r.top) / r.height)) };
    if (marker.current) { marker.current.style.left = `${pos.current.x * 100}%`; marker.current.style.top = `${(1 - pos.current.y) * 100}%`; }
    const s = latest.current;
    if (!s.lane.drums) lightCell(pos.current.x, pos.current.y, s.lane.color);
    if (performance.now() - lastMove.current < 50) return;
    lastMove.current = performance.now();
    if (!s.lane.drums) s.updatePatch(s.track.id, { cutoff: touchCutoff(pos.current.y), resonance: 1 + pos.current.y * 5 });
  };
  const startPad = () => {
    if (sounding.current && timer.current) return; // latched: moving the finger just changes the note
    sounding.current = true;
    padStart.current = performance.now();
    padCount.current = 0;
    setActive(true);
    fire();
  };
  const releasePad = () => {
    pointer.current = null;
    if (holdRef.current) return;
    stopPad();
  };
  const toggleHold = () => {
    const next = !holdRef.current;
    holdRef.current = next;
    setHold(next);
    if (!next && pointer.current === null) stopPad();
  };

  const laneNotes = loops[lane.id] ?? [];
  const scaleLen = TOUCH_SCALES[settings.scale]?.length ?? 5;
  const pitchCount = scaleLen * range + 1;
  const pitches = lane.drums
    ? DRUM_ROWS.filter((i) => i < (lane.drums?.length ?? 0))
    : [...new Set(Array.from({ length: pitchCount }, (_, i) => touchPitch((pitchCount - 1 - i) / (pitchCount - 1), settings.root, settings.octave, settings.scale, range)))];
  const editCell = (step: number, pitch: number) => {
    const s = latest.current;
    const total = loopStepsFor(s.settings.bars);
    const index = (s.loops[s.lane.id] ?? []).findIndex(n => n.step === step && n.pitch === pitch);
    const next = index >= 0 ? eraseLoopNote(s.loops, s.lane.id, index)
      : editMode === 'draw' ? placeLoopNote(s.loops, s.lane.id, { step, pitch, length: 4 / s.settings.rate * s.settings.gate, vel: .9 }, total) : s.loops;
    commitLoops(next);
    if (index < 0 && editMode === 'draw') playHit(pitch, 60 / s.transport.bpm / s.settings.rate * s.settings.gate);
  };
  const totalNotes = TOUCH_LANES.reduce((n, l) => n + (loops[l.id]?.filter(x => x.step < steps).length ?? 0), 0);
  const drumNotes = loops['drums'] ?? [];
  const groupDef = TOUCH_PROGRAM_GROUPS.find(g => g.id === group) ?? TOUCH_PROGRAM_GROUPS[0]!;
  const currentSound = laneSound(lane.id);
  const programOptions = groupDef.programs.includes(currentSound) ? groupDef.programs : [currentSound, ...groupDef.programs];
  const kitIds = TOUCH_KIT_PROGRAMS.map(k => k.id as string);
  const partLetter = PART_LETTERS[TOUCH_LANES.indexOf(lane)] ?? 'A';
  const setName = created?.name ?? (mine ? selectedUserSet?.name : selectedPreset?.name) ?? '—';

  // The readout line is written straight to the display (no re-render per note); a new set name resets it.
  useEffect(() => { say(`SET · ${setName.toUpperCase()}`); }, [setName]); // eslint-disable-line react-hooks/exhaustive-deps

  return <section ref={root} className="kaoss-face min-w-0 space-y-3 rounded-lg p-3" aria-label="Touch synth" style={{ '--lane': lane.color } as CSSProperties}>
    <header className="flex flex-wrap items-center gap-2">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold text-primary"><Hand className="size-5" /> SYNCLAB TOUCH</h3>
      <span className="font-mono text-[10px] text-muted-foreground">LOOP SYNTH · {TOUCH_PROGRAM_GROUPS.reduce((n, g) => n + g.programs.length, 0) + TOUCH_KIT_PROGRAMS.length} SOUNDS</span>
      <div className="ml-auto"><HardwareBypass track={track} name="Touch Synth" /></div>
    </header>

    <div className="kaoss-lcd grid gap-x-4 gap-y-1 rounded-md px-3 py-2 font-mono sm:grid-cols-[minmax(0,1fr)_auto]" aria-label="Touch display">
      <div className="min-w-0">
        <div className="truncate text-sm font-bold">PART {partLetter} · {lane.drums ? kitName(settings.kit) : currentSound}</div>
        <output ref={readoutEl} className="block truncate text-[11px] opacity-80" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-[11px] sm:justify-end">
        <span>{KEYS[settings.root]} {settings.scale.toUpperCase()}</span>
        <span>{transport.bpm} BPM</span>
        <span>{settings.bars ?? 2} BAR{(settings.bars ?? 2) > 1 ? 'S' : ''}</span>
        <span>{totalNotes} NOTES</span>
        {transport.recording && <span className="text-destructive">● REC</span>}
      </div>
    </div>

    <div className="space-y-2" aria-label="Touch loop sets">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground"><ListMusic className="size-4 text-primary" /> LOOP SETS</h4>
        <span className="font-mono text-[10px] text-muted-foreground">{TOUCH_LOOP_LIBRARY.length} SETS · {TOUCH_LOOP_GENRES.length} GENRES · {userSets.length} MINE</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={genre} onValueChange={value => { setGenre(value); setCreated(null); const first = value === MY_SETS ? userSets[0]?.id : TOUCH_LOOP_LIBRARY.find(p => p.genre === value)?.id; if (first) setPresetId(first); }}>
          <SelectTrigger aria-label="Loop genre" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup><SelectLabel>Mine</SelectLabel><SelectItem value={MY_SETS}>My Sets ({userSets.length})</SelectItem></SelectGroup>
            <SelectGroup><SelectLabel>Genres</SelectLabel>{TOUCH_LOOP_GENRES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectGroup>
          </SelectContent>
        </Select>
        <div className="flex min-w-0 items-center gap-1">
          <Button size="icon" variant="outline" aria-label="Previous loop set" title="Previous set" onClick={() => browsePreset(-1)}><ChevronLeft className="size-4" /></Button>
          <Select value={(mine ? selectedUserSet?.id : selectedPreset?.id) ?? ''} onValueChange={id => { setPresetId(id); setCreated(null); }}>
            <SelectTrigger aria-label="Loop set" className="w-52"><SelectValue placeholder={mine ? 'No saved sets yet' : 'Set'} /></SelectTrigger>
            <SelectContent>{mine
              ? userSets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
              : choices.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · {p.pattern.bpm}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="icon" variant="outline" aria-label="Next loop set" title="Next set" onClick={() => browsePreset(1)}><ChevronRight className="size-4" /></Button>
        </div>
        <Button size="sm" variant="default" disabled={mine && !selectedUserSet} onClick={() => loadSelected(false)} aria-label="Load all five parts"><ListMusic className="size-4" /> Load all five</Button>
        <Button size="sm" variant="outline" disabled={mine && !selectedUserSet} onClick={() => loadSelected(true)} aria-label="Load set into the selected part"><ArrowRightToLine className="size-4" /> Load part {partLetter}</Button>
        <Button size="sm" variant="outline" onClick={createSet} aria-label="Create a new set in this genre" title="Writes a brand-new set in this genre's style"><Dices className="size-4" /> Create</Button>
        {setBpm != null && setBpm !== transport.bpm && <Button size="sm" variant="ghost" onClick={() => setTransport({ bpm: setBpm })} aria-label={`Use ${setBpm} BPM`}>Use {setBpm} BPM</Button>}
        {mine && selectedUserSet && <Button size="icon" variant="ghost" aria-label={`Delete my set ${selectedUserSet.name}`} title="Delete this saved set" onClick={() => { if (window.confirm(`Delete "${selectedUserSet.name}" from My Sets?`)) deleteTouchSet(selectedUserSet.id); }}><Trash2 className="size-4" /></Button>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {naming == null
          ? <Button size="sm" variant="outline" disabled={!totalNotes} onClick={() => setNaming(created?.name ?? (mine ? selectedUserSet?.name : '') ?? '')} aria-label="Save this set to My Sets"><Save className="size-4" /> Save to My Sets</Button>
          : <form className="flex items-center gap-1" onSubmit={e => { e.preventDefault(); saveSet(); }}>
            <Input autoFocus aria-label="Name for this set" placeholder="Name your set" value={naming} maxLength={60} onChange={e => setNaming(e.target.value)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') setNaming(null); }} className="h-8 w-48" />
            <Button size="sm" type="submit" disabled={!naming.trim()}>Save</Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setNaming(null)}>Cancel</Button>
          </form>}
        <Button size="sm" variant="ghost" onClick={clearAll} disabled={!totalNotes} aria-label="Start a new empty set"><Eraser className="size-4" /> New empty set</Button>
      </div>
    </div>

    <div className="grid min-w-0 gap-3 md:grid-cols-[9.5rem_minmax(0,1fr)_11rem]">
      <div role="tablist" aria-label="Touch parts" className="grid grid-cols-5 gap-1 md:grid-cols-1">
        {TOUCH_LANES.map((l, i) => {
          const count = loops[l.id]?.filter(n => n.step < steps).length ?? 0;
          const selected = l.id === lane.id;
          const off = !!muted[l.id];
          return <div key={l.id} className="kaoss-part flex min-w-0 items-stretch rounded-md" data-selected={selected || undefined} data-muted={off || undefined} style={{ '--part': l.color } as CSSProperties}>
            <button type="button" role="tab" aria-selected={selected} onClick={() => { updatePatch(track.id, { ...(!l.drums ? applyPreset(laneSound(l.id)) : {}), touch: { ...latest.current.settings, lane: l.id, octave: l.octave } }); }}
              className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1.5 text-left font-mono">
              <span className="kaoss-part-letter grid size-6 shrink-0 place-items-center rounded-sm text-xs font-bold">{PART_LETTERS[i]}</span>
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-bold">{l.label}</span>
                <span className="block truncate text-[9px] opacity-75">{l.drums ? kitName(settings.kit) : laneSound(l.id)}</span>
                <span className="block text-[9px] opacity-75">{count} notes</span>
              </span>
            </button>
            <button type="button" aria-pressed={off} aria-label={`${off ? 'Unmute' : 'Mute'} part ${PART_LETTERS[i]} ${l.label}`} title={off ? 'Unmute part' : 'Mute part'} onClick={() => toggleMute(l.id)} className="grid w-7 shrink-0 place-items-center border-l border-border/60">
              {off ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
          </div>;
        })}
      </div>

      <div className="min-w-0 space-y-2">
        <div ref={leds} className="kaoss-leds grid gap-px" style={{ gridTemplateColumns: `repeat(${steps}, minmax(0, 1fr))` }} aria-hidden="true">
          {Array.from({ length: steps }, (_, i) => <div key={i} className="kaoss-led h-1.5 rounded-[1px]" data-beat={i % 4 === 0 || undefined} />)}
        </div>
        <div role="slider" tabIndex={0} aria-label="Touch performance pad" aria-valuemin={0} aria-valuemax={1} aria-valuenow={pos.current.x} aria-valuetext={lane.drums ? 'Drum pad' : 'Pitch left to right, tone bottom to top'}
          className="kaoss-pad relative h-64 w-full touch-none select-none overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-72"
          onPointerDown={e => { if (pointer.current !== null) return; e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); startPad(); }}
          onPointerMove={e => { if (pointer.current === e.pointerId) move(e); }} onPointerUp={releasePad} onPointerCancel={releasePad} onLostPointerCapture={() => { if (pointer.current !== null) releasePad(); }}
          onBlur={() => { if (!holdRef.current) stopPad(); }}
          onKeyDown={e => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) return;
            e.preventDefault(); e.stopPropagation(); if (e.repeat) return;
            pos.current = { x: Math.max(0, Math.min(1, pos.current.x + (e.key === 'ArrowRight' ? .08 : e.key === 'ArrowLeft' ? -.08 : 0))), y: Math.max(0, Math.min(1, pos.current.y + (e.key === 'ArrowUp' ? .1 : e.key === 'ArrowDown' ? -.1 : 0))) };
            if (timer.current) clearTimeout(timer.current);
            sounding.current = true; fire(); if (!holdRef.current) { sounding.current = false; if (timer.current) clearTimeout(timer.current); timer.current = null; }
          }}>
          {lane.drums
            ? <div className="pointer-events-none absolute inset-0 grid grid-cols-4" aria-hidden="true">
              {TOUCH_DRUM_COLUMNS.map((col) => <div key={col.label} className="flex min-w-0 flex-col border-r border-border last:border-r-0">
                {col.cells.map((drum) => <div key={drum} data-drum={drum} className="touch-drum-cell flex min-h-0 flex-1 items-end justify-center border-b border-border/70 pb-2 text-center font-mono text-xs font-bold last:border-b-0" style={{ '--drum-color': col.color } as CSSProperties}>{TOUCH_DRUM_LABELS[drum]}</div>)}
              </div>)}
            </div>
            : <div className="pointer-events-none absolute inset-1 grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${PAD_COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${PAD_ROWS}, minmax(0, 1fr))` }} aria-hidden="true">
              {Array.from({ length: PAD_COLS * PAD_ROWS }, (_, i) => <div key={i} ref={el => { cells.current[i] = el; }} className="kaoss-cell rounded-[2px]" />)}
            </div>}
          {!lane.drums && <>
            <span className="pointer-events-none absolute left-2 top-2 font-mono text-[10px] text-muted-foreground">TONE ↑</span>
            <span className="pointer-events-none absolute bottom-2 right-2 font-mono text-[10px] text-muted-foreground">PITCH → {range} OCT</span>
          </>}
          <div ref={marker} className={`kaoss-marker pointer-events-none absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${active ? '' : 'opacity-50'}`} data-active={active || undefined} />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Button variant={hold ? 'default' : 'outline'} aria-pressed={hold} onClick={toggleHold} aria-label="Hold the pad note" title="Keeps playing after you lift your finger"><Lock className="size-4" /> {hold ? 'Hold on' : 'Hold'}</Button>
        <label className="space-y-1">
          <span className="block font-mono text-[10px] font-bold text-muted-foreground">GATE ARP</span>
          <Select value={settings.gateArp ?? 'off'} onValueChange={gateArp => save({ gateArp })}>
            <SelectTrigger aria-label="Gate arp rhythm" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{TOUCH_GATE_ARPS.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <div className="flex flex-wrap items-start gap-2">
          <Knob label="RANGE" min={1} max={4} step={1} value={range} onChange={value => save({ range: value })} size={38} />
          <Knob label="OCTAVE" min={1} max={6} step={1} value={settings.octave} onChange={octave => save({ octave })} size={38} />
          <Knob label="RATE" min={1} max={4} step={1} value={settings.rate} onChange={rate => save({ rate })} size={38} />
          <Knob label="GATE" min={.1} max={.95} step={.05} value={settings.gate} onChange={gate => save({ gate })} size={38} />
        </div>
        <Button variant="outline" onClick={() => { holdRef.current = false; setHold(false); stopPad(); }} aria-label="Stop touch pattern"><Square className="size-4" /> Stop pad</Button>
      </div>
    </div>

    <div className="space-y-2 border-t border-border pt-3" aria-label="Touch sound program">
      {lane.drums
        ? <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-foreground">DRUM KIT</span>
          <PresetNavigator label="Touch drum kit" options={kitIds} current={settings.kit ?? '909'} onSelect={selectKit}>
            <Select value={settings.kit ?? '909'} onValueChange={selectKit}>
              <SelectTrigger aria-label="Touch drum kit" className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{KIT_GROUPS.map(cat => <SelectGroup key={cat}><SelectLabel>{cat}</SelectLabel>{TOUCH_KIT_PROGRAMS.filter(k => k.category === cat).map(k => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectGroup>)}</SelectContent>
            </Select>
          </PresetNavigator>
          <span className="font-mono text-[10px] text-muted-foreground">KICK · HI-HAT (CLOSED BOTTOM / OPEN TOP) · SNARE · CLAP</span>
        </div>
        : <>
          <div role="tablist" aria-label="Sound categories" className="flex flex-wrap gap-1">
            {TOUCH_PROGRAM_GROUPS.map(g => <Button key={g.id} size="sm" role="tab" aria-selected={g.id === groupDef.id} variant={g.id === groupDef.id ? 'default' : 'outline'} className="h-7 px-2 font-mono text-[10px]" onClick={() => setGroup(g.id)}>{g.label}</Button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PresetNavigator label="Touch sound program" options={groupDef.programs} current={currentSound} onSelect={selectSound}>
              <Select value={currentSound} onValueChange={selectSound}>
                <SelectTrigger aria-label="Touch sound" className="w-56"><SelectValue placeholder="Sound" /></SelectTrigger>
                <SelectContent>{programOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
              </Select>
            </PresetNavigator>
            <Select value={String(settings.root)} onValueChange={v => save({ root: Number(v) })}><SelectTrigger aria-label="Touch key" className="w-20"><SelectValue /></SelectTrigger><SelectContent>{KEYS.map((k, i) => <SelectItem key={k} value={String(i)}>{k}</SelectItem>)}</SelectContent></Select>
            <Select value={settings.scale} onValueChange={scale => save({ scale })}>
              <SelectTrigger aria-label="Touch scale" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{TOUCH_SCALE_GROUPS.map(gr => <SelectGroup key={gr.label}><SelectLabel>{gr.label}</SelectLabel>{gr.scales.map(sc => <SelectItem key={sc} value={sc}>{sc}</SelectItem>)}</SelectGroup>)}</SelectContent>
            </Select>
          </div>
        </>}
    </div>

    {lane.drums && <div className="touch-drum-display grid grid-cols-5 gap-1 rounded-md p-1.5" role="group" aria-label="Drum colour display">
      {DRUM_DISPLAY.map((drum) => <div key={drum} data-drum={drum} className="touch-drum-led flex min-w-0 flex-col items-center justify-center rounded-sm px-1 py-1.5 font-mono" style={{ '--drum-color': touchDrumColor(drum) } as CSSProperties}>
        <span className="block max-w-full truncate text-[10px] font-bold">{TOUCH_DRUM_LABELS[drum]}</span>
        <span className="block text-[9px] opacity-80">{drumNotes.filter((n) => Math.round(n.pitch) === drum && n.step < steps).length} hits</span>
      </div>)}
    </div>}

    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3" aria-label="Loop sequencer">
      <Button size="sm" variant={recording ? 'destructive' : 'outline'} aria-pressed={recording} onClick={toggleRecord} aria-label="Record touch loop"><Circle className={`size-3.5 ${recording ? 'fill-current' : ''}`} /> {recording ? 'Stop rec' : 'Record loop'}</Button>
      <Button size="sm" variant={playingLoops ? 'default' : 'outline'} aria-pressed={playingLoops} disabled={!totalNotes && !playingLoops} onClick={() => (playingLoops ? stopLoops() : startLoops())} aria-label="Play recorded loops"><Play className="size-3.5" /> {playingLoops ? 'Stop all loops' : 'Play all loops'}</Button>
      <Button size="sm" variant="outline" disabled={!playingLoops || !laneNotes.length} aria-label={`Hold to erase part ${partLetter} as the loop passes`} title="Hold while the loop plays to wipe notes in this part"
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); erasing.current = true; }} onPointerUp={() => { erasing.current = false; }} onPointerCancel={() => { erasing.current = false; }} onLostPointerCapture={() => { erasing.current = false; }}>
        <Eraser className="size-3.5" /> Hold to erase
      </Button>
      <Button size="sm" variant="ghost" disabled={!laneNotes.length} onClick={clearLane} aria-label="Clear this part"><Trash2 className="size-3.5" /> Clear part {partLetter}</Button>
      <div className="flex items-center gap-1" role="group" aria-label="Loop length">
        <span className="font-mono text-[10px] text-muted-foreground">LENGTH</span>
        {TOUCH_LOOP_BARS.map(b => <Button key={b} size="sm" variant={(settings.bars ?? 2) === b ? 'default' : 'outline'} aria-pressed={(settings.bars ?? 2) === b} className="h-7 px-2 font-mono text-[10px]" onClick={() => setBars(b)}>{b} BAR{b > 1 ? 'S' : ''}</Button>)}
      </div>
      <Button size="sm" variant="default" disabled={!totalNotes} onClick={sendToTimeline} aria-label="Send loops to timeline" className="ml-auto"><ArrowRightToLine className="size-3.5" /> Send to timeline</Button>
    </div>

    <div className="space-y-2 border-t border-border pt-3" aria-label="Touch loop note editor">
      <div className="flex items-center gap-2">
        <h4 className="mr-auto font-mono text-xs font-bold text-foreground">PART {partLetter} · {lane.label} · LOOP NOTES</h4>
        <Button size="icon" variant={editMode === 'draw' ? 'default' : 'outline'} aria-label="Place loop notes" title="Place loop notes" aria-pressed={editMode === 'draw'} onClick={() => setEditMode('draw')}><Pencil className="size-4" /></Button>
        <Button size="icon" variant={editMode === 'erase' ? 'default' : 'outline'} aria-label="Erase single loop notes" title="Erase single loop notes" aria-pressed={editMode === 'erase'} onClick={() => setEditMode('erase')}><Eraser className="size-4" /></Button>
      </div>
      <div className="max-h-80 overflow-auto rounded-sm border border-border">
        <div style={{ minWidth: `${steps * 30 + 64}px` }}>
          <div className="flex h-6"><span className="w-16 shrink-0" />{Array.from({ length: steps }, (_, step) => <span key={step} className={`w-[30px] shrink-0 text-center font-mono text-[10px] ${step % 16 === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{step + 1}</span>)}</div>
          {pitches.map(pitch => <div key={pitch} className="flex h-[30px]">
            <span className="flex w-16 shrink-0 items-center px-1 font-mono text-[10px] text-muted-foreground">{lane.drums ? TOUCH_DRUM_LABELS[pitch] : noteName(pitch)}</span>
            {Array.from({ length: steps }, (_, step) => {
              const filled = laneNotes.some(n => n.step === step && n.pitch === pitch);
              return <Button key={step} variant="ghost" aria-label={`${filled ? 'Erase' : 'Place'} ${lane.label} note ${pitch} at step ${step + 1}`} aria-pressed={filled} onClick={() => editCell(step, pitch)} className={`h-[30px] w-[30px] shrink-0 rounded-none border border-border p-0 ${step % 4 === 0 ? 'bg-muted/40' : ''}`} style={{ color: lane.color }}>
                {filled && <span className="size-4 rounded-sm bg-current" />}
              </Button>;
            })}
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}
