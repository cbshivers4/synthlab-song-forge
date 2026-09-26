import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudio, type MidiTarget } from "@/lib/synclab/store";
import { Button } from "@/components/ui/button";

/** Small assign/clear control beside any continuous parameter. */
export function MidiLearnButton({ id, param, label }: MidiTarget & { label: string }) {
  const { midiMap, midiLearn, startMidiLearn, cancelMidiLearn, clearMidiMapping, midiInputId, enableMidi } = useStudio();
  const target = { id, param };
  const assigned = Object.entries(midiMap).find(([, v]) => v.id === id && v.param === param);
  const learning = midiLearn?.id === id && midiLearn.param === param;
  return (
    <span className="inline-flex items-center gap-0.5">
      <Button type="button" size="sm" variant={learning || assigned ? "secondary" : "ghost"}
        className="h-6 min-w-8 px-1 font-mono text-[9px]" aria-label={`${learning ? "Cancel learning" : "MIDI Learn"} ${label}`}
        title={learning ? `Move a controller for ${label}` : assigned ? `${label}: CC ${assigned[0].split(":")[1]}` : `MIDI Learn ${label}`}
        onClick={() => {
          if (learning) cancelMidiLearn();
          else {
            startMidiLearn(target);
            if (!midiInputId) enableMidi();
          }
        }}>
        {learning ? "MOVE" : assigned ? `CC ${assigned[0].split(":")[1]}` : "MIDI"}
      </Button>
      {assigned && <Button type="button" size="icon" variant="ghost" className="size-6" aria-label={`Clear ${label} MIDI mapping`} onClick={() => clearMidiMapping(target)}><X className="size-3" /></Button>}
    </span>
  );
}

/** Assign hardware knobs/faders to a channel's controls. Shared by the mixer and the editors. */
export function MidiLearnBlock({
  id,
  params,
  title = "Hardware control",
}: {
  id: string;
  params?: MidiTarget["param"][];
  title?: string;
}) {
  const { midiMap, midiLearn, startMidiLearn, cancelMidiLearn, clearMidiMapping, midiInputId, enableMidi } = useStudio();
  const list = params ?? (["volume", "pan", "mute", "solo"] as MidiTarget["param"][]);
  const ccFor = (p: MidiTarget["param"]) => {
    const hit = Object.entries(midiMap).find(([, v]) => v.id === id && v.param === p);
    return hit ? `CC ${hit[0].split(":")[1]}` : null;
  };
  return (
    <div className="space-y-1">
      <div className="label-xs pt-1">{title}</div>
      {!midiInputId && (
        <button
          onClick={enableMidi}
          className="h-6 w-full rounded-sm border border-border bg-surface font-mono text-[8px] uppercase text-muted-foreground hover:text-foreground"
        >
          Connect MIDI controller
        </button>
      )}
      <div className="grid grid-cols-2 gap-1">
        {list.map((p) => {
          const cc = ccFor(p);
          const learning = midiLearn?.id === id && midiLearn.param === p;
          return (
            <div key={p} className="flex items-center gap-1">
              <button
                onClick={() => (learning ? cancelMidiLearn() : startMidiLearn({ id, param: p }))}
                className={cn(
                  "h-6 flex-1 rounded-sm border px-1 font-mono text-[8px] uppercase",
                  learning
                    ? "animate-pulse border-primary bg-primary/20 text-primary"
                    : cc
                      ? "border-primary/40 bg-surface text-primary"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
                title={cc ? `${p} follows ${cc}` : `Learn a knob for ${p}`}
              >
                {learning ? "MOVE…" : `${p} ${cc ?? ""}`}
              </button>
              {cc && (
                <button
                  onClick={() => clearMidiMapping({ id, param: p })}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Clear ${p} mapping`}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact one-row MIDI learn strip for editor toolbars. */
export function MidiLearnStrip({ id, label }: { id: string; label?: string }) {
  const { midiMap, midiLearn, startMidiLearn, cancelMidiLearn, clearMidiMapping, midiInputId, enableMidi } = useStudio();
  const params: MidiTarget["param"][] = ["volume", "pan", "mute", "solo"];
  const ccFor = (p: MidiTarget["param"]) => {
    const hit = Object.entries(midiMap).find(([, v]) => v.id === id && v.param === p);
    return hit ? hit[0].split(":")[1] : null;
  };
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-hide rounded-sm border border-border bg-surface/60 p-1.5">
      <span className="label-xs px-1">MIDI LEARN{label ? ` · ${label}` : ""}</span>
      {!midiInputId && (
        <button
          onClick={enableMidi}
          className="h-7 rounded-sm border border-border bg-surface px-2 font-mono text-[9px] uppercase text-muted-foreground hover:text-foreground"
        >
          Connect controller
        </button>
      )}
      {params.map((p) => {
        const cc = ccFor(p);
        const learning = midiLearn?.id === id && midiLearn.param === p;
        return (
          <span key={p} className="flex items-center gap-1">
            <button
              onClick={() => (learning ? cancelMidiLearn() : startMidiLearn({ id, param: p }))}
              className={cn(
                "h-7 rounded-sm border px-2 font-mono text-[9px] uppercase",
                learning
                  ? "animate-pulse border-primary bg-primary/20 text-primary"
                  : cc
                    ? "border-primary/40 bg-surface text-primary"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
              title={cc ? `${p} follows CC ${cc}` : `Press, then move a knob to control ${p}`}
            >
              {learning ? "MOVE A KNOB…" : `${p}${cc ? ` · CC ${cc}` : ""}`}
            </button>
            {cc && (
              <button
                onClick={() => clearMidiMapping({ id, param: p })}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Clear ${p} mapping`}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
