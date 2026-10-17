import { useEffect, useRef, useState, type ReactNode } from "react";
import { AudioLines, ChevronLeft, ChevronRight, FolderOpen, Home, Music2, Scissors, SlidersHorizontal, Wand2, Settings2, Radio, Disc3, Grid2x2, Piano, Gauge, FileSearch, Cpu, Palette, NotebookPen, LifeBuoy, Mic, Bot, Sparkles, Film, PanelTop, Move, X, Maximize2, Minimize2, GripHorizontal } from "lucide-react";
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
  { label: "Sound library", icon: FolderOpen, panel: "browser" },
  { label: "Live View", icon: Radio, panel: "live" }, { label: "Live Looper", icon: Disc3, panel: "looper" },
] as const;
const tools = [
  { label: "Mixer", icon: SlidersHorizontal, panel: "mixer" },
  { label: "Studio View", icon: Home, panel: "studio-view" },
  { label: "Reel-to-Reel Recorder", icon: Disc3, panel: "reel-recorder" },
  { label: "Video Sampler", icon: Film, panel: "video-sampler" },
  { label: "Separate Stems", icon: Scissors, panel: "stems" },
  { label: "Hum to Beat", icon: Mic, panel: "humbeat" },
  { label: "AI Co-Producer", icon: Bot, panel: "coproducer" },
  { label: "Bass Generator", icon: Music2, panel: "bassgen" },
  { label: "Convert Voice", icon: Mic, panel: "voice" },
  { label: "Generate Stem", icon: Sparkles, panel: "genstem" },
  { label: "Plugins", icon: Cpu, panel: "plugins" },
  { label: "Mastering", icon: Gauge, panel: "mastering" }, { label: "Reference", icon: FileSearch, panel: "reference" },
  { label: "Phone settings", icon: Settings2, panel: "settings" }, { label: "Appearance", icon: Palette, panel: "appearance" },
  { label: "Track notes", icon: NotebookPen, panel: "notes" }, { label: "Other apps", icon: AudioLines, panel: "apps" },
] as const;

export function PhoneStudio({ children }: { children: ReactNode }) {
  const { panel, setPanel, transport } = useStudio();
  const { setStage } = useApp();
  const [room, setRoom] = useState<"edit" | "sounds" | "tools">("edit");
  const [railOpen, setRailOpen] = useState(true);
  const [transportOpen, setTransportOpen] = useState(false);
  const [resizeHandlesVisible, setResizeHandlesVisible] = useState(false);
  const [mixerFull, setMixerFull] = useState(false);
  const [dockHeight, setDockHeight] = useState(150);
  const startDockDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startH = dockHeight;
    const move = (e: PointerEvent) => {
      const max = Math.max(120, window.innerHeight - 160);
      setDockHeight(Math.min(max, Math.max(0, startH + e.clientY - startY)));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  useEffect(() => { setTransportOpen(false); }, [panel]);
  // The phone studio always opens on the edit screen (timeline) — never an
  // instrument such as the drum machine, even if one was open last visit.
  useEffect(() => {
    setPanel(null);
    setRoom("edit");
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setPanel(null);
      setRoom("edit");
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [setPanel]);
  // Mobile studio opens automatically — no rotate gate.
  const consoleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.documentElement.classList.add("phone-console-active");
    const size = () => {
      const el = consoleRef.current;
      if (el) el.style.height = `${Math.max(240, window.innerHeight - el.getBoundingClientRect().top)}px`;
    };
    size(); window.addEventListener("resize", size);
    const onMixerFull = () => setMixerFull((full) => { const next = !full; if (next) setTransportOpen(false); return next; });
    window.addEventListener("synclab:mixer-full", onMixerFull);
    return () => { window.removeEventListener("resize", size); window.removeEventListener("synclab:mixer-full", onMixerFull); document.documentElement.classList.remove("phone-console-active"); };
  }, []);
  const enter = (next: typeof room) => { setTransportOpen(false); setPanel(null); setRoom(next); };
  const list = room === "sounds" ? sounds : tools;
  return <div ref={consoleRef} className="phone-console mobile-studio landscape-prod flex h-[100dvh] min-w-0 overflow-hidden bg-background text-foreground">
    <div className="relative shrink-0 transition-[width] duration-200 ease-out" style={{ width: railOpen ? "5rem" : "3rem" }}>
    <nav aria-label="Studio navigation" data-rail-open={railOpen} className="phone-console-rail flex h-full w-full flex-col items-center gap-2 border-r border-border bg-surface px-2 py-3">
      {railOpen && <>
      <Button variant="ghost" className="size-16 shrink-0 p-0" aria-label="Projects" onClick={() => setStage("start")}><img src={logo.url} alt="SYNCLAB" className="size-16 rounded-md object-cover" /></Button>
      <div className="flex min-h-max flex-1 shrink-0 flex-col justify-center gap-3">
        {[{ label: "EDIT", icon: AudioLines, active: !panel && room === "edit", run: () => enter("edit") }, { label: "MIX", icon: SlidersHorizontal, active: panel === "mixer", run: () => setPanel("mixer") }, { label: "SOUNDS", icon: Music2, active: room === "sounds" || ["synth", "sampler", "pads", "drums", "browser", "keys", "live", "looper"].includes(panel ?? ""), run: () => enter("sounds") }, { label: "TOOLS", icon: Wand2, active: room === "tools", run: () => enter("tools") }].map(({ label, icon: Icon, active, run }) => <Button key={label} variant="ghost" aria-pressed={active} className={`phone-room-button h-16 w-16 shrink-0 flex-col gap-1 px-0 text-[10px] font-bold ${active ? "bg-primary/15 text-primary" : "text-muted-foreground"}`} onClick={run}><Icon className="size-6" />{label}</Button>)}
      </div>
      <Button variant="ghost" size="icon" className="size-12 shrink-0" aria-label="Home and projects" onClick={() => setStage("start")}><Home /></Button>
      </>}
      {!railOpen && <Button variant={panel === "mixer" ? "secondary" : "ghost"} size="icon" className="size-11 shrink-0" aria-label="Open mixer" aria-pressed={panel === "mixer"} title="Mixer" onClick={() => setPanel("mixer")}><SlidersHorizontal className="size-5" /></Button>}
      {(panel === "mixer" || (!panel && room === "edit")) && <Button variant={resizeHandlesVisible ? "secondary" : "ghost"} className="h-11 w-full shrink-0 flex-col gap-0.5 px-0 text-[9px] font-semibold" aria-label={resizeHandlesVisible ? "Hide resize handles" : "Show resize handles"} title={resizeHandlesVisible ? "Hide resize handles" : "Show resize handles"} aria-pressed={resizeHandlesVisible} onClick={() => setResizeHandlesVisible((visible) => !visible)}><Move className="size-5" />{railOpen ? "RESIZE" : ""}</Button>}
      {panel === "mixer" && <Button variant={mixerFull ? "secondary" : "ghost"} className="h-11 w-full shrink-0 flex-col gap-0.5 px-0 text-[9px] font-semibold" aria-label={mixerFull ? "Exit full mixer" : "Open mixer full screen"} title={mixerFull ? "Exit full mixer" : "Open mixer full screen"} aria-pressed={mixerFull} onClick={() => setMixerFull((full) => { const next = !full; if (next) setTransportOpen(false); return next; })}>{mixerFull ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}{railOpen ? "FULL" : ""}</Button>}
      <Button variant="ghost" className={`h-12 w-full shrink-0 flex-col gap-0.5 px-0 text-[9px] font-semibold ${transport.recording ? "text-destructive" : transportOpen || transport.playing ? "text-primary" : "text-muted-foreground"}`} aria-label={transportOpen ? "Hide transport" : "Show transport"} title={transportOpen ? "Hide transport" : "Show transport"} aria-expanded={transportOpen} aria-controls="phone-transport-overlay" onClick={() => setTransportOpen((open) => !open)}><PanelTop className="size-5" />{railOpen ? "TRANSPORT" : transport.recording ? "REC" : transport.playing ? "PLAY" : ""}</Button>
      <Button variant="outline" size="icon" className="phone-rail-toggle mt-auto shrink-0 self-center" aria-label={railOpen ? "Hide navigation bar" : "Show navigation bar"} aria-expanded={railOpen} onClick={() => setRailOpen((open) => !open)}>{railOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}</Button>
    </nav>
    </div>
    <main className="phone-console-stage relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {panel === "mixer" && !mixerFull && <>
        {dockHeight > 0 && <div className="docked-phone-timeline shrink-0 overflow-hidden" style={{ height: dockHeight }}><Timeline desktopStyle resizeHandlesVisible={resizeHandlesVisible} /></div>}
        <div role="separator" aria-orientation="horizontal" aria-label="Resize timeline and mixer" title="Drag to resize timeline and mixer" onPointerDown={startDockDrag} className="dock-splitter flex h-4 shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-border bg-surface"><GripHorizontal className="size-4 text-muted-foreground" /></div>
      </>}
      {!panel && room === "edit" && <Timeline desktopStyle resizeHandlesVisible={resizeHandlesVisible} />}
      {panel && children}
      {!panel && room !== "edit" && <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="phone-room-header grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border px-5"><h2 className="truncate text-base font-semibold">{room === "sounds" ? "Sounds & instruments" : "Effects & tools"}</h2><span className="text-xs text-muted-foreground">SYNCLAB</span></header>
        <div className="phone-room-grid grid min-h-0 flex-1 auto-rows-[minmax(8.75rem,1fr)] grid-cols-4 gap-2 overflow-auto p-2.5">{list.map(({ label, icon: Icon, panel: next }, index) => <Button key={label} variant="outline" data-sound-family={index % 4} className="phone-sound-tile h-full min-h-[8.75rem] min-w-0 flex-col gap-2.5 whitespace-normal text-center text-sm leading-tight" onClick={() => setPanel(next as PanelId)}><span className="phone-sound-icon flex size-16 shrink-0 items-center justify-center rounded-xl"><Icon className="size-10" /></span><span className="font-semibold">{label}</span></Button>)}</div>
        <footer className="phone-room-footer grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border px-4"><Button variant="ghost" className="h-12 justify-start" onClick={() => { requestBluetoothSettings(); setPanel("settings"); }}><Radio />Bluetooth & audio</Button><div className="flex gap-1"><Button variant="outline" className="h-12" onClick={() => openExport()}>Export</Button><Button variant="outline" size="icon" className="size-12" aria-label="Help" onClick={() => openHelp("help")}><LifeBuoy /></Button></div></footer>
      </div>}
      {/* Docked transport: sits below the workspace so it never covers the mixer or timeline */}
      <div id="phone-transport-overlay" hidden={!transportOpen} className="max-h-[45%] shrink-0 overflow-auto border-t border-border bg-background shadow-lg">
        <div className="flex h-12 items-center justify-between border-b border-border bg-surface px-3"><span className="text-sm font-semibold">Transport</span><Button variant="ghost" size="icon" className="size-12" aria-label="Close transport" onClick={() => setTransportOpen(false)}><X /></Button></div>
        <TopBar />
      </div>
    </main>
  </div>;
}