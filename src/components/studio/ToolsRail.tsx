import {
  AudioLines,
  Bot,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Disc3,
  Gauge,
  Grid2x2,
  Music2,
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
  { id: "stems", label: "Stem Separator", icon: <Split className="size-4" />, soon: "Stem separation needs its AI backend — it arrives in the AI stage." },
  { id: "voice", label: "Voice Remover", icon: <Volume2 className="size-4" />, soon: "Voice removal needs its AI backend — it arrives in the AI stage." },
  { id: "coproducer", label: "AI Co-Producer", icon: <Bot className="size-4" />, soon: "The Co-Producer needs its AI backend — it arrives in the AI stage." },
  { id: "hum", label: "Hum to Beat", icon: <Waves className="size-4" />, soon: "Hum-to-Beat needs rhythm analysis — it arrives in the AI stage." },
  { id: "synth", label: "Synthesizers", icon: <Music2 className="size-4" />, panel: "synth", drag: { kind: "instrument", name: "Synth" } },
  { id: "drums", label: "Drum Machine", icon: <Disc3 className="size-4" />, panel: "drums", drag: { kind: "drum", name: "Drums" } },
  { id: "beat", label: "Pad Sampler", icon: <Grid2x2 className="size-4" />, panel: "pads", drag: { kind: "sampler", name: "Pad Sampler" } },
  { id: "chop", label: "Sample Chopper", icon: <Scissors className="size-4" />, panel: "pads" },
  { id: "sampler", label: "Sampler", icon: <AudioLines className="size-4" />, panel: "sampler", drag: { kind: "sampler", name: "Sampler" } },
  { id: "plugins", label: "Plugins (VST)", icon: <Cpu className="size-4" />, panel: "plugins" },
  { id: "mixer", label: "Mixer", icon: <SlidersHorizontal className="size-4" />, panel: "mixer" },
  { id: "master", label: "Mastering", icon: <Gauge className="size-4" />, soon: "Mastering and scopes are built in the mix stage." },
];

export function ToolsRail() {
  const { panel, setPanel, installedPlugins, installPlugin } = useStudio();
  const [open, setOpen] = useState(true);
  const [pluginDrop, setPluginDrop] = useState(false);

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

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-border bg-sidebar transition-[width] ${open ? "w-48" : "w-11"}`}
    >
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        {open && <span className="label-xs">SYNCLAB TOOLS — DRAG TO TIMELINE</span>}
        <button
          aria-label={open ? "Collapse tools" : "Expand tools"}
          onClick={() => setOpen((o) => !o)}
          className="ml-auto rounded-[3px] p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          {open ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1">
        {TOOLS.map((t) => {
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
              className={`flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-left text-xs transition-colors ${
                t.drag ? "cursor-grab active:cursor-grabbing" : ""
              } ${t.id === "plugins" && pluginDrop ? "bg-primary/15 ring-1 ring-primary" : ""} ${
                active ? "bg-surface-2 text-primary" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <span className={active ? "text-primary" : ""}>{t.icon}</span>
              {open && <span className="truncate font-medium tracking-wide">{t.label}</span>}
            </button>
          );
        })}

        {open && (
          <div className="pt-2">
            <div className="px-2 pb-1 font-mono text-[9px] tracking-[0.18em] text-muted-foreground">
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
                  <span className="truncate font-medium tracking-wide">{d.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-[8px] text-muted-foreground/70">{d.format}</span>
                </button>
              ))
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
