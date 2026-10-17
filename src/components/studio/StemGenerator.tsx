import { useEffect, useRef, useState } from "react";
import { Play, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { usePreviewTrack } from "@/lib/synclab/use-preview-track";
import { PreviewButtons } from "./PreviewButtons";
import { GeneratedWaveform } from "./GeneratedWaveform";
import { useStudio } from "@/lib/synclab/store";
import { peaksOf, separateStems } from "@/lib/synclab/stems";
import { encodeWav } from "@/lib/synclab/bounce";
import { generateStemFn } from "@/utils/generate-stem.functions";
import { isolatePart, partForInstrument } from "@/lib/synclab/ai-isolate";

const TEMPLATES: { group: string; items: string[] }[] = [
  { group: "Drums", items: ["Drums", "Percussion", "Trap hi-hats", "House drums"] },
  { group: "Bass", items: ["Bass", "808 bass", "Synth bass", "Electric bass", "Upright bass"] },
  { group: "Synth", items: ["Synth", "Synth pad", "Lead synth", "Arp synth", "Pluck synth", "Detroit strings synth"] },
  { group: "Voice", items: ["Voice", "Lead vocal", "Vocal chops", "Choir", "Humming", "Vocal ad-libs"] },
  { group: "Keys", items: ["Piano", "Electric piano", "Organ", "Rhodes"] },
  { group: "Band", items: ["Guitar", "Acoustic guitar", "Strings", "Brass", "Saxophone", "Flute"] },
];
const KEYS = ["", "C major", "A minor", "G major", "E minor", "D major", "B minor", "F major", "D minor", "C minor", "F minor"];

export function StemGenerator() {
  const { transport, addTrack, addClip } = useStudio();
  const gen = useServerFn(generateStemFn);
  const [instrument, setInstrument] = useState("Drums");
  const [key, setKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
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
    pv.stop();
    try {
      const res = await gen({ data: { prompt: prompt.trim() || `${instrument} groove`, instrument, bpm: transport.bpm || 120, key } });
      if (!res.ok) { setError(res.error); return; }
      const bytes = Uint8Array.from(atob(res.mp3), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const ctx = new AudioContext();
      const raw = await ctx.decodeAudioData(await blob.arrayBuffer());
      // The AI music model sometimes adds other parts, so isolate only the requested instrument.
      // First choice: AI separation (Demucs) keeps just that part. Fallback: on-device spectral cleaning.
      setCleaning(true);
      const part = partForInstrument(instrument);
      let left: Float32Array, right: Float32Array, sr = raw.sampleRate, how = "";
      try {
        const iso = await ctx.decodeAudioData(await (await isolatePart(blob, part)).arrayBuffer());
        left = iso.getChannelData(0).slice(); right = (iso.numberOfChannels > 1 ? iso.getChannelData(1) : iso.getChannelData(0)).slice(); sr = iso.sampleRate;
        how = "AI kept only the " + instrument.toLowerCase() + ".";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        const want = part === "drums" ? ["drums"] : part === "vocals" ? ["vocals"] : part === "bass" ? ["bass"] : ["drums", "bass", "vocals"];
        const parts = await separateStems(raw, want as Parameters<typeof separateStems>[1]);
        const L0 = raw.getChannelData(0), R0 = raw.numberOfChannels > 1 ? raw.getChannelData(1) : L0;
        const keep = part === "drums" ? parts.drums : part === "vocals" ? parts.vocals : part === "bass" ? parts.bass : null;
        if (keep) ({ left, right } = keep);
        else {
          left = L0.slice(); right = R0.slice();
          for (const k of ["drums", "bass", "vocals"] as const) { const d = parts[k]; if (d) for (let i = 0; i < left.length; i++) { left[i] = left[i]! - d.left[i]!; right[i] = right[i]! - d.right[i]!; } }
        }
        how = "Cleaned on your device (some bleed can remain). Clean AI isolation unavailable" + (msg ? ": " + msg : ".");
      }
      setNote(how);
      const buf = ctx.createBuffer(2, left.length, sr);
      buf.copyToChannel(new Float32Array(left), 0); buf.copyToChannel(new Float32Array(right), 1);
      void ctx.close();
      const wav = encodeWav({ left, right, sampleRate: sr });
      if (result) URL.revokeObjectURL(result.url);
      setResult({ url: URL.createObjectURL(wav), buf, name: `${instrument.toUpperCase()} · AI` });
    } catch {
      setError("Sign in to generate stems, then try again.");
    } finally { setBusy(false); setCleaning(false); }
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

  const pv = usePreviewTrack();
  const build = (name: string) => {
    if (!result) return "";
    const d = result.buf.duration;
    const id = addTrack("audio", name, undefined, { keepPanel: true });
    addClip(id, { id: `gen-${Date.now()}`, name: result.name, url: result.url, peaks: peaksOf(result.buf.getChannelData(0)), duration: d, start: 0, offset: 0, length: d });
    return id;
  };
  const preview = () => { if (!result) return; audioRef.current?.pause(); setPlaying(false); pv.start((n) => build(n(result.name))); };
  const add = () => {
    if (!result) return;
    audioRef.current?.pause();
    setPlaying(false);
    if (!pv.keep(result.name)) build(result.name);
    toast.success("Generated stem added to a new track");
    setResult(null);
  };

  return (
    <section className="space-y-4 rounded-md border border-border bg-surface-1 p-4">
      <header>
        <h2 className="font-mono text-sm font-bold tracking-[0.18em]">GENERATE STEM</h2>
        <p className="text-xs text-muted-foreground">
          Describe a part and AI creates a 30-second audio clip at {transport.bpm} BPM. Afterwards AI separation keeps only the instrument you picked and removes everything else. If that service is unavailable, SYNCLAB cleans it on your device instead, where faint bleed can remain. Each generation uses AI credits.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((g) => (
          <div key={g.group} className="flex w-full flex-wrap items-center gap-2">
            <span className="w-14 shrink-0 font-mono text-[10px] font-bold tracking-widest text-muted-foreground">{g.group.toUpperCase()}</span>
            {g.items.map((i) => (
              <button key={i} type="button" onClick={() => setInstrument(i)} disabled={busy} aria-pressed={instrument === i}
                className={`min-h-11 rounded-md border px-3 text-sm ${instrument === i ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{i}</button>
            ))}
          </div>
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
          <Sparkles className="size-4" /> {cleaning ? "Keeping only your instrument… (about a minute)" : busy ? "Composing… (up to a minute)" : "Generate"}
        </Button>
        {result && <>
          <Button size="lg" variant="secondary" className="min-h-12" onClick={toggle}>
            {playing ? <Square className="size-4 fill-current" /> : <Play className="size-4" />} {playing ? "Stop" : "Play"}
          </Button>
          <PreviewButtons pv={pv} onPreview={preview} onAdd={add} addLabel="Add to timeline" />
        </>}
      </div>

      {result && <GeneratedWaveform buffer={result.buf} label="Generated stem waveform" />}
      {note && result && <p className="text-xs text-muted-foreground">{note}</p>}
      {error && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
