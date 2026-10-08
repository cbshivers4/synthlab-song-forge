import { useEffect, useRef, useState, type ReactNode } from "react";
import { AudioLines, FolderOpen, Home, Music2, Scissors, SlidersHorizontal, Wand2, Settings2, Radio, Disc3, Grid2x2, Piano, Gauge, FileSearch, Cpu, Palette, NotebookPen, LifeBuoy, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { TopBar } from "./TopBar";
import { Timeline } from "./Timeline";
import { PhonePages } from "./PhonePages";
import { requestBluetoothSettings } from "./Settings";
import { openHelp } from "./HelpCenter";
import { openExport } from "./ExportDialog";
import logo from "@/assets/synclab-logo-neon.jpg.asset.json";

const sounds = [
  { label: "Drum Machine", icon: Disc3, panel: "drums" }, { label: "Synth", icon: Piano, panel: "synth" },
  { label: "Sampler", icon: Scissors, panel: "sampler" }, { label: "Sample pads", icon: Grid2x2, panel: "pads" },
  { label: "Sound library", icon: FolderOpen, panel: "browser" }, { label: "Keyboard", icon: Music2, panel: "keys" },
  { label: "Live View", icon: Radio, panel: "live" }, { label: "Live Looper", icon: Disc3, panel: "looper" },
] as const;
const tools = [
  { label: "Piano Roll", icon: Piano, panel: "piano" }, { label: "Effects & Plugins", icon: Cpu, panel: "plugins" },
  { label: "Mastering", icon: Gauge, panel: "mastering" }, { label: "Reference", icon: FileSearch, panel: "reference" },
  { label: "Phone settings", icon: Settings2, panel: "settings" }, { label: "Appearance", icon: Palette, panel: "appearance" },
  { label: "Track notes", icon: NotebookPen, panel: "notes" }, { label: "Other apps", icon: AudioLines, panel: "apps" },
] as const;

export function PhoneStudio({ children }: { children: ReactNode }) {
  const { panel, setPanel } = useStudio();
  const { setStage } = useApp();
  const [room, setRoom] = useState<"edit" | "sounds" | "tools">("edit");
  const [upright, setUpright] = useState(false);
  const [allowPortrait, setAllowPortrait] = useState(false);
  const [menuPage, setMenuPage] = useState(0);
  const consoleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const query = matchMedia("(orientation: portrait)");
    const update = () => setUpright(query.matches);
    update(); query.addEventListener("change", update);
    document.documentElement.classList.add("phone-console-active");
    const size = () => {
      const el = consoleRef.current;
      if (el) el.style.height = `${Math.max(240, window.innerHeight - el.getBoundingClientRect().top)}px`;
    };
    size(); window.addEventListener("resize", size);
    return () => { query.removeEventListener("change", update); window.removeEventListener("resize", size); document.documentElement.classList.remove("phone-console-active"); };
  }, []);
  const enter = (next: typeof room) => { setPanel(null); setRoom(next); setMenuPage(0); };
  const list = room === "sounds" ? sounds : tools;
  return <div ref={consoleRef} className="phone-console mobile-studio landscape-prod flex h-[100dvh] min-w-0 overflow-hidden bg-background text-foreground">
    <nav aria-label="Studio navigation" className="phone-console-rail flex w-20 shrink-0 flex-col items-center gap-2 border-r border-border bg-surface px-2 py-3">
      <Button variant="ghost" className="size-12 shrink-0 p-0" aria-label="Projects" onClick={() => setStage("start")}><img src={logo.url} alt="SYNCLAB" className="size-12 rounded-md object-cover" /></Button>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
        {[{ label: "EDIT", icon: AudioLines, active: !panel && room === "edit", run: () => enter("edit") }, { label: "MIX", icon: SlidersHorizontal, active: panel === "mixer", run: () => setPanel("mixer") }, { label: "SOUNDS", icon: Music2, active: room === "sounds" || ["synth", "sampler", "pads", "drums", "browser", "keys", "live", "looper"].includes(panel ?? ""), run: () => enter("sounds") }, { label: "TOOLS", icon: Wand2, active: room === "tools", run: () => enter("tools") }].map(({ label, icon: Icon, active, run }) => <Button key={label} variant="ghost" aria-pressed={active} className={`phone-room-button h-16 w-16 shrink-0 flex-col gap-1 px-0 text-[10px] font-bold ${active ? "bg-primary/15 text-primary" : "text-muted-foreground"}`} onClick={run}><Icon className="size-6" />{label}</Button>)}
      </div>
      <Button variant="ghost" size="icon" className="size-12 shrink-0" aria-label="Home and projects" onClick={() => setStage("start")}><Home /></Button>
    </nav>
    <main className="phone-console-stage flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <TopBar />
      {!panel && room === "edit" && <PhonePages name="Timeline"><Timeline phonePaged /></PhonePages>}
      {panel && children}
      {!panel && room !== "edit" && <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border px-5"><h2 className="truncate text-base font-semibold">{room === "sounds" ? "Sounds & instruments" : "Effects & tools"}</h2><span className="text-xs text-muted-foreground">SYNCLAB</span></header>
        <div className="phone-room-grid grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-3 p-4">{list.slice(menuPage * 8, menuPage * 8 + 8).map(({ label, icon: Icon, panel: next }) => <Button key={label} variant="outline" className="h-full min-h-12 min-w-0 flex-col gap-2 whitespace-normal bg-surface text-center text-xs" onClick={() => setPanel(next as PanelId)}><Icon className="size-7 text-primary" /><span>{label}</span></Button>)}</div>
        <footer className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border px-4"><Button variant="ghost" className="h-12 justify-start" onClick={() => { requestBluetoothSettings(); setPanel("settings"); }}><Radio />Bluetooth & audio</Button><div className="flex gap-1"><Button variant="outline" className="h-12" onClick={() => openExport()}>Export</Button><Button variant="outline" size="icon" className="size-12" aria-label="Help" onClick={() => openHelp("help")}><LifeBuoy /></Button></div></footer>
      </div>}
    </main>
    {upright && !allowPortrait && <div className="phone-rotate fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-background px-6 text-center"><img src={logo.url} alt="SYNCLAB" className="size-24 rounded-lg" /><RotateCw className="size-12 text-primary" /><h2 className="text-xl font-semibold">Turn your phone sideways</h2><p className="max-w-xs text-sm text-muted-foreground">Landscape studio</p><Button className="h-12" variant="outline" onClick={() => setAllowPortrait(true)}>Continue upright</Button><Button className="h-12" variant="ghost" onClick={() => setStage("start")}>Projects</Button></div>}
  </div>;
}