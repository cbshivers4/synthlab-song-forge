import { useState } from "react";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONTROL_DEVICES,
  CONTROL_PARTS,
  resetControlColors,
  setControlColor,
  useControlColors,
  type ControlDeviceId,
} from "@/lib/synclab/control-colors";

/** Four colour pickers (knob ring, knob body, sliders, front panel) for all devices or one device. */
export function ControlColorPickers({ target }: { target: "all" | ControlDeviceId }) {
  const prefs = useControlColors();
  const own = target === "all" ? prefs.all : (prefs.devices[target] ?? {});
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {CONTROL_PARTS.map(({ part, label, fallback }) => {
        const set = own[part];
        const inherited = target === "all" ? undefined : prefs.all[part];
        const shown = set ?? inherited ?? fallback;
        const note = set ? "Your colour" : inherited ? "From all devices" : "Built-in look";
        return (
          <div
            key={part}
            className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
            data-control-part={part}
          >
            <input
              type="color"
              aria-label={`${label} colour`}
              value={shown}
              onChange={(e) => setControlColor(target, part, e.target.value)}
              className={`size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 ${set ? "" : "opacity-60"}`}
            />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
              <span className="text-[11px] text-muted-foreground">{note}</span>
            </span>
            {set && (
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`Use the ${target === "all" ? "built-in" : "previous"} ${label.toLowerCase()} colour`}
                title="Remove this colour"
                onClick={() => setControlColor(target, part, undefined)}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Appearance section: one colour set for every device, plus each device's own colours. */
export function ControlColorsSection() {
  const prefs = useControlColors();
  const [device, setDevice] = useState<ControlDeviceId>("drums");
  const customised = CONTROL_DEVICES.filter((d) => prefs.devices[d.id]);
  return (
    <section className="panel p-3" data-control-color-settings>
      <span className="label-xs flex items-center gap-1">
        <SlidersHorizontal className="size-3.5" /> Knob, slider &amp; device colours
      </span>
      <p className="mt-1 text-xs text-muted-foreground">
        Colour the controls on the devices themselves — knob rings, knob bodies, sliders and faders,
        and each device&apos;s front panel. Saved on this device only, not in your songs.
      </p>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="label-xs">All devices</span>
          <Button size="sm" variant="ghost" onClick={() => resetControlColors("all")}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        </div>
        <ControlColorPickers target="all" />
      </div>

      <div className="mt-4 space-y-2 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-xs">One device</span>
          <Select value={device} onValueChange={(v) => setDevice(v as ControlDeviceId)}>
            <SelectTrigger className="h-8 w-52" aria-label="Device to colour">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTROL_DEVICES.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                  {prefs.devices[d.id] ? " •" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => resetControlColors(device)}>
            <RotateCcw className="size-3.5" /> Reset this device
          </Button>
        </div>
        <ControlColorPickers target={device} />
        {customised.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Own colours: {customised.map((d) => d.label).join(", ")}
          </p>
        )}
      </div>
    </section>
  );
}

/** Small button for a device's colour bar that opens that device's own control colours. */
export function ControlColorsButton({ device }: { device: ControlDeviceId }) {
  const label = CONTROL_DEVICES.find((d) => d.id === device)?.label ?? "Device";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          title={`Colour the knobs, sliders and front panel of the ${label}`}
        >
          <SlidersHorizontal className="size-4" /> Knobs &amp; panel
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] max-w-[92vw] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {label} colours
          </span>
          <Button size="sm" variant="ghost" onClick={() => resetControlColors(device)}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        </div>
        <ControlColorPickers target={device} />
        <p className="text-xs text-muted-foreground">
          Colours for every device are in Settings → Appearance &amp; themes.
        </p>
      </PopoverContent>
    </Popover>
  );
}
