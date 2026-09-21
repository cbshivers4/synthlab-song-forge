import {
  Cpu,
  AudioLines,
  Circle,
  Disc3,
  Download,
  FolderOpen,
  Grid2x2,
  Hash,
  Headphones,
  Import,
  KeyboardMusic,
  Layers,
  Mic,
  Minus,
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
  Menu,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { PlanBadge } from "@/lib/synclab/plan";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
const synclabLogo = synclabLogoAsset.url;

export function TopBar() {
  const isMobile = useIsMobile();
  const { transport, setTransport, togglePlay, toggleRecord, stop, addTrack, setPanel, panel } = useStudio();

  return (
    <header className="rack sticky top-0 z-30 shrink-0">
      <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-2 sm:flex sm:flex-wrap sm:px-3">
        <div className="hidden items-center pr-1 sm:flex">
          <img
            src={synclabLogo}
            alt="SYNCLAB"
            width={1024}
            height={1024}
            className="h-9 w-auto max-w-36 rounded-[3px] object-cover"
          />
        </div>

        <div className="hidden sm:block"><StudioSearch /></div>

        <div className="flex shrink-0 items-center gap-0.5 rounded-[3px] border border-border bg-background/70 p-0.5 shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]">
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
        <div className="flex min-w-0 items-stretch gap-2 rounded-[3px] border border-border bg-background px-2 py-1 font-mono shadow-[inset_0_1px_3px_oklch(0_0_0/0.6)] sm:gap-3 sm:px-3">
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
          {!isMobile && (
            <>
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
            </>
          )}
          <span className="hidden w-px bg-border sm:block" />
          <div className="hidden sm:block" title="Timeline length — click + to add bars (Shift = +16), up to 512">
            <span className="label-xs">BARS</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Fewer bars"
                className="rounded-[2px] px-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                disabled={(transport.bars ?? 4) <= 1}
                onClick={(e) => setTransport({ bars: Math.max(1, (transport.bars ?? 4) - (e.shiftKey ? 16 : 1)) })}
              >
                <Minus className="size-3" />
              </button>
              <span className="min-w-7 text-center text-base leading-none text-primary">{transport.bars ?? 4}</span>
              <button
                type="button"
                aria-label="More bars"
                className="rounded-[2px] px-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                disabled={(transport.bars ?? 4) >= 512}
                onClick={(e) => setTransport({ bars: Math.min(512, (transport.bars ?? 4) + (e.shiftKey ? 16 : 1)) })}
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>
          {!isMobile && (
            <>
              <span className="w-px bg-border" />
              <div>
                <span className="label-xs">SIG</span>
                <div className="text-base leading-none text-muted-foreground">4/4</div>
              </div>
            </>
          )}
        </div>

        <div className="hidden items-center gap-3 rounded-[3px] border border-border bg-background/70 px-3 py-1 sm:flex">
          <div>
            <span className="label-xs">BPM</span>
            <div className="font-mono text-base leading-none text-primary">{transport.bpm}</div>
          </div>
          <Slider
            className="w-16 sm:w-24"
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

        {!isMobile && (
          <div className="flex flex-wrap items-center gap-1 rounded-[3px] border border-border bg-background/70 p-1">
            <FeatBtn
              label="METRONOME"
              icon={<Timer className="size-3.5" />}
              active={transport.metronome}
              onClick={() => setTransport({ metronome: !transport.metronome })}
            />
            <FeatBtn
              label={transport.countIn ? `COUNT-IN ${transport.countInBars ?? 1}BAR` : "COUNT-IN"}
              icon={<Hash className="size-3.5" />}
              active={transport.countIn}
              onClick={() => setTransport({ countIn: !transport.countIn })}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Count-in length"
                  title="Count-in length"
                  className="h-7 px-1 font-mono text-[10px] tracking-wider text-muted-foreground"
                >
                  {transport.countInBars ?? 1}▾
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel className="font-mono text-[10px] tracking-wider">COUNT-IN LENGTH</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[1, 2, 4].map((b) => (
                  <DropdownMenuItem
                    key={b}
                    onClick={() => setTransport({ countIn: true, countInBars: b })}
                  >
                    {transport.countIn && (transport.countInBars ?? 1) === b ? "● " : "○ "}
                    {b} {b === 1 ? "bar" : "bars"}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTransport({ countIn: false })}>
                  {transport.countIn ? "○ " : "● "}Off
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        )}

        {!isMobile && <MidiControl />}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <PlanBadge />
          <Button
            variant="outline"
            size="icon"
            className={isMobile ? "size-11" : "size-8"}
            aria-label="Open SYNCLAB Help Center"
            title="SYNCLAB Help Center"
            onClick={() => openHelp("help")}
          >
            <LifeBuoy className={isMobile ? "size-5" : "size-4"} />
          </Button>
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-11" aria-label="Open studio panels">
                  <Menu className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Studio Panels</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPanel("browser")}>
                  <FolderOpen className="mr-2 size-4" /> Browser
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("plugins")}>
                  <Cpu className="mr-2 size-4" /> Plugins
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("drums")}>
                  <Disc3 className="mr-2 size-4" /> Drums
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("synth")}>
                  <Music2 className="mr-2 size-4" /> Instruments
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("keys")}>
                  <KeyboardMusic className="mr-2 size-4" /> Keys
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("mixer")}>
                  <SlidersHorizontal className="mr-2 size-4" /> Mixer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("vocal")}>
                  <Mic className="mr-2 size-4" /> Vocal Forge
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("pads")}>
                  <Grid2x2 className="mr-2 size-4" /> Sample Pads
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("hum")}>
                  <Waves className="mr-2 size-4" /> Hum to Beat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-mono text-[10px] tracking-wider">COUNT-IN</DropdownMenuLabel>
                {[1, 2, 4].map((b) => (
                  <DropdownMenuItem
                    key={b}
                    onClick={() => setTransport({ countIn: true, countInBars: b })}
                  >
                    <Hash className="mr-2 size-4" />
                    {transport.countIn && (transport.countInBars ?? 1) === b ? "● " : ""}
                    {b} {b === 1 ? "bar" : "bars"}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => setTransport({ countIn: false })}>
                  <Hash className="mr-2 size-4" />
                  {transport.countIn ? "" : "● "}Count-in off
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPanel("settings")}>
                  <Settings2 className="mr-2 size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openExport}>
                  <Download className="mr-2 size-4" /> Export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
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
            </>
          )}
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
