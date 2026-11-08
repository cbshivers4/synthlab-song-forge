/**
 * Granular Synth front panel: source picker (built-in textures or your own
 * sample), a source display showing the read window and the grains really
 * playing, and GRAIN / CLOUD / TONE knob sections. Every control writes the
 * track's patch.granular, so presets, MIDI learn and held notes share it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Snowflake, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import {
  GRANULAR_KNOBS,
  GRANULAR_SOURCES,
  defaultGranular,
  synthSource,
  type GrainShape,
  type GranularPatch,
  type GranularSource,
} from "@/lib/synclab/granular";
import type { Track } from "@/lib/synclab/types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (m: number) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

const peakCache = new Map<string, Float32Array>();
function peaksOf(data: Float32Array, buckets = 360) {
  const out = new Float32Array(buckets);
  const size = Math.max(1, Math.floor(data.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let pk = 0;
    for (let i = b * size; i < Math.min(data.length, (b + 1) * size); i++) pk = Math.max(pk, Math.abs(data[i]!));
    out[b] = pk;
  }
  return out;
}
function builtInPeaks(kind: Exclude<GranularSource, "sample">) {
  const hit = peakCache.get(kind);
  if (hit) return hit;
  // A lower rate is plenty for the display outline and keeps the panel quick to open.
  const p = peaksOf(synthSource(kind, 11025));
  peakCache.set(kind, p);
  return p;
}

function fmt(v: number, unit?: string) {
  if (unit === "Hz") return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
  if (unit === "ms") return `${Math.round(v)} ms`;
  if (unit === "s") return v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`;
  if (unit === "st") return `${v > 0 ? "+" : ""}${Number.isInteger(v) ? v : v.toFixed(2)}`;
  if (unit === "/s") return `${Math.round(v)}/s`;
  return `${Math.round(v * 100)}%`;
}

export function GranularSynth({ track }: { track: Track }) {
  const { updatePatch, previewNote } = useStudio();
  const g: GranularPatch = { ...defaultGranular(), ...(track.patch?.granular ?? {}) };
  const set = (p: Partial<GranularPatch>) => updatePatch(track.id, { granular: { ...g, ...p } });
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);

  const peaks = useMemo(() => {
    if (g.source !== "sample") return builtInPeaks(g.source);
    const buf = g.sampleUrl ? getEngine().decodedAudio().get(g.sampleUrl) : undefined;
    return buf ? peaksOf(buf.getChannelData(0)) : null;
  }, [g.source, g.sampleUrl, loading]);

  const loadFile = async (file: File) => {
    setLoading(true);
    try {
      const engine = getEngine();
      engine.init();
      const loaded = await engine.loadSampleFile(file, file.name.replace(/\.[^.]+$/, ""));
      set({ source: "sample", sampleUrl: loaded.url, sampleName: loaded.name, sampleCloudPath: undefined, sampleRoot: g.sampleRoot ?? 60 });
      toast.success("Sample loaded into the Granular Synth", { description: `${loaded.name} · ${loaded.duration.toFixed(2)} s` });
    } catch {
      toast.error("That file could not be read", { description: "Use a WAV, MP3, AIFF or M4A audio file." });
    } finally {
      setLoading(false);
    }
  };

  // Source outline + read window, then the grains sounding right now, at 20 fps.
  const latest = useRef(g);
  latest.current = g;
  useEffect(() => {
    const draw = () => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const x = c.getContext("2d");
      if (!x) return;
      const css = getComputedStyle(c);
      const ink = css.getPropertyValue("--granular-ink").trim() || "red";
      const dim = css.getPropertyValue("--granular-dim").trim() || "gray";
      const hot = css.getPropertyValue("--granular-hot").trim() || "white";
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);
      const gp = latest.current;
      if (peaks) {
        x.fillStyle = dim;
        const bw = w / peaks.length;
        for (let i = 0; i < peaks.length; i++) {
          const ph = Math.max(1, peaks[i]! * (h - 10));
          x.fillRect(i * bw, (h - ph) / 2, Math.max(1, bw - 0.5), ph);
        }
      }
      // read window: position ± spray
      const px = gp.position * w;
      const sw = Math.max(2, gp.spray * w);
      x.fillStyle = ink;
      x.globalAlpha = 0.18;
      x.fillRect(px - sw / 2, 0, sw, h);
      x.globalAlpha = 1;
      x.fillRect(px - 1, 0, 2, h);
      // live grains (real scheduled grains from the engine)
      const grains = getEngine().granularGrains(track.id);
      x.fillStyle = hot;
      for (const gr of grains) {
        const env = Math.sin(Math.PI * Math.min(1, Math.max(0, gr.progress)));
        const r = 2 + env * 4;
        const gy = h / 2 + ((gr.position * 997) % 1 - 0.5) * (h - 16);
        x.globalAlpha = 0.35 + env * 0.65;
        x.beginPath();
        x.arc(gr.position * w, gy, r, 0, Math.PI * 2);
        x.fill();
      }
      x.globalAlpha = 1;
    };
    draw();
    const id = window.setInterval(draw, 50);
    return () => window.clearInterval(id);
  }, [peaks, track.id]);

  const groups: { id: "grain" | "cloud" | "tone"; title: string }[] = [
    { id: "grain", title: "GRAIN" },
    { id: "cloud", title: "CLOUD" },
    { id: "tone", title: "AMP & TONE" },
  ];

  return (
    <div className="granular-synth space-y-3" aria-label="Granular Synth">
      <div className="granular-source-row flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Grain source">
        <span className="label-xs mr-1">SOURCE</span>
        {GRANULAR_SOURCES.map((s) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            role="radio"
            aria-checked={g.source === s.id}
            variant={g.source === s.id ? "default" : "secondary"}
            className="min-h-10"
            disabled={s.id === "sample" && !g.sampleUrl}
            title={s.id === "sample" && !g.sampleUrl ? "Load a sample first" : undefined}
            onClick={() => set({ source: s.id })}
          >
            {s.id === "sample" && g.sampleName ? g.sampleName : s.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" className="min-h-10" onClick={() => fileRef.current?.click()} disabled={loading}>
          <Upload className="size-4" /> {loading ? "Loading…" : "Load sample"}
        </Button>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
        {g.source === "sample" && (
          <label className="flex items-center gap-1 text-xs">
            <span className="label-xs">ROOT</span>
            <select
              aria-label="Sample root note"
              className="h-9 rounded border border-border bg-background px-1"
              value={g.sampleRoot ?? 60}
              onChange={(e) => set({ sampleRoot: Number(e.target.value) })}
            >
              {Array.from({ length: 61 }, (_, i) => i + 36).map((m) => <option key={m} value={m}>{noteName(m)}</option>)}
            </select>
          </label>
        )}
      </div>

      <div
        className="granular-display"
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
        onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith("audio")) { e.preventDefault(); e.stopPropagation(); void loadFile(f); } }}
      >
        <div className="granular-display-head">
          <span>{g.source === "sample" ? (g.sampleName ?? "MY SAMPLE") : GRANULAR_SOURCES.find((s) => s.id === g.source)?.label.toUpperCase()}</span>
          <span>{Math.round(g.size)} MS · {Math.round(g.density)}/S {g.freeze ? "· FROZEN" : g.scan ? `· SCAN ${g.scan > 0 ? "▶" : "◀"}` : ""}</span>
        </div>
        <canvas
          ref={canvasRef}
          className="granular-canvas"
          aria-label="Source sound with the read position and the grains playing now. Click to move the position."
          onPointerDown={(e) => {
            const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
            const vertical = r.height > r.width * 1.2; // sideways phone canvas
            const f = vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
            set({ position: Math.max(0, Math.min(1, f)) });
          }}
        />
        {!peaks && <p className="granular-empty">Loading the sample… press a key once it shows here.</p>}
      </div>

      <div className="granular-sections grid gap-2 md:grid-cols-3">
        {groups.map((grp) => (
          <section key={grp.id} className="granular-section" aria-label={grp.title}>
            <h4>{grp.title}</h4>
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-3">
              {GRANULAR_KNOBS.filter((k) => k.group === grp.id).map((k) => (
                <Knob
                  key={k.id}
                  label={k.label}
                  min={k.min}
                  max={k.max}
                  step={k.step}
                  value={g[k.id]}
                  defaultValue={defaultGranular()[k.id]}
                  format={(v) => fmt(v, k.unit)}
                  midiTarget={{ id: track.id, param: `synth:granular:${k.id}` }}
                  onChange={(v) => set({ [k.id]: v } as Partial<GranularPatch>)}
                />
              ))}
            </div>
            {grp.id === "grain" && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1" role="radiogroup" aria-label="Grain shape">
                {(["smooth", "triangle", "sharp"] as GrainShape[]).map((sh) => (
                  <Button key={sh} type="button" size="sm" role="radio" aria-checked={g.shape === sh} variant={g.shape === sh ? "default" : "secondary"} className="min-h-9 uppercase" onClick={() => set({ shape: sh })}>{sh}</Button>
                ))}
              </div>
            )}
            {grp.id === "cloud" && (
              <div className="mt-2 flex justify-center">
                <Button type="button" size="sm" variant={g.freeze ? "default" : "secondary"} aria-pressed={g.freeze} className="min-h-9" onClick={() => set({ freeze: !g.freeze })}>
                  <Snowflake className="size-4" /> FREEZE
                </Button>
              </div>
            )}
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="min-h-10" onClick={() => previewNote(track.id, 60, 2, false)}>Hear a 2-second note</Button>
      </div>
    </div>
  );
}
