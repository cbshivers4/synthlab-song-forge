import { useState } from "react";
import { ChevronDown, ChevronUp, Cpu, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { PLUGIN_KINDS, makeDef } from "@/lib/synclab/plugins";
import type { PluginDef, PluginInstance, PluginKind } from "@/lib/synclab/types";
import { toast } from "sonner";

const FORMATS: PluginDef["format"][] = ["VST3", "AU", "CLAP", "AAX"];

function ParamRow({
  trackId,
  plugin,
  paramId,
  name,
  value,
  min,
  max,
  unit,
}: {
  trackId: string;
  plugin: PluginInstance;
  paramId: string;
  name: string;
  value: number;
  min: number;
  max: number;
  unit?: string | undefined;
}) {
  const { setPluginParam } = useStudio();
  const step = max - min > 40 ? 1 : (max - min) / 200;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{name}</span>
      <Slider
        className="flex-1"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v = value]) => setPluginParam(trackId, plugin.id, paramId, v)}
      />
      <span className="w-16 shrink-0 text-right font-mono text-[10px] text-primary">
        {value >= 100 ? value.toFixed(0) : value.toFixed(2)}
        {unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

export function PluginRack() {
  const {
    selected,
    tracks,
    installedPlugins,
    installPlugin,
    uninstallPlugin,
    addPlugin,
    removePlugin,
    togglePluginBypass,
    movePlugin,
  } = useStudio();
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [format, setFormat] = useState<PluginDef["format"]>("VST3");
  const [kind, setKind] = useState<PluginKind>("eq");

  const track = selected ?? tracks[0];
  if (!track) return <p className="text-sm text-muted-foreground">Add a track to open its plugin rack.</p>;
  const chain = track.plugins ?? [];

  const scan = () => {
    if (!name.trim()) {
      toast("Name the plugin first", { description: "e.g. Serum, FabFilter Pro-Q 3, Valhalla VintageVerb" });
      return;
    }
    const def = makeDef(name.trim(), vendor.trim() || "3RD PARTY", format, kind);
    installPlugin(def);
    setName("");
    setVendor("");
    toast.success(`${def.name} installed`, { description: `${def.vendor} · ${def.format}` });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Cpu className="size-4 text-primary" />
        <span className="font-display text-[11px] tracking-[0.2em]">INSERTS · {track.name}</span>
        <span className="label-xs ml-auto">{chain.length} plugin{chain.length === 1 ? "" : "s"}</span>
      </div>

      {/* chain */}
      <div className="space-y-1.5">
        {chain.length === 0 && (
          <p className="panel px-3 py-4 text-center text-[11px] text-muted-foreground">
            No plugins on this channel — add one from the rack below.
          </p>
        )}
        {chain.map((p, i) => (
          <div key={p.id} className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-2 py-1">
              <button
                className={`grid size-5 place-items-center rounded-[3px] ${p.bypass ? "text-muted-foreground" : "bg-primary/20 text-primary"}`}
                onClick={() => togglePluginBypass(track.id, p.id)}
                aria-label="Bypass plugin"
              >
                <Power className="size-3" />
              </button>
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === p.id ? null : p.id)}>
                <span className={`block truncate text-[11px] font-medium ${p.bypass ? "text-muted-foreground line-through" : ""}`}>
                  {p.name}
                </span>
                <span className="block truncate font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                  {p.vendor} · {p.format} · {p.kind}
                </span>
              </button>
              <Button size="icon" variant="ghost" className="size-6" onClick={() => movePlugin(track.id, p.id, -1)} disabled={i === 0} aria-label="Move up">
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                onClick={() => movePlugin(track.id, p.id, 1)}
                disabled={i === chain.length - 1}
                aria-label="Move down"
              >
                <ChevronDown className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-6" onClick={() => removePlugin(track.id, p.id)} aria-label="Remove plugin">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            {open === p.id && (
              <div className="space-y-2 p-2">
                {p.params.map((prm) => (
                  <ParamRow
                    key={prm.id}
                    trackId={track.id}
                    plugin={p}
                    paramId={prm.id}
                    name={prm.name}
                    value={prm.value}
                    min={prm.min}
                    max={prm.max}
                    unit={prm.unit}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* installed rack */}
      <div>
        <p className="label-xs mb-1.5">PLUGIN RACK — click to insert on {track.name}</p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {installedPlugins.map((d) => (
            <div
              key={d.id}
              draggable
              onDragStart={(e) => {
                const payload = JSON.stringify({ type: "plugin", defId: d.id });
                e.dataTransfer.setData("application/synclab", payload);
                e.dataTransfer.setData("text/plain", payload);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="panel flex cursor-grab items-center gap-2 px-2 py-1.5 active:cursor-grabbing"
            >
              <button className="min-w-0 flex-1 text-left" onClick={() => addPlugin(track.id, d)}>
                <span className="block truncate text-[11px] font-medium">{d.name}</span>
                <span className="block truncate font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                  {d.vendor} · {d.format}
                </span>
              </button>
              {d.format !== "Built-in" && (
                <Button size="icon" variant="ghost" className="size-6" onClick={() => uninstallPlugin(d.id)} aria-label="Uninstall">
                  <Trash2 className="size-3.5" />
                </Button>
              )}
              <Plus className="size-3.5 shrink-0 text-primary" />
            </div>
          ))}
        </div>
      </div>

      {/* third-party install */}
      <div className="panel space-y-2 p-2">
        <p className="label-xs">ADD 3RD-PARTY PLUGIN</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-8 w-44 text-[11px]" placeholder="Plugin name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="h-8 w-40 text-[11px]" placeholder="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          <Select value={format} onValueChange={(v) => setFormat(v as PluginDef["format"])}>
            <SelectTrigger className="h-8 w-24 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (
                <SelectItem key={f} value={f} className="text-[11px]">
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kind} onValueChange={(v) => setKind(v as PluginKind)}>
            <SelectTrigger className="h-8 w-32 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLUGIN_KINDS.map((k) => (
                <SelectItem key={k} value={k} className="text-[11px] uppercase">
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 gap-1.5 font-mono text-[10px] tracking-widest" onClick={scan}>
            <Plus className="size-3.5" />
            INSTALL
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Browsers cannot host native VST/AU binaries, so a scanned plugin runs through SYNCLAB&apos;s matching DSP engine with
          its own editable parameter set.
        </p>
      </div>
    </div>
  );
}
