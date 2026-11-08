import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { DeviceClock } from "./DeviceClock";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AudioLines, ChevronLeft, ChevronRight, FolderOpen, Home, Music2, Scissors, SlidersHorizontal, Wand2, Settings2, Radio, Disc3, Grid2x2, Piano, Gauge, FileSearch, Cpu, Palette, NotebookPen, LifeBuoy, Mic, Bot, Sparkles, Film, PanelTop, Move, X, Maximize2, Minimize2, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { TopBar } from "./TopBar";
import { Timeline } from "./Timeline";
import { AddTrackMenu } from "./AddTrackMenu";
import { PhonePages } from "./PhonePages";
import { ComputerFiles } from "./ComputerFiles";
import { requestBluetoothSettings } from "./Settings";
import { openHelp } from "./HelpCenter";
import { openExport } from "./ExportDialog";
import logo from "@/assets/synclab-logo-neon.jpg.asset.json";
import { Hand } from "lucide-react";
import { recordingPosition } from "@/lib/synclab/recording-display";
import { usePlayStep } from "@/lib/synclab/playhead";

const sounds = [
  { label: "Drum Machine", icon: Disc3, panel: "drums" }, { label: "Synth", icon: Piano, panel: "synth" },
  { label: "Touch Synth", icon: Hand, panel: "synth" }, { label: "Granular Synth", icon: Sparkles, panel: "synth" },
  { label: "Sampler", icon: Scissors, panel: "sampler" }, { label: "Sample pads", icon: Grid2x2, panel: "pads" },
  { label: "Sound library", icon: FolderOpen, panel: "browser" },
  { label: "Live View", icon: Radio, panel: "live" }, { label: "Live Looper", icon: Disc3, panel: "looper" },
] as const;
const tools = [
  { label: "Audio Converter", icon: AudioLines, panel: "audio-converter" },
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
  { label: "FX Rack", icon: Cpu, panel: "plugins" },
  { label: "Mastering", icon: Gauge, panel: "mastering" }, { label: "Reference", icon: FileSearch, panel: "reference" },
  { label: "Phone settings", icon: Settings2, panel: "settings" }, { label: "Appearance", icon: Palette, panel: "appearance" },
  { label: "Track notes", icon: NotebookPen, panel: "notes" }, { label: "Other apps", icon: AudioLines, panel: "apps" },
] as const;

export function PhoneStudio({ children }: { children: ReactNode }) {
  const { panel, setPanel, transport, tracks, select, addTrack, stop } = useStudio();
  const { setStage, project } = useApp();
  const [room, setRoom] = useState<"edit" | "sounds" | "tools">("edit");
  const [railOpen, setRailOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(false);
  const [transportOpen, setTransportOpen] = useState(false);
  const [mixerFull, setMixerFull] = useState(true);
  const [dockHeight, setDockHeight] = useState(150);
  const startDockDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = canvasPoint(event.clientX, event.clientY).y;
    const startH = dockHeight;
    const move = (e: PointerEvent) => {
      const max = Math.max(120, window.innerHeight - 160);
      setDockHeight(Math.min(max, Math.max(0, startH + canvasPoint(e.clientX, e.clientY).y - startY)));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  useEffect(() => { setTransportOpen(false); if (panel) setMixerFull(true); }, [panel]);
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
    const onMixerFull = () => setMixerFull((full) => { const next = !full; if (next) setTransportOpen(false); return next; });
    window.addEventListener("synclab:mixer-full", onMixerFull);
    return () => { window.removeEventListener("synclab:mixer-full", onMixerFull); document.documentElement.classList.remove("phone-console-active"); };
  }, []);
  // Edit screen: divide the track area's height between the visible rows so
  // tracks fill the screen; rows never shrink below the height the four-line
  // track header needs, so extra tracks scroll instead of overlapping.
  const editRef = useRef<HTMLDivElement>(null);
  const editPageOpen = !panel && room === "edit";
  useEffect(() => {
    const root = editRef.current;
    if (!editPageOpen || !root) return;
    const fit = () => {
      const scroller = root.querySelector<HTMLElement>("#timeline-scroll");
      if (!scroller) return;
      const rows = Math.max(1, root.querySelectorAll("[data-track-row]").length);
      const drop = root.querySelector<HTMLElement>("[data-new-channel-drop]")?.offsetHeight ?? 30;
      const h = Math.floor((scroller.clientHeight - drop - 2) / rows) - 1;
      root.style.setProperty("--fit-row-h", `${Math.max(118, Math.min(140, h))}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(root);
    const mo = new MutationObserver(fit);
    mo.observe(root, { childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [editPageOpen, tracks.length]);
  const enter = (next: typeof room) => { setTransportOpen(false); setPanel(null); setRoom(next); };
  const list = room === "sounds" ? sounds : tools;
  const editPage = !panel && room === "edit";
  const header = <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3"><h1 className="min-w-0 truncate text-xs font-semibold">{project?.id ? project.name : project ? `${project.name} · not saved yet` : "Untitled song"}</h1><DeviceClock mobile /></header>;
  const recordingStrip = transport.recording ? <PhoneRecordingPosition beatsPerBar={transport.beatsPerBar ?? 4} onStop={() => void stop()} /> : null;
  return <div ref={consoleRef} data-mixer-full={panel === "mixer" && mixerFull ? "true" : undefined} className="phone-console mobile-studio landscape-prod flex h-[100dvh] min-w-0 overflow-hidden bg-background text-foreground">
    <div className="relative shrink-0 transition-[width] duration-200 ease-out" style={{ width: railOpen ? "5rem" : "3rem" }}>
    <nav aria-label="Studio navigation" data-rail-open={railOpen} className="phone-console-rail flex h-full w-full flex-col items-center gap-2 border-r border-border bg-surface px-2 py-3">
      {railOpen && <>
      <Button variant="ghost" className="size-16 shrink-0 p-0" aria-label="Projects" onClick={() => setStage("start")}><img src={logo.url} alt="SYNCLAB" className="size-16 rounded-md object-cover" /></Button>
      <div className="my-auto flex shrink-0 flex-col gap-3">
        {[{ label: "EDIT", icon: AudioLines, active: !panel && room === "edit", run: () => enter("edit") }, { label: "MIX", icon: SlidersHorizontal, active: panel === "mixer", run: () => setPanel("mixer") }, { label: "SOUNDS", icon: Music2, active: room === "sounds" || ["synth", "sampler", "pads", "drums", "browser", "keys", "live", "looper"].includes(panel ?? ""), run: () => enter("sounds") }, { label: "TOOLS", icon: Wand2, active: room === "tools", run: () => enter("tools") }, { label: "FILES", icon: FolderOpen, active: filesOpen, run: () => setFilesOpen((o) => !o) }].map(({ label, icon: Icon, active, run }) => <Button key={label} variant="ghost" aria-pressed={active} className={`phone-room-button h-16 w-16 shrink-0 flex-col gap-1 px-0 text-[10px] font-bold ${active ? "bg-primary/15 text-primary" : "text-muted-foreground"}`} onClick={run}><Icon className="size-6" />{label}</Button>)}
      </div>
      <Button variant="ghost" size="icon" className="size-12 shrink-0" aria-label="Home and projects" onClick={() => setStage("start")}><Home /></Button>
      </>}
      {!railOpen && <Button variant={panel === "mixer" ? "secondary" : "ghost"} size="icon" className="size-11 shrink-0" aria-label="Open mixer" aria-pressed={panel === "mixer"} title="Mixer" onClick={() => setPanel("mixer")}><SlidersHorizontal className="size-5" /></Button>}

      {panel === "mixer" && <Button variant={mixerFull ? "secondary" : "ghost"} className="h-11 w-full shrink-0 flex-col gap-0.5 px-0 text-[9px] font-semibold" aria-label={mixerFull ? "Exit full mixer" : "Open mixer full screen"} title={mixerFull ? "Exit full mixer" : "Open mixer full screen"} aria-pressed={mixerFull} onClick={() => setMixerFull((full) => { const next = !full; if (next) setTransportOpen(false); return next; })}>{mixerFull ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}{railOpen ? "FULL" : ""}</Button>}
      <Button variant="ghost" className={`h-12 w-full shrink-0 flex-col gap-0.5 px-0 text-[9px] font-semibold ${transport.recording ? "text-destructive" : transportOpen || transport.playing ? "text-primary" : "text-muted-foreground"}`} aria-label={transportOpen ? "Hide transport" : "Show transport"} title={transportOpen ? "Hide transport" : "Show transport"} aria-expanded={transportOpen} aria-controls="phone-transport-overlay" onClick={() => setTransportOpen((open) => !open)}><PanelTop className="size-5" />{railOpen ? "TRANSPORT" : transport.recording ? "REC" : transport.playing ? "PLAY" : ""}</Button>
      <Button variant="outline" size="icon" className="phone-rail-toggle mt-auto shrink-0 self-center" aria-label={railOpen ? "Hide navigation bar" : "Show navigation bar"} aria-expanded={railOpen} onClick={() => setRailOpen((open) => !open)}>{railOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}</Button>
    </nav>
    </div>
    {filesOpen && <aside aria-label="My music files" className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-surface">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3"><span className="text-sm font-semibold">Files</span><Button variant="ghost" size="icon" className="size-10" aria-label="Close files" onClick={() => setFilesOpen(false)}><X /></Button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1"><ComputerFiles /></div>
    </aside>}
    <main className="phone-console-stage relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {!editPage && header}
      {!editPage && recordingStrip}
      {panel === "mixer" && !mixerFull && <>
        {dockHeight > 0 && <div className="docked-phone-timeline shrink-0 overflow-hidden" style={{ height: dockHeight }}><Timeline desktopStyle /></div>}
        <div role="separator" aria-orientation="horizontal" aria-label="Resize timeline and mixer" title="Drag to resize timeline and mixer" onPointerDown={startDockDrag} className="dock-splitter flex h-8 shrink-0 cursor-row-resize touch-none items-center justify-center gap-2 border-y-2 border-primary/50 bg-surface"><GripHorizontal className="size-5 text-primary" /><span className="text-[10px] font-bold uppercase tracking-widest text-primary">Drag to resize</span></div>
      </>}
      {editPage && (
        // Edit screen fits the phone: compact title, toolbars and ruler stay
        // put and the track rows share the remaining height.
        <div ref={editRef} className="phone-edit-fit flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3"><h1 className="min-w-0 truncate text-xs font-semibold">{project?.id ? project.name : project ? `${project.name} · not saved yet` : "Untitled song"}</h1><AddTrackMenu size="sm" /><DeviceClock inline /></header>
          {recordingStrip}
          <Timeline desktopStyle />
        </div>
      )}
      {panel && children}
      {!panel && room !== "edit" && <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="phone-room-header grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border px-5"><h2 className="truncate text-base font-semibold">{room === "sounds" ? "Sounds & instruments" : "Effects & tools"}</h2><span className="text-xs text-muted-foreground">SYNCLAB</span></header>
        <div className="phone-room-grid grid min-h-0 flex-1 auto-rows-[minmax(8.75rem,1fr)] grid-cols-4 gap-2 overflow-auto p-2.5">{list.map(({ label, icon: Icon, panel: next }, index) => <Button key={label} variant="outline" data-sound-family={index % 4} className="phone-sound-tile h-full min-h-[8.75rem] min-w-0 flex-col gap-2.5 whitespace-normal text-center text-sm leading-tight" onClick={() => {
          if (label === "Touch Synth") {
            const found = tracks.find((track) => /^touch synth$/i.test(track.name) && track.patch && !track.patch.modular);
            if (found) select(found.id);
            else addTrack("instrument", "TOUCH SYNTH", "Cybotron Lead");
          }
          if (label === "Granular Synth") {
            const found = tracks.find((track) => track.patch?.granular);
            if (found) select(found.id);
            else addTrack("instrument", "GRANULAR SYNTH", "Granular Glass Cloud");
          }
          if (label === "Drum Machine" && !tracks.some((track) => track.kind === "drum")) {
            addTrack("drum", "DRUM MACHINE", undefined, { keepPanel: true });
          }
          setPanel(next as PanelId);
        }}><span className="phone-sound-icon flex size-16 shrink-0 items-center justify-center rounded-xl"><Icon className="size-10" /></span><span className="font-semibold">{label}</span></Button>)}</div>
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
/** Live bar/beat while recording on the phone; only this strip re-renders each step. */
function PhoneRecordingPosition({ beatsPerBar, onStop }: { beatsPerBar: number; onStop: () => void }) {
  const recordingAt = recordingPosition(usePlayStep(), beatsPerBar);
  return <div aria-label="Recording position" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-surface-2 px-3 py-2">
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-destructive"><span className="size-2 rounded-full bg-destructive" />REC</span>
        <span className="shrink-0 font-mono text-lg font-bold tabular-nums">BAR {recordingAt.bar} <span className="text-primary">BEAT {recordingAt.beat}</span></span>
        <span className="min-w-0 text-xs text-foreground">BAR {recordingAt.nextBar} IN {Math.ceil(recordingAt.beatsRemaining)} {Math.ceil(recordingAt.beatsRemaining) === 1 ? "BEAT" : "BEATS"}</span>
        <Button size="sm" variant="destructive" className="ml-auto h-10 shrink-0" aria-label="Stop recording now" onClick={onStop}>■ STOP</Button>
        <div className="flex h-1 w-full gap-1" aria-hidden="true">{Array.from({ length: beatsPerBar }, (_, beat) => <div key={beat} className={`h-full flex-1 ${beat < recordingAt.beat ? "bg-primary" : "bg-muted"}`} />)}</div>
      </div>;
}
