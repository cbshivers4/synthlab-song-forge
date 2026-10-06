import type { ComponentType } from "react";
import {
  Activity,
  AudioLines,
  AudioWaveform,
  Bell,
  Bot,
  CassetteTape,
  Disc3,
  DiscAlbum,
  Drum,
  Drumstick,
  Guitar,
  Hand,
  Headphones,
  Headset,
  Keyboard,
  KeyboardMusic,
  ListMusic,
  Metronome,
  Mic,
  Mic2,
  MicVocal,
  MonitorSpeaker,
  Music,
  Music2,
  Music3,
  Music4,
  Piano,
  Radio,
  Speaker,
  Sparkles,
  Star,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStudio } from "@/lib/synclab/store";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/synclab/types";

/** Colours a track or channel can be painted with — shared by timeline and mixer. */
export const TRACK_PALETTE: { id: string; name: string; value: string }[] = [
  { id: "cyan", name: "Cyan", value: "oklch(0.78 0.16 195)" },
  { id: "teal", name: "Teal", value: "oklch(0.8 0.14 175)" },
  { id: "green", name: "Green", value: "oklch(0.78 0.18 145)" },
  { id: "lime", name: "Lime", value: "oklch(0.85 0.19 125)" },
  { id: "yellow", name: "Yellow", value: "oklch(0.88 0.17 100)" },
  { id: "amber", name: "Amber", value: "oklch(0.82 0.17 80)" },
  { id: "orange", name: "Orange", value: "oklch(0.75 0.19 45)" },
  { id: "red", name: "Red", value: "oklch(0.68 0.21 25)" },
  { id: "rose", name: "Rose", value: "oklch(0.72 0.2 5)" },
  { id: "magenta", name: "Magenta", value: "oklch(0.75 0.19 330)" },
  { id: "purple", name: "Purple", value: "oklch(0.7 0.2 305)" },
  { id: "violet", name: "Violet", value: "oklch(0.72 0.18 285)" },
  { id: "indigo", name: "Indigo", value: "oklch(0.68 0.18 265)" },
  { id: "blue", name: "Blue", value: "oklch(0.72 0.17 245)" },
  { id: "sky", name: "Sky", value: "oklch(0.8 0.14 220)" },
  { id: "steel", name: "Steel", value: "oklch(0.68 0.05 240)" },
  { id: "sand", name: "Sand", value: "oklch(0.82 0.07 75)" },
  { id: "silver", name: "Silver", value: "oklch(0.86 0.01 250)" },
];

/** Musical icons a track can be badged with. */
export const TRACK_ICONS: { id: string; label: string; Icon: ComponentType<{ className?: string | undefined }> }[] = [
  { id: "note", label: "Note", Icon: Music2 },
  { id: "notes", label: "Notes", Icon: Music3 },
  { id: "score", label: "Score", Icon: Music4 },
  { id: "music", label: "Music", Icon: Music },
  { id: "setlist", label: "Setlist", Icon: ListMusic },
  { id: "piano", label: "Piano", Icon: Piano },
  { id: "keys", label: "Keys", Icon: Keyboard },
  { id: "synth", label: "Synth", Icon: KeyboardMusic },
  { id: "metronome", label: "Metronome", Icon: Metronome },
  { id: "guitar", label: "Guitar", Icon: Guitar },
  { id: "drum", label: "Drums", Icon: Drum },
  { id: "sticks", label: "Drum sticks", Icon: Drumstick },
  { id: "percussion", label: "Percussion", Icon: Hand },
  { id: "disc", label: "Turntable", Icon: Disc3 },
  { id: "album", label: "Album", Icon: DiscAlbum },
  { id: "mic", label: "Microphone", Icon: Mic },
  { id: "vocal", label: "Vocal mic", Icon: Mic2 },
  { id: "livemic", label: "Live mic", Icon: MicVocal },
  { id: "headset", label: "Headset mic", Icon: Headset },
  { id: "speaker", label: "Speaker", Icon: Speaker },
  { id: "studioSpeaker", label: "Studio speaker", Icon: MonitorSpeaker },
  { id: "headphones", label: "Headphones", Icon: Headphones },
  { id: "radio", label: "Radio", Icon: Radio },
  { id: "tape", label: "Tape", Icon: CassetteTape },
  { id: "wave", label: "Waveform", Icon: AudioWaveform },
  { id: "lines", label: "Audio lines", Icon: AudioLines },
  { id: "waves", label: "Sub / waves", Icon: Waves },
  { id: "pulse", label: "Pulse", Icon: Activity },
  { id: "zap", label: "Zap", Icon: Zap },
  { id: "sparkle", label: "FX", Icon: Sparkles },
  { id: "bell", label: "Bell", Icon: Bell },
  { id: "wind", label: "Air", Icon: Wind },
  { id: "bot", label: "AI", Icon: Bot },
  { id: "star", label: "Star", Icon: Star },
];

const ICON_BY_ID = new Map(TRACK_ICONS.map((i) => [i.id, i.Icon]));

/** Falls back to a sensible icon from the track kind and name when none was picked. */
export function autoIcon(track: Pick<Track, "kind" | "name" | "instrument">) {
  const name = `${track.instrument ?? ""} ${track.name}`.toLowerCase();
  if (track.kind === "drum") return Drum;
  if (track.kind === "audio") return Mic;
  if (track.kind === "ai-vocal") return Mic2;
  if (track.kind === "sampler") return AudioLines;
  if (/bass|sub/.test(name)) return Waves;
  if (/piano|keys|rhodes/.test(name)) return Piano;
  if (/synth|organ/.test(name)) return KeyboardMusic;
  if (/guitar|pluck/.test(name)) return Guitar;
  if (/string|brass|pad|choir/.test(name)) return Radio;
  if (/fx|noise|sweep/.test(name)) return Sparkles;
  return Music2;
}

/** Renders the track's chosen icon (or its automatic one) in the track colour. */
export function TrackIcon({
  track,
  className,
  tinted = true,
}: {
  track: Pick<Track, "kind" | "name" | "instrument" | "icon" | "color">;
  className?: string | undefined;
  tinted?: boolean;
}) {
  const Icon = (track.icon && ICON_BY_ID.get(track.icon)) || autoIcon(track);
  return <Icon className={className} {...(tinted ? { style: { color: track.color } } : {})} />;
}

/**
 * Colour + icon picker shared by the timeline track head and the mixer channel.
 * Pass any trigger as children; the popover handles the rest.
 */
export function TrackStylePicker({
  track,
  children,
  align = "start",
}: {
  track: Track;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  const { updateTrack } = useStudio();
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[268px] space-y-3 p-3"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-1.5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Track colour</p>
          <div className="grid grid-cols-9 gap-1.5">
            {TRACK_PALETTE.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.name}
                aria-label={`${c.name} colour`}
                onClick={() => updateTrack(track.id, { color: c.value })}
                className={cn(
                  "size-6 rounded-full border transition-transform hover:scale-110",
                  c.value === track.color ? "border-foreground ring-2 ring-foreground/40" : "border-black/40",
                )}
                style={{ background: c.value }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Track icon</p>
          <div className="grid max-h-[168px] grid-cols-6 gap-1.5 overflow-y-auto pr-1">
            {TRACK_ICONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={`${label} icon`}
                onClick={() => updateTrack(track.id, { icon: id })}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md border transition-colors",
                  track.icon === id ? "border-foreground bg-foreground/10" : "border-border hover:border-primary",
                )}
                style={track.icon === id ? { color: track.color } : undefined}
              >
                <Icon className="size-4.5" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => updateTrack(track.id, { icon: undefined })}
            className="w-full rounded-md border border-border py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-foreground"
          >
            Automatic icon
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
