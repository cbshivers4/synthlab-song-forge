import { useState } from "react";
import { AudioLines, FolderOpen, Music2, Plus, Search, Sparkles, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { SYNTH_PRESETS, uid } from "@/lib/synclab/presets";
import { toast } from "sonner";

type Tab = "samples" | "plugins" | "presets";

const SAMPLE_PACKS: { pack: string; samples: { name: string; kind: string }[] }[] = [
  {
    pack: "DETROIT TECHNO KIT",
    samples: [
      { name: "303 ACID LOOP", kind: "LOOP" },
      { name: "WAREHOUSE KICK", kind: "KICK" },
      { name: "METRO SNARE", kind: "SNARE" },
      { name: "HI-NRG HAT", kind: "HAT" },
      { name: "INDUSTRIAL CLANG", kind: "FX" },
    ],
  },
  {
    pack: "ELECTRO 808",
    samples: [
      { name: "808 BOOM", kind: "KICK" },
      { name: "808 SNAP", kind: "SNARE" },
      { name: "CYBOTRON TOM", kind: "TOM" },
      { name: "ELECTRO CLAP", kind: "CLAP" },
    ],
  },
  {
    pack: "GHETTO PERCUSSION",
    samples: [
      { name: "JIT PERC LOOP", kind: "LOOP" },
      { name: "RIM SHOT", kind: "RIM" },
      { name: "SHAKER 16", kind: "SHAKER" },
      { name: "CONGA HIT", kind: "PERC" },
    ],
  },
  {
    pack: "HOUSE CHORDS & STABS",
    samples: [
      { name: "DEEP CHORD STAB", kind: "STAB" },
      { name: "ORGAN RIFF", kind: "LOOP" },
      { name: "PIANO HOUSE LOOP", kind: "LOOP" },
      { name: "BRASS HIT", kind: "STAB" },
    ],
  },
  {
    pack: "VOCALS & FX",
    samples: [
      { name: "ROBOT VOX PHRASE", kind: "VOX" },
      { name: "VOCODER CHANT", kind: "VOX" },
      { name: "RISER SWEEP", kind: "FX" },
      { name: "DOWNLIFTER", kind: "FX" },
      { name: "VINYL CRACKLE", kind: "FX" },
    ],
  },
];

const EFFECT_PLUGINS: { name: string; desc: string; fx: string }[] = [
  { name: "Tube Saturation", desc: "Warm analog drive", fx: "saturation" },
  { name: "Distortion Unit", desc: "Hard clipping aggression", fx: "distortion" },
  { name: "Dimension Chorus", desc: "Wide ensemble movement", fx: "chorus" },
  { name: "Jet Flanger", desc: "Sweeping comb jet", fx: "flanger" },
  { name: "Phase Shifter", desc: "Slow rotary phase", fx: "phaser" },
  { name: "Tape Delay", desc: "Echo with feedback", fx: "delay" },
  { name: "Hall Reverb", desc: "Large space ambience", fx: "reverb" },
  { name: "Bit Crusher", desc: "Lo-fi sample reduction", fx: "bitcrush" },
];

const peaksFromName = (name: string) => {
  let seed = 0;
  for (const c of name) seed = (seed * 31 + c.charCodeAt(0)) % 9973;
  return Array.from({ length: 96 }, (_, i) => {
    seed = (seed * 16807) % 2147483647;
    return 0.25 + ((seed % 1000) / 1000) * 0.7 * Math.max(0.25, Math.sin(i / 9));
  });
};

export function Browser() {
  const [tab, setTab] = useState<Tab>("samples");
  const [q, setQ] = useState("");
  const { tracks, selected, select, addTrack, addClip, loadPreset, updatePatch, setPanel } = useStudio();
  const query = q.trim().toLowerCase();
  const match = (...fields: (string | undefined)[]) => !query || fields.some((f) => f?.toLowerCase().includes(query));

  const addSampleToTimeline = (sample: string, pack: string) => {
    const target =
      selected && (selected.kind === "audio" || selected.kind === "sampler")
        ? selected
        : tracks.find((t) => t.kind === "audio");
    const clip = {
      id: uid(),
      name: `${sample} (${pack})`,
      peaks: peaksFromName(sample),
      duration: 2,
    };
    if (target) {
      addClip(target.id, clip);
      select(target.id);
      toast.success(`Sample added to ${target.name}`, { description: clip.name });
    } else {
      const id = addTrack("audio", "SAMPLES");
      if (id) {
        addClip(id, clip);
        toast.success("Sample track created", { description: clip.name });
      }
    }
    setPanel(null);
  };

  const loadPresetOnto = (preset: string) => {
    const target = selected?.patch ? selected : tracks.find((t) => t.patch);
    if (target) {
      loadPreset(target.id, preset);
      select(target.id);
      toast.success(`Preset loaded on ${target.name}`, { description: preset });
      setPanel("synth");
    } else {
      addTrack("instrument", preset.toUpperCase(), preset);
      toast.success("Instrument added", { description: preset });
      setPanel(null);
    }
  };

  const insertEffect = (name: string, fx: string) => {
    const target = selected?.patch ? selected : tracks.find((t) => t.patch);
    if (!target?.patch) {
      toast("Select an instrument track first", { description: "Effects insert on the selected instrument channel." });
      return;
    }
    const cur = target.patch.fx as Record<string, number | undefined>;
    const current = cur[fx] ?? 0;
    const next = current > 0 ? 0 : 0.45;
    const patchFx: Record<string, number> = { ...target.patch.fx, [fx]: next };
    if (fx === "delay" && next > 0) patchFx["delayFeedback"] = 0.35;
    updatePatch(target.id, { fx: { ...target.patch.fx, ...patchFx } });
    toast.success(next > 0 ? `${name} inserted` : `${name} bypassed`, { description: `on ${target.name}` });
    setPanel("synth");
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "samples", label: "SAMPLES", icon: <AudioLines className="size-3.5" /> },
    { id: "plugins", label: "PLUGINS", icon: <Sparkles className="size-3.5" /> },
    { id: "presets", label: "PRESETS", icon: <Music2 className="size-3.5" /> },
  ];

  return (
    <div className="space-y-3">
      {/* search across samples, plugins and presets */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search samples, plugins, presets…"
          aria-label="Search the browser"
          className="h-8 w-full rounded-[3px] border border-border bg-background/70 pl-7 pr-7 font-mono text-[11px] outline-none placeholder:text-muted-foreground/60 focus:border-primary/60"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex gap-1">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "secondary" : "ghost"}
            className="h-7 gap-1 font-mono text-[10px] tracking-widest"
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
          </Button>
        ))}
        <span className="ml-auto self-center label-xs hidden sm:inline">
          {tab === "samples" ? "click a sample to drop it on the timeline" : tab === "plugins" ? "click to insert on the selected instrument" : "click to load on the selected instrument"}
        </span>
      </div>

      {tab === "samples" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_PACKS.map((p) => ({ ...p, samples: p.samples.filter((s) => match(s.name, s.kind, p.pack)) }))
            .filter((p) => p.samples.length > 0)
            .map((p) => (
            <div key={p.pack} className="panel overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-border bg-surface-2/60 px-2 py-1">
                <FolderOpen className="size-3.5 text-primary" />
                <span className="font-display text-[10px] font-semibold tracking-[0.15em]">{p.pack}</span>
              </div>
              {p.samples.map((s) => (
                <button
                  key={s.name}
                  onClick={() => addSampleToTimeline(s.name, p.pack)}
                  className="group flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-primary/10"
                >
                  <span className="w-12 shrink-0 font-mono text-[9px] tracking-wider text-primary">{s.kind}</span>
                  <span className="flex-1 truncate font-mono text-[11px]">{s.name}</span>
                  <Plus className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "plugins" && (
        <div className="space-y-3">
          <div>
            <p className="label-xs mb-1.5">EFFECTS — insert on selected instrument</p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {EFFECT_PLUGINS.filter((e) => match(e.name, e.desc, e.fx)).map((e) => (
                <button
                  key={e.name}
                  onClick={() => insertEffect(e.name, e.fx)}
                  className="panel flex items-center gap-2 px-2 py-1.5 text-left transition-colors hover:border-primary/50"
                >
                  <Waves className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium">{e.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{e.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label-xs mb-1.5">INSTRUMENTS — drag onto the timeline or click to add a channel</p>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {SYNTH_PRESETS.map((p) => (
                <button
                  key={p.name}
                  draggable
                  onDragStart={(e) => {
                    const payload = JSON.stringify({ type: "instrument", name: p.name, preset: p.name });
                    e.dataTransfer.setData("application/synclab", payload);
                    e.dataTransfer.setData("text/plain", payload);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => addTrack("instrument", p.name.toUpperCase(), p.name)}
                  className="panel flex cursor-grab items-center gap-2 px-2 py-1.5 text-left transition-colors hover:border-primary/50 active:cursor-grabbing"
                >
                  <Music2 className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium">{p.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{p.category}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "presets" && (
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {SYNTH_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => loadPresetOnto(p.name)}
              className="panel flex items-center gap-2 px-2 py-1.5 text-left transition-colors hover:border-primary/50"
            >
              <Sparkles className="size-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium">{p.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{p.category}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
