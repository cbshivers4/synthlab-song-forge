import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Knob } from "./Knob";
import {
  REPEAT_RATES,
  clampSwing,
  type NoteRepeatSettings,
  type RepeatRateId,
} from "@/lib/synclab/mpc-pad";

/** MPC Note Repeat: hold a pad and it keeps hitting at the chosen rate, with swing. */
export function NoteRepeatBar({
  settings,
  onChange,
  disabled,
}: {
  settings: NoteRepeatSettings;
  onChange: (next: NoteRepeatSettings) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2/60 p-2"
      role="group"
      aria-label="Note repeat"
    >
      <Button
        type="button"
        size="sm"
        variant={settings.on ? "default" : "outline"}
        className="h-9 gap-1.5 font-mono text-[10px] tracking-widest sm:h-7"
        aria-pressed={settings.on}
        disabled={disabled}
        title="Hold a pad and it repeats in time with the song tempo"
        onClick={() => onChange({ ...settings, on: !settings.on })}
      >
        <Repeat className="size-3.5" /> NOTE REPEAT {settings.on ? "ON" : "OFF"}
      </Button>
      <Select
        value={settings.rate}
        disabled={!!disabled}
        onValueChange={(rate) => onChange({ ...settings, rate: rate as RepeatRateId })}
      >
        <SelectTrigger aria-label="Note repeat rate" className="h-9 w-24 font-mono text-xs sm:h-7">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPEAT_RATES.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Knob
        label="SWING"
        ariaLabel="Note repeat swing"
        layout="inline"
        size={30}
        value={settings.swing}
        min={50}
        max={75}
        step={1}
        defaultValue={50}
        format={(v) => `${Math.round(v)}%`}
        onChange={(v) => onChange({ ...settings, swing: clampSwing(Math.round(v)) })}
      />
      <span className="text-[11px] text-muted-foreground">
        {settings.on ? "Hold a pad to repeat it at the song tempo" : "Hold a pad to play it once"}
      </span>
    </div>
  );
}
