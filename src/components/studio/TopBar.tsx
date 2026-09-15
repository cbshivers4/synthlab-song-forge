import {
  AudioLines,
  Circle,
  Disc3,
  Download,
  Import,
  Mic,
  Music2,
  Pause,
  Piano,
  Play,
  Plus,
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
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex min-w-44 items-center pr-2">
          <img
            src={synclabLogo}
            alt="SYNCLAB"
            width={1024}
            height={1024}
            className="h-12 w-auto max-w-48 rounded-md object-cover"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <Button size="icon" variant="ghost" onClick={togglePlay} aria-label={transport.playing ? "Pause" : "Play"}>
            {transport.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={stop} aria-label="Stop">
            <Square className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleRecord}
            aria-label="Record"
            className={transport.recording ? "text-destructive" : ""}
          >
            <Circle className={`size-4 ${transport.recording ? "animate-pulse fill-current" : ""}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Metronome"
            className={transport.metronome ? "text-primary" : ""}
            onClick={() => setTransport({ metronome: !transport.metronome })}
          >
            <Timer className="size-4" />
          </Button>
          <span className="mx-1 h-6 w-px bg-border" />
          {(
            [
              ["LOOP", "loop"],
              ["DUB", "overdub"],
              ["CNT", "countIn"],
              ["MON", "monitor"],
            ] as const
          ).map(([label, key]) => (
            <Button
              key={key}
              size="sm"
              variant="ghost"
              className={`h-7 px-2 font-mono text-[10px] ${transport[key] ? "text-primary" : "text-muted-foreground"}`}
              aria-pressed={Boolean(transport[key])}
              onClick={() => {
                const next = !transport[key];
                setTransport({ [key]: next });
                if (key === "monitor") getEngine().setMonitoring(next);
              }}
            >
              {label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className={`h-7 px-2 font-mono text-[10px] ${transport.punchIn != null ? "text-primary" : "text-muted-foreground"}`}
            onClick={() =>
              setTransport(
                transport.punchIn == null
                  ? { punchIn: transport.step }
                  : { punchOut: transport.step },
              )
            }
          >
            {transport.punchIn == null ? "PUNCH IN" : `PUNCH OUT ${transport.punchIn + 1}`}
          </Button>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-1.5">
          <div>
            <span className="label-xs">BPM</span>
            <div className="font-mono text-base leading-none text-primary">{transport.bpm}</div>
          </div>
          <Slider
            className="w-28"
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
