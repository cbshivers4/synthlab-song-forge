import {
  Cpu,
  AudioLines,
  Circle,
  Disc3,
  Download,
  FolderOpen,
  Hash,
  Headphones,
  Import,
  KeyboardMusic,
  Layers,
  Mic,
  Music2,
  Pause,
  Piano,
  Play,
  Plus,
  Repeat,
  Scissors,
  Settings2,
  SlidersHorizontal,
  Square,
  Timer,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";
import { INSTRUMENTS } from "@/lib/synclab/presets";
import { toast } from "sonner";
import { openExport } from "@/components/studio/ExportDialog";
import { StudioSearch } from "@/components/studio/StudioSearch";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
const synclabLogo = synclabLogoAsset.url;

export function TopBar() {
  const { transport, setTransport, togglePlay, toggleRecord, stop, addTrack, setPanel, panel } = useStudio();

  return (
    <header className="rack sticky top-0 z-30 shrink-0">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="flex items-center pr-1">
          <img
            src={synclabLogo}
            alt="SYNCLAB"
            width={1024}
            height={1024}
            className="h-9 w-auto max-w-36 rounded-[3px] object-cover"
          />
        </div>

        <StudioSearch />

        <div className="flex items-center gap-0.5 rounded-[3px] border border-border bg-background/70 p-0.5 shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]">
          <TBtn label="PLAY" active={transport.playing} onClick={togglePlay}>
            {transport.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </TBtn>
          <TBtn label="STOP" onClick={stop}>
            <Square className="size-4" />
          </TBtn>
          <TBtn label="REC" danger active={transport.recording} onClick={toggleRecord}>
            <Circle className={`size-4 ${transport.recording ? "animate-pulse fill-current" : ""}`} />
          </TBtn>
        </div>

        {/* LCD position display */}
        <div className="flex items-stretch gap-3 rounded-[3px] border border-border bg-background px-3 py-1 font-mono shadow-[inset_0_1px_3px_oklch(0_0_0/0.6)]">
          {transport.countInLeft != null ? (
            <div>
              <span className="label-xs">COUNT-IN</span>
              <div className="animate-pulse text-base leading-none text-destructive">
                {Math.ceil(transport.countInLeft / 4)}.{((transport.countInLeft - 1) % 4) + 1}
              </div>
            </div>
          ) : (
            <div>
              <span className="label-xs">BAR.BEAT</span>
              <div className="text-base leading-none text-primary">
                {Math.floor(transport.step / 4) + 1}.{(transport.step % 4) + 1}
              </div>
            </div>
          )}
          <span className="w-px bg-border" />
          <div>
            <span className="label-xs">TIME</span>
            <div className="text-base leading-none text-primary">
              {(() => {
                const secs = (transport.step / 4) * (60 / transport.bpm);
                const m = Math.floor(secs / 60);
                const s = Math.floor(secs % 60);
                return `${m}:${String(s).padStart(2, "0")}`;
              })()}
            </div>
          </div>
          <span className="w-px bg-border" />
          <div>
            <span className="label-xs">BARS</span>
            <div className="text-base leading-none text-primary">{transport.bars ?? 4}</div>
          </div>
          <span className="w-px bg-border" />
          <div>
            <span className="label-xs">SIG</span>
            <div className="text-base leading-none text-muted-foreground">4/4</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-[3px] border border-border bg-background/70 px-3 py-1">
          <div>
            <span className="label-xs">BPM</span>
            <div className="font-mono text-base leading-none text-primary">{transport.bpm}</div>
          </div>
          <Slider
            className="w-24"
            value={[transport.bpm]}
            min={60}
            max={190}
            step={1}
            onValueChange={([v = 0]) => setTransport({ bpm: v })}
          />
          <div className="hidden sm:block">
            <span className="label-xs">Swing</span>
            <Slider
              className="w-20"
              value={[transport.swing]}
              min={0}
              max={0.6}
              step={0.01}
              onValueChange={([v = 0]) => setTransport({ swing: v })}
            />
          </div>
        </div>

        {/* Recording features — labelled like a DAW */}
        <div className="flex flex-wrap items-center gap-1 rounded-[3px] border border-border bg-background/70 p-1">
          <FeatBtn
            label="METRONOME"
            icon={<Timer className="size-3.5" />}
            active={transport.metronome}
            onClick={() => setTransport({ metronome: !transport.metronome })}
          />
          <FeatBtn
            label="COUNT-IN"
            icon={<Hash className="size-3.5" />}
            active={transport.countIn}
            onClick={() => setTransport({ countIn: !transport.countIn })}
          />
          <FeatBtn
            label="LOOP"
            icon={<Repeat className="size-3.5" />}
            active={transport.loop}
            onClick={() => setTransport({ loop: !transport.loop })}
          />
          <FeatBtn
            label="OVERDUB"
            icon={<Layers className="size-3.5" />}
            active={transport.overdub}
            onClick={() => setTransport({ overdub: !transport.overdub })}
          />
          <FeatBtn
            label="INPUT MON"
            icon={<Headphones className="size-3.5" />}
            active={transport.monitor}
            onClick={() => {
              const next = !transport.monitor;
              setTransport({ monitor: next });
              getEngine().setMonitoring(next);
            }}
          />
          <FeatBtn
            label={transport.punchIn == null ? "PUNCH IN" : `PUNCH OUT @${transport.punchIn + 1}`}
            icon={<Scissors className="size-3.5" />}
            active={transport.punchIn != null}
            onClick={() =>
              setTransport(
                transport.punchIn == null ? { punchIn: transport.step } : { punchOut: transport.step },
              )
            }
          />
        </div>

        <MidiControl />






        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            variant={panel === "browser" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPanel(panel === "browser" ? null : "browser")}
          >
            <FolderOpen className="size-4" /> BROWSER
          </Button>
          <Button
            variant={panel === "plugins" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPanel(panel === "plugins" ? null : "plugins")}
          >
            <Cpu className="size-4" /> PLUGINS
          </Button>
          <Button
            variant={panel === "drums" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPanel(panel === "drums" ? null : "drums")}
          >
            <Disc3 className="size-4" /> DRUMS
          </Button>
          <Button
            variant={panel === "synth" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPanel(panel === "synth" ? null : "synth")}
          >
            <Music2 className="size-4" /> INSTRUMENTS
          </Button>
          <Button
            variant={panel === "keys" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPanel(panel === "keys" ? null : "keys")}
          >
            <KeyboardMusic className="size-4" /> KEYS
          </Button>
          <Button
            variant={panel === "mixer" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPanel(panel === "mixer" ? null : "mixer")}
          >
            <SlidersHorizontal className="size-4" /> MIX
          </Button>
          <Button
            variant={panel === "vocal" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPanel(panel === "vocal" ? null : "vocal")}
          >
            <Mic className="size-4" /> VOCAL FORGE
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toast("Import instrumental", { description: "Drop a file on the timeline to analyse BPM, key and structure." })}>
            <Import className="size-4" /> IMPORT
          </Button>
          <Button variant="ghost" size="sm" onClick={openExport}>
            <Download className="size-4" /> EXPORT
          </Button>
          <Button
            variant={panel === "settings" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPanel(panel === "settings" ? null : "settings")}
          >
            <Settings2 className="size-4" /> SETTINGS
          </Button>
        </div>
      </div>
    </header>
  );
}

function TBtn({
  label,
  active,
  danger,
  onClick,
  children,
}: {
  label: string;
  active?: boolean | undefined;
  danger?: boolean | undefined;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      aria-label={label}
      aria-pressed={Boolean(active)}
      className={`h-10 flex-col gap-0.5 px-2.5 ${
        danger
          ? active
            ? "bg-destructive text-destructive-foreground shadow-[0_0_12px_color-mix(in_oklab,var(--destructive)_70%,transparent)] hover:bg-destructive/90"
            : "bg-destructive/15 text-destructive shadow-[inset_0_0_0_1px_var(--destructive)] hover:bg-destructive/25"
          : active
            ? "text-primary"
            : ""
      }`}
    >
      {children}
      <span className="font-mono text-[9px] tracking-wider">{label}</span>
    </Button>
  );
}

function FeatBtn({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean | undefined;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onClick}
      aria-pressed={Boolean(active)}
      className={`h-7 gap-1 px-2 font-mono text-[10px] tracking-wider ${
        active
          ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_var(--primary)]"
          : "text-muted-foreground"
      }`}
    >
      <span className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-border"}`} />
      {icon}
      {label}
    </Button>
  );
}

function MidiControl() {
  const { midiInputs, midiInputId, midiLearning, enableMidi, setMidiInput, tracks } = useStudio();
  const armedNote = tracks.find((t) => t.armed && (t.kind === "instrument" || t.kind === "midi"));

  return (
    <div className="flex items-center gap-1 rounded-[3px] border border-border bg-background/70 p-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={enableMidi}
        className={`h-7 gap-1 px-2 font-mono text-[10px] tracking-wider ${
          midiInputId ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_var(--primary)]" : "text-muted-foreground"
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${midiLearning ? "bg-destructive" : midiInputId ? "bg-primary" : "bg-border"}`}
        />
        <KeyboardMusic className="size-3.5" />
        MIDI IN
      </Button>

      {midiInputs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 max-w-40 truncate px-2 font-mono text-[10px] tracking-wider">
              {midiInputs.find((i) => i.id === midiInputId)?.name ?? "SELECT DEVICE"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="font-mono text-[10px] tracking-wider">
              CONTROLLER → {armedNote ? armedNote.name : "SELECTED INSTRUMENT"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {midiInputs.map((i) => (
              <DropdownMenuItem key={i.id} onClick={() => setMidiInput(i.id)}>
                {i.id === midiInputId ? "● " : "○ "}
                {i.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => setMidiInput("all")}>
              {midiInputId === "all" ? "● " : "○ "}ALL DEVICES
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setMidiInput(null)}>Disconnect</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
