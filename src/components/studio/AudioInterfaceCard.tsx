import { cn } from "@/lib/utils";
import { useIsAppleMobile } from "@/hooks/use-is-apple-mobile";
import voltFace from "@/assets/audio-interface-volt.jpg";

type DeviceOption = { id: string; label: string };

type Props = {
  inputs: DeviceOption[];
  outputs: DeviceOption[];
  inputDevice: string;
  channel: "in1" | "in2" | "stereo";
  sampleRate: number;
  scanning: boolean;
};

/** Front-panel drawing used when the browser label names no known interface. */
function GenericInterface({ active }: { active: boolean }) {
  const body = "fill-surface-2 stroke-border";
  const metal = "fill-muted stroke-border";
  return (
    <svg viewBox="0 0 224 120" aria-hidden className="h-full w-full">
      {/* body */}
      <rect x="22" y="22" width="180" height="76" rx="8" className={body} strokeWidth="1.5" />
      <rect x="30" y="30" width="164" height="60" rx="5" className="fill-background/40 stroke-border" strokeWidth="1" />
      {/* XLR combo input */}
      <circle cx="58" cy="60" r="13" className={metal} strokeWidth="1.5" />
      <circle cx="58" cy="60" r="6" className="fill-background stroke-border" strokeWidth="1" />
      <circle cx="54" cy="55" r="2" className="fill-foreground/40" />
      <circle cx="63" cy="64" r="2" className="fill-foreground/40" />
      {/* gain knob */}
      <circle cx="106" cy="60" r="15" className={metal} strokeWidth="1.5" />
      <circle cx="106" cy="60" r="10" className="fill-background/50 stroke-border" strokeWidth="1" />
      <line x1="106" y1="46" x2="106" y2="54" className={cn("stroke-foreground", active ? "opacity-80" : "opacity-40")} strokeWidth="2" strokeLinecap="round" />
      {/* headphone jack */}
      <circle cx="146" cy="60" r="8" className={metal} strokeWidth="1.5" />
      <circle cx="146" cy="60" r="4" className="fill-background stroke-border" strokeWidth="1" />
      {/* monitor knob + power LED */}
      <circle cx="174" cy="54" r="7" className={cn("fill-[oklch(0.72_0.17_60)]", active ? "opacity-90" : "opacity-40")} />
      <circle cx="174" cy="72" r="2.5" className={cn("fill-primary", active ? "animate-pulse" : "opacity-30")} />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-[11px] text-foreground">{value}</div>
    </div>
  );
}

/**
 * Illustration of the user's audio interface in the audio settings.
 * Honest by design: the browser only reports a device label, so a Volt-style
 * picture shows when the label matches, otherwise a generic front panel is
 * drawn with the real name.
 */
export function AudioInterfaceCard({ inputs, outputs, inputDevice, channel, sampleRate, scanning }: Props) {
  const apple = useIsAppleMobile();
  const current = inputDevice === "System default" ? null : inputs.find((d) => d.label === inputDevice) ?? null;
  const label = current?.label ?? "System default input";
  const isVolt = /volt/i.test(current?.label ?? "");
  const active = Boolean(current) || inputDevice !== "System default";
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface sm:flex-row">
      <div className="relative h-36 w-full shrink-0 overflow-hidden bg-background sm:h-44 sm:w-60">
        {isVolt ? (
          <img src={voltFace} alt="Audio interface" loading="lazy" width={1024} height={768} className="h-full w-full object-cover" />
        ) : (
          <GenericInterface active={active} />
        )}
        <span
          className={cn(
            "absolute left-2 top-2 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest",
            active ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-surface text-muted-foreground"
          )}
        >
          {isVolt ? "Volt · 1 in / 2 out" : active ? "Interface" : "No interface detected"}
        </span>
        <span className="absolute bottom-2 left-2 rounded-sm border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {channel === "in1" ? "IN 1" : channel === "in2" ? "IN 2" : "IN 1 + 2"}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-semibold text-foreground">{label}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {isVolt
              ? "USB audio interface — mic input, headphones and monitor out"
              : current
                ? "USB audio device — recording, sampling and Hum to Beat use this input"
                : "Playing and recording through your computer's chosen audio device"}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Volt 1 hardware is fixed: one mic/line input, two line outputs.
              The browser enumerates each playback/recording track separately,
              which inflated the counts — show the real hardware instead. */}
          <Stat label="Inputs" value={isVolt ? "1 (mic / line)" : String(inputs.length)} />
          <Stat label="Outputs" value={isVolt ? "2 (line out)" : String(outputs.length)} />
          <Stat label="Record ch" value={channel === "in1" ? "1 (mono)" : channel === "in2" ? "2 (mono)" : "1+2 stereo"} />
          <Stat label="Sample rate" value={sampleRate > 0 ? `${sampleRate} Hz` : "Not started yet"} />
        </div>
        <div className="truncate text-[10px] text-muted-foreground">
          {scanning
            ? "Reading your audio devices…"
            : inputs.length
              ? "The drawing follows the interface named above when the browser recognizes it."
              : "Press Detect devices below to show your interface here."}
        </div>
        {/* iPad/iPhone route audio per app in Control Centre, so the picker above cannot move sound there. */}
        {apple && (
          <div className="text-[10px] text-muted-foreground">
            On iPad, iPadOS routes audio itself: open Control Centre, tap the audio card, and pick this interface for SYNCLAB.
          </div>
        )}
      </div>
    </div>
  );
}
