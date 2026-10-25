import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowRightToLine, ChevronLeft, ChevronRight, Circle, Eraser, Hand, ListMusic, Pencil, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Knob } from './Knob';
import { useStudio } from '@/lib/synclab/store';
import { applyPreset } from '@/lib/synclab/presets';
import { getEngine } from '@/lib/synclab/audio-engine';
import { laneById, loopsToNotes, placeLoopNote, eraseLoopNote, touchPitch, touchCutoff, TOUCH_LANES, TOUCH_LOOP_STEPS, TOUCH_SCALES, TOUCH_SOUNDS, type TouchLoops } from '@/lib/synclab/touch-synth';
import type { Track } from '@/lib/synclab/types';
import { genreLoops, loadGenreLoops, TOUCH_LOOP_GENRES, TOUCH_LOOP_LIBRARY } from '@/lib/synclab/touch-loop-library';
import { PresetNavigator } from './PresetNavigator';

const KEYS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const drumPad = (kind: string) => ({ id: `touch-${kind}`, name: kind, kind: kind as 'kick', volume: 1, pan: 0, pitch: 0, decay: .4, muted: false, solo: false, steps: [] as number[] });

export function TouchSynth({ track }: { track: Track }) {
  const { previewNote, updatePatch, transport, updateTrack } = useStudio();
  const settings = track.patch?.touch ?? { root: 0, octave: 3, scale: 'Minor pentatonic', rate: 2, gate: .65 };
  const lane = laneById(settings.lane ?? 'bass');
  const loops: TouchLoops = settings.loops ?? {};
  /** Each column keeps its own instrument; falls back to the lane's default sound. */
  const laneSound = (id: string) => settings.sounds?.[id] ?? laneById(id).sound;
  const latest = useRef({ track, settings, lane, loops, previewNote, updatePatch, updateTrack, transport });
  latest.current = { track, settings, lane, loops, previewNote, updatePatch, updateTrack, transport };
  const pointer = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStart = useRef<number | null>(null);
  const loopStart = useRef<number | null>(null);
  const pos = useRef({ x: .5, y: .5 });
  const marker = useRef<HTMLDivElement>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const lastMove = useRef(0);
  const [active, setActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [playingLoops, setPlayingLoops] = useState(false);
  const [readout, setReadout] = useState('—');
  const [editMode, setEditMode] = useState<'draw' | 'erase'>('draw');
  const [genre, setGenre] = useState('Detroit Techno');
  const [presetId, setPresetId] = useState('0-0');
  const choices = TOUCH_LOOP_LIBRARY.filter(p => p.genre === genre);
  const selectedPreset = choices.find(p => p.id === presetId) ?? choices[0];
  const save = (values: Partial<typeof settings>) => updatePatch(track.id, { touch: { ...settings, ...values } });
  const selectSound = (name: string) => {
    stopPad();
    const patch = applyPreset(name);
    const touch = { ...settings, sounds: { ...settings.sounds, [lane.id]: name } };
    updatePatch(track.id, { ...patch, touch });
    previewNote(track.id, 60 + settings.root, .4, false, { ...patch, touch });
  };

  const stopPad = () => {
    pointer.current = null;
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
    if (playhead.current) playhead.current.style.left = '0%';
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (loopTimer.current) clearInterval(loopTimer.current); }, []);

  const recordNote = (step: number, pitch: number, length: number) => {
    const s = latest.current;
    const next = placeLoopNote(s.loops, s.lane.id, { step, pitch, length, vel: .9 });
    latest.current = { ...s, loops: next, settings: { ...s.settings, loops: next } };
    s.updatePatch(s.track.id, { touch: { ...s.settings, loops: next } });
  };
  const recStep = () => {
    if (recStart.current == null) return null;
    const stepDur = 60 / latest.current.transport.bpm / 4;
    return Math.round((performance.now() - recStart.current) / 1000 / stepDur) % TOUCH_LOOP_STEPS;
  };

  const playHit = (pitch: number, length: number) => {
    const s = latest.current;
    if (!s.track.patch) return;
    if (s.lane.drums) {
      const kinds = s.lane.drums;
      const kind = kinds[Math.max(0, Math.min(kinds.length - 1, Math.round(pitch)))] ?? 'kick';
      getEngine().playDrum(s.track.id, drumPad(kind), .9);
      setReadout(kind.toUpperCase());
      return;
    }
    const cutoff = touchCutoff(pos.current.y);
    const patch = { ...s.track.patch, voiceMode: 'poly' as const, cutoff, resonance: 1 + pos.current.y * 5, arp: { ...s.track.patch.arp, on: false } };
    s.previewNote(s.track.id, pitch, length, false, patch);
    s.updatePatch(s.track.id, { cutoff, resonance: patch.resonance });
    setReadout(`${KEYS[pitch % 12]}${Math.floor(pitch / 12) - 1} · ${Math.round(cutoff)} Hz`);
  };

  const trigger = () => {
    const s = latest.current;
    if (!s.track.patch) return;
    const pitch = s.lane.drums
      ? Math.round(pos.current.x * (s.lane.drums.length - 1))
      : touchPitch(pos.current.x, s.settings.root, s.settings.octave, s.settings.scale);
    const length = (60 / s.transport.bpm / s.settings.rate) * s.settings.gate;
    playHit(pitch, length);
    const step = recStep();
    if (step != null) recordNote(step, pitch, length / (60 / s.transport.bpm / 4));
    timer.current = setTimeout(() => { if (pointer.current !== null) trigger(); }, (60 / s.transport.bpm / s.settings.rate) * 1000);
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
      if (playhead.current) playhead.current.style.left = `${(step / TOUCH_LOOP_STEPS) * 100}%`;
      for (const l of TOUCH_LANES) {
        for (const n of cur.loops[l.id] ?? []) {
          if (n.step !== step) continue;
          if (l.drums) {
            const kind = l.drums[Math.max(0, Math.min(l.drums.length - 1, Math.round(n.pitch)))] ?? 'kick';
            getEngine().playDrum(cur.track.id, drumPad(kind), n.vel);
          } else if (cur.track.patch) {
            const patch = { ...applyPreset(cur.settings.sounds?.[l.id] ?? l.sound), voiceMode: 'poly' as const, arp: { ...cur.track.patch.arp, on: false } };
            cur.previewNote(cur.track.id, n.pitch, n.length * stepDur, false, patch);
          }
        }
      }
      step = (step + 1) % TOUCH_LOOP_STEPS;
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
  const clearLane = () => {
    const s = latest.current;
    const next = { ...s.loops };
    delete next[s.lane.id];
    s.updatePatch(s.track.id, { touch: { ...s.settings, loops: next } });
  };
  const sendToTimeline = () => {
    const s = latest.current;
    const notes = loopsToNotes(s.loops, Math.max(0, Math.floor(s.transport.step)), Date.now());
    if (!notes.length) return;
    s.updateTrack(s.track.id, { notes: [...(s.track.notes ?? []), ...notes] });
    setReadout(`${notes.length} NOTES SENT TO TIMELINE`);
  };
  const loadPresetLoops = (onlyLane: boolean) => {
    if (!selectedPreset) return;
    const s = latest.current;
    const occupied = onlyLane ? (s.loops[s.lane.id]?.length ?? 0) > 0 : Object.values(s.loops).some(notes => notes.length > 0);
    if (occupied && !window.confirm(`Replace ${onlyLane ? s.lane.label.toLowerCase() + ' notes' : 'all five loops'} with ${selectedPreset.name}?`)) return;
    stopPad();
    stopLoops();
    const next = loadGenreLoops(s.loops, genreLoops(selectedPreset, s.settings.root, onlyLane ? s.settings.scale : selectedPreset.scale), onlyLane ? s.lane.id : undefined);
    const nextSettings = { ...s.settings, loops: next, scale: onlyLane ? s.settings.scale : selectedPreset.scale };
    latest.current = { ...s, settings: nextSettings, loops: next };
    s.updatePatch(s.track.id, { touch: nextSettings });
    setReadout(`${selectedPreset.name.toUpperCase()} · ${onlyLane ? s.lane.label : '5 LANES'} LOADED`);
  };
  const browsePreset = (direction: number) => {
    const index = choices.findIndex(p => p.id === selectedPreset?.id);
    const next = choices[(index + direction + choices.length) % choices.length];
    if (next) setPresetId(next.id);
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = canvasRect(e.currentTarget);
    const pt = canvasPoint(e.clientX, e.clientY);
    pos.current = { x: Math.max(0, Math.min(1, (pt.x - r.left) / r.width)), y: Math.max(0, Math.min(1, 1 - (pt.y - r.top) / r.height)) };
    if (marker.current) { marker.current.style.left = `${pos.current.x * 100}%`; marker.current.style.top = `${(1 - pos.current.y) * 100}%`; }
    if (performance.now() - lastMove.current < 50) return;
    lastMove.current = performance.now();
    const s = latest.current;
    if (!s.lane.drums) s.updatePatch(s.track.id, { cutoff: touchCutoff(pos.current.y), resonance: 1 + pos.current.y * 5 });
  };

  const laneNotes = loops[lane.id] ?? [];
  const pitchCount = (TOUCH_SCALES[settings.scale]?.length ?? 5) * 2 + 1;
  const pitches = lane.drums
    ? lane.drums.map((_, i) => i).reverse()
    : Array.from({ length: pitchCount }, (_, i) => touchPitch((pitchCount - 1 - i) / (pitchCount - 1), settings.root, settings.octave, settings.scale));
  const editCell = (step: number, pitch: number) => {
    const s = latest.current;
    const index = (s.loops[s.lane.id] ?? []).findIndex(n => n.step === step && n.pitch === pitch);
    const next = index >= 0 ? eraseLoopNote(s.loops, s.lane.id, index)
      : editMode === 'draw' ? placeLoopNote(s.loops, s.lane.id, { step, pitch, length: 4 / s.settings.rate * s.settings.gate, vel: .9 }) : s.loops;
    latest.current = { ...s, loops: next, settings: { ...s.settings, loops: next } };
    s.updatePatch(s.track.id, { touch: { ...s.settings, loops: next } });
    if (index < 0 && editMode === 'draw') playHit(pitch, 60 / s.transport.bpm / s.settings.rate * s.settings.gate);
  };
  const totalNotes = TOUCH_LANES.reduce((n, l) => n + (loops[l.id]?.length ?? 0), 0);
  return <section className="min-w-0 space-y-3" aria-label="Touch synth">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold text-primary"><Hand className="size-5" /> SYNCLAB TOUCH</h3>
      <span className="font-mono text-xs text-muted-foreground">5-LANE LOOP SYNTH · {totalNotes} NOTES RECORDED</span>
    </header>
    <div className="space-y-2 border-b border-border pb-3" aria-label="Touch genre loop library">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-mono text-xs font-bold text-foreground"><ListMusic className="size-4 text-primary" /> GENRE LOOPS</h4>
        <span className="font-mono text-[10px] text-muted-foreground">{TOUCH_LOOP_LIBRARY.length} SETS · {TOUCH_LOOP_GENRES.length} GENRES · 2 BARS</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={genre} onValueChange={value => { setGenre(value); const first = TOUCH_LOOP_LIBRARY.find(p => p.genre === value); if (first) setPresetId(first.id); }}>
          <SelectTrigger aria-label="Loop genre" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{TOUCH_LOOP_GENRES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex min-w-0 items-center gap-1">
          <Button size="icon" variant="outline" aria-label="Previous genre loop" title="Previous loop" onClick={() => browsePreset(-1)}><ChevronLeft className="size-4" /></Button>
          <Select value={selectedPreset?.id ?? ''} onValueChange={setPresetId}>
            <SelectTrigger aria-label="Genre loop set" className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>{choices.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="icon" variant="outline" aria-label="Next genre loop" title="Next loop" onClick={() => browsePreset(1)}><ChevronRight className="size-4" /></Button>
        </div>
        <Button size="sm" variant="default" onClick={() => loadPresetLoops(false)} aria-label="Load all five genre loops"><ListMusic className="size-4" /> Load all five</Button>
        <Button size="sm" variant="outline" onClick={() => loadPresetLoops(true)} aria-label="Load genre loop into selected lane"><ArrowRightToLine className="size-4" /> Load {lane.label.toLowerCase()}</Button>
      </div>
    </div>
    <div role="tablist" aria-label="Touch lanes" className="grid grid-cols-5 gap-1">
      {TOUCH_LANES.map((l) => {
        const count = loops[l.id]?.length ?? 0;
        const selected = l.id === lane.id;
        return <Button variant="outline" key={l.id} role="tab" aria-selected={selected} onClick={() => { stopPad(); updatePatch(track.id, { ...(!l.drums ? applyPreset(laneSound(l.id)) : {}), touch: { ...settings, lane: l.id, octave: l.octave } }); }}
          className={`min-w-0 rounded-md border px-1 py-2 font-mono text-[10px] font-bold transition-colors ${selected ? 'border-transparent text-background' : 'border-border text-muted-foreground hover:text-foreground'}`}
          style={selected ? { background: l.color } : { borderColor: `${l.color}66` }}>
          <span className="block truncate">{l.label}</span>
          <span className="block truncate text-[9px] font-normal">{l.drums ? 'DRUM KIT' : laneSound(l.id)}</span>
          <span className="block text-[9px] font-normal">{count} notes</span>
        </Button>;
      })}
    </div>
    <div className="flex flex-wrap gap-2">
      {!lane.drums && <>
        <PresetNavigator label="Touch sound preset" options={TOUCH_SOUNDS} current={laneSound(lane.id)} onSelect={selectSound}>
        <Select value={laneSound(lane.id)} onValueChange={selectSound}>
          <SelectTrigger aria-label="Touch sound" className="w-48"><SelectValue placeholder="Sound" /></SelectTrigger>
          <SelectContent>{TOUCH_SOUNDS.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
        </Select>
        </PresetNavigator>
        <Select value={String(settings.root)} onValueChange={v => save({ root: Number(v) })}><SelectTrigger aria-label="Touch key" className="w-20"><SelectValue /></SelectTrigger><SelectContent>{KEYS.map((k, i) => <SelectItem key={k} value={String(i)}>{k}</SelectItem>)}</SelectContent></Select>
        <Select value={settings.scale} onValueChange={scale => save({ scale })}><SelectTrigger aria-label="Touch scale" className="w-48"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(TOUCH_SCALES).map(scale => <SelectItem key={scale} value={scale}>{scale}</SelectItem>)}</SelectContent></Select>
      </>}
      {lane.drums && <span className="self-center font-mono text-xs text-muted-foreground">LEFT → RIGHT: {lane.drums.map((d) => d.toUpperCase()).join(' · ')}</span>}
    </div>
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div role="slider" tabIndex={0} aria-label="Touch performance pad" aria-valuemin={0} aria-valuemax={1} aria-valuenow={pos.current.x} aria-valuetext={readout}
        className="relative h-64 w-full touch-none select-none overflow-hidden rounded-md border-2 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ borderColor: `${lane.color}88` }}
        onPointerDown={e => { if (pointer.current !== null) return; e.preventDefault(); e.currentTarget.focus(); pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); setActive(true); trigger(); }}
        onPointerMove={e => { if (pointer.current === e.pointerId) move(e); }} onPointerUp={stopPad} onPointerCancel={stopPad} onLostPointerCapture={stopPad} onBlur={stopPad}
        onKeyDown={e => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) return; e.preventDefault(); e.stopPropagation(); if (e.repeat) return; pos.current = { x: Math.max(0, Math.min(1, pos.current.x + (e.key === 'ArrowRight' ? .08 : e.key === 'ArrowLeft' ? -.08 : 0))), y: Math.max(0, Math.min(1, pos.current.y + (e.key === 'ArrowUp' ? .1 : e.key === 'ArrowDown' ? -.1 : 0))) }; if (timer.current) clearTimeout(timer.current); trigger(); }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">{[20,40,60,80].map(v => <path key={v} d={`M ${v} 0 V 100 M 0 ${v} H 100`} stroke="var(--border)" strokeWidth=".3" />)}</svg>
        {TOUCH_LANES.map((l) => (loops[l.id] ?? []).map((n, i) => {
          const y = l.drums ? 1 - n.pitch / Math.max(1, (l.drums?.length ?? 1) - 1) : 1 - (n.pitch % 24) / 24;
          return <span key={`${l.id}-${i}`} aria-hidden="true" className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(n.step / TOUCH_LOOP_STEPS) * 100}%`, top: `${y * 100}%`, background: l.color, boxShadow: `0 0 8px ${l.color}` }} />;
        }))}
        <div ref={playhead} aria-hidden="true" className={`pointer-events-none absolute inset-y-0 w-0.5 bg-foreground/70 ${playingLoops ? '' : 'hidden'}`} style={{ left: '0%' }} />
        <span className="pointer-events-none absolute left-3 top-3 font-mono text-xs text-muted-foreground">{lane.drums ? 'DRUMS' : 'TONE ↑'}</span>
        <span className="pointer-events-none absolute bottom-3 right-3 font-mono text-xs text-muted-foreground">{lane.drums ? 'KICK → TOM' : 'PITCH →'}</span>
        <div ref={marker} className={`pointer-events-none absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${active ? '' : 'opacity-60'}`} style={{ borderColor: lane.color, background: active ? lane.color : `${lane.color}33` }} />
      </div>
      <div className="flex flex-wrap items-start gap-3 sm:w-40">
        <Knob label="OCTAVE" min={1} max={6} step={1} value={settings.octave} onChange={octave => save({ octave })} />
        <Knob label="RATE" min={1} max={4} step={1} value={settings.rate} onChange={rate => save({ rate })} />
        <Knob label="GATE" min={.1} max={.95} step={.05} value={settings.gate} onChange={gate => save({ gate })} />
        <Button variant="outline" onClick={stopPad} aria-label="Stop touch pattern"><Square className="size-4" /> Stop</Button>
      </div>
    </div>
    <div className="space-y-2 border-t border-border pt-3" aria-label="Touch loop note editor">
      <div className="flex items-center gap-2">
        <h4 className="mr-auto font-mono text-xs font-bold text-foreground">{lane.label} · LOOP NOTES</h4>
        <Button size="icon" variant={editMode === 'draw' ? 'default' : 'outline'} aria-label="Place loop notes" title="Place loop notes" aria-pressed={editMode === 'draw'} onClick={() => setEditMode('draw')}><Pencil className="size-4" /></Button>
        <Button size="icon" variant={editMode === 'erase' ? 'default' : 'outline'} aria-label="Erase single loop notes" title="Erase single loop notes" aria-pressed={editMode === 'erase'} onClick={() => setEditMode('erase')}><Eraser className="size-4" /></Button>
      </div>
      <div className="max-h-80 overflow-auto border border-border rounded-sm">
        <div className="min-w-[1040px]">
          <div className="flex h-6"><span className="w-16 shrink-0" />{Array.from({ length: TOUCH_LOOP_STEPS }, (_, step) => <span key={step} className="w-[30px] shrink-0 text-center font-mono text-[10px] text-muted-foreground">{step + 1}</span>)}</div>
          {pitches.map(pitch => <div key={pitch} className="flex h-[30px]">
            <span className="flex w-16 shrink-0 items-center px-1 font-mono text-[10px] text-muted-foreground">{lane.drums ? lane.drums[pitch]?.toUpperCase() : `${KEYS[pitch % 12]}${Math.floor(pitch / 12) - 1}`}</span>
            {Array.from({ length: TOUCH_LOOP_STEPS }, (_, step) => {
              const filled = laneNotes.some(n => n.step === step && n.pitch === pitch);
              return <Button key={step} variant="ghost" aria-label={`${filled ? 'Erase' : 'Place'} ${lane.label} note ${pitch} at step ${step + 1}`} aria-pressed={filled} onClick={() => editCell(step, pitch)} className="h-[30px] w-[30px] shrink-0 rounded-none border border-border p-0" style={{ color: lane.color }}>
                {filled && <span className="size-4 rounded-sm bg-current" />}
              </Button>;
            })}
          </div>)}
        </div>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
      <Button size="sm" variant={recording ? 'destructive' : 'outline'} aria-pressed={recording} onClick={toggleRecord} aria-label="Record touch loop"><Circle className={`size-3.5 ${recording ? 'fill-current' : ''}`} /> {recording ? 'Stop rec' : 'Record loop'}</Button>
      <Button size="sm" variant={playingLoops ? 'default' : 'outline'} aria-pressed={playingLoops} disabled={!totalNotes && !playingLoops} onClick={() => (playingLoops ? stopLoops() : startLoops())} aria-label="Play recorded loops"><Play className="size-3.5" /> {playingLoops ? 'Stop all loops' : 'Play all loops'}</Button>
      <Button size="sm" variant="ghost" disabled={!laneNotes.length} onClick={clearLane} aria-label="Clear this lane"><Eraser className="size-3.5" /> Clear {lane.label.toLowerCase()}</Button>
      <Button size="sm" variant="default" disabled={!totalNotes} onClick={sendToTimeline} aria-label="Send loops to timeline"><ArrowRightToLine className="size-3.5" /> Send to timeline</Button>
    </div>
    <output className="block font-mono text-sm text-primary">{readout}{transport.recording ? ' · RECORDING' : ''}</output>
  </section>;
}
