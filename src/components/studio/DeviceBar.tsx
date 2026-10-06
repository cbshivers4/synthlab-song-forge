import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Disc3, AudioLines, Music2, Piano, Plus, Power, X } from "lucide-react";
import { useStudio } from "@/lib/synclab/store";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
import type { PluginInstance, Track } from "@/lib/synclab/types";
import { Knob } from "./Knob";
import { Button } from "@/components/ui/button";
import { Scope } from "./Scope";
import { EffectDisplay } from "./EffectDisplay";

function instrumentModule(track: Track): { label: string; icon: React.ReactNode; panel: "synth" | "drums" | "sampler" | "piano"; tone: string } {
  if (track.kind === "drum") return { label: "Drum Machine", icon: <Disc3 className="size-3.5" />, panel: "drums", tone: "drums" };
  if (track.kind === "sampler") return { label: "Sampler", icon: <AudioLines className="size-3.5" />, panel: "sampler", tone: "sampler" };
  if (track.kind === "audio" || track.kind === "ai-vocal") return { label: "Audio Track", icon: <AudioLines className="size-3.5" />, panel: "piano", tone: "audio" };
  return { label: "Synthesizer", icon: <Music2 className="size-3.5" />, panel: "synth", tone: "synth" };
}

function EffectModule({ track, plugin }: { track: Track; plugin: PluginInstance }) {
  const { setPluginParam, togglePluginBypass, removePlugin, setPanel } = useStudio();
  const shown = plugin.params.slice(0, 8);
  return (
    <div
      data-device-kind={plugin.kind}
      className={`device-module flex w-[300px] shrink-0 flex-col overflow-hidden rounded-md border ${plugin.bypass ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        className="device-module-header flex items-center gap-1.5 px-2 py-1 text-left"
        onClick={() => setPanel("plugins")}
        title="Open the full effect window"
      >
        <span
          role="button"
          tabIndex={0}
          aria-label={plugin.bypass ? `Turn ${plugin.name} on` : `Turn ${plugin.name} off`}
          className="device-module-power grid size-5 shrink-0 place-items-center rounded-full border"
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
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-semibold tracking-wide text-foreground">
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
      <div className="px-1 pt-1">
        <EffectDisplay plugin={plugin} height={64} onParam={(paramId, v) => setPluginParam(track.id, plugin.id, paramId, v)} />
      </div>
      <div className="flex flex-1 flex-wrap items-start justify-around gap-x-1 gap-y-0.5 px-1 py-1">
        {shown.map((p) => (
          <Knob
            key={p.id}
            label={p.name}
            value={p.value}
            min={p.min}
            max={p.max}
            unit={p.unit ?? ""}
            size={28}
            onChange={(v) => setPluginParam(track.id, plugin.id, p.id, v)}
            midiTarget={{ id: track.id, param: `plugin:${plugin.id}:${p.id}` }}
          />
        ))}
        {shown.length === 0 && <span className="self-center text-[10px] text-muted-foreground">No controls</span>}
      </div>
      <div className="px-1 pb-1"><Scope scopeId={plugin.id} height={22} compact /></div>
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
        <div className="flex h-[236px] items-stretch gap-2 overflow-x-auto p-2">
          <div
            data-device-kind={inst.tone}
            className="device-module flex w-[150px] shrink-0 flex-col rounded-md border px-2 py-1.5"
          >
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-1.5 px-0 py-0 text-left hover:bg-transparent"
            onClick={() => setPanel(inst.panel)}
            title={`Open the ${inst.label} editor`}
          >
            <span className="flex items-center gap-1.5 text-[color:var(--device-accent)]">{inst.icon}</span>
            <span className="font-mono text-[10px] font-semibold tracking-wide text-foreground">{inst.label}</span>
          </Button>
          <div className="mt-auto"><Scope scopeId={`ch:${track.id}`} height={150} compact /></div>
          </div>
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
                <div className="px-2 py-1 font-mono text-[9px] tracking-widest text-muted-foreground">BUILT-IN EFFECTS</div>
                {[...addable].sort((a, b) => (a.name === "Stereo Delay" ? -1 : b.name === "Stereo Delay" ? 1 : 0)).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    data-device-kind={d.kind}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => {
                      addPlugin(track.id, d);
                      setPickerOpen(false);
                    }}
                  >
                    <span className="size-2 shrink-0 rounded-full bg-[color:var(--device-accent)]" />
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
