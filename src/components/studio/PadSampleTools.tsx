import { useEffect, useRef, useState } from 'react';
import { Play, Scissors, Square, ArrowRight, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { WaveformView } from './WaveformView';
import { getEngine } from '@/lib/synclab/audio-engine';
import { encodeWav } from '@/lib/synclab/bounce';
import { detectSampleChops } from '@/lib/synclab/sample-chops';
import { cropPadPeaks, distributePadChops, padChopRanges } from '@/lib/synclab/pad-chops';
import { getPadBank, setPadBank, type SavedPad } from '@/lib/synclab/pad-session';
import { toast } from 'sonner';

export function PadSampleTools({ id, pad, manual, onManual, onPatch, onPreview, onStop, onStopTarget }: {
  id: number; pad: SavedPad; manual: boolean; onManual: () => void;
  onPatch: (patch: Partial<SavedPad>) => void;
  onPreview: (start: number, end: number) => void; onStop: () => void; onStopTarget: (id: number) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [destination, setDestination] = useState(Math.floor(id / 16) === 0 ? 16 : 0);
  const [percent, setPercent] = useState(100);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  useEffect(() => () => workerRef.current?.terminate(), []);
  const ranges = padChopRanges(pad);
  const chosen = selected.filter(i => Boolean(ranges[i]));
  const duration = pad.duration * (pad.end - pad.start);
  const patchCuts = (slices: number[]) => { setSelected([]); onPatch({ slices }); };

  const autoChop = async () => {
    setBusy(true);
    try {
      const buffer = await getEngine().ensureBuffer(pad.url);
      if (!buffer) throw new Error('Sample audio is unavailable');
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
      patchCuts(detectSampleChops(channels, buffer.sampleRate, pad.start, pad.end, 0.6));
    } catch (error) { toast.error('Could not chop sample', { description: String(error) }); }
    finally { setBusy(false); }
  };

  const send = (replace = false) => {
    try {
      const bank = getPadBank();
      const next = distributePadChops(bank, id, chosen, destination);
      if (!replace && chosen.some((_, i) => bank[destination + i])) { setConfirm(true); return; }
      chosen.forEach((_, i) => onStopTarget(destination + i));
      setPadBank(next);
      setConfirm(false);
      toast.success(`${chosen.length} chops added to pads`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add chops'); }
  };

  const stretch = async () => {
    setBusy(true);
    try {
      const buffer = await getEngine().ensureBuffer(pad.url);
      if (!buffer) throw new Error('Sample audio is unavailable');
      const a = Math.floor(pad.start * buffer.length), b = Math.floor(pad.end * buffer.length);
      const left = buffer.getChannelData(0).slice(a, b);
      const right = buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1)).slice(a, b);
      const worker = new Worker(new URL('../../lib/synclab/pad-stretch.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      const audio = await new Promise<{ left: Float32Array; right: Float32Array }>((resolve, reject) => {
        worker.onmessage = e => e.data.error ? reject(new Error(e.data.error)) : resolve(e.data);
        worker.onerror = () => reject(new Error('Audio processing failed'));
        worker.postMessage({ left, right, speed: 100 / percent }, [left.buffer, right.buffer]);
      });
      worker.terminate(); workerRef.current = null;
      const loaded = await getEngine().loadSampleFile(encodeWav({ ...audio, sampleRate: buffer.sampleRate }), `${pad.name.slice(0, 12)} ST`);
      // Use current bank so an async render cannot replace a newly loaded sample.
      const bank = getPadBank(), current = bank[id];
      if (!current || current.url !== pad.url || current.start !== pad.start || current.end !== pad.end) throw new Error('Pad changed while stretching; try again');
      onStop();
      bank[id] = { ...current, ...loaded, cloudPath: undefined, start: 0, end: 1, slices: (pad.slices ?? []).filter(v => v >= pad.start && v < pad.end).map(v => (v - pad.start) / (pad.end - pad.start)) };
      setPadBank(bank); setPercent(100);
      toast.success('Time stretch applied — pitch kept');
    } catch (error) { toast.error('Could not stretch sample', { description: error instanceof Error ? error.message : undefined }); }
    finally { workerRef.current?.terminate(); workerRef.current = null; setBusy(false); }
  };

  return <div className="space-y-3 border-y border-border py-3" aria-label="Pad chop and stretch tools">
    <div className="flex flex-wrap items-center gap-2">
      <Scissors className="size-4 text-primary" /><span className="label-xs">Chop sample</span>
      <Button size="sm" variant={manual ? 'default' : 'outline'} aria-pressed={manual} onClick={onManual}>Manual cuts</Button>
      {[4, 8, 12, 16].map(n => <Button key={n} size="sm" variant="secondary" disabled={busy} aria-label={`Make ${n} pad chops`} onClick={() => patchCuts(Array.from({ length: n }, (_, i) => pad.start + (pad.end - pad.start) * i / n))}>{n}</Button>)}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void autoChop()}>Auto-chop attacks</Button>
      <Button size="sm" variant="ghost" onClick={() => patchCuts([])}>Clear cuts</Button>
    </div>
    {Boolean(pad.slices?.length) && <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {ranges.map((range, i) => <div key={i} className="min-w-0 space-y-1 rounded border border-border p-1.5">
          <div className="flex items-center gap-2"><Checkbox aria-label={`Select pad chop ${i + 1}`} checked={chosen.includes(i)} onCheckedChange={checked => setSelected(list => checked ? [...list, i] : list.filter(v => v !== i))} /><span className="font-mono text-[10px]">Chop {i + 1}</span></div>
          <Button variant="ghost" className="signal-screen relative h-12 w-full p-0" aria-label={`Preview pad chop ${i + 1}`} onClick={() => onPreview(range.start, range.end)}><WaveformView peaks={cropPadPeaks({ ...pad, ...range })} className="!h-full !w-full" color="var(--display-wave)" grid={false} label={`Chop ${i + 1} waveform`} /><Play className="absolute size-3 text-foreground" /></Button>
        </div>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setSelected(chosen.length === ranges.length ? [] : ranges.map((_, i) => i))}>{chosen.length === ranges.length ? 'Deselect all' : 'Select all chops'}</Button>
        <Button size="sm" variant="ghost" aria-label="Stop chop preview" onClick={onStop}><Square className="size-4" /></Button>
        <span className="label-xs">Starting pad</span>
        <Select value={String(destination)} onValueChange={value => setDestination(Number(value))}><SelectTrigger className="w-28" aria-label="Chop destination pad"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 64 }, (_, i) => <SelectItem key={i} value={String(i)}>{'ABCD'[Math.floor(i / 16)]}{i % 16 + 1}{getPadBank()[i] ? ' · loaded' : ''}</SelectItem>)}</SelectContent></Select>
        <Button size="sm" disabled={!chosen.length || busy} onClick={() => send()}><ArrowRight className="size-4" />Add selected chops ({chosen.length})</Button>
      </div>
    </>}
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
      <Waves className="size-4 text-primary" /><span className="label-xs">Time stretch · keep pitch</span>
      <div className="w-48 space-y-1"><span className="font-mono text-xs">{percent}% · {duration.toFixed(2)}s → {(duration * percent / 100).toFixed(2)}s</span><Slider aria-label="Pad time stretch length" min={25} max={400} step={1} value={[percent]} disabled={busy} onValueChange={([value]) => setPercent(value ?? 100)} /></div>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setPercent(50)}>½ length</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => setPercent(200)}>2× length</Button>
      <Button size="sm" disabled={busy || percent === 100} onClick={() => void stretch()}>{busy ? 'Processing…' : 'Apply pad stretch'}</Button>
    </div>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Replace pad sounds?</AlertDialogTitle><AlertDialogDescription>The destination contains loaded sounds. Selected chops will replace them; the source pad stays unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => send(true)}>Replace sounds</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}