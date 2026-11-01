import { useMemo, useState, type CSSProperties } from "react";
import { usePreviewTrack } from "@/lib/synclab/use-preview-track";
import { PreviewButtons } from "./PreviewButtons";
import { PatternWaveform } from "./PatternWaveform";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { getBeatsPerBar } from "@/lib/synclab/timebase";
import { SYNTH_PRESETS, applyPreset } from "@/lib/synclab/presets";

const BASS_SOUNDS = SYNTH_PRESETS.filter((p) => p.category === "Bass").map((p) => p.name);
import { BASS_STYLES, BASS_TEMPLATES, cleanBassPatch, generateBass, NOTE_NAMES, PROGRESSIONS, rootsFromKey, rootsFromTracks, type BassStyle } from "@/lib/synclab/bass-gen";

export function BassGenerator() {
  const { tracks, transport, addTrack, updateTrack, setTransport } = useStudio();
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
  const [template, setTemplate] = useState<string | null>(null);
  const signature = `${roots.join(",")}|${style}|${octave}|${barSteps}`;
  const [made, setMade] = useState<{ notes: ReturnType<typeof generateBass>; signature: string } | null>(null);
  const generated = made && made.signature === signature ? made.notes : null;
  const [variation, setVariation] = useState(0);
  const generate = () => {
    // Pressing again with the same settings makes a new variation; changing settings starts from the plain line.
    const v = made && made.signature === signature ? variation + 1 : 0;
    setVariation(v);
    const notes = varyBass(generateBass(roots, style, barSteps, octave), v, minor, barSteps);
    setMade({ notes, signature });
    toast.success(v ? `Bassline variation ${v}` : "Bassline generated", { description: `${notes.length} notes over ${bars} bars — preview it or add it to the timeline.` });
  };
  const applyTemplate = (id: string) => {
    const t = BASS_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTemplate(id);
    setStyle(t.style); setSound(t.sound); setOctave(t.octave);
    setTonic(t.tonic); setMinor(t.minor); setProg(t.prog); setFollow(false);
    const degrees = PROGRESSIONS.find((p) => p.id === t.prog)!.degrees;
    const r = rootsFromKey(t.tonic, t.minor, degrees, bars);
    const notes = generateBass(r, t.style, barSteps, t.octave);
    setVariation(0);
    setMade({ notes, signature: `${r.join(",")}|${t.style}|${t.octave}|${barSteps}` });
    toast.success(`${t.label} bassline generated`, { description: `${notes.length} notes in ${NOTE_NAMES[t.tonic]} ${t.minor ? "minor" : "major"} — check the waveform, then preview or add it.` });
  };
  const activeTemplate = BASS_TEMPLATES.find((t) => t.id === template);
  const build = (name: string, withSound = sound) => {
    const notes = generated ?? generateBass(roots, style, barSteps, octave);
    const id = addTrack("instrument", name, withSound, { keepPanel: true });
    updateTrack(id, { steps: bars * barSteps, notes, patch: cleanBassPatch(applyPreset(withSound)) });
    return { id, notes };
  };
  const preview = (withSound?: string) => pv.start((n) => build(n(`BASS · ${label}`), withSound ?? sound).id);
  const create = () => {
    if (pv.keep(`BASS · ${label}`)) { toast.success("Bassline added"); return; }
    const { notes } = build(`BASS · ${label}`);
    toast.success("Bassline added", { description: `${notes.length} notes — edit them in the piano roll.` });
  };

  const chip = (on: boolean) => `min-h-11 rounded-md border px-3 text-sm ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`;

  return (
    <section className="bassgen-device space-y-4 rounded-md border border-border bg-surface-1 p-4">
      <header>
        <h2 className="bassgen-brand">SYNCLAB <b>Bassline Generator</b></h2>
        <p className="text-xs text-muted-foreground">Writes a bassline from music theory — following the chords already in your song, or a key and progression you pick. No AI credits used.</p>
      </header>

      <div className="bassgen-display" aria-live="polite">
        <span className="bassgen-display-key">{useSong ? "FOLLOWING YOUR CHORDS" : `${NOTE_NAMES[tonic]} ${minor ? "MINOR" : "MAJOR"}`}</span>
        <span className="bassgen-display-roots">{roots.map((r) => NOTE_NAMES[r]).join(" → ")}</span>
        <span className="bassgen-display-meta">{label} · {bars} BARS · {sound.toUpperCase()}</span>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-xs font-bold tracking-widest text-muted-foreground">GENRE TEMPLATES</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {BASS_TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => applyTemplate(t.id)} aria-pressed={template === t.id}
              className={`min-h-14 rounded-md border p-2 text-left ${template === t.id ? "border-primary bg-primary/15" : "border-border hover:border-primary/60"}`}>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block font-mono text-[10px] text-muted-foreground">{t.bpm} BPM · {t.sound}</span>
            </button>
          ))}
        </div>
        {activeTemplate && transport.bpm !== activeTemplate.bpm && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {activeTemplate.label} usually runs at {activeTemplate.bpm} BPM (your song is {transport.bpm}).
            <Button size="sm" variant="outline" onClick={() => setTransport({ bpm: activeTemplate.bpm })}>Use {activeTemplate.bpm} BPM</Button>
          </div>
        )}
      </div>

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
        <select value={octave} onChange={(e) => setOctave(Number(e.target.value))} aria-label="Octave" className="min-h-12 rounded-md border border-border bg-surface-2 px-3 text-sm">
          <option value={0}>Very low (C0)</option><option value={1}>Low (C1)</option><option value={2}>Mid (C2)</option>
        </select>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-xs font-bold tracking-widest text-muted-foreground">BASS SOUND · {BASS_SOUNDS.length} TO PICK FROM</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6" role="radiogroup" aria-label="Bass sound">
          {BASS_SOUNDS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={sound === s}
              onClick={() => { setSound(s); if (pv.previewing) { pv.stop(); setTimeout(() => preview(s), 60); } }}
              className={`min-h-11 rounded-md border px-2 text-left text-sm ${sound === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{s}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Pick a sound, then press Preview to hear your bassline with it. Changing the sound while previewing switches it right away.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" className="min-h-12" onClick={generate}>{generated ? "Regenerate (new variation)" : "Generate bassline"}</Button>
        {generated && <span className="font-mono text-xs text-muted-foreground">{generated.length} notes ready</span>}
      </div>
      {generated && (
        <div className="bassgen-grid" role="img" aria-label={`Generated bassline: ${generated.length} notes over ${bars} bars`}>
          {Array.from({ length: bars * barSteps }, (_, i) => {
            const note = generated.find((n) => i >= n.step && i < n.step + n.length);
            const start = generated.find((n) => n.step === i);
            return (
              <span
                key={i}
                className={`bassgen-cell${note ? " is-on" : ""}${start ? " is-start" : ""}${i % barSteps === 0 ? " is-bar" : ""}`}
                style={note ? ({ "--cell-level": String(0.35 + note.velocity * 0.65) } as CSSProperties) : undefined}
              />
            );
          })}
        </div>
      )}
      {generated && <PatternWaveform pattern={{ notes: generated, instrument: sound, steps: bars * barSteps }} bpm={transport.bpm} label="Generated bassline waveform" />}
      <PreviewButtons pv={pv} onPreview={() => preview()} onAdd={create} addLabel="Add bassline to timeline" />
    </section>
  );
}
