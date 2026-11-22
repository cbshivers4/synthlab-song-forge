import { useIsLandscapePhone } from "@/hooks/use-mobile";
import { joinBandPreview, stopBandPreview } from "@/lib/synclab/live-band";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { toast } from "sonner";
import { Drum, Play, Square, Sparkles, Zap, PauseCircle, Disc, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Knob } from "./Knob";
import { useStudio } from "@/lib/synclab/store";
import { stepsPerBar } from "@/lib/synclab/timebase";
import { getPlayStep } from "@/lib/synclab/playhead";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { DRUM_KITS, defaultPads } from "@/lib/synclab/presets";
import { getDrummer, type DrummerSnapshot } from "@/lib/synclab/drummer-player";
import {
  DRUM_GENRES,
  GENRE_GROUPS,
  defaultDrummer,
  genreById,
  grooveBars,
  padForRole,
  writeHitsToPads,
  type DrumPiece,
  type DrumRole,
  type DrummerSettings,
  type GenreGroup,
} from "@/lib/synclab/drummer";
import type { DrumKitId, Track } from "@/lib/synclab/types";
import { DrumKitView } from "./DrumKitView";
import { LiveChannelNotice } from "./LiveChannelNotice";
import { DRUMMER_CHANNEL_VOLUME } from "@/lib/synclab/live-channel-check";

const PIECES: { id: DrumPiece; label: string }[] = [
  { id: "kick", label: "Kick" },
  { id: "snare", label: "Snare / Clap" },
  { id: "hats", label: "Hats / Ride" },
  { id: "cymbals", label: "Cymbals" },
  { id: "toms", label: "Toms" },
  { id: "perc", label: "Percussion" },
];
const ROWS: { label: string; roles: DrumRole[] }[] = [
  { label: "CYM", roles: ["crash"] },
  { label: "HAT", roles: ["hat", "openhat", "ride"] },
  { label: "PERC", roles: ["shaker", "conga", "congaLo", "cowbell", "clave", "tamb", "perc"] },
  { label: "TOMS", roles: ["tomHi", "tomMid", "tomLo"] },
  { label: "SNR", roles: ["snare", "clap", "rim"] },
  { label: "KICK", roles: ["kick"] },
];

/** The drummer's channel the panel controls: the one the player follows, else the first drummer track. */
export function useDrummerTrack() {
  const { tracks } = useStudio();
  const chosen = useSyncExternalStore(
    subscribeChoice,
    () => chosenId,
    () => null,
  );
  return tracks.find((t) => t.drummer && t.id === chosen) ?? tracks.find((t) => t.drummer) ?? null;
}
let chosenId: string | null = null;
const choiceListeners = new Set<() => void>();
const subscribeChoice = (fn: () => void) => {
  choiceListeners.add(fn);
  return () => void choiceListeners.delete(fn);
};
export function chooseDrummer(id: string) {
  chosenId = id;
  choiceListeners.forEach((l) => l());
}

/** Always mounted: keeps the drummer pointed at its channel and the song tempo/swing. */
export function DrummerBridge() {
  const { transport } = useStudio();
  const track = useDrummerTrack();
  useEffect(() => {
    getDrummer().sync(track, transport.bpm, transport.swing ?? 0, stepsPerBar());
  }, [track, transport.bpm, transport.swing, transport.beatsPerBar]);
  return null;
}

function useDrummerState(): DrummerSnapshot {
  const [snap, setSnap] = useState(() => getDrummer().snapshot());
  useEffect(() => {
    const p = getDrummer();
    const read = () => setSnap(p.snapshot());
    const off = p.subscribe(read);
    // 20 fps while playing for the step light; idle otherwise
    const id = setInterval(() => {
      if (p.snapshot().running) read();
    }, 50);
    return () => {
      off();
      clearInterval(id);
    };
  }, []);
  return snap;
}

export function LiveDrummer() {
  const { tracks, addTrack, updateTrack, transport, setTransport, togglePlay, pause } = useStudio();
  const track = useDrummerTrack();
  const drummers = tracks.filter((t) => t.drummer);
  const [group, setGroup] = useState<GenreGroup>(() =>
    track?.drummer ? genreById(track.drummer.genre).group : "Electronic",
  );
  const snap = useDrummerState();
  const spb = stepsPerBar();

  const bringIn = (genreId: string) => {
    const genre = genreById(genreId);
    const id = addTrack("drum", "LIVE DRUMMER", undefined, { keepPanel: true });
    updateTrack(id, {
      steps: spb,
      pads: defaultPads(spb, genre.kit),
      // headroom: the session kits peak hot, so a new drummer channel starts lower and never clips the master
      volume: DRUMMER_CHANNEL_VOLUME,
      drummer: defaultDrummer(genreId),
      name: `DRUMMER · ${genre.label}`.slice(0, 40),
    });
    chooseDrummer(id);
    toast.success(`${genre.label} drummer joined the session`, {
      description: "Preview them alone, or play them along with your song.",
    });
  };

  if (!track?.drummer) {
    return (
      <section className="drummer-device space-y-3 rounded-md border border-border p-3">
        <DrummerHeader />
        <p className="text-sm text-muted-foreground">
          Pick a style to bring a session drummer into your song. They play live with your song,
          take fills on cue, and you can print what they play onto the timeline as an editable drum
          part.
        </p>
        <GenrePicker group={group} setGroup={setGroup} current={null} onPick={bringIn} />
      </section>
    );
  }
  return (
    <DrummerDesk
      track={track}
      drummers={drummers}
      snap={snap}
      group={group}
      setGroup={setGroup}
      update={(patch) => updateTrack(track.id, { drummer: { ...track.drummer!, ...patch } })}
      updateTrack={updateTrack}
      addTrack={addTrack}
      transport={transport}
      setTransport={setTransport}
      togglePlay={togglePlay}
      pause={pause}
      onNew={bringIn}
    />
  );
}

function DrummerHeader({ name }: { name?: string }) {
  return (
    <header className="flex flex-wrap items-center gap-2">
      <Drum className="size-5 text-primary" />
      <h2 className="drummer-brand">
        SYNCLAB <b>Live Drummer</b>
      </h2>
      {name && <span className="font-mono text-[11px] text-muted-foreground">· {name}</span>}
    </header>
  );
}

function GenrePicker({
  group,
  setGroup,
  current,
  onPick,
}: {
  group: GenreGroup;
  setGroup: (g: GenreGroup) => void;
  current: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="drummer-picker space-y-2">
      <div className="drummer-tabs flex flex-wrap gap-1.5" role="tablist" aria-label="Genre groups">
        {GENRE_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={group === g}
            onClick={() => setGroup(g)}
            className={`drummer-chip ${group === g ? "is-on" : ""}`}
          >
            {g}{" "}
            <span className="opacity-60">{DRUM_GENRES.filter((x) => x.group === g).length}</span>
          </button>
        ))}
      </div>
      <div className="drummer-genres" role="radiogroup" aria-label="Drummer style">
        {DRUM_GENRES.filter((x) => x.group === group).map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={current === x.id}
            onClick={() => onPick(x.id)}
            className={`drummer-genre ${current === x.id ? "is-on" : ""}`}
          >
            <span className="block text-sm font-semibold leading-tight">{x.label}</span>
            <span className="block font-mono text-[10px] text-muted-foreground">{x.bpm} BPM</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface DeskProps {
  track: Track;
  drummers: Track[];
  snap: DrummerSnapshot;
  group: GenreGroup;
  setGroup: (g: GenreGroup) => void;
  update: (patch: Partial<DrummerSettings>) => void;
  updateTrack: ReturnType<typeof useStudio>["updateTrack"];
  addTrack: ReturnType<typeof useStudio>["addTrack"];
  transport: ReturnType<typeof useStudio>["transport"];
  setTransport: ReturnType<typeof useStudio>["setTransport"];
  togglePlay: () => void;
  pause: () => void;
  onNew: (genre: string) => void;
}

function DrummerDesk({
  track,
  drummers,
  snap,
  group,
  setGroup,
  update,
  updateTrack,
  addTrack,
  transport,
  setTransport,
  togglePlay,
  pause,
  onNew,
}: DeskProps) {
  const phone = useIsLandscapePhone();
  const knobSize = phone ? 40 : 54;
  // Sideways phone: the desk splits into Play / Styles / Print pages so each fits the screen without scrolling.
  const [tab, setTab] = useState<"play" | "styles" | "print">("play");
  const show = (t: "play" | "styles" | "print") => !phone || tab === t;
  const settings = track.drummer!;
  const genre = genreById(settings.genre);
  const player = getDrummer();
  const spb = stepsPerBar();
  const kit = (track.pads?.find((p) => p.kit)?.kit ?? genre.kit) as DrumKitId;
  const [bars, setBars] = useState(8);
  const [startAt, setStartAt] = useState<"start" | "playhead">("start");
  const playing = snap.running && player.trackId === track.id;
  // Printing while the song plays: the live player keeps going until the printed track is in the
  // song, then hands over in that same update, so the beat never drops out or doubles.
  const { tracks: allTracks } = useStudio();
  const handOff = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = handOff.current;
    if (!id || !allTracks.some((t) => t.id === id)) return;
    handOff.current = null;
    player.finish();
  }, [allTracks, player]);

  /** Just the drummer: the song pauses so you hear them on their own. */
  const previewAlone = () => {
    chooseDrummer(track.id);
    if (transport.recording) {
      toast("Stop recording first", {
        description: "Preview pauses your song, which would end the take.",
      });
      return;
    }
    if (transport.playing) {
      pause();
      toast("Song paused", {
        description:
          "You're hearing the live players without the song (Live Drummer and Live Keys play together). Press Play with song to bring the song back in.",
      });
    }
    player.stop();
    player.start("alone");
    // The other live player (if this song has one) previews with it, on the same beat.
    joinBandPreview("drums");
  };
  /** Drummer and song together, locked to the song's bars. */
  const playWithSong = () => {
    chooseDrummer(track.id);
    if (!transport.playing) togglePlay();
    if (!player.snapshot().running) player.start("song");
    else player.followSong();
  };

  const pickGenre = (id: string) => {
    const next = genreById(id);
    update({ genre: id });
    // The style's own kit comes with it, unless you loaded a sound of your own.
    if (!track.pads?.some((p) => p.sampleUrl))
      updateTrack(track.id, {
        pads: defaultPads(spb, next.kit),
        name: `DRUMMER · ${next.label}`.slice(0, 40),
      });
    else updateTrack(track.id, { name: `DRUMMER · ${next.label}`.slice(0, 40) });
  };
  const loadKit = (id: DrumKitId) => updateTrack(track.id, { pads: defaultPads(spb, id) });

  const print = (source: "groove" | "performance") => {
    const perf = player.performance();
    const startBar = startAt === "playhead" ? Math.floor(getPlayStep() / spb) : 0;
    const list = source === "performance" ? perf : grooveBars(settings, startBar, bars, spb);
    if (!list.length) {
      toast("Nothing captured yet", {
        description: "Play the drummer along with your song first, then print the performance.",
      });
      return;
    }
    const pads = (track.pads ?? []).map((p) => ({ ...p, id: crypto.randomUUID() }));
    const { pads: written, steps } = writeHitsToPads(pads, list, spb);
    const first = list[0]!.bar,
      last = list[list.length - 1]!.bar;
    const id = addTrack("drum", `DRUMS · ${genre.label}`.slice(0, 40), undefined, {
      keepPanel: true,
    });
    // Hand over only if the printed part carries on from here; otherwise the live player keeps the
    // beat going (stop it yourself when you only want the printed part).
    const nowBar = Math.floor(getPlayStep() / spb);
    const loopEndBar =
      transport.loop && (transport.loopEnd ?? 0) > 0
        ? Math.ceil((transport.loopEnd ?? 0) / spb)
        : Infinity;
    const nextBar =
      nowBar + 1 >= loopEndBar ? Math.floor((transport.loopStart ?? 0) / spb) : nowBar + 1;
    const covers = (b: number) => b >= first && b <= last;
    const handsOver = !transport.playing || (covers(nowBar) && covers(nextBar));
    if (handsOver) handOff.current = id;
    updateTrack(id, {
      pads: written,
      steps,
      patternRegion: [first * spb, (last + 1) * spb],
      // same level as the live drummer, so the printed part doesn't jump in volume at hand-over
      volume: track.volume,
      ...(track.plugins?.length ? { plugins: structuredClone(track.plugins) } : {}),
    });
    if (last + 1 > (transport.bars ?? 0)) setTransport({ bars: last + 1 });
    if (source === "performance") player.clearPerformance();
    const count = last - first + 1;
    toast.success(source === "performance" ? "Performance printed" : "Groove printed", {
      description: `${count} bar${count === 1 ? "" : "s"} of ${genre.label} on a new drum track from bar ${first + 1} — edit it in the drum roll. ${handsOver ? "The live drummer handed over to it so you don't hear it twice." : "The live drummer keeps playing so your beat doesn't stop — press Stop on it when you only want the printed part."}`,
    });
  };

  const timeKit = (
    <div className="drummer-timekit flex flex-col gap-1.5">
      <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">
        TIME ON
      </span>
      <div className="flex gap-1">
        {(["hat", "ride"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={settings.timekeeper === k}
            onClick={() => update({ timekeeper: k })}
            className={`drummer-chip ${settings.timekeeper === k ? "is-on" : ""}`}
          >
            {k === "hat" ? "Hi-hat" : "Ride"}
          </button>
        ))}
      </div>
      <select
        aria-label="Drum kit"
        value={kit}
        onChange={(e) => loadKit(e.target.value as DrumKitId)}
        className="min-h-11 rounded-md border border-border bg-surface-2 px-2 text-sm"
      >
        {DRUM_KITS.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
    </div>
  );

  const swingHint = Math.abs((transport.swing ?? 0) - genre.swing) > 0.05;
  const tempoHint = transport.bpm !== genre.bpm;

  return (
    <section
      className="drummer-device space-y-3 rounded-md border border-border p-3"
      style={{ "--drummer-accent": "var(--primary)" } as CSSProperties}
    >
      <div className="drummer-head">
        <DrummerHeader name={track.name} />
      </div>
      {drummers.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-bold tracking-widest text-muted-foreground">DRUMMER</span>
          <select
            aria-label="Drummer track"
            value={track.id}
            onChange={(e) => {
              player.stop();
              chooseDrummer(e.target.value);
            }}
            className="min-h-11 rounded-md border border-border bg-surface-2 px-2 text-sm"
          >
            {drummers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {phone && (
        <div className="drummer-pages" role="tablist" aria-label="Live Drummer pages">
          {(
            [
              ["play", "Play"],
              ["styles", `Styles · ${genre.label}`],
              ["print", "Print to timeline"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`drummer-chip ${tab === id ? "is-on" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {show("play") && (
        <>
          <div className="drummer-main">
            <div className="drummer-left">
              <div className="drummer-display" aria-live="polite">
                <span className="drummer-display-genre">{genre.label.toUpperCase()}</span>
                <span className="drummer-display-meta">
                  {playing
                    ? snap.waiting
                      ? "STARTING SONG…"
                      : snap.following
                        ? "WITH SONG"
                        : "ALONE"
                    : "READY"}{" "}
                  · BAR {snap.bar + 1} · {transport.bpm} BPM ·{" "}
                  {DRUM_KITS.find((k) => k.id === kit)?.name ?? kit}
                </span>
                <span className="drummer-display-flags">
                  {snap.fillQueued && <b>FILL</b>}
                  {snap.breakQueued && <b>BREAK</b>}
                  {snap.crashQueued && <b>CRASH</b>}
                </span>
              </div>
              <LiveChannelNotice track={track} part="drummer" volume={DRUMMER_CHANNEL_VOLUME} />

              <div className="drummer-perform">
                {playing ? (
                  <Button
                    size="lg"
                    className="drummer-play min-h-14"
                    variant="destructive"
                    onClick={() => {
                      stopBandPreview("drums");
                      player.stop();
                    }}
                    aria-label="Stop the drummer"
                  >
                    <Square className="size-5 fill-current" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="drummer-play min-h-14"
                    onClick={previewAlone}
                    title="Hear only the drummer, at the song tempo — your song pauses if it's playing"
                  >
                    <Play className="size-5 fill-current" />
                    {phone ? "Preview" : "Preview (no song)"}
                  </Button>
                )}
                <Button
                  size="lg"
                  variant={snap.following || snap.waiting ? "default" : "secondary"}
                  className="drummer-with-song min-h-14"
                  aria-pressed={playing && (snap.following || snap.waiting)}
                  disabled={playing && (snap.following || snap.waiting)}
                  onClick={playWithSong}
                  title="Start your song and the drummer together, locked to the song's bars"
                >
                  <Music2 className="size-5" />
                  {phone ? "With song" : "Play with song"}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="min-h-14"
                  disabled={!playing}
                  onClick={() => player.fill()}
                  aria-pressed={snap.fillQueued}
                >
                  <Zap className="size-5" />
                  Fill
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="min-h-14"
                  disabled={!playing}
                  onClick={() => player.breakNext()}
                  aria-pressed={snap.breakQueued}
                >
                  <PauseCircle className="size-5" />
                  Break
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="min-h-14"
                  disabled={!playing}
                  onClick={() => player.crashNext()}
                  aria-pressed={snap.crashQueued}
                >
                  <Disc className="size-5" />
                  Crash
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="min-h-14"
                  onClick={() => update({ seed: settings.seed + 1 })}
                >
                  <Sparkles className="size-5" />
                  {phone ? "Variation" : "New variation"}
                </Button>
              </div>

              {!phone && <DrumKitView track={track} genre={genre} settings={settings} />}
              <GrooveDisplay snap={snap} spb={spb} playing={playing} pads={track.pads ?? []} />

              <div className="drummer-pieces flex flex-wrap gap-1.5" aria-label="Drum pieces">
                {PIECES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={settings.pieces[p.id] !== false}
                    onClick={() =>
                      update({
                        pieces: { ...settings.pieces, [p.id]: settings.pieces[p.id] === false },
                      })
                    }
                    className={`drummer-chip ${settings.pieces[p.id] !== false ? "is-on" : ""}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {phone && timeKit}
            </div>

            <div className="drummer-controls">
              {phone && <DrumKitView track={track} genre={genre} settings={settings} />}
              <IntensityPad
                complexity={settings.complexity}
                loudness={settings.loudness}
                onChange={(complexity, loudness) => update({ complexity, loudness })}
              />
              <div className="drummer-knobs">
                <Knob
                  label="FILLS"
                  value={settings.fills}
                  onChange={(v) => update({ fills: v })}
                  format={(v) =>
                    v <= 0.02 ? "OFF" : v <= 0.4 ? "8 BARS" : v <= 0.75 ? "4 BARS" : "2 BARS"
                  }
                  size={knobSize}
                />
                <Knob
                  label="FEEL"
                  value={settings.humanize}
                  onChange={(v) => update({ humanize: v })}
                  format={(v) => (v < 0.2 ? "TIGHT" : v < 0.6 ? "NATURAL" : "LOOSE")}
                  size={knobSize}
                />
                <Knob
                  label="SWING"
                  value={transport.swing ?? 0}
                  min={0}
                  max={0.6}
                  onChange={(v) => setTransport({ swing: v })}
                  format={(v) => `${Math.round(v * 100)}%`}
                  size={knobSize}
                />
                {!phone && timeKit}
              </div>
            </div>
          </div>
          <p className="drummer-note text-[11px] text-muted-foreground">
            Swing is the song's swing, so the drummer, your drum machine and printed parts all
            shuffle together.
          </p>
        </>
      )}

      {show("styles") && (tempoHint || swingHint) && (
        <div className="drummer-hint flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {genre.label} usually plays at {genre.bpm} BPM
          {genre.swing ? ` with ${Math.round(genre.swing * 100)}% swing` : ", straight"}.
          {tempoHint && (
            <Button size="sm" variant="outline" onClick={() => setTransport({ bpm: genre.bpm })}>
              Use {genre.bpm} BPM
            </Button>
          )}
          {swingHint && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTransport({ swing: genre.swing })}
            >
              Use {Math.round(genre.swing * 100)}% swing
            </Button>
          )}
        </div>
      )}

      {show("styles") && (
        <GenrePicker
          group={group}
          setGroup={setGroup}
          current={settings.genre}
          onPick={pickGenre}
        />
      )}

      {show("print") && (
        <>
          <div className="drummer-print">
            <span className="font-mono text-xs font-bold tracking-widest text-muted-foreground">
              PRINT TO TIMELINE
            </span>
            <select
              aria-label="Bars to print"
              value={bars}
              onChange={(e) => setBars(Number(e.target.value))}
              className="min-h-11 rounded-md border border-border bg-surface-2 px-2 text-sm"
            >
              {[1, 2, 4, 8, 16, 32].map((b) => (
                <option key={b} value={b}>
                  {b} bar{b === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <select
              aria-label="Print from"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value as "start" | "playhead")}
              className="min-h-11 rounded-md border border-border bg-surface-2 px-2 text-sm"
            >
              <option value="start">from bar 1</option>
              <option value="playhead">from the playhead bar</option>
            </select>
            <Button className="min-h-11" onClick={() => print("groove")}>
              Print groove
            </Button>
            <Button
              className="min-h-11"
              variant="secondary"
              disabled={!snap.captured}
              onClick={() => print("performance")}
              title="What the drummer played along with your song, fills and breaks included, at the bars they were played"
            >
              Print my performance
              {snap.captured ? ` (${snap.captured} bar${snap.captured === 1 ? "" : "s"})` : ""}
            </Button>
          </div>
          <div className="drummer-foot flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="drummer-note">
              Printed parts go on a new drum track you can edit in the drum roll. Want another
              drummer?
            </span>
            <Button size="sm" variant="ghost" onClick={() => onNew(settings.genre)}>
              Add another drummer
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function GrooveDisplay({
  snap,
  spb,
  playing,
  pads,
}: {
  snap: DrummerSnapshot;
  spb: number;
  playing: boolean;
  pads: Track["pads"] & object;
}) {
  const grid = useMemo(
    () =>
      ROWS.map((r) => {
        const cells = Array<number>(spb).fill(0);
        for (const h of snap.hits)
          if (r.roles.includes(h.role) && h.step < spb && padForRole(pads, h.role))
            cells[h.step] = Math.max(cells[h.step]!, h.vel);
        return { label: r.label, cells };
      }),
    [snap.hits, spb, pads],
  );
  return (
    <div
      className="drummer-grid"
      role="img"
      aria-label={`Bar ${snap.bar + 1} of the drummer's groove`}
      style={{ "--drummer-steps": spb } as CSSProperties}
    >
      {grid.map((row) => (
        <div key={row.label} className="drummer-grid-row">
          <span className="drummer-grid-label">{row.label}</span>
          {row.cells.map((v, i) => (
            <span
              key={i}
              className={`drummer-cell${v ? " is-on" : ""}${playing && i === snap.step ? " is-now" : ""}${i % 4 === 0 ? " is-beat" : ""}`}
              style={v ? ({ "--cell-level": String(0.3 + v * 0.7) } as CSSProperties) : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Logic-style pad: left ↔ right is simple ↔ complex, bottom ↔ top is soft ↔ loud. */
export function IntensityPad({
  complexity,
  loudness,
  onChange,
}: {
  complexity: number;
  loudness: number;
  onChange: (c: number, l: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = canvasRect(el);
    const p = canvasPoint(e.clientX, e.clientY);
    const c = Math.max(0, Math.min(1, (p.x - r.left) / Math.max(1, r.width)));
    const l = Math.max(0, Math.min(1, 1 - (p.y - r.top) / Math.max(1, r.height)));
    onChange(Math.round(c * 100) / 100, Math.round(l * 100) / 100);
  };
  const key = (e: React.KeyboardEvent) => {
    const d = e.shiftKey ? 0.1 : 0.03;
    if (e.key === "ArrowLeft") onChange(Math.max(0, complexity - d), loudness);
    else if (e.key === "ArrowRight") onChange(Math.min(1, complexity + d), loudness);
    else if (e.key === "ArrowUp") onChange(complexity, Math.min(1, loudness + d));
    else if (e.key === "ArrowDown") onChange(complexity, Math.max(0, loudness - d));
    else return;
    e.preventDefault();
  };
  return (
    <div className="drummer-xy-wrap">
      <div
        ref={ref}
        className="drummer-xy"
        role="slider"
        tabIndex={0}
        aria-label="Simple to complex, soft to loud"
        aria-valuetext={`${Math.round(complexity * 100)}% complex, ${Math.round(loudness * 100)}% loud`}
        aria-valuenow={Math.round(complexity * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={(e) => {
          drag.current = true;
          (e.target as Element).setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => {
          if (drag.current) move(e);
        }}
        onPointerUp={() => {
          drag.current = false;
        }}
        onPointerCancel={() => {
          drag.current = false;
        }}
        onKeyDown={key}
      >
        <span
          className="drummer-xy-dot"
          style={{ left: `${complexity * 100}%`, top: `${(1 - loudness) * 100}%` }}
        />
        <span className="drummer-xy-label is-top">LOUD</span>
        <span className="drummer-xy-label is-bottom">SOFT</span>
        <span className="drummer-xy-label is-left">SIMPLE</span>
        <span className="drummer-xy-label is-right">COMPLEX</span>
      </div>
    </div>
  );
}
