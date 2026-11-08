import { levelColor, peakOf, spectrumColor, dbColor, LEVEL_GREEN, LEVEL_ORANGE, LEVEL_RED } from "@/lib/synclab/level-colors";
import { availableEffects, effectBrand, groupByCategory } from "@/lib/synclab/effect-catalog";
import {
  AudioLines,
  AppWindow,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Disc3,
  FileSearch,
  Gauge,
  Grid2x2,
  Hand,
  Music2,
  NotebookPen,
  Puzzle,
  Radio,
  Scissors,
  SlidersHorizontal,
  Waves,
  Square,
} from "lucide-react";
import { Drum, Film, Guitar, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getLocalFile, getPreviewAnalyser, onPreviewChange, stopPreview } from "@/lib/synclab/local-files";
import { ComputerFiles } from "./ComputerFiles";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import type { TrackKind } from "@/lib/synclab/types";
import { defsFromFiles } from "@/lib/synclab/plugins";
import { toast } from "sonner";

interface Tool {
  id: string;
  label: string;
  icon: React.ReactNode;
  panel?: PanelId;
  soon?: string;
  /** Hidden in Simple mode — settings are kept, just out of the way. */
  advanced?: boolean;
  /** Dragging this tool onto the timeline creates a channel of this kind. */
  drag?: { kind: TrackKind; name: string; preset?: string };
}


const TOOLS: Tool[] = [
  { id: "studio-view", label: "Studio View", icon: <AppWindow className="size-4" />, panel: "studio-view" },
  { id: "reel-recorder", label: "Reel-to-Reel Recorder", icon: <Disc3 className="size-4" />, panel: "reel-recorder" },
  { id: "video-sampler", label: "Video Sampler", icon: <Film className="size-4" />, panel: "video-sampler" },
  { id: "audio-converter", label: "Audio Converter", icon: <AudioLines className="size-4" />, panel: "audio-converter" },
  { id: "synth", label: "Spec 4 Synth", icon: <Music2 className="size-4" />, panel: "synth", drag: { kind: "instrument", name: "Spec 4 Synth", preset: "Cybotron Lead" } },
  { id: "touch", label: "Touch Synth", icon: <Hand className="size-4" />, panel: "synth", drag: { kind: "instrument", name: "Touch Synth", preset: "Cybotron Lead" } },
  { id: "acid", label: "Acid Bass (TD-3)", icon: <Waves className="size-4" />, panel: "synth", drag: { kind: "instrument", name: "Acid Bass", preset: "TD-3 Acid Saw" } },
  { id: "modular", label: "Modular Tech Synth", icon: <Cpu className="size-4" />, panel: "synth", drag: { kind: "instrument", name: "Modular Tech", preset: "Modular Tech Empty Rack" } },
  { id: "granular", label: "Granular Synth", icon: <Sparkles className="size-4" />, panel: "synth", drag: { kind: "instrument", name: "Granular Synth", preset: "Granular Glass Cloud" } },
  { id: "poly", label: "Poly Synth", icon: <Music2 className="size-4" />, panel: "synth", drag: { kind: "instrument", name: "Poly Synth", preset: "Poly Synth Brass" } },
  { id: "drums", label: "Drum Machine", icon: <Disc3 className="size-4" />, panel: "drums", drag: { kind: "drum", name: "Drums" } },
  { id: "beat", label: "Pad Sampler", icon: <Grid2x2 className="size-4" />, panel: "pads", drag: { kind: "sampler", name: "Pad Sampler" } },
  { id: "chop", label: "Sample Chopper", icon: <Scissors className="size-4" />, panel: "pads", advanced: true },
  { id: "sampler", label: "Sampler", icon: <AudioLines className="size-4" />, panel: "sampler", drag: { kind: "sampler", name: "Sampler" } },
  { id: "plugins", label: "FX Rack", icon: <Cpu className="size-4" />, panel: "plugins" },
  { id: "mixer", label: "Mixer", icon: <SlidersHorizontal className="size-4" />, panel: "mixer" },
  { id: "notes", label: "Track Notes", icon: <NotebookPen className="size-4" />, panel: "notes", advanced: true },
  { id: "master", label: "Mastering", icon: <Gauge className="size-4" />, panel: "mastering" },
  { id: "live", label: "Live View", icon: <Radio className="size-4" />, panel: "live" },
  { id: "looper", label: "Live Looper", icon: <Disc3 className="size-4" />, panel: "looper" },
  { id: "humbeat", label: "Hum to Beat", icon: <AudioLines className="size-4" />, panel: "humbeat" },
  { id: "stems", label: "Separate Stems", icon: <Scissors className="size-4" />, panel: "stems" },
  { id: "coproducer", label: "AI Co-Producer", icon: <Waves className="size-4" />, panel: "coproducer" },
  { id: "voice", label: "Convert Voice", icon: <Waves className="size-4" />, panel: "voice" },
  { id: "genstem", label: "Generate Stem", icon: <Music2 className="size-4" />, panel: "genstem" },
  { id: "bassgen", label: "Bass Generator", icon: <Music2 className="size-4" />, panel: "bassgen" },
  { id: "drummer", label: "Live Drummer", icon: <Drum className="size-4" />, panel: "drummer" },
  { id: "dj", label: "DJ Decks", icon: <Disc3 className="size-4" />, panel: "dj" },
  { id: "amprig", label: "Amps & Pedals", icon: <Guitar className="size-4" />, panel: "amprig" },
  { id: "apps", label: "Other Apps", icon: <AppWindow className="size-4" />, panel: "apps" },
  { id: "reference", label: "Reference Analyzer", icon: <FileSearch className="size-4" />, panel: "reference" },

];

const tool = (id: string): Tool => TOOLS.find((t) => t.id === id)!;

interface Section {
  id: string;
  label: string;
  tools: Tool[];
}

const SECTIONS: Section[] = [
  { id: "files", label: "Files", tools: ["audio-converter"].map(tool) },
  { id: "perform", label: "Perform", tools: ["studio-view", "reel-recorder", "video-sampler", "live", "looper", "dj", "humbeat"].map(tool) },
  { id: "synths", label: "Synthesizers", tools: ["synth", "touch", "acid", "poly", "modular", "granular"].map(tool) },
  { id: "instruments", label: "Instruments", tools: ["coproducer", "genstem", "bassgen", "drummer", "drums", "beat", "chop", "sampler"].map(tool) },
  { id: "mix", label: "Mix & Master", tools: ["mixer", "master", "stems", "voice"].map(tool) },
  { id: "amps", label: "Amps & Pedals", tools: ["amprig"].map(tool) },
  { id: "plugins", label: "FX Rack", tools: ["plugins"].map(tool) },
  // Everything that reaches outside the song itself lives under Other Apps.
  { id: "apps", label: "Other Apps", tools: ["apps", "reference", "notes"].map(tool) },
];

/** Pinned to the bottom of the left menu while a file previews: stop button, name, live waveform scope. */
function PreviewScope({ playingFile }: { playingFile: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const file = getLocalFile(playingFile);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const data = new Float32Array(2048);
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 50) return; // 20 fps, off the audio path
      last = t;
      const canvas = canvasRef.current;
      const an = getPreviewAnalyser();
      if (!canvas || !an) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = (canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1));
      const h = (canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1));
      an.getFloatTimeDomainData(data);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = levelColor(peakOf(data));
      ctx.lineWidth = Math.max(1, h / 24);
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = h / 2 - data[i]! * (h / 2) * 0.9;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border bg-surface-1/95 p-2">
      <button
        type="button"
        aria-label={`Stop playing ${file?.name ?? "file"}`}
        onClick={() => stopPreview()}
        className="grid size-7 shrink-0 place-items-center rounded-[3px] border border-border text-primary hover:border-primary"
      >
        <Square className="size-3 fill-current" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[10px] text-primary">{file?.name ?? "Preview"}</p>
        <canvas ref={canvasRef} className="h-8 w-full text-primary" aria-label="Waveform scope of the playing file" />
      </div>
    </div>
  );
}


export function ToolsRail() {
  const { panel, setPanel, installedPlugins, installPlugin, tracks, select, addTrack } = useStudio();
  const { mode, setMode } = useApp();
  const advanced = mode === "advanced";
  const [open, setOpen] = useState(true);
  const [pluginDrop, setPluginDrop] = useState(false);
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({ plugins: true, apps: true });
  // Collapsed rail and folded sections are remembered on this device.
  const railLoaded = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("synclab.rail") || "null") as { open?: boolean; closed?: Record<string, boolean> } | null;
      if (saved?.open === false) setOpen(false);
      if (saved?.closed) setClosedSections(saved.closed);
    } catch { /* storage unavailable */ }
    railLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!railLoaded.current) return;
    try { localStorage.setItem("synclab.rail", JSON.stringify({ open, closed: closedSections })); } catch { /* storage unavailable */ }
  }, [open, closedSections]);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [railW, setRailW] = useState(() => {
    if (typeof localStorage === "undefined") return 208;
    const v = Number(localStorage.getItem("synclab-tools-width"));
    return v >= 168 && v <= 420 ? v : 208;
  });
  useEffect(() => {
    try { localStorage.setItem("synclab-tools-width", String(railW)); } catch { /* private mode */ }
  }, [railW]);
  const startRailResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = railW;
    const move = (ev: PointerEvent) => setRailW(Math.min(420, Math.max(168, startW + ev.clientX - startX)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  useEffect(() => onPreviewChange(setPlayingFile), []);

  const visible = (t: Tool) => advanced || !t.advanced;
  const sections = SECTIONS.map((s) => ({ ...s, tools: s.tools.filter(visible) })).filter((s) => s.tools.length > 0);

  const toggleSection = (id: string) =>
    setClosedSections((s) => ({ ...s, [id]: !s[id] }));


  /** Plugin files dropped straight onto the FX Rack entry in this rail. */
  const dropPlugins = (files: File[]) => {
    const defs = defsFromFiles(files, installedPlugins.map((d) => d.name));
    setPanel("plugins");
    if (defs.length === 0) {
      toast("No plugins in that drop", { description: "Drop .vst3, .component, .clap or .aaxplugin files or folders." });
      return;
    }
    defs.forEach(installPlugin);
    toast.success(`${defs.length} plugin${defs.length === 1 ? "" : "s"} added`, {
      description: "They are in the rack, running through SYNCLAB's matching processor.",
    });
  };

  const rowBase =
    "group flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-left text-xs transition-colors";

  const renderToolButton = (t: Tool, collapsedRail: boolean) => {
    const active = !!t.panel && panel === t.panel;
    return (
      <button
        key={t.id}
        title={
          t.id === "plugins"
            ? "FX Rack — drop your VST3 / AU / CLAP files here"
            : t.drag
              ? `${t.label} — drag onto the timeline to add a channel`
              : t.label
        }
        onDragOver={
          t.id === "plugins"
            ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setPluginDrop(true);
              }
            : undefined
        }
        onDragLeave={t.id === "plugins" ? () => setPluginDrop(false) : undefined}
        onDrop={
          t.id === "plugins"
            ? (e) => {
                e.preventDefault();
                setPluginDrop(false);
                dropPlugins(Array.from(e.dataTransfer.files));
              }
            : undefined
        }
        draggable={!!t.drag}
        onDragStart={(e) => {
          if (!t.drag) return;
          const payload = JSON.stringify({ type: "tool", ...t.drag });
          e.dataTransfer.setData("application/synclab", payload);
          e.dataTransfer.setData("text/plain", payload);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => {
          if (t.id === "touch") {
            const found = tracks.find((track) => /^touch synth$/i.test(track.name) && track.patch && !track.patch.modular);
            if (found) select(found.id);
            else addTrack("instrument", "TOUCH SYNTH", "Cybotron Lead");
          }
          if ((t.id === "acid" || t.id === "poly" || t.id === "synth" || t.id === "modular" || t.id === "granular") && t.drag) {
            const prefix = t.id === "acid" ? "TD-3" : t.id === "poly" ? "Poly Synth" : t.id === "modular" ? "Modular Tech" : null;
            const found = tracks.find((x) => x.kind === "instrument" && (t.id === "granular" ? Boolean(x.patch?.granular) : prefix ? x.patch?.name.startsWith(prefix) && !x.patch?.granular : !x.patch?.name.startsWith("TD-3") && !x.patch?.name.startsWith("Poly Synth") && !x.patch?.modular && !x.patch?.granular));
            if (found) select(found.id);
            else if (prefix || t.id === "granular") addTrack("instrument", t.drag.name.toUpperCase(), t.drag.preset);
          }
          if (t.panel) setPanel(t.panel);
          else toast(t.label, { description: t.soon });
        }}
        className={`${rowBase} relative ${
          t.drag ? "cursor-grab active:cursor-grabbing" : ""
        } ${t.id === "plugins" && pluginDrop ? "bg-primary/15 ring-1 ring-primary" : ""} ${
          active
            ? "bg-surface-2 text-primary before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full before:bg-primary"
            : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        <span className={`shrink-0 ${active ? "text-primary" : "group-hover:text-foreground"}`}>{t.icon}</span>
        {!collapsedRail && (
          <span className="min-w-0 flex-1 truncate font-medium tracking-wide">{t.label}</span>
        )}
        {!collapsedRail && t.drag && (
          <span className="hidden shrink-0 text-[8px] font-mono uppercase tracking-widest text-muted-foreground/50 group-hover:block">
            drag
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className={`arrangement-tools relative hidden shrink-0 flex-col border-r border-border bg-sidebar transition-[width] sm:flex ${open ? "" : "w-11"}`}
      style={open ? { width: railW } : undefined}
    >
      {open && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left menu"
          title="Drag to resize"
          onPointerDown={startRailResize}
          className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize hover:bg-primary/20"
        />
      )}
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        {open && <span className="label-xs">SYNCLAB TOOLS</span>}
        <button
          aria-label={open ? "Collapse tools" : "Expand tools"}
          onClick={() => setOpen((o) => !o)}
          className="ml-auto rounded-[3px] p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          {open ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      </div>

      {/* Collapsed rail — icons only */}
      {!open && (
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1">
          {TOOLS.filter(visible).map((t) => renderToolButton(t, true))}
        </nav>
      )}

      {/* Expanded rail — grouped, collapsible sections */}
      {open && (
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
          {sections.map((s) => {

            const closed = !!closedSections[s.id];
            const sectionActive = s.tools.some((t) => t.panel && panel === t.panel);
            return (
              <div key={s.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(s.id)}
                  className={`flex w-full items-center gap-1.5 rounded-[3px] px-1.5 py-1 text-left transition-colors hover:bg-surface-2 ${
                    sectionActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <ChevronDown
                    className={`size-3 shrink-0 text-muted-foreground/70 transition-transform duration-200 ${
                      closed ? "-rotate-90" : ""
                    }`}
                  />
                  <span className="flex-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em]">
                    {s.label}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground/50">{s.tools.length}</span>
                </button>
                {!closed && (
                  <div className="space-y-0.5 pb-0.5 pl-1.5">
                    {s.tools.map((t) => renderToolButton(t, false))}

                    {/* My Computer — Studio One-style browser: breadcrumb, folder tree, search, drag to timeline */}
                    {s.id === "files" && (
                      <ComputerFiles />
                    )}

                    {/* My Plugins lives inside the FX Rack section */}
                    {s.id === "plugins" && (
                      <div className="pt-1.5">
                        <div className="px-2 pb-1 font-mono text-[9px] tracking-[0.18em] text-muted-foreground/70">
                          EFFECTS — DRAG ONTO A TIMELINE TRACK
                        </div>
                        {availableEffects(installedPlugins).length === 0 ? (
                          <p className="px-2 text-[10px] leading-snug text-muted-foreground/80">
                            None yet — drop your VST3 / AU / CLAP files on "FX Rack" above or open it to scan a folder.
                          </p>
                        ) : (
                          groupByCategory(availableEffects(installedPlugins)).map(([category, defs]) => <div key={category} role="group" aria-label={category}>
                          <div className="px-2 pt-1.5 font-mono text-[8px] tracking-[0.16em] text-muted-foreground/70">{category.toUpperCase()}</div>
                          {defs.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              title={`${effectBrand(d)} (${d.name}) — drag onto a timeline track to insert it`}
                              draggable
                              onDragStart={(e) => {
                                const payload = JSON.stringify({ type: "plugin", defId: d.id });
                                e.dataTransfer.setData("application/synclab", payload);
                                e.dataTransfer.setData("text/plain", payload);
                                e.dataTransfer.effectAllowed = "copy";
                              }}
                              onClick={() => setPanel("plugins")}
                              className="flex w-full cursor-grab items-center gap-2 rounded-[3px] px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground active:cursor-grabbing"
                            >
                              <Puzzle className="size-3.5 shrink-0 text-primary/80" />
                              <span className="min-w-0 flex-1 truncate font-medium tracking-wide">{effectBrand(d)}</span>
                              <span className="shrink-0 font-mono text-[8px] text-muted-foreground/70">{d.format === "Built-in" ? "" : d.format}</span>
                            </button>
                          ))}
                          </div>)
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      )}

      {/* File preview player with live scope — pinned above the mode toggle while a file plays */}
      {open && playingFile && <PreviewScope playingFile={playingFile} />}

      <div className="border-t border-border p-1.5">
        <button
          type="button"
          onClick={() => setMode(advanced ? "simple" : "advanced")}
          title={
            advanced
              ? "Advanced mode — every tool, send and scope is shown. Click for Simple."
              : "Simple mode — deep routing, scopes and plugin tools are tucked away. Nothing is lost; your settings stay."
          }
          className="flex w-full items-center justify-center gap-1 rounded-[3px] bg-surface-2 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          {open ? (advanced ? "ADVANCED MODE" : "SIMPLE MODE") : advanced ? "ADV" : "SIM"}
        </button>
      </div>
    </aside>
  );

}
