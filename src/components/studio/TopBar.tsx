import { getPlayStep, usePlayStep } from "@/lib/synclab/playhead";
import {
  LifeBuoy,
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
  Magnet,
  Mic,
  Minus,
  Music2,
  Pause,
  Palette,
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
  Undo2,
  Redo2,
} from "lucide-react";

import { requestBluetoothSettings } from "./Settings";
import {
  stepsPerBar,
  STEPS_PER_BEAT,
  METERS,
  getBeatsPerBar,
  songSteps,
  stepSeconds,
} from "@/lib/synclab/timebase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { useStudio } from "@/lib/synclab/store";
import { midiInputEnabled, selectedMidiInputs, toggleMidiInput } from "@/lib/synclab/midi";
import { getEngine } from "@/lib/synclab/audio-engine";
import { INSTRUMENTS } from "@/lib/synclab/presets";
import { toast } from "sonner";
import { openExport } from "@/components/studio/ExportDialog";
import { StudioSearch } from "@/components/studio/StudioSearch";
import { MidiLearnButton } from "@/components/studio/MidiLearn";
import { ControllerLibrary } from "@/components/studio/ControllerLibrary";
import { useIsMobile } from "@/hooks/use-mobile";
import { PlanBadge } from "@/lib/synclab/plan";
import { openHelp } from "@/components/studio/HelpCenter";
import { MasterMeter } from "@/components/studio/MasterMeter";
import { QuickNotes } from "@/components/studio/QuickNotes";
/** Phone BPM field: lets you type freely, then applies the tempo when it's a valid 60–190 or when you leave the field. */
function BpmInput({ bpm, onChange }: { bpm: number; onChange: (bpm: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const next = Math.round(Number(raw));
    if (Number.isFinite(next) && next >= 60 && next <= 190) onChange(next);
    setDraft(null);
  };
  return (
    <input
      aria-label="BPM"
      type="number"
      inputMode="numeric"
      min={60}
      max={190}
      value={draft ?? bpm}
      className="phone-bpm-input w-16 bg-transparent text-base tabular-nums text-primary"
      onFocus={(e) => {
        setDraft(String(bpm));
        e.target.select();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const next = Number(e.target.value);
        if (e.target.value.length >= 2 && Number.isFinite(next) && next >= 60 && next <= 190)
          onChange(next);
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit((e.target as HTMLInputElement).value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
import { IdeaRecorder } from "@/components/studio/IdeaRecorder";
import { PhonePages } from "./PhonePages";
import { useEffect, useRef, useState } from "react";
import { importAudioToSampler, AUDIO_IMPORT_ACCEPT } from "@/lib/synclab/import-audio";
import { SkipBack } from "lucide-react";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
const synclabLogo = synclabLogoAsset.url;

export function TopBar() {
  const isMobile = useIsMobile();
  const transportSkin = useSkin("transport");
  const transportDrop = useImageDrop("transport");
  const {
    transport,
    setTransport,
    togglePlay,
    toggleRecord,
    stop,
    addTrack,
    setPanel,
    panel,
    loadSample,
    removeTrack,
  } = useStudio();
  const importInput = useRef<HTMLInputElement>(null);

  const bpb = getBeatsPerBar();
  const ciTotal = (transport.countInBars ?? 1) * bpb;
  const ciElapsed = transport.countInLeft != null ? ciTotal - transport.countInLeft : 0;
  const ciBeat = (ciElapsed % bpb) + 1;
  const ciBar = Math.floor(ciElapsed / bpb) + 1;

  return (
    <header
      className="studio-topbar transport-glass studio-wallpaper rack sticky top-0 z-30 shrink-0"
      data-studio-panel="transport"
      data-desktop-transport={!isMobile ? "true" : undefined}
      data-phone-transport={isMobile ? "true" : undefined}
      style={skinBackground(transportSkin)}
      {...transportDrop}
    >
      {transport.countInLeft != null && (
        <div
          className={`pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center ${isMobile ? "bg-background/95" : "bg-background/40"}`}
        >
          {isMobile ? (
            <div
              role="status"
              aria-label={`Count-in bar ${ciBar} of ${transport.countInBars ?? 1}, beat ${ciBeat} of ${bpb}`}
              className="w-full max-w-sm px-5 text-center"
            >
              <div className="mb-4 font-mono text-base font-semibold text-foreground">COUNT-IN</div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <div className="font-mono text-sm text-foreground">BAR</div>
                  <div className="font-mono text-7xl font-bold leading-none text-primary">
                    {ciBar}
                  </div>
                  <div className="mt-2 font-mono text-sm text-muted-foreground">
                    of {transport.countInBars ?? 1}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-sm text-foreground">BEAT</div>
                  <div
                    className={`font-mono text-7xl font-bold leading-none ${ciBeat === 1 ? "text-destructive" : "text-primary"}`}
                  >
                    {ciBeat}
                  </div>
                  <div className="mt-2 font-mono text-sm text-muted-foreground">of {bpb}</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="label-xs tracking-[0.3em] text-muted-foreground">
                COUNT-IN · BAR {ciBar}
              </div>
              <div
                key={transport.countInLeft}
                className={`font-mono text-[9rem] font-bold leading-none sm:text-[12rem] ${
                  ciBeat === 1 ? "text-destructive" : "text-primary"
                }`}
                style={{ textShadow: "0 0 60px currentColor" }}
              >
                {ciBeat}
              </div>
            </>
          )}
          <div className="mt-2 flex gap-2">
            {Array.from({ length: bpb }, (_, i) => (
              <span
                key={i}
                className={`h-2 w-6 rounded-full ${i < ciBeat ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      )}
      <div className="transport-layout grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-2 sm:flex sm:flex-col sm:items-stretch sm:gap-1.5 sm:px-3">
        <div className="transport-row contents sm:flex sm:items-center sm:gap-2">
          <div className="transport-logo hidden items-center pr-1 sm:flex">
            <img
              src={synclabLogo}
              alt="SYNCLAB"
              width={1024}
              height={1024}
              className="h-14 w-auto max-w-56 rounded-[3px] object-cover"
            />
          </div>

          {isMobile && (
            <div className="transport-search hidden min-w-0 sm:block sm:w-[420px]">
              <StudioSearch />
            </div>
          )}

          <div className="transport-glass-group transport-playback order-1 flex w-fit shrink-0 items-center gap-0.5 rounded-[3px] border border-border bg-background/70 p-0.5 sm:order-none sm:ml-auto">
            <TBtn
              label="RTZ"
              onClick={() =>
                setTransport({ step: transport.loop ? (transport.loopStart ?? 0) : 0 })
              }
            >
              <SkipBack className="size-4" />
            </TBtn>
            <TBtn
              label={transport.playing ? "PAUSE" : "PLAY"}
              active={transport.playing}
              onClick={togglePlay}
            >
              {transport.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </TBtn>
            <TBtn label="STOP" onClick={stop}>
              <Square className="size-4" />
            </TBtn>
            <TBtn label="REC" danger active={transport.recording} onClick={toggleRecord}>
              <span className="relative flex size-4 items-center justify-center">
                <span
                  className={`absolute -inset-1 rounded-full border border-destructive ${
                    transport.recording ? "animate-pulse" : "opacity-0"
                  }`}
                />
                <span
                  className="size-4 rounded-full"
                  style={{
                    boxShadow: transport.recording
                      ? "0 0 0 2px color-mix(in oklab, var(--destructive) 55%, transparent), 0 0 16px 4px color-mix(in oklab, var(--destructive) 85%, transparent)"
                      : "0 0 0 1px color-mix(in oklab, var(--destructive) 55%, transparent), 0 0 8px 1px color-mix(in oklab, var(--destructive) 45%, transparent)",
                    background:
                      "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--destructive) 55%, white), var(--destructive) 55%, color-mix(in oklab, var(--destructive) 75%, black))",
                  }}
                />
              </span>
            </TBtn>
          </div>
          {!isMobile && <MasterMeter />}
        </div>
        <div className="transport-row contents sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          {/* LCD position display */}
          <div className="transport-glass-display order-3 col-span-2 flex min-w-0 items-stretch gap-2 rounded-[3px] border border-border bg-background px-2 py-1 font-mono sm:order-none sm:gap-3 sm:px-3">
            {transport.countInLeft != null ? (
              <div>
                <span className="label-xs">COUNT-IN</span>
                <div className="animate-pulse text-base leading-none text-destructive">
                  {Math.ceil(transport.countInLeft / getBeatsPerBar())}.
                  {((transport.countInLeft - 1) % getBeatsPerBar()) + 1}
                </div>
              </div>
            ) : (
              <PositionDisplay bpm={transport.bpm} playing={transport.playing} />
            )}
            {isMobile && (
              <>
                <label className="phone-tempo-value shrink-0">
                  <span className="label-xs">BPM</span>
                  <BpmInput bpm={transport.bpm} onChange={(bpm) => setTransport({ bpm })} />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-12 shrink-0"
                  aria-label="Loop"
                  title="Loop"
                  aria-pressed={transport.loop}
                  onClick={() => setTransport({ loop: !transport.loop })}
                >
                  <Repeat
                    className={`size-5 ${transport.loop ? "text-primary" : "text-muted-foreground"}`}
                  />
                </Button>
              </>
            )}
            <span className="hidden w-px bg-border sm:block" />
            <div
              className="hidden sm:block"
              title="Timeline length — click + to add bars (Shift = +16), up to 512"
            >
              <span className="label-xs">BARS</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Fewer bars"
                  className="rounded-[2px] px-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                  disabled={(transport.bars ?? 4) <= 1}
                  onClick={(e) =>
                    setTransport({
                      bars: Math.max(1, (transport.bars ?? 4) - (e.shiftKey ? 16 : 1)),
                    })
                  }
                >
                  <Minus className="size-3" />
                </button>
                <span className="min-w-7 text-center text-base leading-none text-primary">
                  {transport.bars ?? 4}
                </span>
                <button
                  type="button"
                  aria-label="More bars"
                  className="rounded-[2px] px-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                  disabled={(transport.bars ?? 4) >= 512}
                  onClick={(e) =>
                    setTransport({
                      bars: Math.min(512, (transport.bars ?? 4) + (e.shiftKey ? 16 : 1)),
                    })
                  }
                >
                  <Plus className="size-3" />
                </button>
              </div>
            </div>
            {!isMobile && (
              <>
                <span className="w-px bg-border" />
                <div title="Time signature — change it with METER next to the tempo">
                  <span className="label-xs">SIG</span>
                  <div className="text-base leading-none text-primary">
                    {transport.beatsPerBar ?? 4}/4
                  </div>
                </div>
                <span className="w-px bg-border" />
                <LoopRange />
                <span className="w-px bg-border" />
                <AudioStatus />
              </>
            )}
          </div>

          {isMobile && (
            <div
              aria-label="Loop range"
              className="phone-loop-controls flex w-full min-w-0 flex-wrap items-center gap-1"
            >
              <LoopRange mobile />
              <div className="phone-loop-group flex shrink-0 items-center rounded-md border border-border/70">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-12"
                  aria-label="Fewer bars"
                  disabled={transport.bars <= 1}
                  onClick={() => setTransport({ bars: Math.max(1, transport.bars - 1) })}
                >
                  <Minus className="size-3" />
                </Button>
                <span className="font-mono text-sm">{transport.bars} bars</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-12"
                  aria-label="More bars"
                  disabled={transport.bars >= 512}
                  onClick={() => setTransport({ bars: Math.min(512, transport.bars + 1) })}
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
          )}

          {isMobile && (
            <div
              aria-label="Tempo & rhythm"
              className="phone-rhythm-controls flex min-w-0 items-center gap-3"
            >
              <div className="flex shrink-0 items-center gap-2">
                <span className="label-xs">Tempo</span>
                <Slider
                  aria-label="Tempo"
                  className="w-24"
                  value={[transport.bpm]}
                  min={60}
                  max={190}
                  step={1}
                  onValueChange={([bpm = 120]) => setTransport({ bpm })}
                />
                <MidiLearnButton id="transport" param="bpm" label="Tempo" />
              </div>
              <label className="flex shrink-0 items-center gap-2">
                <span className="label-xs">METER</span>
                <select
                  aria-label="Time signature"
                  className="bg-transparent font-mono text-base text-primary"
                  value={transport.beatsPerBar ?? 4}
                  onChange={(e) => setTransport({ beatsPerBar: Number(e.target.value) })}
                >
                  {METERS.map((m) => (
                    <option key={m} value={m} className="bg-background">
                      {m}/4
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex shrink-0 items-center gap-2">
                <span className="label-xs">Swing</span>
                <Slider
                  aria-label="Swing"
                  className="w-20"
                  value={[transport.swing]}
                  min={0}
                  max={0.6}
                  step={0.01}
                  onValueChange={([swing = 0]) => setTransport({ swing })}
                />
                <MidiLearnButton id="transport" param="swing" label="Swing" />
              </div>
            </div>
          )}

          <div className="transport-tempo transport-glass-group hidden min-w-0 items-center gap-3 rounded-[3px] border border-border bg-background/70 px-3 py-1 sm:flex">
            <div>
              <span className="label-xs">BPM</span>
              <div className="font-mono text-base leading-none text-primary">{transport.bpm}</div>
            </div>
            <Slider
              className="w-40"
              value={[transport.bpm]}
              min={60}
              max={190}
              step={1}
              onValueChange={([v = 0]) => setTransport({ bpm: v })}
            />
            <MidiLearnButton id="transport" param="bpm" label="Tempo" />
            <label className="block" title="Time signature (beats per bar, quarter-note beat)">
              <span className="label-xs">METER</span>
              <select
                aria-label="Time signature"
                className="block bg-transparent font-mono text-base leading-none text-primary outline-none"
                value={transport.beatsPerBar ?? 4}
                onChange={(e) => setTransport({ beatsPerBar: Number(e.target.value) })}
              >
                {METERS.map((m) => (
                  <option key={m} value={m} className="bg-background">
                    {m}/4
                  </option>
                ))}
              </select>
            </label>
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
              <MidiLearnButton id="transport" param="swing" label="Swing" />
            </div>
          </div>
        </div>
        <div className="transport-row contents sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          {!isMobile && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="order-4 h-10 shrink-0 gap-1 px-2"
                  aria-label="Recording options"
                  title="Recording options: metronome, count-in, loop and overdub"
                >
                  <Timer className="size-4" />
                  <span className="text-[10px]">REC OPTIONS</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(92vw,520px)]">
                <div className="transport-glass-group flex flex-wrap items-center gap-1 rounded-[3px] border border-border bg-background/70 p-1">
                  <FeatBtn
                    label="METRONOME"
                    icon={<Timer className="size-3.5" />}
                    active={transport.metronome}
                    onClick={() => setTransport({ metronome: !transport.metronome })}
                  />
                  <FeatBtn
                    label={
                      transport.countIn ? `COUNT-IN ${transport.countInBars ?? 1}BAR` : "COUNT-IN"
                    }
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
                      <DropdownMenuLabel className="font-mono text-[10px] tracking-wider">
                        COUNT-IN LENGTH
                      </DropdownMenuLabel>
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
                    label="SNAP NOTES"
                    icon={<Magnet className="size-3.5" />}
                    active={transport.snapRecording !== false}
                    onClick={() =>
                      setTransport({ snapRecording: transport.snapRecording === false })
                    }
                  />
                  <FeatBtn
                    label="REPLACE"
                    icon={<Layers className="size-3.5" />}
                    active={!!transport.replace}
                    onClick={() => setTransport({ replace: !transport.replace })}
                  />

                  <FeatBtn
                    label="INPUT MON"
                    icon={<Headphones className="size-3.5" />}
                    active={transport.monitor}
                    onClick={() => {
                      const next = !transport.monitor;
                      setTransport({ monitor: next });
                    }}
                  />
                  <FeatBtn
                    label={
                      transport.punchIn == null ? "PUNCH IN" : `PUNCH OUT @${transport.punchIn + 1}`
                    }
                    icon={<Scissors className="size-3.5" />}
                    active={transport.punchIn != null}
                    onClick={() =>
                      setTransport(
                        transport.punchIn == null
                          ? { punchIn: getPlayStep() }
                          : { punchOut: getPlayStep() },
                      )
                    }
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <TransportExtras mobile={isMobile}>
          <IdeaRecorder compact={isMobile} />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={isMobile ? "size-11" : "size-8"}
                aria-label="Transport color and wallpaper"
                title="Transport color and wallpaper"
              >
                <Palette className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(92vw,420px)]">
              <SkinControls skinKey="transport" image />
            </PopoverContent>
          </Popover>
          <TransportUndo mobile={isMobile} />
          <QuickNotes />
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
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label="Open studio panels"
                >
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
                  <Cpu className="mr-2 size-4" /> FX Rack
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("drums")}>
                  <Disc3 className="mr-2 size-4" /> Drums
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("synth")}>
                  <Music2 className="mr-2 size-4" /> Instruments
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("mixer")}>
                  <SlidersHorizontal className="mr-2 size-4" /> Mixer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPanel("pads")}>
                  <Grid2x2 className="mr-2 size-4" /> Sample Pads
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-mono text-[10px] tracking-wider">
                  COUNT-IN
                </DropdownMenuLabel>
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
                <DropdownMenuItem
                  onClick={() => {
                    requestBluetoothSettings();
                    setPanel("settings");
                  }}
                >
                  Bluetooth devices
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
                <Cpu className="size-4" /> FX RACK
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
                variant={panel === "mixer" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPanel(panel === "mixer" ? null : "mixer")}
              >
                <SlidersHorizontal className="size-4" /> MIX
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Import an audio file onto a new sampler channel"
                onClick={() => importInput.current?.click()}
              >
                <Import className="size-4" /> IMPORT
              </Button>
              <input
                ref={importInput}
                type="file"
                accept={AUDIO_IMPORT_ACCEPT}
                className="hidden"
                aria-label="Import audio file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file)
                    void importAudioToSampler(
                      { addTrack, setPanel, loadSample, removeTrack },
                      file,
                    );
                }}
              />
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
        </TransportExtras>
        {isMobile && (
          <section
            aria-label="Meters & MIDI"
            className="phone-transport-signals order-4 col-span-full flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-2"
          >
            <div className="phone-master-display min-w-0 max-w-full overflow-x-auto">
              <MasterMeter />
            </div>
            <div className="phone-signal-controls flex shrink-0 items-center gap-2">
              <AudioStatus />
              <MidiControl />
            </div>
          </section>
        )}
      </div>
    </header>
  );
}

function TransportExtras({ mobile, children }: { mobile: boolean; children: React.ReactNode }) {
  if (!mobile)
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="order-4 size-10 shrink-0"
            aria-label="Studio tools"
            title="Studio tools"
          >
            <Menu className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,560px)]">
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        </PopoverContent>
      </Popover>
    );
  return (
    <div className="order-2 justify-self-end">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="transport-glass-group size-11"
            aria-label="Transport menu"
            title="Studio tools"
          >
            <SlidersHorizontal className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="phone-transport-menu transport-glass-menu flex max-h-[min(70dvh,440px)] w-[min(78vw,360px)] flex-col overflow-hidden p-0"
        >
          <div className="shrink-0 border-b border-border px-3 py-2 font-display text-sm font-semibold">
            Studio tools
          </div>
          <PhonePages name="Studio tools">
            <div className="flex flex-wrap items-center gap-2 p-2.5">{children}</div>
          </PhonePages>
        </PopoverContent>
      </Popover>
    </div>
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
      className={`h-12 min-w-12 flex-col gap-0.5 px-2 sm:h-10 sm:min-w-0 sm:px-2.5 ${
        danger
          ? active
            ? "bg-destructive/15 text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--destructive)_60%,transparent),0_0_12px_color-mix(in_oklab,var(--destructive)_45%,transparent)] hover:bg-destructive/25 hover:text-destructive"
            : "bg-background/60 text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--destructive)_35%,transparent)] hover:bg-destructive/10 hover:text-destructive"
          : active
            ? "text-primary"
            : ""
      }`}
    >
      {children}
      <span className="font-mono text-[10px] font-semibold tracking-wider sm:text-[9px]">
        {label}
      </span>
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

/** Desktop strip above the timeline: studio search and the MIDI controller inputs. */
export function TimelineTopBar() {
  return (
    <div
      className="timeline-top-bar flex shrink-0 items-center gap-3 border-b-2 border-primary/50 bg-surface-2 px-4 py-2.5"
      aria-label="Search and MIDI controllers"
    >
      <div className="min-w-0 w-[560px] max-w-[55%]">
        <StudioSearch />
      </div>
      <div className="ml-auto shrink-0">
        <MidiControl />
      </div>
    </div>
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
          midiInputId
            ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_var(--primary)]"
            : "text-muted-foreground"
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${midiLearning ? "bg-destructive" : midiInputId ? "bg-primary" : "bg-border"}`}
        />
        <KeyboardMusic className="size-3.5" />
        MIDI IN
      </Button>

      <ControllerLibrary />
      {midiInputs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 max-w-40 truncate px-2 font-mono text-[10px] tracking-wider"
            >
              {midiInputId === "all"
                ? "ALL DEVICES"
                : selectedMidiInputs(midiInputId).length > 1
                  ? `${selectedMidiInputs(midiInputId).length} CONTROLLERS`
                  : (midiInputs.find((i) => midiInputEnabled(midiInputId, i.id))?.name ??
                    "SELECT DEVICES")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel className="font-mono text-[10px] tracking-wider">
              CONTROLLER → {armedNote ? armedNote.name : "SELECTED INSTRUMENT"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {midiInputs.map((i) => (
              <DropdownMenuCheckboxItem
                key={i.id}
                checked={midiInputEnabled(midiInputId, i.id)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) =>
                  setMidiInput(toggleMidiInput(midiInputId, i.id, checked, midiInputs))
                }
              >
                {i.name}
              </DropdownMenuCheckboxItem>
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

const TICKS = 960;

/** Musical (BAR | BEAT | TICK) or absolute (H:MM:SS.mmm) playhead position, click to switch. */
function PositionDisplay({ bpm, playing }: { bpm: number; playing: boolean }) {
  const beatStep = usePlayStep();
  const [abs, setAbs] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("synclab.timeMode") === "abs") setAbs(true);
  }, []);
  const toggle = () => {
    setAbs((a) => {
      localStorage.setItem("synclab.timeMode", a ? "bars" : "abs");
      return !a;
    });
  };
  // The scheduler reports whole 1/16 steps; interpolate within the step at 20 fps so ticks and ms move.
  const [frac, setFrac] = useState(0);
  useEffect(() => {
    setFrac(0);
    if (!playing) return;
    const t0 = performance.now();
    const beatMs = stepSeconds(bpm) * 1000;
    const id = window.setInterval(
      () => setFrac(Math.min(0.999, (performance.now() - t0) / beatMs)),
      50,
    );
    return () => window.clearInterval(id);
  }, [beatStep, playing, bpm]);
  const step = beatStep + frac;
  const whole = Math.floor(step);
  const tick = Math.floor(
    ((((step % STEPS_PER_BEAT) + STEPS_PER_BEAT) % STEPS_PER_BEAT) / STEPS_PER_BEAT) * TICKS,
  );
  const secs = step * stepSeconds(bpm);
  const hh = Math.floor(secs / 3600),
    mm = Math.floor((secs % 3600) / 60),
    ss = Math.floor(secs % 60);
  const ms = Math.floor((secs * 1000) % 1000);
  return (
    <button
      type="button"
      onClick={toggle}
      className="text-left"
      title="Click to switch musical / absolute time"
    >
      <span className="label-xs">{abs ? "H:MM:SS.MS" : "BAR | BEAT | TICK"}</span>
      <div className="whitespace-nowrap text-base leading-none tabular-nums text-primary">
        {abs
          ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(ms).padStart(3, "0")}`
          : `${Math.floor(whole / stepsPerBar()) + 1} | ${Math.floor((whole % stepsPerBar()) / STEPS_PER_BEAT) + 1} | ${String(tick).padStart(3, "0")}`}
      </div>
    </button>
  );
}

function LoopRange({ mobile = false }: { mobile?: boolean }) {
  const { transport, setTransport } = useStudio();
  const total = songSteps(transport.bars);
  const lo = transport.loopStart ?? 0;
  const hi = transport.loopEnd ?? total;
  const nudge = (which: "loopStart" | "loopEnd", d: number) => {
    if (which === "loopStart")
      setTransport({ loopStart: Math.max(0, Math.min(hi - stepsPerBar(), lo + d)) });
    else setTransport({ loopEnd: Math.min(total, Math.max(lo + stepsPerBar(), hi + d)) });
  };
  if (mobile)
    return (
      <div className="flex flex-wrap items-center gap-1 text-sm text-primary">
        {(
          [
            {
              key: "loopStart",
              name: "start",
              value: Math.floor(lo / stepsPerBar()) + 1,
              earlier: "Loop start earlier",
              later: "Loop start later",
              down: lo <= 0,
              up: lo + stepsPerBar() >= hi,
            },
            {
              key: "loopEnd",
              name: "end",
              value: Math.ceil(hi / stepsPerBar()),
              earlier: "Loop end earlier",
              later: "Loop end later",
              down: hi - stepsPerBar() <= lo,
              up: hi >= total,
            },
          ] as const
        ).map(({ key, name, value, earlier, later, down, up }) => (
          <div
            key={key}
            className="phone-loop-group flex shrink-0 items-center rounded-md border border-border/70"
          >
            <span className="phone-loop-label">{name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-12"
              aria-label={earlier}
              title={earlier}
              disabled={down}
              onClick={() => nudge(key, -stepsPerBar())}
            >
              <Minus className="size-4" />
            </Button>
            <span
              className="min-w-4 text-center tabular-nums"
              title={key === "loopStart" ? "Loop start bar" : "Loop last bar"}
            >
              {value}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-12"
              aria-label={later}
              title={later}
              disabled={up}
              onClick={() => nudge(key, stepsPerBar())}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  const Btn = ({ k, d, l }: { k: "loopStart" | "loopEnd"; d: number; l: string }) => (
    <button
      type="button"
      aria-label={l}
      onClick={() => nudge(k, d)}
      className="rounded-[2px] px-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {d < 0 ? <Minus className="size-3" /> : <Plus className="size-3" />}
    </button>
  );
  return (
    <div title="Loop range in bars">
      <span className="label-xs">LOOP {transport.loop ? "ON" : "OFF"}</span>
      <div className="flex items-center gap-0.5 text-sm leading-none text-primary">
        <Btn k="loopStart" d={-stepsPerBar()} l="Loop start earlier" />
        <span className="tabular-nums">{Math.floor(lo / stepsPerBar()) + 1}</span>
        <Btn k="loopStart" d={stepsPerBar()} l="Loop start later" />
        <span className="px-0.5 text-muted-foreground">–</span>
        <Btn k="loopEnd" d={-stepsPerBar()} l="Loop end earlier" />
        <span className="tabular-nums">{Math.floor(hi / stepsPerBar()) + 1}</span>
        <Btn k="loopEnd" d={stepsPerBar()} l="Loop end later" />
      </div>
    </div>
  );
}

/** Real AudioContext state and sample rate, polled once a second. */
function AudioStatus() {
  const [st, setSt] = useState<{ s: string; sr: number }>({ s: "off", sr: 0 });
  useEffect(() => {
    const read = () => {
      const e = getEngine();
      setSt({ s: e.audioState, sr: e.sampleRate });
    };
    read();
    const id = window.setInterval(read, 1000);
    return () => window.clearInterval(id);
  }, []);
  const ok = st.s === "running";
  return (
    <button
      type="button"
      title={ok ? "Audio engine running" : "Audio is paused by the browser — click to start it"}
      onClick={() => getEngine().init()}
      className="text-left"
    >
      <span className="label-xs">AUDIO</span>
      <div
        className={`flex items-center gap-1 text-xs leading-none ${ok ? "text-primary" : "text-destructive"}`}
      >
        <span className={`size-1.5 rounded-full ${ok ? "bg-primary" : "bg-destructive"}`} />
        {ok ? `${(st.sr / 1000).toFixed(1)}k` : st.s === "off" ? "IDLE" : "PAUSED"}
      </div>
    </button>
  );
}

/** Undo/redo on the transport, sharing the project history used by Edit menu and shortcuts. */
function TransportUndo({ mobile }: { mobile: boolean }) {
  const { undo, redo, canUndo, canRedo } = useStudio();
  const cls = mobile ? "size-11" : "size-8";
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={cls}
        aria-label="Undo"
        title="Undo (Ctrl/Cmd+Z)"
        disabled={!canUndo}
        onClick={undo}
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={cls}
        aria-label="Redo"
        title="Redo (Ctrl/Cmd+Shift+Z)"
        disabled={!canRedo}
        onClick={redo}
      >
        <Redo2 className="size-4" />
      </Button>
    </>
  );
}
