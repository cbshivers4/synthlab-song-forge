import { useState, useSyncExternalStore } from "react";
import {
  ArrowUpFromLine,
  Circle,
  FlipHorizontal2,
  Pause,
  Play,
  Plus,
  Rewind,
  FastForward,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReelRecorder } from "@/lib/synclab/reel-recorder";
import { reelAngles } from "@/lib/synclab/reel-audio";
import { getTapeMedia, useTapeMedia } from "@/lib/synclab/tape-media";
import {
  CASSETTE_TYPES,
  MAX_NAME,
  cassetteSideSeconds,
  cassetteType,
  shelfTag,
  shownName,
  sideSeconds,
  type Cassette,
  type CassetteSide,
} from "@/lib/synclab/tape-media-model";
import { Knob } from "./Knob";
import { TapeExportBar } from "./ReelRecorder";
import { DeckKey, DeckMeters, TapeSourceControls, tapeClock } from "./TapeControls";
import { DeleteFromShelfButton, SaveToAccountButton } from "./ShelfControls";

const HUB = 13;
const PACK = 40;
const packRadius = (fill: number) =>
  Math.sqrt(HUB ** 2 + Math.max(0, Math.min(1, fill)) * (PACK ** 2 - HUB ** 2));

/** A compact cassette drawn as SVG: label with its name and side, window with real tape packs. */
export function CassetteArt({
  cassette,
  side,
  progress = 0,
  seconds = 1,
  compact,
}: {
  cassette: Cassette;
  side: CassetteSide;
  /** tape wound onto the right hub, 0..1 */
  progress?: number;
  seconds?: number;
  compact?: boolean;
}) {
  const type = cassetteType(cassette.typeId);
  const name = shownName(cassette.name, type.name);
  const angles = reelAngles(progress, seconds);
  const clip = `cs-win-${cassette.id}`;
  const hub = (cx: number, angle: number) => (
    <g transform={`rotate(${angle} ${cx} 111)`}>
      <circle cx={cx} cy="111" r={HUB} className="cs-hub" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect
          key={a}
          x={cx - 2}
          y="99"
          width="4"
          height="6"
          className="cs-tooth"
          transform={`rotate(${a} ${cx} 111)`}
        />
      ))}
      <circle cx={cx} cy="111" r="5" className="cs-hub-hole" />
    </g>
  );
  return (
    <svg
      viewBox="0 0 400 250"
      className="cassette-art"
      data-shell={type.shell}
      role="img"
      aria-label={`${name}, ${type.name}, side ${side}`}
    >
      <defs>
        <clipPath id={clip}>
          <rect x="110" y="82" width="180" height="58" rx="8" />
        </clipPath>
      </defs>
      <rect x="2" y="2" width="396" height="246" rx="16" className="cs-shell" />
      {[
        [18, 18],
        [382, 18],
        [18, 232],
        [382, 232],
        [200, 236],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" className="cs-screw" />
      ))}
      <rect x="26" y="16" width="348" height="150" rx="8" className="cs-label" />
      <rect x="26" y="16" width="348" height="16" rx="6" className="cs-stripe" />
      <text x="44" y="64" className="cs-side">
        {side}
      </text>
      <text x="76" y="60" className="cs-name">
        {name.length > 26 ? `${name.slice(0, 25)}…` : name}
      </text>
      <line x1="76" y1="68" x2="356" y2="68" className="cs-rule" />
      {!compact && (
        <text x="356" y="158" className="cs-type" textAnchor="end">
          {`C${type.minutes} · ${type.formula.toUpperCase()}`}
        </text>
      )}
      <rect x="110" y="82" width="180" height="58" rx="8" className="cs-window" />
      <g clipPath={`url(#${clip})`}>
        <circle cx="150" cy="111" r={packRadius(1 - progress)} className="cs-pack" />
        <circle cx="250" cy="111" r={packRadius(progress)} className="cs-pack" />
      </g>
      {hub(150, angles.supply)}
      {hub(250, angles.takeUp)}
      <rect x="110" y="82" width="180" height="58" rx="8" className="cs-glass" />
      <path d="M86 248 L108 190 H292 L314 248 Z" className="cs-bottom" />
      {[132, 168, 232, 268].map((x) => (
        <circle key={x} cx={x} cy="222" r="6" className="cs-hole" />
      ))}
      <rect x="184" y="212" width="32" height="16" rx="2" className="cs-hole" />
    </svg>
  );
}

export function CassetteDeck() {
  const media = useTapeMedia();
  const m = getTapeMedia();
  const recorder = getReelRecorder();
  const state = useSyncExternalStore(
    recorder.subscribe,
    recorder.getSnapshot,
    recorder.getSnapshot,
  );
  const cassette = media.cassettes.find((c) => c.id === media.deck.cassetteId) ?? null;
  const type = cassette ? cassetteType(cassette.typeId) : null;
  const capacity = cassette ? sideSeconds(cassette.typeId) : 0;
  const recording = state.mode === "recording";
  const playing = state.mode === "playing";
  const moving = media.deck.motion !== "idle";
  const locked = state.busy || moving;
  const loaded = !!cassette && !moving;
  const progress = capacity ? Math.min(1, state.position / capacity) : 0;
  const status = !cassette
    ? "NO TAPE"
    : moving
      ? media.deck.motion.toUpperCase()
      : state.busy
        ? "WAIT"
        : state.full
          ? "END OF SIDE"
          : state.mode.toUpperCase();
  return (
    <section className="cassette-section flex flex-col gap-3" aria-label="Cassette deck">
      <div
        className="cassette-deck"
        data-recording={recording || undefined}
        data-moving={playing || recording || state.mode === "rewinding" || undefined}
      >
        <header className="deck-brand">
          <div>
            <strong>SYNCLAB</strong> <span>CX-1 STEREO CASSETTE DECK</span>
          </div>
          <div className="deck-lights" aria-label="Tape type">
            {(["Normal", "Chrome", "Metal"] as const).map((f) => (
              <span key={f} data-on={type?.formula === f || undefined}>
                {f.toUpperCase()}
              </span>
            ))}
            <span className="deck-rec-light" data-on={recording || undefined}>
              REC
            </span>
          </div>
        </header>
        <div className="deck-body">
          <div className="deck-well" data-door-open={media.deck.doorOpen || undefined}>
            <div className="deck-bay">
              {cassette ? (
                <div className="deck-cassette" data-motion={media.deck.motion}>
                  <CassetteArt
                    cassette={cassette}
                    side={media.deck.side}
                    progress={progress}
                    seconds={capacity}
                  />
                </div>
              ) : (
                <p className="deck-empty">Pick a cassette from the shelf below to put it in.</p>
              )}
            </div>
            <div className="deck-door" aria-hidden="true" />
          </div>
          <div className="deck-panel">
            <div className="deck-lcd" role="status" aria-live="polite">
              <div className="deck-lcd-row">
                <span>{cassette ? `SIDE ${media.deck.side}` : "—"}</span>
                <span data-rec={recording || undefined}>{status}</span>
              </div>
              <output aria-label="Tape counter" className="deck-counter">
                {tapeClock(state.position)}
              </output>
              <div className="deck-lcd-row">
                <span>REC {tapeClock(state.duration)}</span>
                <span>SIDE {tapeClock(capacity)}</span>
              </div>
            </div>
            <DeckMeters state={state} />
          </div>
        </div>
        <div className="deck-keys">
          <DeckKey
            label="EJECT"
            icon={<ArrowUpFromLine />}
            disabled={!cassette || locked}
            onClick={() => void m.ejectCassette()}
            title="Eject the cassette"
          />
          <DeckKey
            label="FLIP"
            icon={<FlipHorizontal2 />}
            disabled={!loaded || state.busy}
            onClick={() => void m.flipCassette()}
            title={`Turn the cassette over to side ${media.deck.side === "A" ? "B" : "A"}`}
          />
          <DeckKey
            label="REW"
            icon={<Rewind />}
            active={state.mode === "rewinding"}
            disabled={!loaded || locked || recording || !state.hasTape || state.position <= 0}
            onClick={() => void recorder.rewind()}
            title="Rewind"
          />
          <DeckKey
            label={playing ? "PAUSE" : "PLAY"}
            icon={playing ? <Pause /> : <Play />}
            title={playing ? "Pause the tape" : "Play the tape"}
            active={playing}
            disabled={!loaded || locked || recording || !state.hasTape}
            onClick={() => void recorder.play()}
          />
          <DeckKey
            label="STOP"
            icon={<Square className="fill-current" />}
            title="Stop the tape"
            disabled={!loaded || state.busy}
            onClick={() => void recorder.stop()}
          />
          <DeckKey
            label="F.FWD"
            icon={<FastForward />}
            disabled={!loaded || locked || recording || !state.hasTape}
            onClick={() => void recorder.seek(state.position + 10)}
            title="Fast forward ten seconds"
          />
          <DeckKey
            label="REC"
            danger
            icon={<Circle className="fill-current" />}
            active={recording}
            disabled={!loaded || locked || recording}
            onClick={() => void recorder.record({ punchIn: true })}
            title="Record onto this side from the counter position"
          />
        </div>
        <div className="deck-controls">
          <div className="flex flex-wrap justify-center gap-4">
            <Knob
              label="Rec level"
              min={-24}
              max={24}
              step={0.5}
              value={state.inputGain}
              unit=" dB"
              onChange={(inputGain) => recorder.configure({ inputGain })}
              size={48}
            />
            <Knob
              label="Output"
              min={-48}
              max={6}
              step={0.5}
              value={state.outputGain}
              unit=" dB"
              onChange={(outputGain) => recorder.configure({ outputGain })}
              size={48}
            />
            <Knob
              label="Pitch"
              min={0.9}
              max={1.1}
              step={0.005}
              value={Math.max(0.9, Math.min(1.1, state.speed))}
              unit="×"
              onChange={(speed) => recorder.configure({ speed })}
              size={48}
            />
            <Knob
              label="Saturation"
              value={state.drive}
              onChange={(drive) => recorder.configure({ drive })}
              size={48}
            />
          </div>
          <TapeSourceControls state={state} locked={locked} />
          {state.monitor && (
            <p className="text-xs text-amber">Use headphones to avoid microphone feedback.</p>
          )}
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            REC records onto the side from the counter, like a real deck: what was under it is
            replaced and the rest stays. Recording stops by itself at the end of the side — flip the
            cassette to keep going. Press Save cassette to keep it (both sides and its name) in your
            account; it comes back on the shelf on every device you sign in on.
          </p>
        </div>
      </div>
      <TapeExportBar
        nameLabel={null}
        canLoad={!!cassette}
        keep={
          cassette ? (
            <SaveToAccountButton kind="cassette" item={cassette} disabled={recording || moving} />
          ) : null
        }
      />
      <CassetteShelf />
    </section>
  );
}

function CassetteShelf() {
  const media = useTapeMedia();
  const m = getTapeMedia();
  const [picked, setPicked] = useState<string | null>(null);
  const [newType, setNewType] = useState(CASSETTE_TYPES[2]!.id);
  const [newName, setNewName] = useState("");
  const selected = media.cassettes.find((c) => c.id === (picked ?? media.deck.cassetteId)) ?? null;
  const inDeck = (c: Cassette) => c.id === media.deck.cassetteId;
  const busy = media.deck.motion !== "idle";
  return (
    <section
      className="cassette-shelf rounded-md border border-border bg-card p-3"
      aria-label="Cassette shelf"
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <h3 className="mr-auto font-display text-sm font-semibold uppercase tracking-wider">
          Cassette shelf
        </h3>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          New cassette
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="h-11 rounded border border-input bg-background px-2 text-foreground"
          >
            {CASSETTE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-muted-foreground sm:flex-none">
          Name
          <input
            value={newName}
            maxLength={MAX_NAME}
            placeholder="My mixtape"
            onChange={(e) => setNewName(e.target.value)}
            className="h-11 rounded border border-input bg-background px-2 text-foreground"
          />
        </label>
        <Button
          className="h-11"
          onClick={() => {
            setPicked(m.addCassette(newType, newName));
            setNewName("");
          }}
        >
          <Plus />
          Add cassette
        </Button>
      </div>
      {selected && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded border border-border bg-background/60 p-2">
          <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Cassette name
            <input
              value={selected.name}
              maxLength={MAX_NAME}
              aria-label="Cassette name"
              placeholder={cassetteType(selected.typeId).name}
              onChange={(e) => m.renameCassette(selected.id, e.target.value)}
              className="h-11 rounded border border-input bg-background px-2 text-foreground"
            />
          </label>
          <Button
            className="h-11"
            disabled={busy || inDeck(selected) || media.shelf.loading === selected.id}
            onClick={() => void m.insertCassette(selected.id)}
          >
            {media.shelf.loading === selected.id
              ? "Loading…"
              : inDeck(selected)
                ? "In the deck"
                : "Put in deck"}
          </Button>
          <SaveToAccountButton kind="cassette" item={selected} disabled={busy} />
          {(["A", "B"] as const).map((side) => (
            <Button
              key={side}
              variant="outline"
              className="h-11"
              disabled={cassetteSideSeconds(selected, side) <= 0 || busy}
              onClick={() => void m.eraseSide(selected.id, side)}
              title={`Erase side ${side}`}
            >
              Erase {side}
            </Button>
          ))}
          <DeleteFromShelfButton
            kind="cassette"
            item={selected}
            name={shownName(selected.name, cassetteType(selected.typeId).name)}
            disabled={inDeck(selected)}
            onDeleted={() => setPicked(null)}
          />
        </div>
      )}
      <div className="cassette-grid">
        {media.cassettes.map((c) => {
          const type = cassetteType(c.typeId);
          const tag = shelfTag(c);
          return (
            <button
              key={c.id}
              type="button"
              className="cassette-slot"
              data-selected={selected?.id === c.id || undefined}
              data-in-deck={inDeck(c) || undefined}
              onClick={() => setPicked(c.id)}
              onDoubleClick={() => void m.insertCassette(c.id)}
              aria-label={`${shownName(c.name, type.name)}${inDeck(c) ? ", in the deck" : ""}`}
            >
              <CassetteArt cassette={c} side="A" compact />
              <span className="cassette-slot-name">{shownName(c.name, type.name)}</span>
              <span className="cassette-slot-meta">
                {inDeck(c)
                  ? "IN DECK"
                  : `A ${tapeClock(cassetteSideSeconds(c, "A"))} · B ${tapeClock(cassetteSideSeconds(c, "B"))}`}
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
