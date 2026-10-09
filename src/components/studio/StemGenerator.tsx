import { useEffect, useRef, useState } from "react";
import { Play, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { peaksOf } from "@/lib/synclab/stems";
import { generateStemFn } from "@/utils/generate-stem.functions";

const INSTRUMENTS = ["Drums", "Bass", "Piano", "Synth pad", "Lead synth", "Guitar", "Strings", "Brass", "Vocal chops", "Percussion"];
const KEYS = ["", "C major", "A minor", "G major", "E minor", "D major", "B minor", "F major", "D minor", "C minor", "F minor"];

export function StemGenerator() {
  const { transport, addTrack, addClip } = useStudio();
  const gen = useServerFn(generateStemFn);
  const [instrument, setInstrument] = useState("Drums");
  const [key, setKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; buf: AudioBuffer; name: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    audioRef.current?.pause();
    setPlaying(false);
    try {
      const res = await gen({ data: { prompt: prompt.trim() || `${instrument} groove`, instrument, bpm: transport.bpm || 120, key } });
      if (!res.ok) { setError(res.error); return; }
      const bytes = Uint8Array.from(atob(res.mp3), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const ctx = new AudioContext();
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      void ctx.close();
      if (result) URL.revokeObjectURL(result.url);
      setResult({ url: URL.createObjectURL(blob), buf, name: `${instrument.toUpperCase()} · AI` });
    } catch {
      setError("Sign in to generate stems, then try again.");
    } finally { setBusy(false); }
  };

  const toggle = () => {
    if (!result) return;
    if (playing) { audioRef.current?.pause(); setPlaying(false); return; }
    const a = audioRef.current && audioRef.current.src === result.url ? audioRef.current : new Audio(result.url);
    audioRef.current = a;
    a.currentTime = 0;
    a.onended = () => setPlaying(false);
    void a.play();
    setPlaying(true);
  };

  const add = () => {
    if (!result) return;
    audioRef.current?.pause();
    setPlaying(false);
    const d = result.buf.duration;
    const id = addTrack("audio", result.name, undefined, { keepPanel: true });
    addClip(id, { id: `gen-${Date.now()}`, name: result.name, url: result.url, peaks: peaksOf(result.buf.getChannelData(0)), duration: d, start: 0, offset: 0, length: d });
    toast.success("Generated stem added to a new track");
    setResult(null);
  };

  return (
    <section className="space-y-4 rounded-md border border-border bg-surface-1 p-4">
      <header>
        <h2 className="font-mono text-sm font-bold tracking-[0.18em]">GENERATE STEM</h2>
        <p className="text-xs text-muted-foreground">
          Describe a part and AI creates a 30-second audio clip at {transport.bpm} BPM. The AI aims for just that instrument, but some clips may include other sounds. Each generation uses AI credits.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {INSTRUMENTS.map((i) => (
          <button key={i} type="button" onClick={() => setInstrument(i)} disabled={busy}
            className={`min-h-11 rounded-md border px-3 text-sm ${instrument === i ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{i}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={key} onChange={(e) => setKey(e.target.value)} disabled={busy} aria-label="Key" className="min-h-12 rounded-md border border-border bg-surface-2 px-3 text-sm">
          {KEYS.map((k) => <option key={k} value={k}>{k || "Any key"}</option>)}
        </select>
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={800} disabled={busy}
          placeholder="Style or mood, e.g. dark Detroit techno, warm 90s R&B…" className="min-h-12 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 text-sm" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" className="min-h-12" disabled={busy} onClick={() => void generate()}>
          <Sparkles className="size-4" /> {busy ? "Composing… (up to a minute)" : "Generate"}
        </Button>
        {result && <>
          <Button size="lg" variant="secondary" className="min-h-12" onClick={toggle}>
            {playing ? <Square className="size-4 fill-current" /> : <Play className="size-4" />} {playing ? "Stop" : "Listen"}
          </Button>
          <Button size="lg" variant="secondary" className="min-h-12" onClick={add}>Add to timeline</Button>
        </>}
      </div>

      {error && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
