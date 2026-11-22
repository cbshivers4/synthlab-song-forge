import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTapeMedia, useTapeMedia } from "@/lib/synclab/tape-media";
import {
  MAX_NAME,
  REEL_TYPES,
  reelSeconds,
  reelSizeLabel,
  reelTapeSeconds,
  reelType,
  shelfTag,
  shownName,
  type Reel,
} from "@/lib/synclab/tape-media-model";
import { tapeClock } from "./TapeControls";
import { DeleteFromShelfButton, SaveToAccountButton } from "./ShelfControls";

const HUB = 34;
const PACK = 96;
/** A reel drawn for the shelf: flange colour and size from its type, tape pack from what's on it. */
export function ReelArt({ reel }: { reel: Reel }) {
  const type = reelType(reel.typeId);
  const fill = Math.min(1, reelTapeSeconds(reel) / reelSeconds(reel.typeId));
  // A blank reel still carries a full pack of unrecorded tape; recorded tape shows darker.
  const pack = PACK;
  const recorded = Math.sqrt(HUB ** 2 + fill * (PACK ** 2 - HUB ** 2));
  const name = shownName(reel.name, type.name);
  const windows = [0, 120, 240].map((a) => {
    const t = (a * Math.PI) / 180;
    const p = (r: number, ang: number) => `${120 + r * Math.sin(ang)} ${120 - r * Math.cos(ang)}`;
    const s = 0.62;
    return `M${p(44, t - s * 0.9)} L${p(100, t - s)} A100 100 0 0 1 ${p(100, t + s)} L${p(44, t + s * 0.9)} A44 44 0 0 0 ${p(44, t - s * 0.9)}Z`;
  });
  return (
    <svg
      viewBox="0 0 240 240"
      className="reel-art"
      data-finish={type.finish}
      data-oxide={type.oxide}
      data-size={type.size}
      role="img"
      aria-label={`${name}, ${type.name}`}
    >
      <circle cx="120" cy="120" r={pack} className="ra-pack" />
      {fill > 0 && <circle cx="120" cy="120" r={recorded} className="ra-recorded" />}
      <path
        className="ra-flange"
        fillRule="evenodd"
        d={`M120 6a114 114 0 1 0 0.01 0Z ${windows.join(" ")}`}
      />
      <circle cx="120" cy="120" r="112" className="ra-edge" />
      <circle cx="120" cy="120" r="38" className="ra-hub" />
      <circle cx="120" cy="120" r="12" className="ra-center" />
      <text x="120" y="60" className="ra-size" textAnchor="middle">
        {reelSizeLabel(type.size)}
      </text>
    </svg>
  );
}

/** Shelf of reel tapes: pick one to thread on the machine, name it and save it to the account. */
export function ReelShelf() {
  const media = useTapeMedia();
  const m = getTapeMedia();
  const [picked, setPicked] = useState<string | null>(null);
  const [newType, setNewType] = useState(REEL_TYPES[0]!.id);
  const [newName, setNewName] = useState("");
  const threadedId = media.reelDeck.reelId;
  const selected = media.reels.find((r) => r.id === (picked ?? threadedId)) ?? null;
  const onMachine = (r: Reel) => r.id === threadedId;
  const busy = media.reelDeck.motion !== "idle";
  return (
    <section
      id="reel-shelf"
      className="cassette-shelf rounded-md border border-border bg-card p-3"
      aria-label="Reel shelf"
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <h3 className="mr-auto font-display text-sm font-semibold uppercase tracking-wider">
          Reel shelf
        </h3>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          New reel
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="h-11 rounded border border-input bg-background px-2 text-foreground"
          >
            {REEL_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.minutes} min
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-muted-foreground sm:flex-none">
          Name
          <input
            value={newName}
            maxLength={MAX_NAME}
            placeholder="Session tape 1"
            onChange={(e) => setNewName(e.target.value)}
            className="h-11 rounded border border-input bg-background px-2 text-foreground"
          />
        </label>
        <Button
          className="h-11"
          onClick={() => {
            setPicked(m.addReel(newType, newName));
            setNewName("");
          }}
        >
          <Plus />
          Add reel
        </Button>
      </div>
      {selected && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded border border-border bg-background/60 p-2">
          <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Reel name
            <input
              value={selected.name}
              maxLength={MAX_NAME}
              aria-label="Reel name"
              placeholder={reelType(selected.typeId).name}
              onChange={(e) => m.renameReel(selected.id, e.target.value)}
              className="h-11 rounded border border-input bg-background px-2 text-foreground"
            />
          </label>
          <Button
            className="h-11"
            variant={onMachine(selected) ? "outline" : "default"}
            disabled={busy || media.shelf.loading === selected.id}
            onClick={() => void (onMachine(selected) ? m.removeReel() : m.loadReel(selected.id))}
          >
            {media.shelf.loading === selected.id
              ? "Loading…"
              : onMachine(selected)
                ? "Remove from machine"
                : "Load on machine"}
          </Button>
          <SaveToAccountButton kind="reel" item={selected} disabled={busy} />
          <Button
            variant="outline"
            className="h-11"
            disabled={busy || reelTapeSeconds(selected) <= 0}
            onClick={() => void m.eraseReel(selected.id)}
            title="Erase this reel's tape"
          >
            Erase
          </Button>
          <DeleteFromShelfButton
            kind="reel"
            item={selected}
            name={shownName(selected.name, reelType(selected.typeId).name)}
            disabled={onMachine(selected) || busy}
            onDeleted={() => setPicked(null)}
          />
        </div>
      )}
      <div className="cassette-grid">
        {media.reels.map((r) => {
          const type = reelType(r.typeId);
          const tag = shelfTag(r);
          return (
            <button
              key={r.id}
              type="button"
              className="cassette-slot"
              data-selected={selected?.id === r.id || undefined}
              data-in-deck={onMachine(r) || undefined}
              onClick={() => setPicked(r.id)}
              onDoubleClick={() => void m.loadReel(r.id)}
              aria-label={`${shownName(r.name, type.name)}${onMachine(r) ? ", on the machine" : ""}`}
            >
              <ReelArt reel={r} />
              <span className="cassette-slot-name">{shownName(r.name, type.name)}</span>
              <span className="cassette-slot-meta">
                {onMachine(r)
                  ? "ON MACHINE"
                  : `${tapeClock(reelTapeSeconds(r))} / ${type.minutes} min · ${type.speed}`}
              </span>
              {tag && (
                <span className="shelf-tag" data-dirty={tag === "UNSAVED" || undefined}>
                  {tag}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
