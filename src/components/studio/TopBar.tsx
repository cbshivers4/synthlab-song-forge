import {
  AudioLines,
  Circle,
  Disc3,
  Download,
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
import synclabLogoAsset from "@/assets/synclab-logo.jpg.asset.json";
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
          <div>
            <span className="label-xs">BAR.BEAT</span>
            <div className="text-base leading-none text-primary">
              {Math.floor(transport.step / 4) + 1}.{(transport.step % 4) + 1}
            </div>
          </div>
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


        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="glow font-display font-semibold tracking-wide">
              <Plus className="size-4" /> ADD TRACK
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="label-xs">New channel</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => addTrack("audio", "AUDIO")}>
              <Mic className="size-4" /> Audio — mic, guitar, line in
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addTrack("instrument", "INSTRUMENT", "Cybotron Lead")}>
              <Music2 className="size-4" /> Instrument — software synth
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addTrack("drum", "DRUM MACHINE")}>
              <Disc3 className="size-4" /> Drum machine
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addTrack("sampler", "SAMPLER", "Metro Pluck")}>
              <AudioLines className="size-4" /> Sampler
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addTrack("ai-vocal", "AI VOCAL", "Vocoder Bot")}>
              <Waves className="size-4" /> AI vocal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addTrack("midi", "MIDI", "Deep Keys")}>
              <Piano className="size-4" /> MIDI channel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="label-xs">Instrument browser</DropdownMenuLabel>
            {INSTRUMENTS.map((group) => (
              <DropdownMenuItem
                key={group.category}
                onClick={() => addTrack("instrument", group.category, group.items[0])}
              >
                <span className="font-mono text-[11px] text-primary">{group.category}</span>
                <span className="text-muted-foreground">{group.items[0]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex flex-wrap items-center gap-1">
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
          <Button variant="ghost" size="sm" onClick={() => toast.success("Bounce queued", { description: "Your session will render to stereo WAV." })}>
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
      className={`h-10 flex-col gap-0.5 px-2.5 ${active ? (danger ? "text-destructive" : "text-primary") : ""}`}
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
