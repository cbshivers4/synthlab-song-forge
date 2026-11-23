import type { CSSProperties } from "react";
import { usePlayStep } from "@/lib/synclab/playhead";
import { ToolErrorBoundary } from "@/components/studio/ToolErrorBoundary";
import { PhoneOrientation } from "@/components/studio/RotateGate";
import { Activity, useEffect, useRef, useState } from "react";
import { TrackSettingsDialog, openTrackSettings } from "@/components/studio/TrackSettingsDialog";
import { useShortcuts } from "@/components/studio/useShortcuts";
import { barBeat } from "@/lib/synclab/timebase";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { TEST_MODE, studioEntry } from "@/lib/synclab/test-mode";
import { TestModeBadge, TestModeHarness, TestModeOff } from "@/components/studio/TestMode";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  AudioLines,
  AudioWaveform,
  Cpu,
  Gauge,
  Disc3,
  FileSearch,
  FolderOpen,
  Grid2x2,
  KeyboardMusic,
  Music2,
  NotebookPen,
  Palette,
  Piano,
  Radio,
  SlidersHorizontal,
  Split,
  Rows2,
  Settings2,
  Sparkles,
  Waves,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { TimelineTopBar, TopBar } from "@/components/studio/TopBar";
import { Mastering } from "@/components/studio/Mastering";
import { NotesPanel } from "@/components/studio/TrackNotes";
import { Timeline } from "@/components/studio/Timeline";
import { Mixer } from "@/components/studio/Mixer";
import {
  DetachedWindow,
  popOutPanel,
  setDetached,
  useDetached,
  type DetachId,
} from "@/components/studio/MixerWindow";
import { AddSynthTrack, SynthEditor } from "@/components/studio/SynthEditor";
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
import { HardwareWindow } from "@/components/studio/HardwareWindow";
import { FloatingDevice } from "@/components/studio/FloatingDevice";
import { ScopeWindow } from "@/components/studio/ScopeWindow";
import { MenuBar } from "@/components/studio/MenuBar";
import { ProjectCloseGuard } from "@/components/studio/ProjectCloseGuard";
import { MidiClockFollow } from "@/components/studio/MidiClockFollow";
import {
  DEFAULT_MIXER_SHARE,
  clampMixerHeight,
  clampTimelineHeight,
  setWorkspacePrefs,
  useWorkspacePrefs,
} from "@/lib/synclab/workspace-prefs";
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
import { AppUpdateBanner } from "@/components/studio/AppUpdateBanner";
import { DesktopWebsiteStatus } from "@/components/studio/DesktopWebsiteStatus";
import { ReferenceAnalyzer } from "@/components/studio/ReferenceAnalyzer";
import { LiveView } from "@/components/studio/LiveView";
import { StudioAgentTools } from "@/components/studio/StudioAgentTools";
import { LiveLooperView } from "@/components/studio/LiveLooperView";
import { ExternalApps } from "@/components/studio/ExternalApps";
import { HumToBeat } from "@/components/studio/HumToBeat";
import { BassGenerator } from "@/components/studio/BassGenerator";
import { LiveDrummer, DrummerBridge } from "@/components/studio/LiveDrummer";
import { CollabBridge } from "@/components/studio/collab/CollabBridge";
import { LiveKeys, KeysBridge } from "@/components/studio/LiveKeys";
import { DjDecks } from "@/components/studio/DjDecks";
import { AmpRoom } from "@/components/studio/AmpRoom";
import { VoiceConverter } from "@/components/studio/VoiceConverter";
import { AudioConverter } from "@/components/studio/AudioConverter";
import { CoProducer } from "@/components/studio/CoProducer";
import { StemGenerator } from "@/components/studio/StemGenerator";
import { StemSplitter } from "@/components/studio/StemSplitter";
import { TapeCdRecorder } from "@/components/studio/TapeCdRecorder";
import { Bot, Film, Guitar } from "lucide-react";
import { VideoSampler } from "@/components/studio/VideoSampler";
import { StudioView } from "@/components/studio/StudioView";
import { AppProvider, useApp, useMaybeApp } from "@/lib/synclab/app-state";
import { PlanProvider, TestPlanProvider } from "@/lib/synclab/plan";
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
      { property: "og:url", content: "https://synclabsapp.com/" },
    ],
    links: [{ rel: "canonical", href: "https://synclabsapp.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "SYNCLAB",
          url: "https://synclabsapp.com/",
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
  const synthTrack =
    selected?.patch && selected.kind !== "sampler"
      ? selected
      : tracks.find((t) => t.patch && t.kind !== "sampler");
  const meta: Record<DetachId, { title: string; icon: React.ReactNode; body: React.ReactNode }> = {
    mixer: { title: "MIXER", icon: <SlidersHorizontal className="size-4" />, body: <Mixer /> },
    keys: { title: "KEYBOARD", icon: <KeyboardMusic className="size-4" />, body: <Keyboard /> },
    drums: {
      title: "DRUM MACHINE",
      icon: <Disc3 className="size-4" />,
      body: drumTrack ? (
        <DrumMachine track={drumTrack} />
      ) : (
        <p className="text-sm text-muted-foreground">Add a drum machine track to program a beat.</p>
      ),
    },
    synth: {
      title: selected?.kind === "sampler" ? "SAMPLER" : "SYNTH",
      icon: <Music2 className="size-4" />,
      body:
        selected?.kind === "sampler" ? (
          <Sampler />
        ) : synthTrack ? (
          <SynthEditor track={synthTrack} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Add an instrument track to open the synthesizer.
          </p>
        ),
    },
    live: { title: "LIVE VIEW", icon: <Radio className="size-4" />, body: <LiveView /> },
    looper: { title: "LIVE LOOPER", icon: <Disc3 className="size-4" />, body: <LiveLooperView /> },
    pads: { title: "PAD SAMPLER", icon: <Grid2x2 className="size-4" />, body: <PadSampler /> },
  };
  return (
    <>
      {ids.map((id) => (
        <DetachedWindow
          key={id}
          id={id}
          title={meta[id].title}
          onClose={() => setDetached(id, false)}
        >
          <div className="rack flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-1.5">
              <span className="text-primary">{meta[id].icon}</span>
              <h2 className="font-display text-[11px] font-semibold tracking-[0.2em]">
                {meta[id].title}
              </h2>
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
            <div
              className={`min-h-0 flex-1 p-3 ${
                id === "synth" && synthTrack && selected?.kind !== "sampler"
                  ? "flex flex-col overflow-hidden"
                  : "overflow-y-auto"
              }`}
            >
              {meta[id].body}
            </div>
          </div>
        </DetachedWindow>
      ))}
    </>
  );
}

/** Any crash in an open tool (or its header/notes) shows a message instead of the full-page error. */
/** Drag bar between the timeline and the open editor in split view; the height is remembered on this device. */
function SplitHandle() {
  const { timelineHeight } = useWorkspacePrefs();
  const begin = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const y0 = e.clientY,
      h0 = timelineHeight;
    const move = (ev: PointerEvent) =>
      setWorkspacePrefs({
        timelineHeight: clampTimelineHeight(h0 + ev.clientY - y0, window.innerHeight),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize timeline and editor"
      tabIndex={0}
      aria-valuenow={timelineHeight}
      onPointerDown={begin}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          setWorkspacePrefs({
            timelineHeight: clampTimelineHeight(
              timelineHeight + (e.key === "ArrowDown" ? 24 : -24),
              window.innerHeight,
            ),
          });
        }
      }}
      className="workspace-split-handle h-2 shrink-0 cursor-row-resize border-y border-border bg-surface-2 hover:bg-primary/40 focus-visible:bg-primary/40"
    />
  );
}

/** Drag bar above the docked mixer (Studio Pro style): drag up for a taller mixer, down for more timeline. */
function MixerDockHandle() {
  const { mixerHeight } = useWorkspacePrefs();
  const current = () => mixerHeight || Math.round(window.innerHeight * DEFAULT_MIXER_SHARE);
  const begin = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const y0 = e.clientY,
      h0 = current();
    const move = (ev: PointerEvent) =>
      setWorkspacePrefs({
        mixerHeight: clampMixerHeight(h0 - (ev.clientY - y0), window.innerHeight),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize timeline and mixer"
      title="Drag to resize the mixer"
      tabIndex={0}
      aria-valuenow={current()}
      onPointerDown={begin}
      onDoubleClick={() => setWorkspacePrefs({ mixerHeight: 0 })}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          setWorkspacePrefs({
            mixerHeight: clampMixerHeight(
              current() + (e.key === "ArrowUp" ? 24 : -24),
              window.innerHeight,
            ),
          });
        }
      }}
      className="mixer-dock-handle h-2 shrink-0 cursor-row-resize border-y border-border bg-surface-2 hover:bg-primary/40 focus-visible:bg-primary/40"
    />
  );
}

function SafePanels(props: {
  float: FloatState;
  setFloat: (f: (p: FloatState) => FloatState) => void;
}) {
  const { panel, setPanel } = useStudio();
  return (
    <ToolErrorBoundary
      key={panel ?? "none"}
      name={panel ? panel.replace(/-/g, " ") : "Tool"}
      onClose={() => setPanel(null)}
      className="fixed inset-x-2 top-2 z-50 bg-background sm:relative sm:inset-auto sm:m-3"
    >
      <Panels {...props} />
    </ToolErrorBoundary>
  );
}

function Panels({
  float,
  setFloat,
}: {
  float: FloatState;
  setFloat: (f: (p: FloatState) => FloatState) => void;
}) {
  const workspace = useWorkspacePrefs();
  const isMobile = useIsMobile();
  const { selected, tracks, panel, setPanel, select } = useStudio();
  const drumTrack = selected?.kind === "drum" ? selected : tracks.find((t) => t.kind === "drum");
  const pianoTrack = selected?.patch ? selected : tracks.find((t) => t.patch);
  const synthTrack =
    selected?.patch && selected.kind !== "sampler"
      ? selected
      : tracks.find((t) => t.patch && t.kind !== "sampler");
  if (!panel) return null;

  const config: Record<Exclude<PanelId, null>, { title: string; icon: React.ReactNode }> = {
    mixer: { title: "MIXER", icon: <SlidersHorizontal className="size-4" /> },
    synth: { title: "SYNTH", icon: <Music2 className="size-4" /> },
    drums: { title: "DRUM MACHINE", icon: <Disc3 className="size-4" /> },
    piano: { title: "PIANO ROLL", icon: <Piano className="size-4" /> },
    settings: { title: "SETTINGS", icon: <Settings2 className="size-4" /> },
    keys: { title: "KEYBOARD", icon: <KeyboardMusic className="size-4" /> },
    browser: { title: "BROWSER", icon: <FolderOpen className="size-4" /> },
    plugins: { title: "FX RACK", icon: <Cpu className="size-4" /> },
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
    "audio-converter": { title: "AUDIO CONVERTER", icon: <AudioLines className="size-4" /> },
    genstem: { title: "GENERATE STEM", icon: <Sparkles className="size-4" /> },
    bassgen: { title: "BASS GENERATOR", icon: <AudioLines className="size-4" /> },
    drummer: { title: "LIVE DRUMMER", icon: <Disc3 className="size-4" /> },
    livekeys: { title: "LIVE KEYS", icon: <Piano className="size-4" /> },
    dj: { title: "DJ DECKS", icon: <Disc3 className="size-4" /> },
    amprig: { title: "AMPS & PEDALS", icon: <Guitar className="size-4" /> },
    "reel-recorder": { title: "TAPE & CD RECORDER", icon: <Disc3 className="size-4" /> },
    "video-sampler": { title: "VIDEO SAMPLER", icon: <Film className="size-4" /> },
    "studio-view": { title: "STUDIO VIEW", icon: <Music2 className="size-4" /> },
  };
  const current = config[panel];

  return (
    <HardwareWindow
      id={panel}
      enabled={[
        "mixer",
        "synth",
        "drums",
        "keys",
        "plugins",
        "sampler",
        "pads",
        "mastering",
        "live",
        "looper",
        "reel-recorder",
        "video-sampler",
        "studio-view",
      ].includes(panel)}
    >
      {(windowControls) => (
        <>
          <div className="editor-panel-header flex min-h-14 items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-1.5">
            <span className="shrink-0 text-primary">{current.icon}</span>
            <h2 className="min-w-0 flex-1 truncate font-display text-sm font-semibold tracking-[0.12em] sm:text-[11px] sm:tracking-[0.2em]">
              {current.title}
              {(panel === "synth" ? synthTrack : selected) && (
                <span className="ml-2 hidden label-xs sm:inline">
                  · {(panel === "synth" ? synthTrack : selected)?.name}
                </span>
              )}
            </h2>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {windowControls}
              {!isMobile &&
                ((panel === "synth" && selected?.kind !== "sampler") || panel === "drums") && (
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
                    {float[panel === "synth" ? "synth" : "drums"]
                      ? "Hide hardware"
                      : "Hardware panel"}
                  </Button>
                )}
              {(
                ["mixer", "drums", "keys", "synth", "live", "looper", "pads"] as PanelId[]
              ).includes(panel) &&
                (!isMobile ||
                  (typeof window !== "undefined" &&
                    window.matchMedia("(pointer: fine)").matches)) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Open in its own window — drag it to your second monitor"
                    className="h-11 gap-1.5 px-2 font-mono text-[10px] tracking-widest uppercase sm:h-7"
                    onClick={() => {
                      if (popOutPanel(panel as DetachId)) setPanel(null);
                      else
                        toast.error("Window blocked", {
                          description:
                            "Allow pop-ups for SYNCLAB in your browser, then try Pop out again.",
                        });
                    }}
                  >
                    <ArrowUpFromLine className="size-3.5" />
                    Pop out
                  </Button>
                )}
              {!isMobile && panel === "mixer" && (
                <Button
                  size="sm"
                  variant={workspace.mixerDock ? "secondary" : "ghost"}
                  className="h-11 gap-1.5 px-2 font-mono text-[10px] tracking-widest uppercase sm:h-7"
                  aria-pressed={workspace.mixerDock}
                  title={
                    workspace.mixerDock
                      ? "Give the mixer the whole workspace"
                      : "Dock the mixer under the timeline (F3 shows or hides it)"
                  }
                  onClick={() => setWorkspacePrefs({ mixerDock: !workspace.mixerDock })}
                >
                  <Rows2 className="size-3.5" />{" "}
                  {workspace.mixerDock ? "Full view" : "Dock under timeline"}
                </Button>
              )}
              {!isMobile && panel !== "mixer" && (
                <Button
                  size="sm"
                  variant={workspace.split ? "secondary" : "ghost"}
                  className="h-11 gap-1.5 px-2 font-mono text-[10px] tracking-widest uppercase sm:h-7"
                  aria-pressed={workspace.split}
                  title={
                    workspace.split
                      ? "Give the editor the whole workspace"
                      : "Show the timeline above this editor (drag the bar between them to resize)"
                  }
                  onClick={() => setWorkspacePrefs({ split: !workspace.split })}
                >
                  <Rows2 className="size-3.5" /> {workspace.split ? "Full view" : "Split view"}
                </Button>
              )}
              {panel !== "mixer" && <QuickNotes label={!isMobile} className="h-11 sm:h-7" />}
              <Button
                size="icon"
                variant="secondary"
                className="size-12 sm:size-7"
                onClick={() => setPanel(null)}
                aria-label="Close editor"
              >
                <X className="size-6 sm:size-4" />
              </Button>
            </div>
          </div>
          {panel === "studio-view" ? (
            <StudioView />
          ) : isMobile ? (
            <PhonePages
              name={current.title}
              scrollbar={panel === "drummer" || panel === "livekeys" || panel === "dj"}
            >
              <div className="phone-editor-content min-h-0 space-y-3 p-3">
                {panel === "reel-recorder" && <TapeCdRecorder />}
                {panel === "video-sampler" && <VideoSampler />}
                {panel === "mixer" && <Mixer desktopLayout />}
                {panel === "synth" &&
                  (synthTrack ? <SynthEditor track={synthTrack} /> : <AddSynthTrack />)}
                {panel === "drums" &&
                  (drumTrack ? <DrumMachine track={drumTrack} /> : <AddDrumTrack />)}
                {panel === "piano" &&
                  (selected?.kind === "drum" ? (
                    <DrumRoll track={selected} />
                  ) : pianoTrack ? (
                    <PianoRoll track={pianoTrack} />
                  ) : drumTrack ? (
                    <DrumRoll track={drumTrack} />
                  ) : (
                    <p>Select an instrument, MIDI or drum track.</p>
                  ))}
                {panel === "settings" && <Settings />}
                {panel === "keys" && <Keyboard />}
                {panel === "browser" && <Browser />}
                {panel === "audio-converter" && <AudioConverter />}
                {panel === "plugins" && <PluginRack />}
                {panel === "appearance" && <Appearance />}
                {panel === "sampler" && <Sampler />}
                {panel === "pads" && <PadSampler />}
                {panel === "mastering" && <Mastering />}
                {panel === "notes" && <NotesPanel />}
                {panel === "reference" && <ReferenceAnalyzer />}
                {panel === "live" && <LiveView />}
                {panel === "looper" && <LiveLooperView />}
                {panel === "apps" && <ExternalApps />}
                {panel === "humbeat" && (
                  <ToolErrorBoundary name="Hum to Beat">
                    <HumToBeat />
                  </ToolErrorBoundary>
                )}
                {panel === "stems" && (
                  <ToolErrorBoundary name="Separate Stems">
                    {TEST_MODE ? <TestModeOff name="Separate Stems" /> : <StemSplitter />}
                  </ToolErrorBoundary>
                )}
                {panel === "coproducer" && (
                  <ToolErrorBoundary name="AI Co-Producer">
                    {TEST_MODE ? <TestModeOff name="AI Co-Producer" /> : <CoProducer />}
                  </ToolErrorBoundary>
                )}
                {panel === "voice" && (
                  <ToolErrorBoundary name="Convert Voice">
                    <VoiceConverter />
                  </ToolErrorBoundary>
                )}
                {panel === "genstem" && (
                  <ToolErrorBoundary name="Generate Stem">
                    {TEST_MODE ? <TestModeOff name="Generate Stem" /> : <StemGenerator />}
                  </ToolErrorBoundary>
                )}
                {panel === "bassgen" && (
                  <ToolErrorBoundary name="Bass Generator">
                    <BassGenerator />
                  </ToolErrorBoundary>
                )}
                {panel === "drummer" && (
                  <ToolErrorBoundary name="Live Drummer">
                    <LiveDrummer />
                  </ToolErrorBoundary>
                )}
                {panel === "livekeys" && (
                  <ToolErrorBoundary name="Live Keys">
                    <LiveKeys />
                  </ToolErrorBoundary>
                )}
                {panel === "dj" && (
                  <ToolErrorBoundary name="DJ Decks">
                    <DjDecks />
                  </ToolErrorBoundary>
                )}
                {panel === "amprig" && (
                  <ToolErrorBoundary name="Amp Room">
                    <AmpRoom />
                  </ToolErrorBoundary>
                )}
              </div>
            </PhonePages>
          ) : (
            <div
              className={`editor-body min-h-0 flex-1 p-3 ${
                panel === "synth" && synthTrack
                  ? "flex flex-col overflow-hidden"
                  : "space-y-3 overflow-y-auto pb-24 sm:pb-3"
              }`}
            >
              {panel === "reel-recorder" && <TapeCdRecorder />}
              {panel === "video-sampler" && <VideoSampler />}
              {panel === "mixer" && (
                <Mixer
                  dockControls={
                    workspace.mixerDock ? (
                      <span className="mixer-dock-controls ml-1 flex shrink-0 items-center gap-1 border-l border-border pl-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 gap-1 px-2 font-mono text-[9px] uppercase tracking-wider"
                          title="Show the effects and scope for the selected instrument instead of the mixer"
                          onClick={() => setPanel(null)}
                        >
                          <Piano className="size-3" /> Effects &amp; scope
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 gap-1 px-2 font-mono text-[9px] uppercase tracking-wider"
                          title="Open the mixer in its own window — drag it to your second monitor"
                          onClick={() => {
                            if (popOutPanel("mixer")) setPanel(null);
                            else
                              toast.error("Window blocked", {
                                description:
                                  "Allow pop-ups for SYNCLAB in your browser, then try Pop out again.",
                              });
                          }}
                        >
                          <ArrowUpFromLine className="size-3" /> Pop out
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 gap-1 px-2 font-mono text-[9px] uppercase tracking-wider"
                          title="Give the mixer the whole workspace"
                          onClick={() => setWorkspacePrefs({ mixerDock: false })}
                        >
                          <Rows2 className="size-3" /> Full view
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          aria-label="Close mixer"
                          title="Hide the mixer (F3)"
                          onClick={() => setPanel(null)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </span>
                    ) : undefined
                  }
                />
              )}
              {panel === "synth" &&
                (synthTrack ? <SynthEditor track={synthTrack} /> : <AddSynthTrack />)}
              {panel === "drums" &&
                (drumTrack ? (
                  <DrumMachine track={drumTrack} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Add a drum machine track to program a beat.
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    Select an instrument, MIDI or drum track to edit its notes.
                  </p>
                ))}
              {panel === "settings" && <Settings />}
              {panel === "keys" && <Keyboard />}
              {panel === "browser" && <Browser />}
              {panel === "audio-converter" && <AudioConverter />}
              {panel === "plugins" && <PluginRack />}
              {panel === "appearance" && <Appearance />}
              {panel === "sampler" && <Sampler />}
              {panel === "pads" && <PadSampler />}
              {panel === "mastering" && <Mastering />}
              {panel === "notes" && <NotesPanel />}
              {panel === "reference" && <ReferenceAnalyzer />}
              {panel === "live" && <LiveView />}
              {panel === "looper" && <LiveLooperView />}
              {panel === "apps" && <ExternalApps />}
              {panel === "humbeat" && (
                <ToolErrorBoundary name="Hum to Beat">
                  <HumToBeat />
                </ToolErrorBoundary>
              )}
              {panel === "stems" && (
                <ToolErrorBoundary name="Separate Stems">
                  {TEST_MODE ? <TestModeOff name="Separate Stems" /> : <StemSplitter />}
                </ToolErrorBoundary>
              )}
              {panel === "coproducer" && (
                <ToolErrorBoundary name="AI Co-Producer">
                  {TEST_MODE ? <TestModeOff name="AI Co-Producer" /> : <CoProducer />}
                </ToolErrorBoundary>
              )}
              {panel === "voice" && (
                <ToolErrorBoundary name="Convert Voice">
                  <VoiceConverter />
                </ToolErrorBoundary>
              )}
              {panel === "genstem" && (
                <ToolErrorBoundary name="Generate Stem">
                  {TEST_MODE ? <TestModeOff name="Generate Stem" /> : <StemGenerator />}
                </ToolErrorBoundary>
              )}
              {panel === "bassgen" && (
                <ToolErrorBoundary name="Bass Generator">
                  <BassGenerator />
                </ToolErrorBoundary>
              )}
              {panel === "drummer" && (
                <ToolErrorBoundary name="Live Drummer">
                  <LiveDrummer />
                </ToolErrorBoundary>
              )}
              {panel === "livekeys" && (
                <ToolErrorBoundary name="Live Keys">
                  <LiveKeys />
                </ToolErrorBoundary>
              )}
              {panel === "dj" && (
                <ToolErrorBoundary name="DJ Decks">
                  <DjDecks />
                </ToolErrorBoundary>
              )}
              {panel === "amprig" && (
                <ToolErrorBoundary name="Amp Room">
                  <AmpRoom />
                </ToolErrorBoundary>
              )}
            </div>
          )}

          {selected && (
            <div className="editor-track-actions flex flex-nowrap items-center gap-1 overflow-x-auto whitespace-nowrap border-t border-border bg-surface/60 px-3 py-1 [&>*]:shrink-0">
              <span className="label-xs self-center">Selected: {selected.name}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px]"
                onClick={() =>
                  setPanel(
                    selected.kind === "drum"
                      ? "drums"
                      : selected.kind === "sampler"
                        ? "sampler"
                        : "synth",
                  )
                }
              >
                Open editor
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px]"
                onClick={() => setPanel("piano")}
              >
                Piano roll
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px]"
                onClick={() => {
                  select(selected.id);
                  openTrackSettings(selected.id);
                }}
              >
                Track settings
              </Button>
            </div>
          )}
        </>
      )}
    </HardwareWindow>
  );
}

function StatusBar() {
  const liveStep = usePlayStep();
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
  const saved = savedAt
    ? new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-border bg-surface-2/60 px-3 py-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
      <span
        className={
          transport.recording ? "text-destructive" : transport.playing ? "text-primary" : ""
        }
      >
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
        BAR {barBeat(liveStep).bar}.{barBeat(liveStep).beat} / {transport.bars ?? 4}
      </span>
      <span className="hidden sm:inline">{saved ? `SAVED ${saved}` : "NOT SAVED YET"}</span>
      <span className="ml-auto hidden sm:inline">
        {panel ? `${panel} editor open` : "synclab studio"}
      </span>
    </footer>
  );
}

function FloatingDevices({
  float,
  setFloat,
}: {
  float: FloatState;
  setFloat: (f: (p: FloatState) => FloatState) => void;
}) {
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

function StudioWorkspace() {
  const isMobile = useIsMobile();
  const { panel } = useStudio();
  const workspace = useWorkspacePrefs();
  const mobileAccessibility = useMobileAccessibility();
  // Studio Pro layout: on a computer the mixer docks under the timeline unless the user chose Full view.
  const mixerDock = !isMobile && panel === "mixer" && workspace.mixerDock;
  const [float, setFloat] = useState<FloatState>({ synth: false, drums: false });
  const [beatMode, setBeatMode] = useState(false);
  const [mobileView, setMobileView] = useState<"create" | "edit">("create");
  const landscape = useIsLandscapePhone();
  const [landscapeTools, setLandscapeTools] = useState(false);
  const [moreSignal, setMoreSignal] = useState(0);
  useEffect(() => {
    if (landscape) setMobileView("edit");
  }, [landscape]);
  useShortcuts();
  useEffect(() => {
    if (panel) setBeatMode(false);
  }, [panel]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("mobile-controls-xl", isMobile && mobileAccessibility.extraLargeControls);
    root.classList.toggle("mobile-text-xl", isMobile && mobileAccessibility.increasedText);
    root.classList.toggle("mobile-high-contrast", isMobile && mobileAccessibility.highContrast);
    return () =>
      root.classList.remove("mobile-controls-xl", "mobile-text-xl", "mobile-high-contrast");
  }, [isMobile, mobileAccessibility]);
  // CSS hides the timeline as soon as an editor takes over; Activity pauses it a moment later, so a
  // timeline menu whose item opened the editor finishes its closing animation and unmounts first
  // (a hidden Activity disconnects that listener and would leave the menu stuck on screen).
  const timelineCovered = !isMobile && !!panel && !workspace.split && !mixerDock;
  const [timelineHidden, setTimelineHidden] = useState(timelineCovered);
  useEffect(() => {
    if (!timelineCovered) {
      setTimelineHidden(false);
      return;
    }
    // Wait until no menu is still playing its closing animation (checked a few times, then hide anyway).
    let tries = 0;
    let id = 0;
    const tryHide = () => {
      tries += 1;
      if (tries < 12 && document.querySelector('.app-menu[data-state="closed"]')) {
        id = window.setTimeout(tryHide, 150);
        return;
      }
      setTimelineHidden(true);
    };
    id = window.setTimeout(tryHide, 300);
    return () => window.clearTimeout(id);
  }, [timelineCovered]);
  if (isMobile)
    return (
      <>
        <PhoneStudio>
          <SafePanels float={float} setFloat={setFloat} />
        </PhoneStudio>
        <TrackSettingsDialog />
        <DeviceSetup />
        <ExportDialog />
        <MidiClockFollow />
        <DrummerBridge />
        <CollabBridge />
        <KeysBridge />
        <ScopeWindow />
        <StudioAgentTools />
      </>
    );
  return (
    <div
      className={`arrangement-workspace flex h-[100dvh] flex-col overflow-hidden ${landscape ? "landscape-prod" : ""} ${landscape && landscapeTools ? "landscape-tools" : ""} ${isMobile ? "mobile-studio" : ""} ${isMobile && mobileAccessibility.extraLargeControls ? "mobile-controls-xl" : ""} ${isMobile && mobileAccessibility.increasedText ? "mobile-text-xl" : ""} ${isMobile && mobileAccessibility.highContrast ? "mobile-high-contrast" : ""}`}
    >
      {!isMobile && <MenuBar />}
      <StudioAgentTools />
      <div className="flex min-h-0 flex-1">
        {!isMobile && <ToolsRail />}
        {landscape && (
          <MobileNav
            landscape
            toolsOpen={landscapeTools}
            onToggleTools={() => setLandscapeTools((v) => !v)}
            onBeatMode={() => setBeatMode(true)}
            view={mobileView}
            setView={setMobileView}
            moreSignal={moreSignal}
          />
        )}
        <main
          data-panel-full={
            !isMobile && panel && !workspace.split && !mixerDock ? "true" : undefined
          }
          data-panel-split={
            !isMobile && panel && workspace.split && !mixerDock ? "true" : undefined
          }
          data-mixer-dock={mixerDock ? "true" : undefined}
          style={
            mixerDock
              ? ({
                  "--dock-mixer-h": workspace.mixerHeight
                    ? `${workspace.mixerHeight}px`
                    : `${DEFAULT_MIXER_SHARE * 100}dvh`,
                } as CSSProperties)
              : !isMobile && panel && workspace.split
                ? ({ "--split-timeline-h": `${workspace.timelineHeight}px` } as CSSProperties)
                : undefined
          }
          className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {isMobile && mobileView === "edit" && !panel && <TopBar />}
          {isMobile && mobileView === "create" && !panel && !beatMode && (
            <MobileCreate
              onBeatMode={() => setBeatMode(true)}
              onMore={() => setMoreSignal((n) => n + 1)}
            />
          )}
          <h1 className="sr-only">SYNCLAB Studio — browser digital audio workstation</h1>
          {!isMobile && <TimelineTopBar />}
          {/* While an editor fills the workspace the timeline is hidden; Activity keeps its state but stops
              redrawing it on every edit, which otherwise stalled the page during playback. */}
          <Activity mode={timelineCovered && timelineHidden ? "hidden" : "visible"}>
            <Timeline />
          </Activity>
          {!isMobile && panel && workspace.split && !mixerDock && <SplitHandle />}
          {mixerDock && <MixerDockHandle />}
          <SafePanels float={float} setFloat={setFloat} />
          <DetachedPanels />
          {/* The device strip steps out for tools that own the whole workspace: mixer and studio view. */}
          {((!isMobile &&
            panel !== "mixer" &&
            panel !== "studio-view" &&
            panel !== "drums" &&
            panel !== "synth") ||
            (isMobile && !panel)) && <DeviceBar />}
        </main>
      </div>
      <TrackSettingsDialog />
      <DrummerBridge />
      <CollabBridge />
      <KeysBridge />
      {!isMobile && <TopBar />}
      {landscape ? null : isMobile ? (
        <MobileNav
          onBeatMode={() => setBeatMode(true)}
          view={mobileView}
          setView={setMobileView}
          moreSignal={moreSignal}
        />
      ) : (
        <StatusBar />
      )}
      <FloatingDevices float={float} setFloat={setFloat} />
      <ScopeWindow />
      <DeviceSetup />
      <ExportDialog />
      {isMobile && beatMode && !panel && <MobileBeat onClose={() => setBeatMode(false)} />}
      <MobileOnboarding enabled={isMobile && !beatMode} />
      <DesktopUpdateBanner />
      <AppUpdateBanner />
      <DesktopWebsiteStatus />
    </div>
  );
}

function Stages() {
  const { stage } = useApp();
  const isMobile = useIsMobile();
  return (
    <PlanProvider>
      <ProjectCloseGuard />
      <MidiClockFollow />
      <PhoneOrientation />
      <SplashScreen />
      <HelpCenter />
      {stage === "welcome" &&
        (isMobile ? (
          <div className="phone-console phone-entry flex h-[100dvh] flex-col overflow-hidden">
            <PhonePages name="Sign in">
              <WelcomeScreen />
            </PhonePages>
          </div>
        ) : (
          <WelcomeScreen />
        ))}
      {stage === "start" &&
        (isMobile ? (
          <div className="phone-console phone-entry flex h-[100dvh] flex-col overflow-hidden">
            <PhonePages name="Projects">
              <StartScreen />
            </PhonePages>
          </div>
        ) : (
          <StartScreen />
        ))}
      {stage === "studio" && <StudioWorkspace />}
    </PlanProvider>
  );
}

/** ?test=1 only: the studio with a local demo song, no sign-in, nothing saved or sent. */
function TestStages() {
  return (
    <TestPlanProvider>
      <TestModeHarness />
      <TestModeBadge />
      <PhoneOrientation />
      <HelpCenter />
      <StudioWorkspace />
    </TestPlanProvider>
  );
}

function Studio() {
  // The address is known on the server too, so ?test=1 renders a neutral frame there and on the
  // first browser render (no sign-in screen mounts), then the test studio once the browser has read the flag.
  const asked = useRouterState({
    select: (s) => String((s.location.search as Record<string, unknown>)["test"] ?? "") === "1",
  });
  const [booted, setBooted] = useState(false);
  useEffect(() => setBooted(true), []);
  // During hot reloads the root provider can briefly be a stale module copy;
  // mount a local provider in that case instead of crashing the page.
  const app = useMaybeApp();
  if (asked)
    return studioEntry(booted && TEST_MODE, "loading") === "test" ? (
      <TestStages />
    ) : (
      <div className="min-h-screen bg-background" />
    );
  if (app) return <Stages />;
  return (
    <AppProvider>
      <Stages />
    </AppProvider>
  );
}

function AddDrumTrack() {
  const { addTrack } = useStudio();
  return (
    <div className="flex flex-col items-start gap-3 p-4">
      <p className="text-sm text-muted-foreground">This song has no drum track yet.</p>
      <Button
        className="h-12"
        onClick={() => addTrack("drum", "DRUM MACHINE", undefined, { keepPanel: true })}
      >
        Add drum machine track
      </Button>
    </div>
  );
}
