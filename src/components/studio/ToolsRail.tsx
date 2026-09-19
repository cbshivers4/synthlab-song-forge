import {
  AudioLines,
  AudioWaveform,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Disc3,
  Gauge,
  Grid2x2,
  Music2,
  NotebookPen,
  Puzzle,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Split,
  Volume2,
  Waves,
} from "lucide-react";
import { useState } from "react";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import type { TrackKind } from "@/lib/synclab/types";
import { defsFromFiles } from "@/lib/synclab/plugins";
import { toast } from "sonner";

interface Tool {
  id: string;
  label: string;
  icon: React.ReactNode;
  panel?: PanelId;
  soon?: string;
  /** Dragging this tool onto the timeline creates a channel of this kind. */
  drag?: { kind: TrackKind; name: string; preset?: string };
}

const TOOLS: Tool[] = [
  { id: "vocal", label: "Vocal Forge", icon: <Sparkles className="size-4" />, panel: "vocal", drag: { kind: "ai-vocal", name: "Vocal Forge" } },
  { id: "stems", label: "Stem Separator", icon: <Split className="size-4" />, panel: "stems" },
  { id: "voice", label: "Voice Remover", icon: <Volume2 className="size-4" />, panel: "voice" },
  { id: "coproducer", label: "AI Co-Producer", icon: <Bot className="size-4" />, panel: "coproducer" },
  { id: "hum", label: "Hum to Beat", icon: <Waves className="size-4" />, panel: "hum" },
  { id: "synth", label: "Synthesizers", icon: <Music2 className="size-4" />, panel: "synth", drag: { kind: "instrument", name: "Synth" } },
  { id: "bass", label: "Bass Generator", icon: <AudioWaveform className="size-4" />, panel: "bass" },
  { id: "drums", label: "Drum Machine", icon: <Disc3 className="size-4" />, panel: "drums", drag: { kind: "drum", name: "Drums" } },
  { id: "beat", label: "Pad Sampler", icon: <Grid2x2 className="size-4" />, panel: "pads", drag: { kind: "sampler", name: "Pad Sampler" } },
  { id: "chop", label: "Sample Chopper", icon: <Scissors className="size-4" />, panel: "pads" },
  { id: "sampler", label: "Sampler", icon: <AudioLines className="size-4" />, panel: "sampler", drag: { kind: "sampler", name: "Sampler" } },
  { id: "plugins", label: "Plugins (VST)", icon: <Cpu className="size-4" />, panel: "plugins" },
  { id: "mixer", label: "Mixer", icon: <SlidersHorizontal className="size-4" />, panel: "mixer" },
  { id: "stemgen", label: "AI Stem Generator", icon: <Sparkles className="size-4" />, panel: "stemgen" },
  { id: "notes", label: "Track Notes", icon: <NotebookPen className="size-4" />, panel: "notes" },
  { id: "master", label: "Mastering", icon: <Gauge className="size-4" />, panel: "mastering" },
];

const tool = (id: string): Tool => TOOLS.find((t) => t.id === id)!;

interface Section {
  id: string;
  label: string;
  tools: Tool[];
}

const SECTIONS: Section[] = [
  { id: "ai", label: "AI Studio", tools: ["vocal", "stems", "voice", "coproducer", "hum", "stemgen"].map(tool) },
  { id: "instruments", label: "Instruments", tools: ["synth", "bass", "drums", "beat", "chop", "sampler"].map(tool) },
  { id: "mix", label: "Mix & Master", tools: ["mixer", "master", "notes"].map(tool) },
  { id: "plugins", label: "Plugins", tools: ["plugins"].map(tool) },
];

export function ToolsRail() {
  const { panel, setPanel, installedPlugins, installPlugin } = useStudio();
  const [open, setOpen] = useState(true);
  const [pluginDrop, setPluginDrop] = useState(false);
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) =>
    setClosedSections((s) => ({ ...s, [id]: !s[id] }));

  /** Plugin files dropped straight onto the Plugins entry in this rail. */
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
            ? "Plugins — drop your VST3 / AU / CLAP files here"
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
        onClick={() => (t.panel ? setPanel(t.panel) : toast(t.label, { description: t.soon }))}
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
      className={`hidden shrink-0 flex-col border-r border-border bg-sidebar transition-[width] sm:flex ${open ? "w-52" : "w-11"}`}
    >
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
          {TOOLS.map((t) => renderToolButton(t, true))}
        </nav>
      )}

      {/* Expanded rail — grouped, collapsible sections */}
      {open && (
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
          {SECTIONS.map((s) => {
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

                    {/* My Plugins lives inside the Plugins section */}
                    {s.id === "plugins" && (
                      <div className="pt-1.5">
                        <div className="px-2 pb-1 font-mono text-[9px] tracking-[0.18em] text-muted-foreground/70">
                          MY PLUGINS — DRAG ONTO A TRACK
                        </div>
                        {installedPlugins.length === 0 ? (
                          <p className="px-2 text-[10px] leading-snug text-muted-foreground/80">
                            None yet — drop your VST3 / AU / CLAP files on "Plugins (VST)" above or open it to scan a folder.
                          </p>
                        ) : (
                          installedPlugins.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              title={`${d.name} — drag onto a timeline track to insert it`}
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
                              <span className="min-w-0 flex-1 truncate font-medium tracking-wide">{d.name}</span>
                              <span className="shrink-0 font-mono text-[8px] text-muted-foreground/70">{d.format}</span>
                            </button>
                          ))
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
    </aside>
  );
}
