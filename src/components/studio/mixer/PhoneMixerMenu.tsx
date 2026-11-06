import type { ReactNode } from "react";
import { Maximize2, Menu, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStudio } from "@/lib/synclab/store";
import { cn } from "@/lib/utils";
import { MidiLearnStrip } from "../MidiLearn";
import { PhoneEqButton, PhoneFxMenu, type TouchStripSize } from "./PhoneMixer";
import { AUX_IDS, BUS_STRIPS, VCA_IDS } from "./shared";

export type RouteKind = "bus" | "vca" | "aux";

const BIG = "min-h-12 rounded-md px-3 text-sm font-bold";

/**
 * Phone mixer menu: the controls that sat along the top of the full desk (channel counts, buses,
 * VCA, aux, clear solo, unmute all, strip size, desk colour) laid out as big touch tiles.
 */
export function PhoneMixerMenu({
  show,
  setShow,
  counts,
  setCount,
  size,
  setSize,
  soloed,
  muted,
  clearSolo,
  unmuteAll,
  outDb,
  desk,
}: {
  show: Record<RouteKind, boolean>;
  setShow: (k: RouteKind, on: boolean) => void;
  counts: Record<RouteKind, number>;
  setCount: (k: RouteKind, n: number) => void;
  size: TouchStripSize;
  setSize: (s: TouchStripSize) => void;
  soloed: boolean;
  muted: boolean;
  clearSolo: () => void;
  unmuteAll: () => void;
  outDb: number;
  desk: ReactNode;
}) {
  const { tracks, selectedId } = useStudio();
  const selected = tracks.find((t) => t.id === selectedId);
  const groups: [RouteKind, string, number, string][] = [
    ["bus", "Buses", BUS_STRIPS.length, "Group channels (drums, vocals…) before the master. Auto shows only buses that have tracks."],
    ["vca", "VCA groups", VCA_IDS.length, "One fader that turns a set of tracks up or down together."],
    ["aux", "Aux returns", AUX_IDS.length, "Reverb, delay and chorus returns fed by each channel's sends."],
  ];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="phone-mixer-menu-btn h-11 shrink-0 gap-1.5 px-3 text-sm font-bold" aria-label="Open mixer menu" title="Mixer menu: channels, buses, VCA, aux, desk colour">
          <Menu className="size-5" /> MENU
        </Button>
      </DialogTrigger>
      <DialogContent className="phone-strip-dialog phone-mixer-menu max-h-[88dvh] max-w-[96vw] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle>Mixer menu</DialogTitle>
          <DialogDescription>Choose what the mixer shows. Swipe or use the scroll bar under the channels to see them all.</DialogDescription>
        </DialogHeader>

        <section aria-label="Show on the mixer" className="grid gap-2">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Show on the mixer</h3>
          <div className="grid grid-cols-3 gap-2">
            {groups.map(([k, label, max, hint]) => (
              <div key={k} className={cn("flex flex-col gap-2 rounded-md border p-2", show[k] ? "border-primary/70 bg-primary/10" : "border-border bg-surface")}>
                <Button
                  variant={show[k] ? "default" : "outline"}
                  className={cn(BIG, "w-full")}
                  aria-pressed={show[k]}
                  onClick={() => setShow(k, !show[k])}
                >
                  {label} {show[k] ? "ON" : "OFF"}
                </Button>
                <div className="flex flex-wrap gap-1" role="group" aria-label={`How many ${label.toLowerCase()}`}>
                  {Array.from({ length: max + 1 }, (_, n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setCount(k, n); if (!show[k]) setShow(k, true); }}
                      aria-pressed={counts[k] === n}
                      aria-label={`${k === "bus" && n === 0 ? "Auto" : n} ${label.toLowerCase()}`}
                      className={cn(
                        "h-10 min-w-10 flex-1 rounded-md border px-1.5 font-mono text-xs font-bold",
                        counts[k] === n ? "border-primary bg-primary/25 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {k === "bus" && n === 0 ? "Auto" : n}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Channel actions" className="grid gap-2">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Channels</h3>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className={BIG} disabled={!soloed} onClick={clearSolo}>Clear solo</Button>
            <Button variant="outline" className={BIG} disabled={!muted} onClick={unmuteAll}><VolumeX className="size-4" /> Unmute all</Button>
            <Button variant="outline" className={BIG} onClick={() => window.dispatchEvent(new CustomEvent("synclab:mixer-full"))}><Maximize2 className="size-4" /> Full screen</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold uppercase text-foreground">
              {selected ? `Selected: ${selected.name}` : "Tap a channel name to select it"}
            </span>
            <div className="flex shrink-0 items-center gap-2 [&_button]:min-h-11">
              <PhoneFxMenu />
              <PhoneEqButton />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-11 px-3 text-xs font-bold" disabled={!selected} aria-label="Mixer MIDI Learn">MIDI Learn</Button>
                </PopoverTrigger>
                {selected && (
                  <PopoverContent className="w-[min(88vw,520px)]">
                    <MidiLearnStrip id={selected.id} label={`${selected.name} channel — move a knob/fader after tapping`} />
                  </PopoverContent>
                )}
              </Popover>
            </div>
          </div>
        </section>

        <section aria-label="Channel size" className="grid gap-2">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Channel width</h3>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Channel width">
            {(["narrow", "normal", "wide"] as const).map((s) => (
              <Button key={s} variant={size === s ? "default" : "outline"} className={cn(BIG, "capitalize")} aria-pressed={size === s} onClick={() => setSize(s)}>
                {s === "narrow" ? "Narrow · more channels" : s === "wide" ? "Wide · bigger" : "Normal"}
              </Button>
            ))}
          </div>
        </section>

        <section aria-label="Desk colour" className="grid gap-2">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Desk colour</h3>
          {desk}
        </section>

        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Out {outDb.toFixed(0)} dB · {tracks.length} channels
        </p>
      </DialogContent>
    </Dialog>
  );
}
