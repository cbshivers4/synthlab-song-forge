import { ToolErrorBoundary } from "@/components/studio/ToolErrorBoundary";
import { useEffect, useRef, useState } from "react";
import { TrackSettingsDialog, openTrackSettings } from "@/components/studio/TrackSettingsDialog";
import { QWERTY_MAP, qwertyEnabled, qwertyOctave, setQwertyOctave } from "@/lib/synclab/qwerty";
import { barBeat, songSteps } from "@/lib/synclab/timebase";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, AudioLines, AudioWaveform, Cpu, Gauge, Disc3, FileSearch, FolderOpen, Grid2x2, KeyboardMusic, Music2, NotebookPen, Palette, Piano, Radio, SlidersHorizontal, Split, Settings2, Sparkles, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { TopBar } from "@/components/studio/TopBar";
import { Mastering } from "@/components/studio/Mastering";
import { NotesPanel } from "@/components/studio/TrackNotes";
import { Timeline } from "@/components/studio/Timeline";
import { Mixer } from "@/components/studio/Mixer";
import { DetachedWindow, popOutPanel, setDetached, useDetached, type DetachId } from "@/components/studio/MixerWindow";
import { SynthEditor } from "@/components/studio/SynthEditor";
import { DrumMachine } from "@/components/studio/DrumMachine";
import { PianoRoll } from "@/components/studio/PianoRoll";
import { DrumRoll } from "@/components/studio/DrumRoll";
import { MidiLearnStrip } from "@/components/studio/MidiLearn";
import { Settings } from "@/components/studio/Settings";
import { Keyboard } from "@/components/studio/Keyboard";
import { Browser } from "@/components/studio/Browser";
import { Sampler } from "@/components/studio/Sampler";
import { PadSampler } from "@/components/studio/PadSampler";
import { SplashScreen } from "@/components/studio/SplashScreen";
import { PluginRack } from "@/components/studio/PluginRack";
import { DeviceBar } from "@/components/studio/DeviceBar";
import { QuickNotes } from "@/components/studio/QuickNotes";
import { FloatingDevice } from "@/components/studio/FloatingDevice";
import { MenuBar } from "@/components/studio/MenuBar";
import { ToolsRail } from "@/components/studio/ToolsRail";
import { Appearance } from "@/components/studio/Appearance";
import { WelcomeScreen } from "@/components/studio/WelcomeScreen";
import { StartScreen } from "@/components/studio/StartScreen";
import { DeviceSetup } from "@/components/studio/DeviceSetup";
import { ExportDialog } from "@/components/studio/ExportDialog";
import { HelpCenter } from "@/components/studio/HelpCenter";
import { MobileBeat } from "@/components/studio/MobileBeat";
import { MobileNav } from "@/components/studio/MobileNav";
import { MobileCreate } from "@/components/studio/MobileCreate";
import { MobileOnboarding } from "@/components/studio/MobileOnboarding";
import { PhoneStudio } from "@/components/studio/PhoneStudio";
import { PhonePages } from "@/components/studio/PhonePages";
import { DesktopUpdateBanner } from "@/components/studio/DesktopUpdateBanner";
import { DesktopWebsiteStatus } from "@/components/studio/DesktopWebsiteStatus";
import { ReferenceAnalyzer } from "@/components/studio/ReferenceAnalyzer";
import { LiveView } from "@/components/studio/LiveView";
import { LiveLooperView } from "@/components/studio/LiveLooperView";
import { ExternalApps } from "@/components/studio/ExternalApps";
import { HumToBeat } from "@/components/studio/HumToBeat";
import { StemSplitter } from "@/components/studio/StemSplitter";
import { CoProducer } from "@/components/studio/CoProducer";
import { VoiceConverter } from "@/components/studio/VoiceConverter";
import { StemGenerator } from "@/components/studio/StemGenerator";
import { BassGenerator } from "@/components/studio/BassGenerator";
import { ReelRecorder } from "@/components/studio/ReelRecorder";
import { Bot, Film } from "lucide-react";
import { VideoSampler } from "@/components/studio/VideoSampler";
import { StudioView } from "@/components/studio/StudioView";
import { AppProvider, useApp, useMaybeApp } from "@/lib/synclab/app-state";
import { PlanProvider } from "@/lib/synclab/plan";
import { useIsMobile, useIsLandscapePhone } from "@/hooks/use-mobile";
import { useMobileAccessibility } from "@/lib/synclab/mobile-accessibility";
import { toast } from "sonner";
import synthFace from "@/assets/hw-synth.jpg";
import drumFace from "@/assets/hw-drum.jpg";

type FloatState = { synth: boolean; drums: boolean };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SYNCLAB Studio — One-Page Detroit DAW" },
      {
        name: "description",
        content:
          "SYNCLAB is a browser DAW: unlimited tracks, a deep three-oscillator synth, a step-sequenced drum machine, piano roll and mixer, all on one page.",
      },
      { property: "og:title", content: "SYNCLAB Studio — One-Page Detroit DAW" },
      {
        property: "og:description",
        content:
          "Add tracks, program beats, design synths and mix a whole record without leaving a single screen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://synthlab-song-forge.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://synthlab-song-forge.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "SYNCLAB",
          url: "https://synthlab-song-forge.lovable.app/",
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Web Browser",
          description:
            "SYNCLAB is a browser DAW: unlimited tracks, a deep three-oscillator synth, a step-sequenced drum machine, piano roll and mixer, all on one page.",
          featureList: [
            "Multitrack timeline",
            "Audio and MIDI recording",
            "Three-oscillator synthesizer",
            "Step-sequenced drum machine",
            "Sampler",
            "Piano roll editor",
            "Mixing console with buses and sends",
            "Built-in effects and mastering",
          ],
        }),
      },
    ],
  }),
  component: Studio,
});

function DetachedPanels() {
  const ids = useDetached();
  const { selected, tracks } = useStudio();
  const drumTrack = selected?.kind === "drum" ? selected : tracks.find((t) => t.kind === "drum");
  const synthTrack = selected?.patch && selected.kind !== "sampler" ? selected : tracks.find((t) => t.patch && t.kind !== "sampler");
  const meta: Record<DetachId, { title: string; icon: React.ReactNode; body: React.ReactNode }> = {
    mixer: { title: "MIXER", icon: <SlidersHorizontal className="size-4" />, body: <Mixer /> },
    keys: { title: "KEYBOARD", icon: <KeyboardMusic className="size-4" />, body: <Keyboard /> },
    drums: {
      title: "DRUM MACHINE",
      icon: <Disc3 className="size-4" />,
      body: drumTrack ? <DrumMachine track={drumTrack} /> : <p className="text-sm text-muted-foreground">Add a drum machine track to program a beat.</p>,
    },
    synth: {
      title: selected?.kind === "sampler" ? "SAMPLER" : "SYNTH",
      icon: <Music2 className="size-4" />,
      body: selected?.kind === "sampler" ? <Sampler /> : synthTrack ? (
        <>
          <p className="label-xs mb-3">Editing {synthTrack.name}</p>
          <SynthEditor track={synthTrack} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Add an instrument track to open the synthesizer.</p>
      ),
    },
    live: { title: "LIVE VIEW", icon: <Radio className="size-4" />, body: <LiveView /> },
    looper: { title: "LIVE LOOPER", icon: <Disc3 className="size-4" />, body: <LiveLooperView /> },
    pads: { title: "PAD SAMPLER", icon: <Grid2x2 className="size-4" />, body: <PadSampler /> },
  };
  return (
    <>
      {ids.map((id) => (
        <DetachedWindow key={id} id={id} title={meta[id].title} onClose={() => setDetached(id, false)}>
          <div className="rack flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-1.5">
              <span className="text-primary">{meta[id].icon}</span>
              <h2 className="font-display text-[11px] font-semibold tracking-[0.2em]">{meta[id].title}</h2>
              <span className="label-xs">· detached</span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 gap-1.5 font-mono text-[10px] tracking-widest uppercase"
                onClick={() => setDetached(id, false)}
              >
                <ArrowDownToLine className="size-3.5" />
                Dock
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{meta[id].body}</div>
          </div>
        </DetachedWindow>
      ))}
    </>
  );
}

function Panels({ float, setFloat }: { float: FloatState; setFloat: (f: (p: FloatState) => FloatState) => void }) {
  const isMobile = useIsMobile();
  const { selected, tracks, panel, setPanel, select } = useStudio();
  // Resizable editor height, remembered between sessions.
  const [rackH, setRackH] = useState(() => {
    if (typeof window === "undefined") return 380;
    const v = Number(window.localStorage.getItem("synclab.rack.height"));
    return Number.isFinite(v) && v >= 180 ? v : 380;
  });
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = rackH;
    const onMove = (ev: PointerEvent) =>
      setRackH(Math.max(180, Math.min(window.innerHeight - 220, h0 - (ev.clientY - y0))));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        window.localStorage.setItem("synclab.rack.height", String(rackHRef.current));
      } catch {
        /* storage unavailable */
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const rackHRef = useRef(rackH);
  rackHRef.current = rackH;
  const drumTrack = selected?.kind === "drum" ? selected : tracks.find((t) => t.kind === "drum");
  const pianoTrack = selected?.patch ? selected : tracks.find((t) => t.patch);
  const synthTrack = selected?.patch && selected.kind !== "sampler" ? selected : tracks.find((t) => t.patch && t.kind !== "sampler");
  if (!panel) return null;

  const config: Record<Exclude<PanelId, null>, { title: string; icon: React.ReactNode }> = {
    mixer: { title: "MIXER", icon: <SlidersHorizontal className="size-4" /> },
    synth: { title: "SYNTH", icon: <Music2 className="size-4" /> },
    drums: { title: "DRUM MACHINE", icon: <Disc3 className="size-4" /> },
    piano: { title: "PIANO ROLL", icon: <Piano className="size-4" /> },
    settings: { title: "SETTINGS", icon: <Settings2 className="size-4" /> },
    keys: { title: "KEYBOARD", icon: <KeyboardMusic className="size-4" /> },
    browser: { title: "BROWSER", icon: <FolderOpen className="size-4" /> },
    plugins: { title: "PLUGINS", icon: <Cpu className="size-4" /> },
    appearance: { title: "APPEARANCE & THEMES", icon: <Palette className="size-4" /> },
    sampler: { title: "SAMPLER", icon: <AudioLines className="size-4" /> },
    pads: { title: "PAD SAMPLER", icon: <Grid2x2 className="size-4" /> },
    mastering: { title: "MASTERING", icon: <Gauge className="size-4" /> },
    notes: { title: "TRACK NOTES", icon: <NotebookPen className="size-4" /> },
    reference: { title: "REFERENCE ANALYZER", icon: <FileSearch className="size-4" /> },
    live: { title: "LIVE VIEW", icon: <Radio className="size-4" /> },
    looper: { title: "LIVE LOOPER", icon: <Disc3 className="size-4" /> },
    apps: { title: "OTHER APPS", icon: <Cpu className="size-4" /> },
    humbeat: { title: "HUM TO BEAT", icon: <Radio className="size-4" /> },
    stems: { title: "SEPARATE STEMS", icon: <Split className="size-4" /> },
    coproducer: { title: "AI CO-PRODUCER", icon: <Sparkles className="size-4" /> },
    voice: { title: "CONVERT VOICE", icon: <AudioWaveform className="size-4" /> },
    genstem: { title: "GENERATE STEM", icon: <Sparkles className="size-4" /> },
    bassgen: { title: "BASS GENERATOR", icon: <AudioLines className="size-4" /> },
    "reel-recorder": { title: "REEL-TO-REEL RECORDER", icon: <Disc3 className="size-4" /> },
    "video-sampler": { title: "VIDEO SAMPLER", icon: <Film className="size-4" /> },
    "studio-view": { title: "STUDIO VIEW", icon: <Music2 className="size-4" /> },
  };
  const current = config[panel];


  return (
    <section
      className="phone-tool-panel rack fixed inset-0 z-40 flex min-w-0 flex-col overflow-x-hidden border-t-2 border-border sm:relative sm:inset-auto sm:z-auto sm:min-h-[240px]"
       style={{ height: isMobile ? "100dvh" : panel === "looper" || panel === "reel-recorder" || panel === "studio-view" ? Math.max(600, rackH) : rackH }}
    >
      <div
        onPointerDown={startResize}
        title="Drag to resize this editor"
        className="absolute inset-x-0 -top-1 z-20 h-2 cursor-ns-resize hover:bg-primary/40"
      />
      <div className="flex min-h-14 items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-1.5">
        <span className="shrink-0 text-primary">{current.icon}</span>
        <h2 className="min-w-0 flex-1 truncate font-display text-sm font-semibold tracking-[0.12em] sm:text-[11px] sm:tracking-[0.2em]">
          {current.title}
          {(panel === "synth" ? synthTrack : selected) && <span className="ml-2 hidden label-xs sm:inline">· {(panel === "synth" ? synthTrack : selected)?.name}</span>}
        </h2>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!isMobile && ((panel === "synth" && selected?.kind !== "sampler") || panel === "drums") && (
            <Button
              size="sm"
              variant="ghost"
               className="h-11 gap-1.5 px-2 font-mono text-[10px] tracking-widest uppercase sm:h-7"
              onClick={() => {
                const key = panel === "synth" ? "synth" : "drums";
                setFloat((f) => ({ ...f, [key]: !f[key] }));
                setPanel(null);
              }}
            >
              <ArrowUpFromLine className="size-3.5" />
              {float[panel === "synth" ? "synth" : "drums"] ? "Hide hardware" : "Hardware panel"}
            </Button>
          )}
          {(["mixer", "drums", "keys", "synth", "live", "looper", "pads"] as PanelId[]).includes(panel) && (!isMobile || (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches)) && (
            <Button
              size="sm"
              variant="ghost"
              title="Open in its own window — drag it to your second monitor"
              className="h-11 gap-1.5 px-2 font-mono text-[10px] tracking-widest uppercase sm:h-7"
              onClick={() => {
                if (popOutPanel(panel as DetachId)) setPanel(null);
                else toast.error("Window blocked", { description: "Allow pop-ups for SYNCLAB in your browser, then try Pop out again." });
              }}
            >
              <ArrowUpFromLine className="size-3.5" />
              Pop out
            </Button>
          )}
          {panel !== "mixer" && <QuickNotes label={!isMobile} className="h-11 sm:h-7" />}
          <Button size="icon" variant="secondary" className="size-12 sm:size-7" onClick={() => setPanel(null)} aria-label="Close editor">
            <X className="size-6 sm:size-4" />
          </Button>
        </div>
      </div>
      {panel === "studio-view" ? <StudioView /> : isMobile ? <PhonePages name={current.title}><div className="phone-editor-content min-h-0 space-y-3 p-3">
        {panel === "reel-recorder" && <ReelRecorder />}{panel === "video-sampler" && <VideoSampler />}
        {panel === "mixer" && <Mixer />}
        {panel === "synth" && (synthTrack ? <SynthEditor track={synthTrack} /> : <p>Select an instrument track.</p>)}
        {panel === "drums" && (drumTrack ? <DrumMachine track={drumTrack} /> : <p>Add a drum track.</p>)}
        {panel === "piano" && (selected?.kind === "drum" ? <DrumRoll track={selected} /> : pianoTrack ? <PianoRoll track={pianoTrack} /> : drumTrack ? <DrumRoll track={drumTrack} /> : <p>Select an instrument, MIDI or drum track.</p>)}
        {panel === "settings" && <Settings />}{panel === "keys" && <Keyboard />}{panel === "browser" && <Browser />}
        {panel === "plugins" && <PluginRack />}{panel === "appearance" && <Appearance />}{panel === "sampler" && <Sampler />}
        {panel === "pads" && <PadSampler />}{panel === "mastering" && <Mastering />}{panel === "notes" && <NotesPanel />}
        {panel === "reference" && <ReferenceAnalyzer />}{panel === "live" && <LiveView />}{panel === "looper" && <LiveLooperView />}{panel === "apps" && <ExternalApps />}{panel === "humbeat" && <ToolErrorBoundary name="Hum to Beat"><HumToBeat /></ToolErrorBoundary>}{panel === "stems" && <ToolErrorBoundary name="Separate Stems"><StemSplitter /></ToolErrorBoundary>}{panel === "coproducer" && <ToolErrorBoundary name="AI Co-Producer"><CoProducer /></ToolErrorBoundary>}{panel === "voice" && <ToolErrorBoundary name="Convert Voice"><VoiceConverter /></ToolErrorBoundary>}{panel === "genstem" && <ToolErrorBoundary name="Generate Stem"><StemGenerator /></ToolErrorBoundary>}{panel === "bassgen" && <ToolErrorBoundary name="Bass Generator"><BassGenerator /></ToolErrorBoundary>}
      </div></PhonePages> : <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 pb-24 sm:pb-3">
      {panel === "reel-recorder" && <ReelRecorder />}{panel === "video-sampler" && <VideoSampler />}
      {panel === "mixer" && <Mixer />}
      {panel === "synth" &&
        (synthTrack ? (
          <>
            <p className="label-xs mb-3">Editing {synthTrack.name}</p>
            <SynthEditor track={synthTrack} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Add an instrument track to open the synthesizer.</p>
        ))}
      {panel === "drums" &&
        (drumTrack ? (
          <DrumMachine track={drumTrack} />
        ) : (
          <p className="text-sm text-muted-foreground">Add a drum machine track to program a beat.</p>
        ))}
      {panel === "piano" &&
        // a drum track has no melodic notes, so it opens the drum roll instead
        (selected?.kind === "drum" || (!pianoTrack && drumTrack) ? (
          <div className="space-y-2">
            <DrumRoll track={(selected?.kind === "drum" ? selected : drumTrack)!} />
            <MidiLearnStrip
              id={(selected?.kind === "drum" ? selected : drumTrack)!.id}
              label={(selected?.kind === "drum" ? selected : drumTrack)!.name}
            />
          </div>
        ) : pianoTrack ? (
          <div className="space-y-2">
            <PianoRoll track={pianoTrack} />
            <MidiLearnStrip id={pianoTrack.id} label={pianoTrack.name} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select an instrument, MIDI or drum track to edit its notes.</p>
        ))}
      {panel === "settings" && <Settings />}
      {panel === "keys" && <Keyboard />}
      {panel === "browser" && <Browser />}
      {panel === "plugins" && <PluginRack />}
      {panel === "appearance" && <Appearance />}
      {panel === "sampler" && <Sampler />}
      {panel === "pads" && <PadSampler />}
      {panel === "mastering" && <Mastering />}
      {panel === "notes" && <NotesPanel />}
      {panel === "reference" && <ReferenceAnalyzer />}
      {panel === "live" && <LiveView />}
      {panel === "looper" && <LiveLooperView />}
      {panel === "apps" && <ExternalApps />}{panel === "humbeat" && <ToolErrorBoundary name="Hum to Beat"><HumToBeat /></ToolErrorBoundary>}{panel === "stems" && <ToolErrorBoundary name="Separate Stems"><StemSplitter /></ToolErrorBoundary>}{panel === "coproducer" && <ToolErrorBoundary name="AI Co-Producer"><CoProducer /></ToolErrorBoundary>}{panel === "voice" && <ToolErrorBoundary name="Convert Voice"><VoiceConverter /></ToolErrorBoundary>}{panel === "genstem" && <ToolErrorBoundary name="Generate Stem"><StemGenerator /></ToolErrorBoundary>}{panel === "bassgen" && <ToolErrorBoundary name="Bass Generator"><BassGenerator /></ToolErrorBoundary>}

      </div>}

      {selected && (
        <div className="editor-track-actions flex flex-nowrap items-center gap-1 overflow-x-auto whitespace-nowrap border-t border-border bg-surface/60 px-3 py-1 [&>*]:shrink-0">
          <span className="label-xs self-center">Selected: {selected.name}</span>
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setPanel(selected.kind === "drum" ? "drums" : selected.kind === "sampler" ? "sampler" : "synth")}>
            Open editor
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setPanel("piano")}>
            Piano roll
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => { select(selected.id); openTrackSettings(selected.id); }}>
            Track settings
          </Button>
        </div>
      )}
    </section>
  );
}

function StatusBar() {
  const { tracks, transport, panel, savedAt } = useStudio();
  const [engine, setEngine] = useState<{ state: string; rate: number; latency: number }>({
    state: "idle",
    rate: 48000,
    latency: 0,
  });

  useEffect(() => {
    const read = () => {
      const ctx = (getEngine() as unknown as { ctx?: AudioContext }).ctx;
      setEngine({
        state: ctx?.state ?? "idle",
        rate: ctx?.sampleRate ?? 48000,
        latency: Math.round(((ctx?.baseLatency ?? 0) + (ctx?.outputLatency ?? 0)) * 1000),
      });
    };
    read();
    const id = window.setInterval(read, 2000);
    return () => window.clearInterval(id);
  }, []);

  const live = engine.state === "running";
  const saved = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-border bg-surface-2/60 px-3 py-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
      <span className={transport.recording ? "text-destructive" : transport.playing ? "text-primary" : ""}>
        {transport.recording ? "● REC" : transport.playing ? "▶ PLAY" : "■ STOP"}
      </span>
      <span title="Audio engine status" className={live ? "text-primary" : ""}>
        ENGINE {live ? "LIVE" : engine.state === "suspended" ? "ASLEEP" : "IDLE"}
      </span>
      <span title="Sample rate">{(engine.rate / 1000).toFixed(1)} kHz</span>
      <span title="Round-trip latency reported by the browser">{engine.latency} ms</span>
      <span>{transport.bpm} BPM</span>
      <span>{transport.beatsPerBar ?? 4}/4</span>
      <span>{tracks.length} CH</span>
      <span>
        BAR {barBeat(transport.step).bar}.{barBeat(transport.step).beat} / {transport.bars ?? 4}
      </span>
      <span className="hidden sm:inline">{saved ? `SAVED ${saved}` : "NOT SAVED YET"}</span>
      <span className="ml-auto hidden sm:inline">{panel ? `${panel} editor open` : "synclab studio"}</span>
    </footer>
  );
}

function FloatingDevices({ float, setFloat }: { float: FloatState; setFloat: (f: (p: FloatState) => FloatState) => void }) {
  const { selected, tracks } = useStudio();
  const drumTrack = selected?.kind === "drum" ? selected : tracks.find((t) => t.kind === "drum");
  const synthTrack = selected?.patch ? selected : tracks.find((t) => t.patch);
  return (
    <>
      {float.synth && synthTrack && (
        <FloatingDevice
          title={`SYNTHESIZER · ${synthTrack.name}`}
          faceplate={synthFace}
          initial={{ x: 90, y: 80, w: 1020, h: 540 }}
          onClose={() => setFloat((f) => ({ ...f, synth: false }))}
        >
          <SynthEditor track={synthTrack} />
        </FloatingDevice>
      )}
      {float.drums && drumTrack && (
        <FloatingDevice
          title={`DRUM MACHINE · ${drumTrack.name}`}
          faceplate={drumFace}
          initial={{ x: 160, y: 150, w: 1020, h: 520 }}
          onClose={() => setFloat((f) => ({ ...f, drums: false }))}
        >
          <DrumMachine track={drumTrack} />
        </FloatingDevice>
      )}
    </>
  );
}

/** Global DAW keyboard shortcuts. */
function useShortcuts() {
  const { togglePlay, toggleRecord, stop, selected, duplicateTrack, removeTrack, setPanel, copyTrack, cutTrack, pasteTrack, copyClip, cutClip, pasteClip, clipClipboardName, selectAll, splitAtPlayhead, setEditTool, undo, redo, tracks, previewNote, transport, setTransport, updateTrack } =
    useStudio();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      // a panel (e.g. pad sampler keys) already played this key
      if (e.defaultPrevented) return;
      // Typing keys play the armed (or selected) instrument, like a DAW's computer MIDI keyboard.
      if (!e.metaKey && !e.ctrlKey && !e.altKey && qwertyEnabled()) {
        const isPlayable = (t?: { kind: string } | null) => !!t && (t.kind === "instrument" || t.kind === "midi" || t.kind === "sampler");
        const target = tracks.find((t) => t.armed && isPlayable(t)) ?? (selected && isPlayable(selected) ? selected : undefined);
        const k = e.key.toLowerCase();
        if (target && (k in QWERTY_MAP || k === "z" || k === "x")) {
          e.preventDefault();
          if (e.repeat) return;
          if (k === "z") { setQwertyOctave(qwertyOctave() - 1); toast(`Typing keys octave C${qwertyOctave()}`); return; }
          if (k === "x") { setQwertyOctave(qwertyOctave() + 1); toast(`Typing keys octave C${qwertyOctave()}`); return; }
          previewNote(target.id, (qwertyOctave() + 1) * 12 + QWERTY_MAP[k]!);
          return;
        }
      }
      const meta = e.metaKey || e.ctrlKey;
      if (meta) {
        const k = e.key.toLowerCase();
        if (k === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (k === "y") {
          e.preventDefault();
          redo();
        } else if (k === "d" && selected) {
          e.preventDefault();
          duplicateTrack(selected.id);
        } else if (k === "c" && selected) {
          e.preventDefault();
          const clip = selected.clips?.find((c) => c.id === selected.activeClipId);
          if (clip) copyClip(selected.id, clip.id);
          else copyTrack(selected.id);
        } else if (k === "x" && selected) {
          e.preventDefault();
          const clip = selected.clips?.find((c) => c.id === selected.activeClipId);
          if (clip) cutClip(selected.id, clip.id);
          else cutTrack(selected.id);
        } else if (k === "v") {
          e.preventDefault();
          if (clipClipboardName) pasteClip();
          else pasteTrack();
        } else if (k === "a") {
          e.preventDefault();
          selectAll();
        } else if (k === "s") {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent("synclab:cloud-save"));
        }
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "r":
        case "R":
          e.preventDefault();
          toggleRecord();
          break;
        case "s":
        case "S":
          e.preventDefault();
          splitAtPlayhead();
          break;
        case "v":
        case "V":
          setEditTool("select");
          break;
        case "b":
        case "B":
          setEditTool("draw");
          toast("Draw tool", { description: "Click a note or drum lane to write or erase a hit." });
          break;
        case "c":
        case "C":
          setEditTool("split");
          toast("Split tool", { description: "Click an audio clip to cut it right there." });
          break;
        case "t":
        case "T":
          setEditTool("razor");
          toast("Razor tool", { description: "Click inside a clip to slice it exactly where you click." });
          break;
        case "l":
        case "L":
          e.preventDefault();
          setTransport({ loop: !transport.loop });
          toast(transport.loop ? "Loop off" : "Loop on");
          break;
        case "m":
        case "M":
          if (selected) {
            e.preventDefault();
            updateTrack(selected.id, { muted: !selected.muted });
            toast(selected.muted ? `${selected.name} unmuted` : `${selected.name} muted`);
          }
          break;
        case "q":
        case "Q":
          e.preventDefault();
          window.dispatchEvent(new Event("synclab:quantize"));
          break;
        case "Home":
          e.preventDefault();
          setTransport({ step: 0 });
          break;
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          const amount = e.shiftKey ? 1 : 4;
          const total = Math.max(0, songSteps(transport.bars) - 1);
          const step = Math.min(total, Math.max(0, transport.step + dir * amount));
          setTransport({ step });
          break;
        }
        case "Escape":
          stop();
          break;
        case "Delete":
        case "Backspace":
          if (selected) {
            e.preventDefault();
            removeTrack(selected.id);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleRecord, stop, selected, duplicateTrack, removeTrack, setPanel, copyTrack, cutTrack, pasteTrack, copyClip, cutClip, pasteClip, clipClipboardName, selectAll, splitAtPlayhead, setEditTool, undo, redo, tracks, previewNote, transport, setTransport, updateTrack]);
}

function StudioWorkspace() {
  const isMobile = useIsMobile();
  const { panel } = useStudio();
  const mobileAccessibility = useMobileAccessibility();
  const [float, setFloat] = useState<FloatState>({ synth: false, drums: false });
  const [beatMode, setBeatMode] = useState(false);
  const [mobileView, setMobileView] = useState<"create" | "edit">("create");
  const landscape = useIsLandscapePhone();
  const [landscapeTools, setLandscapeTools] = useState(false);
  const [moreSignal, setMoreSignal] = useState(0);
  useEffect(() => { if (landscape) setMobileView("edit"); }, [landscape]);
  useShortcuts();
  useEffect(() => { if (panel) setBeatMode(false); }, [panel]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("mobile-controls-xl", isMobile && mobileAccessibility.extraLargeControls);
    root.classList.toggle("mobile-text-xl", isMobile && mobileAccessibility.increasedText);
    root.classList.toggle("mobile-high-contrast", isMobile && mobileAccessibility.highContrast);
    return () => root.classList.remove("mobile-controls-xl", "mobile-text-xl", "mobile-high-contrast");
  }, [isMobile, mobileAccessibility]);
  if (isMobile) return <>
    <PhoneStudio><Panels float={float} setFloat={setFloat} /></PhoneStudio>
    <TrackSettingsDialog /><DeviceSetup /><ExportDialog />
  </>;
  return (
    <div className={`flex h-[100dvh] flex-col overflow-hidden ${landscape ? "landscape-prod" : ""} ${landscape && landscapeTools ? "landscape-tools" : ""} ${isMobile ? "mobile-studio" : ""} ${isMobile && mobileAccessibility.extraLargeControls ? "mobile-controls-xl" : ""} ${isMobile && mobileAccessibility.increasedText ? "mobile-text-xl" : ""} ${isMobile && mobileAccessibility.highContrast ? "mobile-high-contrast" : ""}`}>
      {!isMobile && <MenuBar />}
      {!isMobile && <TopBar />}
      <div className="flex min-h-0 flex-1">
        {!isMobile && <ToolsRail />}
        {landscape && <MobileNav landscape toolsOpen={landscapeTools} onToggleTools={() => setLandscapeTools((v) => !v)} onBeatMode={() => setBeatMode(true)} view={mobileView} setView={setMobileView} moreSignal={moreSignal} />}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {isMobile && mobileView === "edit" && !panel && <TopBar />}
          {isMobile && mobileView === "create" && !panel && !beatMode && <MobileCreate onBeatMode={() => setBeatMode(true)} onMore={() => setMoreSignal((n) => n + 1)} />}
          <h1 className="sr-only">SYNCLAB Studio — browser digital audio workstation</h1>
          <Timeline />
          <Panels float={float} setFloat={setFloat} />
          <DetachedPanels />
          {(!isMobile || !panel) && <DeviceBar />}
        </main>
      </div>
      <TrackSettingsDialog />
      {landscape ? null : isMobile ? <MobileNav onBeatMode={() => setBeatMode(true)} view={mobileView} setView={setMobileView} moreSignal={moreSignal} /> : <StatusBar />}
      <FloatingDevices float={float} setFloat={setFloat} />
      <DeviceSetup />
      <ExportDialog />
      {isMobile && beatMode && !panel && <MobileBeat onClose={() => setBeatMode(false)} />}
      <MobileOnboarding enabled={isMobile && !beatMode} />
      <DesktopUpdateBanner />
      <DesktopWebsiteStatus />
    </div>
  );
}

function Stages() {
  const { stage } = useApp();
  const isMobile = useIsMobile();
  return (
    <PlanProvider>
      <SplashScreen />
      <HelpCenter />
      {stage === "welcome" && (isMobile ? <div className="phone-console phone-entry flex h-[100dvh] flex-col overflow-hidden"><PhonePages name="Sign in"><WelcomeScreen /></PhonePages></div> : <WelcomeScreen />)}
      {stage === "start" && (isMobile ? <div className="phone-console phone-entry flex h-[100dvh] flex-col overflow-hidden"><PhonePages name="Projects"><StartScreen /></PhonePages></div> : <StartScreen />)}
      {stage === "studio" && <StudioWorkspace />}
    </PlanProvider>
  );
}

function Studio() {
  // During hot reloads the root provider can briefly be a stale module copy;
  // mount a local provider in that case instead of crashing the page.
  const app = useMaybeApp();
  if (app) return <Stages />;
  return (
    <AppProvider>
      <Stages />
    </AppProvider>
  );
}
