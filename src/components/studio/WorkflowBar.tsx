import { Circle, ClipboardMinus, ClipboardPaste, Copy, Layers, Metronome, Mic, Piano, Play, Repeat, Square, SquareSplitHorizontal, Timer, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudio } from '@/lib/synclab/store';
import { deleteSelectedPart, selectedClip, selectedPartBounds } from '@/lib/synclab/workflow';
import { loopRegion } from '@/lib/synclab/recording-region';
import { barsForSteps, positionLabel } from '@/lib/synclab/timebase';

export function WorkflowBar() {
  const { selected, tracks, transport, setTransport, updateTrack, togglePlay, toggleRecord, stop, setPanel, panel, copyClip, cutClip, pasteClip, clipClipboardName, removeClip, swapTake, razorAt } = useStudio();
  const isPhone = useIsMobile();
  const clip = selectedClip(selected);
  const part = selectedPartBounds(selected, transport.bpm, transport.bars, transport.loop ? loopRegion(transport) : undefined);
  const active = transport.recording || transport.countInLeft != null;
  const armed = tracks.filter((track) => track.armed || track.recording);
  const targets = armed.length ? armed : selected ? [selected] : [];
  const bounds = loopRegion(transport);
  const removePart = () => {
    if (!selected || !part) return;
    if (clip) { removeClip(selected.id, clip.id); return; }
    const patch = deleteSelectedPart(selected, transport.bpm, transport.bars, transport.loop ? bounds : undefined);
    if (patch) updateTrack(selected.id, patch);
  };
  return <div aria-label="Recording and selected part" className="shrink-0 border-b border-border bg-surface-2">
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto px-2 py-1.5">
      <span className="max-w-44 shrink-0 truncate font-mono text-[11px] text-foreground" title={targets.map((track) => track.name).join(', ')}>
        {active ? '● ' : ''}{targets.length > 1 ? `${targets.length} armed tracks` : targets[0]?.name ?? 'No track selected'}
      </span>
      {isPhone && <Button size="icon" variant={transport.playing ? 'default' : 'outline'} className="size-8 shrink-0" aria-label={transport.playing ? 'Pause playback' : 'Play'} title={transport.playing ? 'Pause playback' : 'Play'} aria-pressed={transport.playing} onClick={togglePlay}><Play className="size-3.5 fill-current" /></Button>}
      {isPhone && <Button size="icon" variant="outline" className="size-8 shrink-0" aria-label="Stop playback" title="Stop playback" onClick={() => void stop()}><Square className="size-3.5 fill-current" /></Button>}
      <Button size="sm" variant={selected?.armed ? 'default' : 'outline'} className="h-8 shrink-0 gap-1 px-2 text-[11px] font-bold tracking-wider" disabled={!selected || active} aria-label="Microphone" aria-pressed={!!selected?.armed} title="Microphone — arm the selected track for recording" onClick={() => { if (selected) updateTrack(selected.id, { armed: !selected.armed }); }}><Mic className="size-3.5" />MIC</Button>
      {isPhone && <Button size="icon" variant={active ? 'destructive' : 'outline'} className="size-8 shrink-0" disabled={!selected && !armed.length} aria-label={active ? 'Stop or cancel recording' : 'Record armed tracks'} title={active ? 'Stop or cancel recording' : 'Record armed tracks'} onClick={toggleRecord}><Circle className={cn('size-3.5 fill-current', isPhone && !active && 'text-destructive')} /></Button>}
      <div role="group" aria-label="Recording mode" className="flex shrink-0 gap-0.5 border-l border-border pl-2">
        <Button size="sm" variant={!transport.overdub ? 'default' : 'ghost'} className="h-8 px-2 text-[11px]" disabled={active} aria-pressed={!transport.overdub} onClick={() => setTransport({ overdub: false, replace: true })}>Replace</Button>
        <Button size="sm" variant={transport.overdub ? 'default' : 'ghost'} className="h-8 gap-1 px-2 text-[11px]" disabled={active} aria-pressed={!!transport.overdub} onClick={() => setTransport({ overdub: true, replace: false })}><Layers className="size-3" />Overdub</Button>
      </div>
      <Timer className="size-3.5 shrink-0 text-muted-foreground" />
      <Select value={transport.countIn ? String(transport.countInBars ?? 1) : '0'} onValueChange={(value) => setTransport({ countIn: value !== '0', ...(value !== '0' ? { countInBars: Number(value) } : {}) })} disabled={active}>
        <SelectTrigger aria-label="Recording count-in" className="h-8 w-32 shrink-0 text-[11px]"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="0">Count-in off</SelectItem>{[1, 2, 4].map((bars) => <SelectItem key={bars} value={String(bars)}>Count-in {bars} {bars === 1 ? 'bar' : 'bars'}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="icon" variant={transport.metronome ? 'default' : 'ghost'} className="size-8 shrink-0" aria-label="Recording metronome" aria-pressed={!!transport.metronome} title="Metronome" onClick={() => setTransport({ metronome: !transport.metronome })}><Metronome className="size-3.5" /></Button>
      <span className="shrink-0 border-l border-border pl-2 font-mono text-[10px] text-muted-foreground">LOOP {positionLabel(bounds[0])}–{positionLabel(bounds[1])}</span>
      {panel && <Button size="icon" variant="ghost" className="ml-auto size-8 shrink-0" aria-label="Return to arrangement" title="Return to arrangement" onClick={() => setPanel(null)}><X className="size-4" /></Button>}
    </div>
    {selected && <div className="flex min-w-0 items-center gap-1 overflow-x-auto border-t border-border px-2 py-1">
      <span className="max-w-40 shrink-0 truncate pr-1 font-mono text-[10px] text-muted-foreground" title={clip?.name ?? selected.name}>{clip?.name ?? (part ? 'Selected part' : selected.name)}</span>
      <Button size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Split selected part at playhead" title="Split at playhead" onClick={() => razorAt(selected.id, transport.step)}><SquareSplitHorizontal className="size-3.5" /></Button>
      <Button size="icon" variant="ghost" className="size-8 shrink-0" disabled={!clip} aria-label="Copy selected clip" title="Copy selected clip" onClick={() => { if (clip) copyClip(selected.id, clip.id); }}><Copy className="size-3.5" /></Button>
      <Button size="sm" variant="ghost" className="h-8 shrink-0 gap-1 px-2 text-[11px] font-bold tracking-wider" disabled={!clip} aria-label="Cut selected clip" title="Cut selected clip; keep channel" onClick={() => { if (clip) cutClip(selected.id, clip.id); }}><ClipboardMinus className="size-3.5" />CUT</Button>
      <Button size="icon" variant="ghost" className="size-8 shrink-0" disabled={!clipClipboardName} aria-label="Paste clip at playhead" title="Paste clip at playhead" onClick={() => pasteClip(false, selected.id)}><ClipboardPaste className="size-3.5" /></Button>
      <Button size="icon" variant="ghost" className="size-8 shrink-0 text-destructive" disabled={!part} aria-label="Delete selected part" title="Delete selected part; keep channel" onClick={removePart}><Trash2 className="size-3.5" /></Button>
      <Button size="sm" variant={transport.loop ? 'default' : 'outline'} aria-pressed={!!transport.loop} className="h-8 shrink-0 gap-1 px-2 text-[11px]" onClick={() => { if (transport.loop) { setTransport({ loop: false }); return; } if (!part || part[1] <= part[0]) { setTransport({ loop: true }); return; } setTransport({ loop: true, loopStart: part[0], loopEnd: part[1], ...(!transport.playing ? { step: part[0] } : {}), bars: Math.max(transport.bars, barsForSteps(part[1])) }); }}><Repeat className="size-3.5" />Loop selected part</Button>
      {clip?.alts?.length ? <Select value="current" onValueChange={(value) => { if (value !== 'current') swapTake(selected.id, clip.id, Number(value)); }}><SelectTrigger aria-label="Selected clip takes" className="h-8 w-40 shrink-0 text-[11px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="current">Current take</SelectItem>{clip.alts.map((take, index) => <SelectItem key={`${take.id}-${index}`} value={String(index)}>Take {index + 1}: {take.name}</SelectItem>)}</SelectContent></Select> : null}
      {(selected.kind === 'drum' || selected.kind === 'instrument' || selected.kind === 'midi' || selected.kind === 'sampler') && <Button size="sm" variant="ghost" className="h-8 shrink-0 gap-1 px-2 text-[11px]" onClick={() => setPanel('piano')}><Piano className="size-3.5" />Edit notes</Button>}
    </div>}
  </div>;
}