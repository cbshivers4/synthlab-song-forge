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

/** Convert a #rrggbb hex colour to the oklch() string tracks store. */
export function hexToOklch(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = lin(r), G = lin(g), B = lin(b);
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const m2 = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
  const l3 = Math.cbrt(l), m3 = Math.cbrt(m2), s3 = Math.cbrt(s);
  const L = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
  const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
  const b2 = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;
  const C = Math.sqrt(a * a + b2 * b2);
  let H = (Math.atan2(b2, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}

/** Best-effort hex for the native colour input from a stored track colour. */
export function oklchToHex(color: string): string {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color);
  if (!m) return "#22c1c3";
  const L = parseFloat(m[1]!), C = parseFloat(m[2]!), H = (parseFloat(m[3]!) * Math.PI) / 180;
  const a = C * Math.cos(H), b2 = C * Math.sin(H);
  const l3 = L + 0.3963377774 * a + 0.2158037573 * b2;
  const m3 = L - 0.1055613458 * a - 0.0638541728 * b2;
  const s3 = L - 0.0894841775 * a - 1.291485548 * b2;
  const l = l3 ** 3, mm = m3 ** 3, s = s3 ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s;
  const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  const to = (c: number) => Math.round(Math.min(1, Math.max(0, gam(c))) * 255).toString(16).padStart(2, "0");
  return `#${to(R)}${to(G)}${to(B)}`;
}

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

// ---- Hand-drawn band instrument icons (lucide has no violin/horn/sax) ----
type IconProps = { className?: string | undefined };
const svg = (children: React.ReactNode) =>
  function BandIcon({ className }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {children}
      </svg>
    );
  };

/** Trumpet / horn */
const HornIcon = svg(<>
  <path d="M3 10h8l7-4v12l-7-4H3z" />
  <path d="M18 6c2 1.5 3 3.5 3 6s-1 4.5-3 6" />
  <path d="M7 10v4M10 10v4" />
</>);

/** Saxophone */
const SaxIcon = svg(<>
  <path d="M6 3v9a5 5 0 0 0 10 0v-1" />
  <path d="M16 11h4l-1.5 3H16" />
  <path d="M6 3c0 1.5 1 2 2 2" />
  <circle cx="9" cy="13" r="0.6" />
  <circle cx="11" cy="15" r="0.6" />
</>);

/** Violin */
const ViolinIcon = svg(<>
  <path d="M14 3l7 7" />
  <path d="M15.5 8.5c2-2 2-2 0 0z" />
  <path d="M13 9c-2-1.5-5-1-6.5 1C5 12 5.5 13.5 5 14.5 4 16.5 5 19 7.5 19.5c1.5.3 2.5-.5 3-1.5.5-1.5 2-2 3.5-1 2 1 4.5.5 5.5-1.5.7-1.5.3-3.5-1.5-4.5" />
  <path d="M13 9l5-5" />
  <circle cx="10" cy="14" r="0.6" />
</>);

/** Bass guitar (4 tuners, longer neck) */
const BassGuitarIcon = svg(<>
  <path d="M4 20c-1.5-1.5-1.5-4 0-5.5 1-1 2.5-1.3 3.7-.8L19 2.5 21.5 5l-11.2 11.3c.5 1.2.2 2.7-.8 3.7-1.5 1.5-4 1.5-5.5 0z" />
  <circle cx="7" cy="17" r="1.6" />
  <path d="M17 5l2 2M15 3.5l1.5 1.5M20.5 8.5L19 7" />
</>);

/** Lead guitar (electric, pointed headstock) */
const LeadGuitarIcon = svg(<>
  <path d="M5 19c-2-2-2-5 .5-6.5 1.2-.7 2.7-.6 3.8.1L20 2l2 2-10.6 10.7c.7 1.1.8 2.6.1 3.8C10 21 7 21 5 19z" />
  <circle cx="8" cy="16" r="1.6" />
  <path d="M20 2l-3 1 1 2.5" />
  <path d="M12.5 11.5l2 2" />
</>);

/** Drum set (kick + toms + cymbal) */
const DrumSetIcon = svg(<>
  <circle cx="12" cy="15" r="5" />
  <circle cx="12" cy="15" r="1.2" />
  <path d="M5 8h5M7.5 8v3M15 8h5M17.5 8v3" />
  <path d="M3 5h8M19 5h-6" />
  <path d="M7 5L5 15M19 5l2 10" />
</>);

/** Congas / hand drums */
const CongaIcon = svg(<>
  <path d="M6 4h6l-1 16H7z" />
  <path d="M14 6h5l-.8 14h-3.4z" />
  <path d="M6 6h6M14 8h5" />
</>);

/** Tambourine */
const TambourineIcon = svg(<>
  <circle cx="12" cy="12" r="8" />
  <circle cx="12" cy="12" r="4.5" />
  <circle cx="12" cy="4" r="0.8" /><circle cx="19" cy="9" r="0.8" />
  <circle cx="16" cy="18" r="0.8" /><circle cx="8" cy="18" r="0.8" /><circle cx="5" cy="9" r="0.8" />
</>);

/** Cello / upright strings */
const CelloIcon = svg(<>
  <path d="M12 2v4" />
  <path d="M10 3h4" />
  <path d="M12 6c-3 0-4 2-3.5 3.5C9 11 8 12 8 14c0 4 2 8 4 8s4-4 4-8c0-2-1-3-.5-4.5C16 8 15 6 12 6z" />
  <path d="M12 6v16" />
</>);

TRACK_ICONS.push(
  { id: "horn", label: "Horn / trumpet", Icon: HornIcon },
  { id: "sax", label: "Saxophone", Icon: SaxIcon },
  { id: "violin", label: "Violin", Icon: ViolinIcon },
  { id: "cello", label: "Cello / strings", Icon: CelloIcon },
  { id: "bassguitar", label: "Bass guitar", Icon: BassGuitarIcon },
  { id: "leadguitar", label: "Lead guitar", Icon: LeadGuitarIcon },
  { id: "drumset", label: "Drum set", Icon: DrumSetIcon },
  { id: "conga", label: "Congas", Icon: CongaIcon },
  { id: "tambourine", label: "Tambourine", Icon: TambourineIcon },
);

const ICON_BY_ID = new Map(TRACK_ICONS.map((i) => [i.id, i.Icon]));

/** Falls back to a sensible icon from the track kind and name when none was picked. */
export function autoIcon(track: Pick<Track, "kind" | "name" | "instrument">) {
  const name = `${track.instrument ?? ""} ${track.name}`.toLowerCase();
  if (track.kind === "drum") return Drum;
  if (track.kind === "audio") return Mic;
  if (track.kind === "ai-vocal") return Mic2;
  if (track.kind === "sampler") return AudioLines;
  if (/bass ?guitar/.test(name)) return BassGuitarIcon;
  if (/lead ?guitar|solo ?guitar/.test(name)) return LeadGuitarIcon;
  if (/bass|sub/.test(name)) return Waves;
  if (/piano|keys|rhodes/.test(name)) return Piano;
  if (/synth|organ/.test(name)) return KeyboardMusic;
  if (/guitar|pluck/.test(name)) return Guitar;
  if (/violin|fiddle/.test(name)) return ViolinIcon;
  if (/cello|viola|string/.test(name)) return CelloIcon;
  if (/sax/.test(name)) return SaxIcon;
  if (/horn|trumpet|brass|trombone|tuba/.test(name)) return HornIcon;
  if (/drum ?set|kit/.test(name)) return DrumSetIcon;
  if (/conga|bongo/.test(name)) return CongaIcon;
  if (/tambourine/.test(name)) return TambourineIcon;
  if (/pad|choir/.test(name)) return Radio;
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
          <label className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
            <input
              type="color"
              aria-label="Custom track colour"
              value={oklchToHex(track.color)}
              onChange={(e) => updateTrack(track.id, { color: hexToOklch(e.target.value) })}
              className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Custom colour — pick any shade
            </span>
          </label>
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
