import { useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpFromLine,
  Circle,
  Flame,
  Music2,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getReelRecorder } from "@/lib/synclab/reel-recorder";
import { getTapeMedia, useTapeMedia } from "@/lib/synclab/tape-media";
import {
  DISC_TYPES,
  MAX_NAME,
  captureSeconds,
  cassetteSideSeconds,
  cassetteType,
  discLengths,
  discTrackCount,
  discTrackSeconds,
  discType,
  reelTapeSeconds,
  reelType,
  shelfTag,
  shownName,
  type Disc,
} from "@/lib/synclab/tape-media-model";
import {
  CD_PROGRAM_INNER,
  CD_TRACK_GAP_SECONDS,
  cdBurnRadius,
  cdSafeName,
  cdUsedSeconds,
} from "@/lib/synclab/cd-audio";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { songSteps } from "@/lib/synclab/timebase";
import { Knob } from "./Knob";
import { DeckKey, DeckMeters, TapeSourceControls, tapeClock } from "./TapeControls";
import { TapeExportBar } from "./ReelRecorder";
import { DeleteFromShelfButton, SaveToAccountButton } from "./ShelfControls";

/** A CD-R drawn as SVG; the darker ring is the part of the disc already written. */
export function CdArt({
  disc,
  angle = 0,
  burned = 0,
  compact,
}: {
  disc: Disc;
  angle?: number;
  /** fraction of the disc's minutes already used, 0..1 */
  burned?: number;
  compact?: boolean;
}) {
  const type = discType(disc.typeId);
  const title = shownName(disc.title, "My CD");
  const r = cdBurnRadius(burned);
  const gid = `cd-sheen-${disc.id}`;
  return (
    <svg
      viewBox="0 0 120 120"
      className="cd-art"
      data-finish={type.finish}
      role="img"
      aria-label={`${title}, ${type.name}, ${Math.round(burned * 100)}% used`}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="cd-sheen-a" />
          <stop offset="0.35" className="cd-sheen-b" />
          <stop offset="0.6" className="cd-sheen-c" />
          <stop offset="1" className="cd-sheen-a" />
        </linearGradient>
      </defs>
      <g transform={`rotate(${angle} 60 60)`}>
        <circle cx="60" cy="60" r="58" className="cd-face" />
        <circle cx="60" cy="60" r="58" fill={`url(#${gid})`} className="cd-sheen" />
        {burned > 0 && (
          <path
            fillRule="evenodd"
            className="cd-burned"
            d={`M60 ${60 - r}a${r} ${r} 0 1 0 0.01 0Z M60 ${60 - CD_PROGRAM_INNER}a${CD_PROGRAM_INNER} ${CD_PROGRAM_INNER} 0 1 0 0.01 0Z`}
          />
        )}
        <circle cx="60" cy="60" r="58" className="cd-rim" />
        {!compact && (
          <>
            <text x="60" y="34" className="cd-title" textAnchor="middle">
              {title.length > 22 ? `${title.slice(0, 21)}…` : title}
            </text>
            <text x="60" y="94" className="cd-artist" textAnchor="middle">
              {disc.artist.trim() || "SYNCLAB"}
            </text>
          </>
        )}
        <circle cx="60" cy="60" r="17" className="cd-clamp" />
        <circle cx="60" cy="60" r="7.5" className="cd-hole" />
      </g>
    </svg>
  );
}

export function CdBurner() {
  const media = useTapeMedia();
  const m = getTapeMedia();
  const recorder = getReelRecorder();
  const state = useSyncExternalStore(
    recorder.subscribe,
    recorder.getSnapshot,
    recorder.getSnapshot,
  );
  const { tracks, transport, allBuses, vcas, auxReturns, fxChains } = useStudio();
  const { project } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dubFrom, setDubFrom] = useState("");
  const [rendering, setRendering] = useState(false);
  const [burnedName, setBurnedName] = useState<string | null>(null);
  const disc = media.discs.find((d) => d.id === media.tray.discId) ?? null;
  const type = disc ? discType(disc.typeId) : null;
  const recording = state.mode === "recording";
  const playing = state.mode === "playing";
  const trayMoving = media.tray.motion !== "idle";
  const ready = !!disc && !media.tray.open && !trayMoving;
  const locked = state.busy || trayMoving || !!media.burn || rendering;
  const lengths = disc ? discTrackSeconds(disc) : [];
  const capacity = (type?.minutes ?? 80) * 60;
  const liveSeconds = recording ? state.duration + (lengths.length ? CD_TRACK_GAP_SECONDS : 0) : 0;
  const used = cdUsedSeconds(lengths) + liveSeconds;
  const trackIndex = disc ? disc.tracks.findIndex((t) => t.id === media.trackId) : -1;
  const angle = (state.position * 300) % 360;
  const status = media.burn
    ? `WRITING ${media.burn.done}/${media.burn.total}`
    : trayMoving
      ? media.tray.motion === "opening"
        ? "OPENING"
        : "CLOSING"
      : media.tray.open
        ? "TRAY OPEN"
        : !disc
          ? "NO DISC"
          : state.full
            ? "DISC FULL"
            : recording
              ? "REC"
              : state.mode === "rewinding"
                ? "SEARCH"
                : state.mode.toUpperCase();

  const addSong = async () => {
    if (!ready) return;
    setRendering(true);
    const id = toast.loading("Rendering your song for the CD…");
    try {
      const { renderSong } = await import("@/lib/synclab/song-render");
      const cap = await renderSong({
        tracks,
        transport,
        buses: allBuses,
        vcas,
        auxReturns,
        fxChains,
        startStep: 0,
        lengthSteps: songSteps(transport.bars),
        tail: 2,
        sampleRate: 44100,
      });
      if (!cap)
        throw new Error(
          "This browser can't render the song offline. Use REC with Song master instead.",
        );
      const error = m.addToDisc(cap, project?.name ?? "SYNCLAB song");
      if (error) throw new Error(error);
      toast.success("Song added to the CD", { id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add the song.", { id });
    } finally {
      setRendering(false);
    }
  };
  // Every recorded reel and cassette side on the shelves, saved ones included.
  const dubSources: {
    id: string;
    label: string;
    kind: "reel" | "cassette";
    item: string;
    key: string;
  }[] = [
    ...media.reels
      .filter((r) => reelTapeSeconds(r) > 0)
      .map((r) => ({
        id: `reel:${r.id}`,
        label: `${shownName(r.name, reelType(r.typeId).name)} (reel)`,
        kind: "reel" as const,
        item: r.id,
        key: "tape",
      })),
    ...media.cassettes.flatMap((c) =>
      (["A", "B"] as const)
        .filter((side) => cassetteSideSeconds(c, side) > 0)
        .map((side) => ({
          id: `cassette:${c.id}:${side}`,
          label: `${shownName(c.name, cassetteType(c.typeId).name)} · Side ${side}`,
          kind: "cassette" as const,
          item: c.id,
          key: side,
        })),
    ),
  ];
  const [dubbing, setDubbing] = useState(false);
  const dub = async () => {
    const source = dubSources.find((s) => s.id === dubFrom) ?? dubSources[0];
    if (!source || dubbing) return;
    setDubbing(true);
    try {
      const capture = await m.partCapture(source.kind, source.item, source.key);
      if (!capture) return;
      const error = m.addToDisc(capture, source.label);
      if (error) toast.error("Not added to the CD", { description: error });
      else toast.success(`${source.label} copied to the CD`);
    } catch (error) {
      toast.error("Couldn't copy it", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setDubbing(false);
    }
  };
  const burn = async () => {
    if (!disc?.tracks.length || media.burn) return;
    m.setBurn({ done: 0, total: disc.tracks.length + 1 });
    try {
      const { buildCdPackage } = await import("@/lib/synclab/cd-burn");
      const blob = await buildCdPackage(
        { title: shownName(disc.title, "My CD"), artist: disc.artist, tracks: disc.tracks },
        (done, total) => m.setBurn({ done, total }),
      );
      const name = `${cdSafeName(disc.title, "SYNCLAB CD")} (audio CD).zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setBurnedName(name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't write the CD files.");
    } finally {
      m.setBurn(null);
    }
  };

  return (
    <section className="cd-section flex flex-col gap-3" aria-label="CD burner">
      <div
        className="cd-burner"
        data-tray={media.tray.open ? "open" : "closed"}
        data-motion={media.tray.motion}
        data-laser={recording || !!media.burn || undefined}
      >
        <header className="deck-brand">
          <div>
            <strong>SYNCLAB</strong> <span>CDR-1 AUDIO CD RECORDER</span>
          </div>
          <div className="deck-lights" aria-label="Disc status">
            <span data-on={!!disc || undefined}>CD-R</span>
            <span data-on={!!disc || undefined}>{type ? `${type.minutes} MIN` : "— MIN"}</span>
            <span className="deck-rec-light" data-on={recording || !!media.burn || undefined}>
              LASER
            </span>
          </div>
        </header>
        <div className="deck-body">
          <div className="cd-drive">
            <div className="cd-window">
              <div className="cd-tray">
                {disc ? (
                  <CdArt disc={disc} angle={angle} burned={Math.min(1, used / capacity)} />
                ) : (
                  <p className="deck-empty">Pick a blank CD from the spindle below.</p>
                )}
              </div>
              <span className="cd-laser" aria-hidden="true" />
            </div>
            <div className="cd-drive-slot" aria-hidden="true">
              <span />
            </div>
          </div>
          <div className="deck-panel">
            <div className="deck-lcd" role="status" aria-live="polite">
              <div className="deck-lcd-row">
                <span>
                  TRACK{" "}
                  {trackIndex >= 0
                    ? String(trackIndex + 1).padStart(2, "0")
                    : recording
                      ? String(lengths.length + 1).padStart(2, "0")
                      : "--"}
                  {disc ? ` / ${String(disc.tracks.length).padStart(2, "0")}` : ""}
                </span>
                <span data-rec={recording || !!media.burn || undefined}>{status}</span>
              </div>
              <output aria-label="Disc time" className="deck-counter">
                {tapeClock(state.position)}
              </output>
              <div className="deck-lcd-row">
                <span>USED {tapeClock(used)}</span>
                <span>LEFT {tapeClock(Math.max(0, capacity - used))}</span>
              </div>
            </div>
            <DeckMeters state={state} />
          </div>
        </div>
        <div className="deck-keys">
          <DeckKey
            label={media.tray.open ? "CLOSE" : "OPEN"}
            icon={<ArrowUpFromLine />}
            disabled={locked || recording}
            onClick={() => void (media.tray.open ? m.closeTray() : m.openTray())}
            title={media.tray.open ? "Close the tray" : "Open the tray"}
          />
          <DeckKey
            label="PREV"
            icon={<SkipBack />}
            disabled={!ready || locked || recording || !disc?.tracks.length}
            onClick={() => void m.stepTrack(-1)}
            title="Previous track"
          />
          <DeckKey
            label={playing ? "PAUSE" : "PLAY"}
            icon={playing ? <Pause /> : <Play />}
            title={playing ? "Pause the CD" : "Play the CD"}
            active={playing}
            disabled={!ready || locked || recording || !state.hasTape}
            onClick={() => void recorder.play()}
          />
          <DeckKey
            label="STOP"
            icon={<Square className="fill-current" />}
            title="Stop the CD"
            disabled={!ready || state.busy}
            onClick={() => void recorder.stop()}
          />
          <DeckKey
            label="NEXT"
            icon={<SkipForward />}
            disabled={!ready || locked || recording || !disc?.tracks.length}
            onClick={() => void m.stepTrack(1)}
            title="Next track"
          />
          <DeckKey
            label="REC"
            danger
            icon={<Circle className="fill-current" />}
            active={recording}
            disabled={!ready || locked || recording}
            onClick={() => {
              m.readyLiveTake();
              void recorder.record();
            }}
            title="Record a new live track onto the CD"
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
          </div>
          <TapeSourceControls state={state} locked={locked} />
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Live CD: press REC and every take becomes the next track on the disc (track-at-once),
            until you press STOP. Recording stops by itself when the disc is full.
          </p>
        </div>
      </div>

      {disc && (
        <section className="rounded-md border border-border bg-card p-3" aria-label="This CD">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              CD name
              <input
                value={disc.title}
                maxLength={MAX_NAME}
                placeholder="My CD"
                onChange={(e) => m.renameDisc(disc.id, { title: e.target.value })}
                className="h-11 rounded border border-input bg-background px-2 text-foreground"
              />
            </label>
            <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Artist
              <input
                value={disc.artist}
                maxLength={MAX_NAME}
                placeholder="SYNCLAB"
                onChange={(e) => m.renameDisc(disc.id, { artist: e.target.value })}
                className="h-11 rounded border border-input bg-background px-2 text-foreground"
              />
            </label>
            <SaveToAccountButton kind="cd" item={disc} disabled={recording || locked} />
          </div>
          <div
            className="cd-capacity mb-3"
            aria-label={`${tapeClock(used)} of ${tapeClock(capacity)} used`}
          >
            <div style={{ width: `${Math.min(100, (used / capacity) * 100)}%` }} />
          </div>
          {disc.tracks.length ? (
            <ol className="cd-tracklist mb-3">
              {disc.tracks.map((t, i) => (
                <li key={t.id} data-current={t.id === media.trackId || undefined}>
                  <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                  <input
                    value={t.title}
                    maxLength={MAX_NAME}
                    aria-label={`Track ${i + 1} name`}
                    onChange={(e) => m.renameTrack(disc.id, t.id, e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded border border-input bg-background px-2 text-sm text-foreground"
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {tapeClock(captureSeconds(t.capture))}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10"
                    aria-label={`Play track ${i + 1}`}
                    disabled={!ready || locked || recording}
                    onClick={() => void m.playTrack(t.id)}
                  >
                    <Play />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10"
                    aria-label={`Move track ${i + 1} up`}
                    disabled={i === 0 || locked}
                    onClick={() => m.moveTrack(disc.id, t.id, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10"
                    aria-label={`Move track ${i + 1} down`}
                    disabled={i === disc.tracks.length - 1 || locked}
                    onClick={() => m.moveTrack(disc.id, t.id, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10"
                    aria-label={`Remove track ${i + 1}`}
                    disabled={locked || recording}
                    onClick={() => void m.removeTrack(disc.id, t.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">
              This CD is blank. Press REC for a live CD, or add your song, a tape or a file.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Button
              className="h-11"
              disabled={!ready || locked || recording}
              onClick={() => void addSong()}
            >
              <Music2 />
              {rendering ? "Rendering…" : "Add my song"}
            </Button>
            {dubSources.length > 0 && (
              <>
                <select
                  aria-label="Copy from tape"
                  value={dubFrom || dubSources[0]!.id}
                  onChange={(e) => setDubFrom(e.target.value)}
                  className="h-11 max-w-[220px] rounded border border-input bg-background px-2 text-sm text-foreground"
                >
                  {dubSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={!ready || locked || recording || dubbing}
                  onClick={() => void dub()}
                >
                  <Plus />
                  {dubbing ? "Copying…" : "Copy tape to CD"}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              className="h-11"
              disabled={!ready || locked || recording}
              onClick={() => fileInput.current?.click()}
            >
              <Upload />
              Add audio file
            </Button>
            <input
              ref={fileInput}
              hidden
              type="file"
              accept="audio/*,.wav,.mp3,.flac,.aiff,.aif,.m4a"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void recorder.load(file);
                e.target.value = "";
              }}
            />
            <Button
              className="cd-burn-button ml-auto h-11"
              disabled={!disc.tracks.length || locked || recording}
              onClick={() => void burn()}
            >
              <Flame />
              {media.burn ? `Writing ${media.burn.done}/${media.burn.total}…` : "Burn CD"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Burn CD makes audio-CD-ready files (CD-quality WAV tracks in order, plus a CUE sheet
            with the track names) for your computer's disc drive. A web page can't control the disc
            drive itself, so the last step happens in your computer's burning app.
          </p>
        </section>
      )}

      {disc && (
        <TapeExportBar
          nameLabel={null}
          canLoad={false}
          keep={<SaveToAccountButton kind="cd" item={disc} disabled={recording || locked} />}
        />
      )}
      <DiscSpindle />

      <Dialog open={!!burnedName} onOpenChange={(open) => !open && setBurnedName(null)}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Your CD is ready to burn</DialogTitle>
          <DialogDescription>
            "{burnedName}" is downloading. Unzip it, put a blank CD-R in your computer's disc drive
            and burn the tracks as an audio CD.
          </DialogDescription>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold">Windows</p>
              <p className="text-muted-foreground">
                Windows Media Player Legacy → Burn tab → Audio CD → drag the WAV files in order →
                Start burn. Or open the .cue file in ImgBurn or CDBurnerXP to keep the track names.
              </p>
            </div>
            <div>
              <p className="font-semibold">Mac</p>
              <p className="text-muted-foreground">
                Music app → new playlist → add the WAV files in order → File → Burn Playlist to Disc
                → Audio CD. Most Macs need a USB disc drive.
              </p>
            </div>
            <div>
              <p className="font-semibold">Phone or tablet</p>
              <p className="text-muted-foreground">
                Phones can't burn CDs. Send the file to a computer with a disc drive.
              </p>
            </div>
          </div>
          <Button className="h-11" onClick={() => setBurnedName(null)}>
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DiscSpindle() {
  const media = useTapeMedia();
  const m = getTapeMedia();
  const [newType, setNewType] = useState(DISC_TYPES[0]!.id);
  const [newTitle, setNewTitle] = useState("");
  const busy = media.tray.motion !== "idle" || !!media.burn;
  return (
    <section className="rounded-md border border-border bg-card p-3" aria-label="Blank CDs">
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <h3 className="mr-auto font-display text-sm font-semibold uppercase tracking-wider">
          CD spindle
        </h3>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          New blank CD
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="h-11 rounded border border-input bg-background px-2 text-foreground"
          >
            {DISC_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-muted-foreground sm:flex-none">
          CD name
          <input
            value={newTitle}
            maxLength={MAX_NAME}
            placeholder="Live at the studio"
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-11 rounded border border-input bg-background px-2 text-foreground"
          />
        </label>
        <Button
          className="h-11"
          onClick={() => {
            m.addDisc(newType, newTitle);
            setNewTitle("");
          }}
        >
          <Plus />
          Add CD
        </Button>
      </div>
      <div className="cd-grid">
        {media.discs.map((d) => {
          const type = discType(d.typeId);
          const onTray = d.id === media.tray.discId;
          const used = cdUsedSeconds(discLengths(d));
          const tag = shelfTag(d);
          return (
            <div key={d.id} className="cd-slot" data-in-tray={onTray || undefined}>
              <button
                type="button"
                className="cd-slot-pick"
                disabled={busy || onTray || media.shelf.loading === d.id}
                onClick={() => void m.loadDiscOnTray(d.id)}
                aria-label={`Load ${shownName(d.title, "My CD")} (${type.name}) into the burner`}
              >
                <CdArt disc={d} compact burned={used / (type.minutes * 60)} />
                <span className="cassette-slot-name">{shownName(d.title, "My CD")}</span>
                <span className="cassette-slot-meta">
                  {onTray
                    ? "IN BURNER"
                    : media.shelf.loading === d.id
                      ? "LOADING…"
                      : `${type.name.replace("CD-R ", "")} · ${discTrackCount(d)} tr`}
                </span>
                {tag && (
                  <span className="shelf-tag" data-dirty={tag === "UNSAVED" || undefined}>
                    {tag}
                  </span>
                )}
              </button>
              {!onTray && (
                <DeleteFromShelfButton
                  kind="cd"
                  item={d}
                  name={shownName(d.title, "My CD")}
                  compact
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
