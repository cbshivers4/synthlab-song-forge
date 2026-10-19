import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Hand, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Knob } from './Knob';
import { useStudio } from '@/lib/synclab/store';
import { applyPreset } from '@/lib/synclab/presets';
import { touchPitch, touchCutoff, TOUCH_SCALES, TOUCH_SOUNDS } from '@/lib/synclab/touch-synth';
import type { Track } from '@/lib/synclab/types';

const KEYS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function TouchSynth({ track }: { track: Track }) {
  const { previewNote, updatePatch, loadPreset, transport } = useStudio();
  const settings = track.patch?.touch ?? { root: 0, octave: 3, scale: 'Minor pentatonic', rate: 2, gate: .65 };
  const latest = useRef({ track, settings, previewNote, updatePatch, transport });
  latest.current = { track, settings, previewNote, updatePatch, transport };
  const pointer = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pos = useRef({ x: .5, y: .5 });
  const marker = useRef<HTMLDivElement>(null);
  const lastMove = useRef(0);
  const [active, setActive] = useState(false);
  const [readout, setReadout] = useState('—');
  const save = (values: Partial<typeof settings>) => updatePatch(track.id, { touch: { ...settings, ...values } });
  const stop = () => {
    pointer.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setActive(false);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const trigger = () => {
    const state = latest.current;
    if (!state.track.patch) return;
    const pitch = touchPitch(pos.current.x, state.settings.root, state.settings.octave, state.settings.scale);
    const cutoff = touchCutoff(pos.current.y);
    const interval = 60 / state.transport.bpm / state.settings.rate;
    const patch = { ...state.track.patch, cutoff, resonance: 1 + pos.current.y * 5, arp: { ...state.track.patch.arp, on: false } };
    state.previewNote(state.track.id, pitch, interval * state.settings.gate, true, patch);
    state.updatePatch(state.track.id, { cutoff, resonance: patch.resonance });
    setReadout(`${KEYS[pitch % 12]}${Math.floor(pitch / 12) - 1} · ${Math.round(cutoff)} Hz`);
    timer.current = setTimeout(() => { if (pointer.current !== null) trigger(); }, interval * 1000);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pos.current = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) };
    if (marker.current) { marker.current.style.left = `${pos.current.x * 100}%`; marker.current.style.top = `${(1 - pos.current.y) * 100}%`; }
    if (performance.now() - lastMove.current < 50) return;
    lastMove.current = performance.now();
    const s = latest.current;
    s.updatePatch(s.track.id, { cutoff: touchCutoff(pos.current.y), resonance: 1 + pos.current.y * 5 });
  };
  return <section className="min-w-0 space-y-3" aria-label="Touch synth">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold text-primary"><Hand className="size-5" /> SYNCLAB TOUCH</h3>
      <span className="font-mono text-xs text-muted-foreground">SCALE SYNTH · GATED NOTES</span>
    </header>
    <div className="flex flex-wrap gap-2">
      <Select value={track.patch?.name} onValueChange={name => { stop(); const patch = applyPreset(name); loadPreset(track.id, name); updatePatch(track.id, { touch: settings }); previewNote(track.id, 60 + settings.root, .4, false, patch); }}>
        <SelectTrigger aria-label="Touch sound" className="w-48"><SelectValue placeholder="Sound" /></SelectTrigger>
        <SelectContent>{TOUCH_SOUNDS.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={String(settings.root)} onValueChange={v => save({ root: Number(v) })}><SelectTrigger aria-label="Touch key" className="w-20"><SelectValue /></SelectTrigger><SelectContent>{KEYS.map((k, i) => <SelectItem key={k} value={String(i)}>{k}</SelectItem>)}</SelectContent></Select>
      <Select value={settings.scale} onValueChange={scale => save({ scale })}><SelectTrigger aria-label="Touch scale" className="w-48"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(TOUCH_SCALES).map(scale => <SelectItem key={scale} value={scale}>{scale}</SelectItem>)}</SelectContent></Select>
    </div>
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div role="slider" tabIndex={0} aria-label="Touch performance pad" aria-valuemin={0} aria-valuemax={1} aria-valuenow={pos.current.x} aria-valuetext={readout}
        className="relative h-64 w-full touch-none select-none overflow-hidden rounded-md border-2 border-primary/50 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onPointerDown={e => { if (pointer.current !== null) return; e.preventDefault(); e.currentTarget.focus(); pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); setActive(true); trigger(); }}
        onPointerMove={e => { if (pointer.current === e.pointerId) move(e); }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onBlur={stop}
        onKeyDown={e => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) return; e.preventDefault(); e.stopPropagation(); if (e.repeat) return; pos.current = { x: Math.max(0, Math.min(1, pos.current.x + (e.key === 'ArrowRight' ? .08 : e.key === 'ArrowLeft' ? -.08 : 0))), y: Math.max(0, Math.min(1, pos.current.y + (e.key === 'ArrowUp' ? .1 : e.key === 'ArrowDown' ? -.1 : 0))) }; if (timer.current) clearTimeout(timer.current); trigger(); }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">{[20,40,60,80].map(v => <path key={v} d={`M ${v} 0 V 100 M 0 ${v} H 100`} stroke="var(--border)" strokeWidth=".3" />)}</svg>
        <span className="pointer-events-none absolute left-3 top-3 font-mono text-xs text-muted-foreground">TONE ↑</span>
        <span className="pointer-events-none absolute bottom-3 right-3 font-mono text-xs text-muted-foreground">PITCH →</span>
        <div ref={marker} className={`pointer-events-none absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary ${active ? 'bg-primary' : 'bg-primary/20'}`} />
      </div>
      <div className="flex flex-wrap items-start gap-3 sm:w-40">
        <Knob label="OCTAVE" min={1} max={6} step={1} value={settings.octave} onChange={octave => save({ octave })} />
        <Knob label="RATE" min={1} max={4} step={1} value={settings.rate} onChange={rate => save({ rate })} />
        <Knob label="GATE" min={.1} max={.95} step={.05} value={settings.gate} onChange={gate => save({ gate })} />
        <Button variant="outline" onClick={stop} aria-label="Stop touch pattern"><Square className="size-4" /> Stop</Button>
      </div>
    </div>
    <output className="block font-mono text-sm text-primary">{readout}{transport.recording ? ' · RECORDING' : ''}</output>
  </section>;
}
