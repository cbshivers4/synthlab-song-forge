import { availableEffects, effectBrand, effectForm, groupByCategory } from "@/lib/synclab/effect-catalog";
import { useState } from "react";
import { Power, Settings2, Trash2, Waves } from "lucide-react";
import { Knob } from "../Knob";
import { BypassButton } from "../HardwareBypass";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStudio } from "@/lib/synclab/store";
import type { PluginInstance, Track } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { EffectWorkbench, effectFamily } from "../EffectWorkbench";
import { ProEq } from "../ProEq";
import { VocoderPanel } from "../VocoderPanel";
import { EffectPresetMenu } from "../EffectPresetMenu";
import { FxMenu } from "./BusStrips";
import { ROW, SEND_KEYS } from "./shared";

export function InsertRack({
  title,
  midiId,
  midiPrefix = "plugin",
  list,
  onAdd,
  onRemove,
  onBypass,
  onParam,
  openId,
  onOpenChange,
}: {
  title: string;
  midiId: string;
  midiPrefix?: "plugin" | "fx";
  list: PluginInstance[];
  onAdd: (def: import("@/lib/synclab/types").PluginDef) => void;
  onRemove: (id: string) => void;
  onBypass: (id: string) => void;
  onParam: (id: string, paramId: string, value: number) => void;
  openId?: string | null;
  onOpenChange?: (id: string | null) => void;
}) {
  const { installedPlugins } = useStudio();
  const [ownOpen, setOwnOpen] = useState<string | null>(null);
  const open = openId !== undefined ? openId : ownOpen;
  const setOpen = (id: string | null) => {
    if (onOpenChange) onOpenChange(id);
    else setOwnOpen(id);
  };
  // ProEq/VocoderPanel write through the store by track id; bus/master chains use onParam instead.
  const isTrack = !midiId.includes(":") && midiId !== "master";
  return (
    <div>
      <div className="label-xs mb-1">{title}</div>
      <div className="space-y-1">
        {list.length === 0 && <div className="font-mono text-[9px] text-muted-foreground">No effects</div>}
        {list.map((p) => (
          <div key={p.id} className="insert-row rounded-md border border-border bg-surface-2/50 px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <BypassButton name={p.name} bypassed={p.bypass} onToggle={() => onBypass(p.id)} />
              <button className="flex-1 truncate text-left font-mono text-[11px] uppercase" onClick={() => setOpen(open === p.id ? null : p.id)}>
                {p.name}
                <span className="ml-1 text-muted-foreground">{p.format}</span>
              </button>
              <button aria-label={`Remove ${p.name}`} onClick={() => onRemove(p.id)} title="Remove" className="p-0.5">
                <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
            <Dialog open={open === p.id} onOpenChange={(o) => setOpen(o ? p.id : null)}>
              <DialogContent data-fx-family={effectFamily(p)} data-fx-skin={p.kind} data-fx-form={effectForm(p.kind)} data-bypassed={p.bypass} data-fx-variant={p.name.toLowerCase().includes("echo") ? "echo" : undefined} className="fx-editor max-h-[86vh] w-[min(97vw,58rem)] max-w-none overflow-y-auto">
                <DialogHeader className="fx-editor-header">
                  <DialogTitle className="flex flex-wrap items-center gap-2 font-mono uppercase tracking-wider">
                    <BypassButton name={p.name} bypassed={p.bypass} onToggle={() => onBypass(p.id)} />
                    {p.name} <span className="text-xs text-muted-foreground">{title} · {p.format}</span>
                  </DialogTitle>
                </DialogHeader>
                <EffectPresetMenu plugin={p} onParam={(id, value) => onParam(p.id, id, value)} />
                {p.kind === "paraeq" && isTrack ? (
                  <ProEq trackId={midiId} plugin={p} />
                ) : p.kind === "vocoder" && isTrack ? (
                  <VocoderPanel trackId={midiId} plugin={p} />
                ) : (
                <EffectWorkbench plugin={p} midiId={midiId} midiPrefix={midiPrefix} onBypass={() => onBypass(p.id)} onParam={(id, value) => onParam(p.id, id, value)} />
                )}
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </div>
      {groupByCategory(availableEffects(installedPlugins)).map(([category, defs]) => <div key={category} role="group" aria-label={category}>
      <p className="mt-1.5 font-mono text-[8px] tracking-widest text-muted-foreground">{category.toUpperCase()}</p>
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        {defs.map((d) => (
          <button
            key={d.id}
            onClick={() => onAdd(d)}
            className="truncate rounded-md border border-border bg-surface px-2 py-1.5 text-left font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
            title={`${d.vendor} · ${d.format}`}
          >
            + {effectBrand(d)}
          </button>
        ))}
      </div>
      </div>)}
      <p className="mt-1 font-mono text-[8px] leading-tight text-muted-foreground">
        Add 3rd-party plugins in the PLUGINS panel — they appear here.
      </p>
    </div>
  );
}


/** Per-channel send menu: reverb / delay / chorus amounts plus each return's FX chain. */
export function SendsMenu({ t }: { t: Track }) {
  const { updateTrack } = useStudio();
  const active = SEND_KEYS.filter(([key]) => (t.sends?.[key] ?? 0) > 0).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex h-6 w-full items-center justify-center gap-1 rounded-sm font-mono text-[8px] uppercase tracking-wider transition-colors",
            active > 0 ? "bg-amber-500/20 text-amber-400" : "bg-surface-2 text-muted-foreground hover:text-foreground"
          )}
        >
          <Waves className="size-3" /> Sends{active > 0 ? ` ${active}` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="label-xs">Sends — {t.name}</div>
        {SEND_KEYS.map(([key, label]) => {
          const value = t.sends?.[key] ?? 0;
          return (
            <div key={key} className="space-y-1 rounded-sm border border-border bg-surface-2/40 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <Knob
                  label={label}
                  value={value}
                  size={36}
                  onChange={(v) =>
                    updateTrack(t.id, {
                      sends: { reverb: 0, delay: 0, chorus: 0, ...(t.sends ?? {}), [key]: v },
                    })
                  }
                />
                
              </div>
              <FxMenu target={`send:${key}`} label={`${key} return FX`} />
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/** Compact device chain shown directly on the strip. */
export function DeviceSlots({ t, narrow }: { t: Track; narrow: boolean }) {
  const { addPlugin, removePlugin, togglePluginBypass, setPluginParam } = useStudio();
  const list = t.plugins ?? [];
  const max = narrow ? 2 : 3;
  const [editorOpen, setEditorOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const openEditor = (id: string | null) => {
    setOpenId(id);
    setEditorOpen(true);
  };
  return (
    <div className={cn(ROW.devices, "w-full space-y-0.5 overflow-hidden border-b border-border/60 px-1 py-1")}><div className="mx-inserts-label font-mono text-[8px] text-muted-foreground">Inserts</div>
      {list.slice(0, max).map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-1 rounded-sm px-1 py-[3px]"
          style={{ background: `color-mix(in oklab, ${t.color} 18%, var(--surface-2, transparent))` }}
        >
          <button aria-label={`${p.bypass ? "Enable" : "Bypass"} ${p.name} on ${t.name}`} aria-pressed={p.bypass} onClick={(e) => { e.stopPropagation(); togglePluginBypass(t.id, p.id); }} title="Bypass">
            <Power className="size-2.5" style={{ color: p.bypass ? "var(--muted-foreground)" : t.color }} />
          </button>
          <button
            className="flex-1 truncate text-left font-mono text-[8px] uppercase hover:text-primary"
            title={`Open ${p.name} editor`}
            onClick={(e) => { e.stopPropagation(); openEditor(p.id); }}
          >
            {p.name}
          </button>
          <button
            aria-label={`Remove ${p.name} from ${t.name}`} onClick={(e) => { e.stopPropagation(); removePlugin(t.id, p.id); }}
            title={`Remove ${p.name}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-2.5" />
          </button>
        </div>
      ))}
      {list.length > max && (
        <button
          onClick={(e) => { e.stopPropagation(); openEditor(list[max]?.id ?? null); }}
          className="w-full px-1 text-left font-mono text-[8px] text-muted-foreground hover:text-foreground"
        >
          +{list.length - max} more
        </button>
      )}
      <Popover open={editorOpen} onOpenChange={setEditorOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => { e.stopPropagation(); setOpenId(list[0]?.id ?? null); }}
            className="flex h-5 w-full items-center justify-center gap-1 rounded-sm border border-dashed border-border font-mono text-[8px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-2.5" /> {list.length ? `Edit ${list.length}` : "Add"}
          </button>
        </PopoverTrigger>
        <PopoverContent onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) e.preventDefault(); }} align="start" className="max-h-[70vh] w-[360px] overflow-y-auto p-3" onClick={(e) => e.stopPropagation()}>
          <InsertRack
            title={`${t.name} — inserts`}
            midiId={t.id}
            list={list}
            openId={openId}
            onOpenChange={setOpenId}
            onAdd={(def) => addPlugin(t.id, def)}
            onRemove={(id) => removePlugin(t.id, id)}
            onBypass={(id) => togglePluginBypass(t.id, id)}
            onParam={(id, p, v) => setPluginParam(t.id, id, p, v)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
