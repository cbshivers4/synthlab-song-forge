import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, Cpu, Disc3, FolderOpen, KeyboardMusic, Music2, Palette, Piano, SlidersHorizontal, Settings2, Waves, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import { TopBar } from "@/components/studio/TopBar";
import { Timeline } from "@/components/studio/Timeline";
import { Mixer } from "@/components/studio/Mixer";
import { MixerWindow } from "@/components/studio/MixerWindow";
import { SynthEditor } from "@/components/studio/SynthEditor";
import { DrumMachine } from "@/components/studio/DrumMachine";
import { PianoRoll } from "@/components/studio/PianoRoll";
import { VocalForge } from "@/components/studio/VocalForge";
import { Settings } from "@/components/studio/Settings";
import { Keyboard } from "@/components/studio/Keyboard";
import { Browser } from "@/components/studio/Browser";
import { SplashScreen } from "@/components/studio/SplashScreen";
import { PluginRack } from "@/components/studio/PluginRack";
import { FloatingDevice } from "@/components/studio/FloatingDevice";
import { MenuBar } from "@/components/studio/MenuBar";
import { ToolsRail } from "@/components/studio/ToolsRail";
import { Appearance } from "@/components/studio/Appearance";
import { WelcomeScreen } from "@/components/studio/WelcomeScreen";
import { StartScreen } from "@/components/studio/StartScreen";
import { DeviceSetup } from "@/components/studio/DeviceSetup";
import { AppProvider, useApp, useMaybeApp } from "@/lib/synclab/app-state";
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

function Panels({ float, setFloat }: { float: FloatState; setFloat: (f: (p: FloatState) => FloatState) => void }) {
  const { selected, tracks, panel, setPanel, select } = useStudio();
  const [mixerDetached, setMixerDetached] = useState(false);
  const drumTrack = selected?.kind === "drum" ? selected : tracks.find((t) => t.kind === "drum");
  const synthTrack = selected?.patch ? selected : tracks.find((t) => t.patch);
  if (!panel) return null;

  const config: Record<Exclude<PanelId, null>, { title: string; icon: React.ReactNode }> = {
    mixer: { title: "MIXER", icon: <SlidersHorizontal className="size-4" /> },
    synth: { title: "INSTRUMENT EDITOR", icon: <Music2 className="size-4" /> },
    drums: { title: "DRUM MACHINE", icon: <Disc3 className="size-4" /> },
    piano: { title: "PIANO ROLL", icon: <Piano className="size-4" /> },
    vocal: { title: "VOCAL FORGE", icon: <Waves className="size-4" /> },
    settings: { title: "SETTINGS", icon: <Settings2 className="size-4" /> },
    keys: { title: "KEYBOARD", icon: <KeyboardMusic className="size-4" /> },
    browser: { title: "BROWSER", icon: <FolderOpen className="size-4" /> },
    plugins: { title: "PLUGINS", icon: <Cpu className="size-4" /> },
    appearance: { title: "APPEARANCE & THEMES", icon: <Palette className="size-4" /> },
  };
  const current = config[panel];

  return (
    <section className="rack flex max-h-[52vh] min-h-[220px] shrink-0 flex-col border-t-2 border-border">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-1.5">
        <span className="text-primary">{current.icon}</span>
        <h2 className="font-display text-[11px] font-semibold tracking-[0.2em]">{current.title}</h2>
        {selected && <span className="label-xs">· {selected.name}</span>}
        <div className="ml-auto flex items-center gap-1">
          {(panel === "synth" || panel === "drums") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 font-mono text-[10px] tracking-widest uppercase"
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
          {panel === "mixer" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 font-mono text-[10px] tracking-widest uppercase"
              onClick={() => setMixerDetached((d) => !d)}
            >
              {mixerDetached ? <ArrowDownToLine className="size-3.5" /> : <ArrowUpFromLine className="size-3.5" />}
              {mixerDetached ? "Dock" : "Pop out"}
            </Button>
          )}
          <Button size="icon" variant="ghost" className="size-7" onClick={() => setPanel(null)} aria-label="Close editor">
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {panel === "mixer" &&
        (mixerDetached ? (
          <MixerWindow onClose={() => setMixerDetached(false)}>
            <div className="rack flex h-full flex-col">
              <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-1.5">
                <SlidersHorizontal className="size-4 text-primary" />
                <h2 className="font-display text-[11px] font-semibold tracking-[0.2em]">MIXER</h2>
                <span className="label-xs">· detached</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7 gap-1.5 font-mono text-[10px] tracking-widest uppercase"
                  onClick={() => setMixerDetached(false)}
                >
                  <ArrowDownToLine className="size-3.5" />
                  Dock
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <Mixer />
              </div>
            </div>
          </MixerWindow>
        ) : (
          <Mixer />
        ))}
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
        (synthTrack ? (
          <PianoRoll track={synthTrack} />
        ) : (
          <p className="text-sm text-muted-foreground">Select an instrument or MIDI track to edit its notes.</p>
        ))}
      {panel === "vocal" && <VocalForge />}
      {panel === "settings" && <Settings />}
      {panel === "keys" && <Keyboard />}
      {panel === "browser" && <Browser />}
      {panel === "plugins" && <PluginRack />}
      {panel === "appearance" && <Appearance />}

      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border bg-surface/60 px-3 py-1">
          <span className="label-xs self-center">Selected: {selected.name}</span>
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setPanel(selected.kind === "drum" ? "drums" : "synth")}>
            Open editor
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setPanel("piano")}>
            Piano roll
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => select(selected.id)}>
            Track settings
          </Button>
        </div>
      )}
    </section>
  );
}

function StatusBar() {
  const { tracks, transport, panel } = useStudio();
  return (
    <footer className="flex shrink-0 items-center gap-4 border-t border-border bg-surface-2/60 px-3 py-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
      <span className={transport.recording ? "text-destructive" : transport.playing ? "text-primary" : ""}>
        {transport.recording ? "● REC" : transport.playing ? "▶ PLAY" : "■ STOP"}
      </span>
      <span>{transport.bpm} BPM</span>
      <span>4/4</span>
      <span>{tracks.length} CH</span>
      <span>BAR {Math.floor(transport.step / 4) + 1}.{(transport.step % 4) + 1}</span>
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
  const { togglePlay, toggleRecord, stop, selected, duplicateTrack, removeTrack, setPanel, copyTrack, cutTrack, pasteTrack, selectAll, splitAtPlayhead, setEditTool } =
    useStudio();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta) {
        const k = e.key.toLowerCase();
        if (k === "d" && selected) {
          e.preventDefault();
          duplicateTrack(selected.id);
        } else if (k === "c" && selected) {
          e.preventDefault();
          copyTrack(selected.id);
        } else if (k === "x" && selected) {
          e.preventDefault();
          cutTrack(selected.id);
        } else if (k === "v") {
          e.preventDefault();
          pasteTrack();
        } else if (k === "a") {
          e.preventDefault();
          selectAll();
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
  }, [togglePlay, toggleRecord, stop, selected, duplicateTrack, removeTrack, setPanel, copyTrack, cutTrack, pasteTrack, selectAll, splitAtPlayhead, setEditTool]);
}

function StudioWorkspace() {
  const [float, setFloat] = useState<FloatState>({ synth: false, drums: false });
  useShortcuts();
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <MenuBar />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolsRail />
        <main className="flex min-h-0 flex-1 flex-col">
          <h1 className="sr-only">SYNCLAB Studio — browser digital audio workstation</h1>
          <Timeline />
          <Panels float={float} setFloat={setFloat} />
        </main>
      </div>
      <StatusBar />
      <FloatingDevices float={float} setFloat={setFloat} />
      <DeviceSetup />
    </div>
  );
}

function Stages() {
  const { stage } = useApp();
  return (
    <>
      <SplashScreen />
      {stage === "welcome" && <WelcomeScreen />}
      {stage === "start" && <StartScreen />}
      {stage === "studio" && <StudioWorkspace />}
    </>
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
