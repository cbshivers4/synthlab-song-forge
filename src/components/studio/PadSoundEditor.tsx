import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Knob } from "./Knob";
import {
  DEFAULT_PAD_SOUND,
  PAD_SOUND_RANGES,
  type PadFilterType,
  type PadSound,
  type PadSoundRangeKey,
} from "@/lib/synclab/mpc-pad";

type Section = "tune" | "amp" | "filter" | "pitchEnv" | "playback" | "tempo";

const FILTERS: { value: PadFilterType; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "lowpass", label: "LP" },
  { value: "highpass", label: "HP" },
  { value: "bandpass", label: "BP" },
  { value: "notch", label: "Notch" },
];

const ms = (v: number) => (v >= 1 ? `${v.toFixed(2)} s` : `${Math.round(v * 1000)} ms`);
const signed = (v: number, unit = "") => `${v > 0 ? "+" : ""}${v}${unit}`;
const hz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);

/**
 * MPC-style pad edit: tune, fine, level, pan, velocity, ADSR, fades, filter with its own
 * envelope, pitch envelope and playback options. Shared by Pad Sampler pads and Video Sampler
 * chops so every pad offers the same controls.
 */
export function PadSoundEditor({
  sound,
  onChange,
  name,
  midiTarget,
  sections = ["tune", "amp", "filter", "pitchEnv", "playback", "tempo"],
}: {
  sound: Partial<PadSound>;
  onChange: (next: Partial<PadSound>) => void;
  /** used in labels, e.g. "Pad A3" */
  name: string;
  midiTarget?: (field: string) => { id: string; param: string } | undefined;
  sections?: Section[];
}) {
  const v = { ...DEFAULT_PAD_SOUND, ...sound };
  const show = (s: Section) => sections.includes(s);
  const knob = (
    field: PadSoundRangeKey,
    label: string,
    format: (n: number) => string,
    disabled = false,
  ) => {
    const [min, max, step] = PAD_SOUND_RANGES[field];
    const value = (v[field] as number | undefined) ?? (DEFAULT_PAD_SOUND[field] as number);
    return (
      <div
        key={field}
        className={disabled ? "pointer-events-none opacity-40" : undefined}
        aria-disabled={disabled || undefined}
      >
        <Knob
          label={label}
          ariaLabel={`${name} ${label.toLowerCase()}`}
          size={42}
          value={value}
          min={min}
          max={max}
          step={step}
          defaultValue={DEFAULT_PAD_SOUND[field] as number}
          format={format}
          midiTarget={midiTarget?.(field)}
          onChange={(n) => onChange({ [field]: n } as Partial<PadSound>)}
        />
      </div>
    );
  };
  const filterOff = (v.filterType ?? "off") === "off";
  const group = (label: string, children: React.ReactNode) => (
    <div
      className="min-w-0 space-y-1.5 rounded-md border border-border bg-surface-2/40 p-2"
      role="group"
      aria-label={`${name} ${label.toLowerCase()}`}
    >
      <span className="label-xs">{label}</span>
      <div className="flex flex-wrap items-start gap-x-1.5 gap-y-2">{children}</div>
    </div>
  );

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={`${name} sound edit`}>
      {show("tune") &&
        group("TUNE · LEVEL · VELOCITY", [
          knob("pitch", "TUNE", (n) => signed(Math.round(n), " st")),
          knob("fine", "FINE", (n) => signed(Math.round(n), " ct")),
          knob("gain", "LEVEL", (n) => `${Math.round(n * 100)}%`),
          knob("pan", "PAN", (n) =>
            Math.abs(n) < 0.01 ? "C" : `${n < 0 ? "L" : "R"}${Math.round(Math.abs(n) * 100)}`,
          ),
          knob("velSens", "VEL→LVL", (n) => `${Math.round(n * 100)}%`),
        ])}
      {show("amp") &&
        group("AMP ENVELOPE", [
          knob("attack", "ATTACK", ms),
          knob("decay", "DECAY", ms),
          knob("sustain", "SUSTAIN", (n) => `${Math.round(n * 100)}%`),
          knob("release", "RELEASE", ms),
          knob("fadeIn", "FADE IN", ms),
          knob("fadeOut", "FADE OUT", ms),
        ])}
      {show("filter") && (
        <div
          className="min-w-0 space-y-1.5 rounded-md border border-border bg-surface-2/40 p-2"
          role="group"
          aria-label={`${name} filter`}
        >
          <div className="flex flex-wrap items-center gap-1">
            <span className="label-xs mr-1">FILTER</span>
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                type="button"
                size="sm"
                variant={(v.filterType ?? "off") === f.value ? "default" : "outline"}
                className="h-8 px-2 text-[10px] sm:h-6"
                aria-pressed={(v.filterType ?? "off") === f.value}
                onClick={() => onChange({ filterType: f.value })}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-start gap-x-1.5 gap-y-2">
            <div className={filterOff ? "pointer-events-none opacity-40" : undefined}>
              <Knob
                label="CUTOFF"
                ariaLabel={`${name} cutoff`}
                size={42}
                value={Math.log10(v.cutoff ?? 18000)}
                min={Math.log10(20)}
                max={Math.log10(20000)}
                step={0.01}
                defaultValue={Math.log10(18000)}
                format={(n) => hz(Math.pow(10, n))}
                midiTarget={midiTarget?.("cutoff")}
                onChange={(n) => onChange({ cutoff: Math.round(Math.pow(10, n)) })}
              />
            </div>
            {knob("resonance", "RES", (n) => n.toFixed(1), filterOff)}
            {knob("filterEnv", "ENV AMT", (n) => `${signed(Number(n.toFixed(1)))} oct`, filterOff)}
            {knob("filterDecay", "ENV DEC", ms, filterOff)}
            {knob("velFilter", "VEL→FLT", (n) => `${n.toFixed(1)} oct`, filterOff)}
          </div>
        </div>
      )}
      {show("pitchEnv") &&
        group("PITCH ENVELOPE", [
          knob("pitchEnv", "AMOUNT", (n) => signed(Number(n.toFixed(1)), " st")),
          knob("pitchDecay", "DECAY", ms, !v.pitchEnv),
        ])}
      {show("playback") && (
        <div
          className="min-w-0 space-y-2 rounded-md border border-border bg-surface-2/40 p-2"
          role="group"
          aria-label={`${name} playback`}
        >
          <span className="label-xs">PLAYBACK</span>
          <div className="flex gap-1">
            {[
              [true, "One-shot"],
              [false, "Note on"],
            ].map(([value, label]) => (
              <Button
                key={String(value)}
                type="button"
                size="sm"
                variant={v.oneShot === value ? "default" : "outline"}
                className="h-9 flex-1 text-[11px] sm:h-7"
                aria-pressed={v.oneShot === value}
                title={
                  value
                    ? "Plays to the end even after you let go"
                    : "Plays only while you hold the pad"
                }
                onClick={() => onChange({ oneShot: value as boolean })}
              >
                {label as string}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            {[
              [false, "Mono"],
              [true, "Poly"],
            ].map(([value, label]) => (
              <Button
                key={String(value)}
                type="button"
                size="sm"
                variant={!!v.poly === value ? "default" : "outline"}
                className="h-9 flex-1 text-[11px] sm:h-7"
                aria-pressed={!!v.poly === value}
                title={
                  value
                    ? "Hitting the pad again lets the last hit ring on"
                    : "Hitting the pad again cuts the last hit"
                }
                onClick={() => onChange({ poly: value as boolean })}
              >
                {label as string}
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="label-xs">Mute group</span>
            <Select
              value={String(v.choke ?? 0)}
              onValueChange={(g) => onChange({ choke: Number(g) })}
            >
              <SelectTrigger aria-label={`${name} mute group`} className="h-9 w-28 sm:h-7">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 9 }, (_, g) => (
                  <SelectItem key={g} value={String(g)}>
                    {g ? `Group ${g}` : "Off"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(
            [
              ["loop", "Loop"],
              ["reverse", "Reverse"],
              ["mute", "Mute pad"],
            ] as const
          ).map(([field, label]) => (
            <div key={field} className="flex items-center justify-between">
              <span className="label-xs">{label}</span>
              <Switch
                aria-label={`${name} ${label.toLowerCase()}`}
                checked={!!v[field]}
                onCheckedChange={(on) => onChange({ [field]: on } as Partial<PadSound>)}
              />
            </div>
          ))}
        </div>
      )}
      {show("tempo") && (
        <div
          className="min-w-0 space-y-2 rounded-md border border-border bg-surface-2/40 p-2"
          role="group"
          aria-label={`${name} tempo`}
        >
          <span className="label-xs">FOLLOW SONG TEMPO</span>
          <div className="flex items-start gap-2">
            {knob("sampleBpm", "SMP BPM", (n) => `${Math.round(n)}`)}
            <div className="flex flex-1 flex-col gap-1 pt-1">
              <div className="flex items-center justify-between">
                <span className="label-xs">Warp (repitch)</span>
                <Switch
                  aria-label={`${name} follow song tempo`}
                  checked={!!v.syncToBpm}
                  onCheckedChange={(on) =>
                    onChange({ syncToBpm: on, sampleBpm: v.sampleBpm ?? 120 })
                  }
                />
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Speed and pitch follow the song tempo together. To change length but keep the pitch,
                use Time stretch.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
