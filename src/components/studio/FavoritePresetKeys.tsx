import { useState } from "react";
import { Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  assignSlot,
  clearSlot,
  firstEmptySlot,
  setFavoriteSlots,
  useFavoriteSlots,
} from "@/lib/synclab/preset-favorites";

/**
 * A row of favorite preset keys on a synth's face. Tapping a filled key loads that preset through
 * the same selection callback as the preset window; tapping an empty key stores the current preset.
 * EDIT mode lets any key be replaced with the current preset or cleared.
 */
export function FavoritePresetKeys({
  model,
  current,
  available,
  onSelect,
}: {
  model: string;
  current: string;
  available: string[];
  onSelect: (name: string) => void;
}) {
  const slots = useFavoriteSlots(model);
  const [editing, setEditing] = useState(false);
  const known = new Set(available);

  const store = (index: number) => {
    setFavoriteSlots(model, assignSlot(slots, index, current));
    toast.success(`Favorite ${index + 1}: ${current}`);
  };
  const addCurrent = () => {
    const already = slots.indexOf(current);
    if (already >= 0) {
      toast(`${current} is already on favorite ${already + 1}`);
      return;
    }
    const free = firstEmptySlot(slots);
    if (free < 0) {
      toast("All 8 favorite keys are full", {
        description: "Turn on EDIT, then tap a key to replace it with this preset.",
      });
      return;
    }
    store(free);
  };
  const press = (index: number) => {
    const name = slots[index];
    if (editing || !name) {
      store(index);
      return;
    }
    if (!known.has(name)) {
      toast.error(`"${name}" is no longer in this synth's presets`, {
        description: "Turn on EDIT to replace or clear this key.",
      });
      return;
    }
    onSelect(name);
  };

  return (
    <div
      className="synth-fav-strip flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Favorite presets"
    >
      <span className="synth-fav-title font-mono text-[11px] font-bold uppercase tracking-widest">
        Favorites
      </span>
      <div className="synth-fav-keys grid min-w-[min(100%,440px)] flex-1 grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1.5">
        {slots.map((name, i) => {
          const missing = Boolean(name) && !known.has(name!);
          const active = Boolean(name) && name === current;
          return (
            <div key={i} className="relative min-w-0">
              <button
                type="button"
                className="synth-fav-key flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded-[3px] border px-2 py-1 text-left"
                data-empty={name ? undefined : ""}
                data-missing={missing ? "" : undefined}
                data-editing={editing ? "" : undefined}
                aria-pressed={active}
                title={
                  editing
                    ? `Store ${current} on favorite ${i + 1}`
                    : name
                      ? `Load ${name}`
                      : `Store ${current} on favorite ${i + 1}`
                }
                onClick={() => press(i)}
              >
                <span className="synth-fav-num font-mono text-[11px] font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-tight">
                  {name
                    ? name.replace(/^(Poly Synth|Modular Tech|Granular|TD-3)\s+/i, "")
                    : editing
                      ? "Store here"
                      : "Empty"}
                </span>
              </button>
              {editing && name && (
                <button
                  type="button"
                  className="synth-fav-clear absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border"
                  aria-label={`Clear favorite ${i + 1}`}
                  onClick={() => setFavoriteSlots(model, clearSlot(slots, i))}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="min-h-10 gap-1.5"
        onClick={addCurrent}
        title={`Add ${current} to the first empty favorite key`}
      >
        <Star className="size-4" aria-hidden="true" /> Add current
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editing ? "default" : "secondary"}
        className="min-h-10"
        aria-pressed={editing}
        onClick={() => setEditing((v) => !v)}
      >
        {editing ? "Done" : "Edit"}
      </Button>
    </div>
  );
}
