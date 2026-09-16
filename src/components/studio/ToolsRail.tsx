import {
  AudioLines,
  Bot,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Gauge,
  Grid2x2,
  Music2,
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
  { id: "beat", label: "Beat Maker", icon: <Grid2x2 className="size-4" />, soon: "The pad-based Beat Maker is built in the instruments stage." },
  { id: "chop", label: "Sample Chopper", icon: <Scissors className="size-4" />, soon: "Slicing onto pads is built in the instruments stage." },
  { id: "sampler", label: "Sampler", icon: <AudioLines className="size-4" />, panel: "browser", drag: { kind: "sampler", name: "Sampler" } },
  { id: "mixer", label: "Mixer", icon: <SlidersHorizontal className="size-4" />, panel: "mixer" },
  { id: "master", label: "Mastering", icon: <Gauge className="size-4" />, soon: "Mastering and scopes are built in the mix stage." },
];

export function ToolsRail() {
  const { panel, setPanel } = useStudio();
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-border bg-sidebar transition-[width] ${open ? "w-48" : "w-11"}`}
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
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1">
        {TOOLS.map((t) => {
          const active = !!t.panel && panel === t.panel;
          return (
            <button
              key={t.id}
              title={t.label}
              onClick={() => (t.panel ? setPanel(t.panel) : toast(t.label, { description: t.soon }))}
              className={`flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-left text-xs transition-colors ${
                active ? "bg-surface-2 text-primary" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <span className={active ? "text-primary" : ""}>{t.icon}</span>
              {open && <span className="truncate font-medium tracking-wide">{t.label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
