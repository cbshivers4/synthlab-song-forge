import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Disc3, AudioLines, Music2, Piano, Plus, Power, X } from "lucide-react";
import { useStudio } from "@/lib/synclab/store";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
import type { PluginInstance, PluginKind, Track } from "@/lib/synclab/types";
import { Knob } from "./Knob";
import { Button } from "@/components/ui/button";

/** Accent color per effect family, so each module reads differently at a glance. */
const KIND_COLOR: Record<PluginKind, string> = {
  eq: "#7dd3fc",
  paraeq: "#7dd3fc",
  filter: "#4ade80",
  stepfilter: "#4ade80",
  drive: "#fb923c",
  bitcrusher: "#fb923c",
  compressor: "#facc15",
  limiter: "#facc15",
  gate: "#facc15",
  delay: "#c084fc",
  reverb: "#93c5fd",
  chorus: "#f472b6",
  flanger: "#f472b6",
  phaser: "#f472b6",
  tremolo: "#a3e635",
  autopan: "#a3e635",
  width: "#a3e635",
  vocoder: "#2dd4bf",
  gain: "#e2e8f0",
  resonator: "#fb7185",
  scalechord: "#fb7185",
  transient: "#fbbf24",
};

function instrumentModule(track: Track): { label: string; icon: React.ReactNode; panel: "synth" | "drums" | "sampler" | "piano" } {
  if (track.kind === "drum") return { label: "Drum Machine", icon: <Disc3 className="size-3.5" />, panel: "drums" };
  if (track.kind === "sampler") return { label: "Sampler", icon: <AudioLines className="size-3.5" />, panel: "sampler" };
  if (track.kind === "audio" || track.kind === "ai-vocal") return { label: "Audio Track", icon: <AudioLines className="size-3.5" />, panel: "piano" };
  return { label: "Synthesizer", icon: <Music2 className="size-3.5" />, panel: "synth" };
}

function EffectModule({ track, plugin }: { track: Track; plugin: PluginInstance }) {
  const { setPluginParam, togglePluginBypass, removePlugin, setPanel } = useStudio();
  const color = KIND_COLOR[plugin.kind] ?? "#e2e8f0";
  const shown = plugin.params.slice(0, 3);
  return (
    <div
      className={`flex w-[168px] shrink-0 flex-col overflow-hidden rounded-md border bg-surface-2/70 ${plugin.bypass ? "opacity-50" : ""}`}
      style={{ borderColor: `${color}55` }}
    >
      <button
        type="button"
        className="flex items-center gap-1.5 px-2 py-1 text-left"
        style={{ background: `linear-gradient(180deg, ${color}26, transparent)` }}
        onClick={() => setPanel("plugins")}
        title="Open the full effect window"
      >
        <span
          role="button"
          tabIndex={0}
          aria-label={plugin.bypass ? `Turn ${plugin.name} on` : `Turn ${plugin.name} off`}
          className="grid size-5 shrink-0 place-items-center rounded-full border"
          style={{ borderColor: color, color: plugin.bypass ? "#64748b" : color }}
          onClick={(e) => {
            e.stopPropagation();
            togglePluginBypass(track.id, plugin.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              togglePluginBypass(track.id, plugin.id);
            }
          }}
        >
          <Power className="size-3" />
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-semibold tracking-wide" style={{ color }}>
          {plugin.name}
        </span>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Remove ${plugin.name}`}
          className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            removePlugin(track.id, plugin.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              removePlugin(track.id, plugin.id);
            }
          }}
        >
          <X className="size-3" />
        </span>
      </button>
      <div className="flex flex-1 items-start justify-around gap-1 px-1 py-1.5">
        {shown.map((p) => (
          <Knob
            key={p.id}
            label={p.name}
            value={p.value}
            min={p.min}
            max={p.max}
            unit={p.unit ?? ""}
            size={34}
            onChange={(v) => setPluginParam(track.id, plugin.id, p.id, v)}
            midiTarget={{ id: track.id, param: `plugin:${plugin.id}:${p.id}` }}
          />
        ))}
        {shown.length === 0 && <span className="self-center text-[10px] text-muted-foreground">No controls</span>}
      </div>
    </div>
  );
}

export function DeviceBar() {
  const { selected, tracks, select, setPanel, addPlugin, installedPlugins } = useStudio();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("synclab.devicebar.collapsed") === "1";
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ left: number; bottom: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem("synclab.devicebar.collapsed", collapsed ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [pickerOpen]);

  const track = selected ?? tracks[0];
  if (!track) return null;
  const inst = instrumentModule(track);
  const plugins = track.plugins ?? [];
  const addable = [...BUILT_IN_PLUGINS, ...installedPlugins.filter((d) => !BUILT_IN_PLUGINS.some((b) => b.id === d.id))];

  return (
    <section className="shrink-0 border-t-2 border-border bg-surface/80" aria-label="Device chain">
      <div className="flex h-8 items-center gap-2 border-b border-border px-3">
        <Piano className="size-3.5 text-primary" />
        <span className="font-display text-[10px] font-semibold tracking-[0.2em]">DEVICES</span>
        <button
          type="button"
          className="max-w-40 truncate font-mono text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => select(track.id)}
          title="Selected track"
        >
          · {track.name}
        </button>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto size-6"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Show device chain" : "Hide device chain"}
        >
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
      </div>
      {!collapsed && (
        <div className="flex h-[118px] items-stretch gap-2 overflow-x-auto p-2">
          <button
            type="button"
            className="flex w-[150px] shrink-0 flex-col items-start gap-1 rounded-md border border-primary/50 bg-primary/10 px-2 py-1.5 text-left hover:bg-primary/15"
            onClick={() => setPanel(inst.panel)}
            title={`Open the ${inst.label} editor`}
          >
            <span className="flex items-center gap-1.5 text-primary">{inst.icon}</span>
            <span className="font-mono text-[10px] font-semibold tracking-wide text-primary">{inst.label}</span>
            <span className="text-[9px] text-muted-foreground">Tap to open the editor</span>
          </button>
          {plugins.map((p) => (
            <EffectModule key={p.id} track={track} plugin={p} />
          ))}
          <div className="relative shrink-0" ref={pickerRef}>
            <button
              type="button"
              ref={pickerBtnRef}
              className="flex h-full w-[110px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
              onClick={() => {
                const r = pickerBtnRef.current?.getBoundingClientRect();
                if (r) setPickerPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 232)), bottom: window.innerHeight - r.top + 4 });
                setPickerOpen((o) => !o);
              }}
              aria-expanded={pickerOpen}
            >
              <Plus className="size-4" />
              <span className="font-mono text-[10px] tracking-wide">Add effect</span>
            </button>
            {pickerOpen && pickerPos && (
              <div
                className="fixed z-50 max-h-64 w-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-xl"
                style={{ left: pickerPos.left, bottom: pickerPos.bottom }}
              >
                {addable.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => {
                      addPlugin(track.id, d);
                      setPickerOpen(false);
                    }}
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: KIND_COLOR[d.kind] ?? "#e2e8f0" }} />
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    <span className="shrink-0 text-[9px] text-muted-foreground">{d.format}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
