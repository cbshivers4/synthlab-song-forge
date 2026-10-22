import { useRef, useState } from "react";
import { Cpu, FolderSearch, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { PLUGIN_KINDS, makeDef, defsFromFiles } from "@/lib/synclab/plugins";
import type { PluginDef, PluginKind } from "@/lib/synclab/types";
import { RackEffect } from "./RackEffect";
import { PluginBridge } from "./PluginBridge";
import { toast } from "sonner";
import rackWalnut from "@/assets/rack-walnut.jpg";

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

export function PluginRack() {
  const {
    selected,
    select,
    tracks,
    installedPlugins,
    installPlugin,
    uninstallPlugin,
    addPlugin,
  } = useStudio();
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [format, setFormat] = useState<PluginDef["format"]>("VST3");
  const [kind, setKind] = useState<PluginKind>("eq");
  const folderRef = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);

  const dropFiles = (files: File[]) => {
    const defs = defsFromFiles(files, installedPlugins.map((d) => d.name));
    if (defs.length === 0) {
      toast("No plugins in that drop", {
        description: "Drop .vst3, .component, .clap or .aaxplugin files or folders.",
      });
      return;
    }
    defs.forEach(installPlugin);
    toast.success(`${defs.length} plugin${defs.length === 1 ? "" : "s"} added`, {
      description: "They appear in the rack and run through SYNCLAB's matching processor.",
    });
  };

  const track = selected ?? tracks[0];
  if (!track)
    return (
      <div className="space-y-3">
        <PluginBridge />
        <p className="text-sm text-muted-foreground">Add a track to open its plugin rack.</p>
      </div>
    );
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
      <header className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2"><Cpu className="size-5 text-primary" /><h2 className="text-base font-semibold">Plugins</h2><span className="text-xs text-muted-foreground">effects rack</span></div>
        <Select value={track.id} onValueChange={select}>
          <SelectTrigger aria-label="Effects rack track" className="h-11 w-full min-w-0 sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{tracks.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{chain.length} insert{chain.length === 1 ? "" : "s"}</span>
      </header>
      <div className="plugin-rack-workstation">
      <div className="plugin-rack-cabinet">
        <img src={rackWalnut} alt="" aria-hidden="true" className="plugin-rack-wood" loading="lazy" width={1152} height={576} />
        <div className="plugin-rack-badge"><strong>SYNCLAB</strong><span>INSERT RACK</span><span>{track.name} · {chain.length} / SERIAL</span></div>
      <div className="plugin-rack-stack" aria-label={`${track.name} effects chain`}>
        {chain.length === 0 && <p className="border-y border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">No effects on {track.name}.</p>}
        {chain.map((p, i) => <RackEffect key={p.id} trackId={track.id} plugin={p} index={i} count={chain.length} />)}
      </div>
      </div>

      {/* installed rack */}
      <aside className="plugin-rack-browser">
        <p className="label-xs mb-1.5">ADD EFFECT · {track.name}</p>
        <div className="plugin-rack-browser-list">
          {installedPlugins.map((d) => (
            <div
              key={d.id}
              data-fx-skin={d.kind}
              draggable
              onDragStart={(e) => {
                const payload = JSON.stringify({ type: "plugin", defId: d.id });
                e.dataTransfer.setData("application/synclab", payload);
                e.dataTransfer.setData("text/plain", payload);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="plugin-rack-browser-device flex cursor-grab items-center gap-2 px-2 py-1.5 active:cursor-grabbing"
            >
              <Button variant="ghost" aria-label={`Add ${d.name}`} className="h-auto min-h-11 min-w-0 flex-1 flex-col items-start gap-0 text-left" onClick={() => addPlugin(track.id, d)}>
                 <span className="block max-w-full truncate text-[11px] font-medium">{d.name}</span>
                <span className="block truncate font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                  {d.vendor} · {d.format}
                </span>
              </Button>
              {d.format !== "Built-in" && (
                <Button size="icon" variant="ghost" className="size-6" onClick={() => uninstallPlugin(d.id)} aria-label="Uninstall">
                  <Trash2 className="size-3.5" />
                </Button>
              )}
              <Plus className="size-3.5 shrink-0 text-primary" />
            </div>
          ))}
        </div>
      </aside>
      </div>

      <details className="border-t border-border pt-3"><summary className="cursor-pointer py-3 text-sm font-semibold">Plugin files & desktop bridge</summary>
      <PluginBridge />
      {/* drag and drop plugin files straight from the computer */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          dropFiles(Array.from(e.dataTransfer.files));
        }}
        className={`panel grid place-items-center gap-1 border-dashed p-6 text-center transition-colors ${
          dropping ? "border-primary bg-primary/10" : ""
        }`}
      >
        <Upload className="size-5 text-primary" />
        <p className="text-[11px] font-medium">Create a SYNCLAB effect from a plugin name</p>
        <p className="max-w-md text-[10px] text-muted-foreground">
          This reads only the file name and format, then creates a separate SYNCLAB effect with similar controls. It does not
          load, copy, or run the original plugin.
        </p>
      </div>

      {/* scan a plugin folder from the computer */}
      <div className="panel space-y-2 p-2">
        <p className="label-xs">READ NAMES FROM A PLUGIN FOLDER</p>
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
          This browser tool reads names and formats only. The items it creates are clearly separate SYNCLAB effects; use the
          Desktop Audio Bridge above to discover real installed plugin bundles.
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
      </details>
    </div>
  );
}
