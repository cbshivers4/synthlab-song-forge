import { useEffect, useMemo, useState } from "react";
import { usePreviewTrack } from "@/lib/synclab/use-preview-track";
import { PreviewButtons } from "./PreviewButtons";
import { PatternWaveform } from "./PatternWaveform";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { getBeatsPerBar } from "@/lib/synclab/timebase";
import { BASS_STYLES, generateBass, NOTE_NAMES, PROGRESSIONS, rootsFromKey, rootsFromTracks, type BassStyle } from "@/lib/synclab/bass-gen";

export function BassGenerator() {
  const { tracks, transport, addTrack, updateTrack } = useStudio();
  const barSteps = getBeatsPerBar() * 4;
  const [style, setStyle] = useState<BassStyle>("roots");
  const [bars, setBars] = useState(4);
  const [follow, setFollow] = useState(true);
  const [tonic, setTonic] = useState(9);
  const [minor, setMinor] = useState(true);
  const [prog, setProg] = useState(PROGRESSIONS[0]!.id);
  const [sound, setSound] = useState("Sub Bass");
  const [octave, setOctave] = useState(1);

  const detected = useMemo(() => rootsFromTracks(tracks, bars, barSteps), [tracks, bars, barSteps]);
  const hasSong = detected.some((r) => r !== null);
  const useSong = follow && hasSong;

  const roots = useMemo(() => {
    const fromKey = rootsFromKey(tonic, minor, PROGRESSIONS.find((p) => p.id === prog)!.degrees, bars);
    if (!useSong) return fromKey;
    // fill bars with no chords from the previous detected root
    let last = detected.find((r) => r !== null) ?? tonic;
    return detected.map((r) => (r === null ? last : (last = r)));
  }, [useSong, detected, tonic, minor, prog, bars]);

  const pv = usePreviewTrack();
  const label = BASS_STYLES.find((s) => s.id === style)!.label.toUpperCase();
  const [generated, setGenerated] = useState<ReturnType<typeof generateBass> | null>(null);
  useEffect(() => setGenerated(null), [roots, style, octave, barSteps]);
  const generate = () => {
    const notes = generateBass(roots, style, barSteps, octave);
    setGenerated(notes);
    toast.success("Bassline generated", { description: `${notes.length} notes over ${bars} bars — preview it or add it to the timeline.` });
  };
  const build = (name: string) => {
    const notes = generated ?? generateBass(roots, style, barSteps, octave);
    const id = addTrack("instrument", name, sound, { keepPanel: true });
    updateTrack(id, { steps: bars * barSteps, notes });
    return { id, notes };
  };
  const preview = () => pv.start((n) => build(n(`BASS · ${label}`)).id);
  const create = () => {
    if (pv.keep(`BASS · ${label}`)) { toast.success("Bassline added"); return; }
    const { notes } = build(`BASS · ${label}`);
    toast.success("Bassline added", { description: `${notes.length} notes — edit them in the piano roll.` });
  };

  const chip = (on: boolean) => `min-h-11 rounded-md border px-3 text-sm ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`;

  return (
    <section className="space-y-4 rounded-md border border-border bg-surface-1 p-4">
      <header>
        <h2 className="font-mono text-sm font-bold tracking-[0.18em]">BASS GENERATOR</h2>
        <p className="text-xs text-muted-foreground">Writes a bassline from music theory — following the chords already in your song, or a key and progression you pick. No AI credits used.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {BASS_STYLES.map((s) => <button key={s.id} type="button" title={s.hint} onClick={() => setStyle(s.id)} className={chip(style === s.id)}>{s.label}</button>)}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className={chip(useSong)} disabled={!hasSong} onClick={() => setFollow(true)}>Follow my chords</button>
        <button type="button" className={chip(!useSong)} onClick={() => setFollow(false)}>Pick a key</button>
        {!hasSong && <span className="text-xs text-muted-foreground">No chords found yet — using a key.</span>}
      </div>

      {!useSong && (
        <div className="flex flex-wrap gap-2">
          <select value={tonic} onChange={(e) => setTonic(Number(e.target.value))} aria-label="Key" className="min-h-12 rounded-md border border-border bg-surface-2 px-3 text-sm">
            {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
          <select value={minor ? "min" : "maj"} onChange={(e) => setMinor(e.target.value === "min")} aria-label="Scale" className="min-h-12 rounded-md border border-border bg-surface-2 px-3 text-sm">
            <option value="min">Minor</option><option value="maj">Major</option>
          </select>
          <select value={prog} onChange={(e) => setProg(e.target.value)} aria-label="Progression" className="min-h-12 rounded-md border border-border bg-surface-2 px-3 text-sm">
            {PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select value={bars} onChange={(e) => setBars(Number(e.target.value))} aria-label="Bars" className="min-h-12 rounded-md border border-border bg-surface-2 px-3 text-sm">
          {[2, 4, 8].map((b) => <option key={b} value={b}>{b} bars</option>)}
        </select>
        <select value={sound} onChange={(e) => setSound(e.target.value)} aria-label="Bass sound" className="min-h-12 rounded-md border border-border bg-surface-2 px-3 text-sm">
          {["Sub Bass", "Reese Bass", "Ghetto Tech Bass"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={octave} onChange={(e) => setOctave(Number(e.target.value))} aria-label="Octave" className="min-h-12 rounded-md border border-border bg-surface-2 px-3 text-sm">
          <option value={0}>Very low (C0)</option><option value={1}>Low (C1)</option><option value={2}>Mid (C2)</option>
        </select>
      </div>

      <p className="font-mono text-xs text-primary">Roots: {roots.map((r) => NOTE_NAMES[r]).join(" → ")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" className="min-h-12" onClick={generate}>Generate bassline</Button>
        {generated && <span className="font-mono text-xs text-muted-foreground">{generated.length} notes ready</span>}
      </div>
      {generated && <PatternWaveform pattern={{ notes: generated, instrument: sound, steps: bars * barSteps }} bpm={transport.bpm} label="Generated bassline waveform" />}
      <PreviewButtons pv={pv} onPreview={preview} onAdd={create} addLabel="Add bassline to timeline" />
    </section>
  );
}
