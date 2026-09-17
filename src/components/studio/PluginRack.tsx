import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Cpu, FolderSearch, Plus, Power, Trash2 } from "lucide-react";
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
import { ProEq } from "./ProEq";
import { toast } from "sonner";

const FORMATS: PluginDef["format"][] = ["VST3", "AU", "CLAP", "AAX"];

const PLUGIN_EXT: Record<string, PluginDef["format"]> = {
  vst3: "VST3",
  vst: "VST3",
  dll: "VST3",
  component: "AU",
  clap: "CLAP",
  aaxplugin: "AAX",
};

/** Guess a DSP category from the plugin's file name so the scanned entry gets sensible controls. */
function guessKind(fileName: string): PluginKind {
  const n = fileName.toLowerCase();
  const map: [RegExp, PluginKind][] = [
    [/\b(pro-?q|parametric|eq8|linear ?phase)\b/, "paraeq"],
    [/\b(eq|equal|channel ?strip)\b/, "eq"],
    [/\b(comp|1176|la-?2a|glue|bus ?comp)\b/, "compressor"],
    [/\b(limit|maxim|l1|l2)\b/, "limiter"],
    [/\b(gate|expander)\b/, "gate"],
    [/\b(delay|echo)\b/, "delay"],
    [/\b(verb|reverb|hall|plate|room)\b/, "reverb"],
    [/\b(chorus)\b/, "chorus"],
    [/\b(flang)\b/, "flanger"],
    [/\b(phas)\b/, "phaser"],
    [/\b(trem)\b/, "tremolo"],
    [/\b(pan)\b/, "autopan"],
    [/\b(filter|ladder|moog)\b/, "filter"],
    [/\b(sat|drive|tube|tape|dist|crunch)\b/, "drive"],
    [/\b(width|stereo|imager)\b/, "width"],
    [/\b(crush|lofi|bit)\b/, "bitcrusher"],
  ];
  for (const [re, k] of map) if (re.test(n)) return k;
  return "eq";
}

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
  const folderRef = useRef<HTMLInputElement>(null);

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

  const scanFolder = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const seen = new Set(installedPlugins.map((d) => d.name.toLowerCase()));
    let added = 0;
    for (const f of Array.from(files)) {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      const parts = rel.split("/");
      // A .vst3 / .component bundle is a folder — take the first path segment that carries a known extension.
      const bundle = parts.find((seg) => {
        const ext = seg.split(".").pop()?.toLowerCase();
        return !!ext && ext in PLUGIN_EXT;
      });
      if (!bundle) continue;
      const ext = bundle.split(".").pop()?.toLowerCase() ?? "";
      const pluginName = bundle.replace(/\.[^.]+$/, "");
      if (!pluginName || seen.has(pluginName.toLowerCase())) continue;
      seen.add(pluginName.toLowerCase());
      const vendorGuess = parts.length > 1 && parts[0] !== bundle ? (parts[0] as string) : "3RD PARTY";
      installPlugin(makeDef(pluginName, vendorGuess.toUpperCase(), PLUGIN_EXT[ext] ?? "VST3", guessKind(pluginName)));
      added++;
    }
    if (added === 0) {
      toast("No plugins found in that folder", {
        description: "Pick your VST3 / Components folder, e.g. /Library/Audio/Plug-Ins/VST3 or C:\\Program Files\\Common Files\\VST3.",
      });
    } else {
      toast.success(`${added} plugin${added === 1 ? "" : "s"} found`, {
        description: "Names and formats were read from your folder. They run through SYNCLAB's matching DSP, not the original binaries.",
      });
    }
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
                {p.kind === "paraeq" && <ProEq trackId={track.id} plugin={p} />}
                {p.kind !== "paraeq" && p.params.map((prm) => (
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

      {/* scan a plugin folder from the computer */}
      <div className="panel space-y-2 p-2">
        <p className="label-xs">SCAN PLUGIN FOLDER ON THIS COMPUTER</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={folderRef}
            type="file"
            multiple
            className="hidden"
            // @ts-expect-error non-standard directory picker attributes
            webkitdirectory=""
            directory=""
            onChange={(e) => {
              scanFolder(e.target.files);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="secondary" className="h-8 gap-1.5 font-mono text-[10px] tracking-widest" onClick={() => folderRef.current?.click()}>
            <FolderSearch className="size-3.5" />
            CHOOSE FOLDER
          </Button>
          <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
            macOS: /Library/Audio/Plug-Ins/VST3 · Windows: C:\Program Files\Common Files\VST3
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          The browser can read your plugin folder&apos;s names and formats, but it cannot load a native VST/AU binary. Scanned
          plugins appear in the rack and run through SYNCLAB&apos;s matching built-in processor with editable parameters.
        </p>
      </div>

      {/* third-party install */}
      <div className="panel space-y-2 p-2">
        <p className="label-xs">ADD 3RD-PARTY PLUGIN MANUALLY</p>
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
