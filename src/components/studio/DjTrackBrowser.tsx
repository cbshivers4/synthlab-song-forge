import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronUp, FilePlus2, ListMusic } from "lucide-react";
import { toast } from "sonner";
import { getDj, type DeckId } from "@/lib/synclab/dj-engine";
import { clock } from "@/lib/synclab/dj";
import { getPlaylists } from "@/lib/synclab/dj-playlist-store";
import { getTrackInfo } from "@/lib/synclab/dj-track-info";
import { splitArtistTitle } from "@/lib/synclab/track-tags";
import type { PlaylistTrack } from "@/lib/synclab/dj-playlist";
import { DJ_TRACK_DRAG, isOnDeck, loadPlaylistTrack } from "./DjPlaylist";
import { getDjMidi } from "@/lib/synclab/dj-midi";
import { TimelineVScrollbar } from "./timeline/VScrollbar";

const OPEN_KEY = "synclab.dj.trackBrowser.open";

/**
 * Desktop DJ track list, right under the scrolling waveforms (like a DJ app's library): six rows of
 * the open playlist at a time with title, artist, length and tempo, and A / B buttons to load a
 * track onto either deck. Shown or hidden with its header button (remembered on this device).
 */
export function DjTrackBrowser() {
  const s = getPlaylists();
  useSyncExternalStore((fn) => s.subscribe(fn), () => s.version, () => 0);
  const info = getTrackInfo();
  useSyncExternalStore((fn) => info.subscribe(fn), () => info.version, () => 0);
  const dj = getDj();
  const [open, setOpen] = useState(true);
  // the selected row is shared with a DJ controller's Browse knob and LOAD buttons
  const midi = getDjMidi();
  useSyncExternalStore((fn) => midi.subscribe(fn), () => midi.version, () => 0);
  const selected = s.tracks[midi.cursor]?.id ?? null;
  const [loading, setLoading] = useState<DeckId | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { if (localStorage.getItem(OPEN_KEY) === "0") setOpen(false); } catch { /* private mode */ } }, []);
  useEffect(() => { void s.init(); }, [s]);
  const toggle = () => setOpen((v) => { try { localStorage.setItem(OPEN_KEY, v ? "0" : "1"); } catch { /* private mode */ } return !v; });

  // read each file's tags and tempo once (one file at a time, in the background)
  const keys = s.tracks.map((t) => t.key).join("\n");
  useEffect(() => {
    if (!open) return;
    for (const t of s.tracks) void info.ensure(t.key, () => s.audioFor(t));
  }, [open, keys, s, info]);

  const load = async (deck: DeckId, id: string) => {
    setLoading(deck);
    try { await loadPlaylistTrack(deck, id); } finally { setLoading(null); }
  };
  const add = (files: File[]) => {
    if (!files.length) return;
    const r = s.addFiles(files);
    if (r.added) toast.success(`Added ${r.added} track${r.added === 1 ? "" : "s"} to ${s.displayName}`);
    else toast("Nothing added", { description: r.duplicates ? "Those tracks are already in the list." : "Pick MP3, WAV, AAC or FLAC files." });
  };
  // keep the row the controller points at in view
  useEffect(() => {
    if (midi.cursor < 0) return;
    listRef.current?.querySelectorAll<HTMLElement>(".dj-browser-row")[midi.cursor]?.scrollIntoView({ block: "nearest" });
  }, [midi.cursor]);
  const onDeck = (t: PlaylistTrack) => (["A", "B"] as DeckId[]).filter((d) => isOnDeck(d, t));

  return (
    <section className="dj-browser" data-open={open ? "1" : "0"} aria-label="Track list">
      <header className="dj-browser-head">
        <ListMusic className="size-4 shrink-0" />
        <span className="dj-label">TRACKS</span>
        <b className="dj-browser-name truncate" title={s.displayName}>{s.displayName}</b>
        <small className="dj-browser-count">{s.tracks.length} track{s.tracks.length === 1 ? "" : "s"}</small>
        {open && <button type="button" className="dj-browser-btn" onClick={() => fileRef.current?.click()}><FilePlus2 className="size-3.5" />Add music</button>}
        <button type="button" className="dj-browser-btn" onClick={toggle} aria-expanded={open} aria-controls="dj-browser-list">
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}{open ? "Hide" : "Show track list"}
        </button>
      </header>
      {open && (
        <>
          <div className="dj-browser-cols" aria-hidden>
            <span>#</span><span>TRACK</span><span>ARTIST</span><span className="is-num">TIME</span><span className="is-num">BPM</span><span className="is-load">LOAD</span>
          </div>
          <div className="dj-browser-wrap">
            <div ref={listRef} id="dj-browser-list" className="dj-browser-scroll">
              {s.tracks.length === 0 ? (
                <button type="button" className="dj-browser-empty" onClick={() => fileRef.current?.click()}>
                  Your playlist is empty. Add music files here, or open a saved playlist in the Playlist section below.
                </button>
              ) : (
                <ol className="dj-browser-list">
                  {s.tracks.map((t, i) => {
                    const ti = info.get(t.key);
                    const guess = splitArtistTitle(t.name);
                    const title = ti?.title ?? guess.title;
                    const artist = ti?.artist ?? guess.artist;
                    const decks = onDeck(t);
                    const deckBpm = decks.length ? dj.deck(decks[0]!).state.bpm : 0;
                    const bpm = deckBpm > 0 ? Math.round(deckBpm * 10) / 10 : ti?.bpm ?? null;
                    const bpmText = bpm != null ? bpm.toFixed(bpm % 1 ? 1 : 0) : ti?.scan === "queued" || ti?.scan === "scanning" || !ti ? "…" : "—";
                    const bpmTitle = bpm != null
                      ? (deckBpm > 0 || ti?.bpmFrom === "deck" ? "Tempo detected by the deck" : ti?.bpmFrom === "tag" ? "Tempo from the file's tag" : "Tempo measured on this device")
                      : ti?.scan === "failed" ? "Couldn't measure this file's tempo" : "Measuring the tempo…";
                    return (
                      <li key={t.id} className="dj-browser-row" data-on={decks.join("") || undefined} aria-selected={selected === t.id} draggable
                        onClick={() => midi.setCursor(i)}
                        onDragStart={(e) => { e.dataTransfer.setData("application/synclab", JSON.stringify({ type: DJ_TRACK_DRAG, id: t.id })); e.dataTransfer.effectAllowed = "copy"; }}>
                        <span className="dj-browser-num">{i + 1}</span>
                        <span className="dj-browser-title truncate" title={title}>
                          {decks.map((d) => <i key={d} className="dj-browser-ondeck" data-deck={d}>{d}</i>)}{title}
                        </span>
                        <span className="dj-browser-artist truncate" title={artist ?? undefined}>{artist ?? "—"}</span>
                        <span className="is-num">{t.duration ? clock(t.duration).replace(/\.\d$/, "") : "—"}</span>
                        <span className="is-num dj-browser-bpm" title={bpmTitle}>{bpmText}</span>
                        <span className="is-load">
                          <button type="button" className="dj-browser-load" data-deck="A" disabled={loading === "A"} onClick={(e) => { e.stopPropagation(); void load("A", t.id); }} aria-label={`Load ${title} on deck A`}>A</button>
                          <button type="button" className="dj-browser-load" data-deck="B" disabled={loading === "B"} onClick={(e) => { e.stopPropagation(); void load("B", t.id); }} aria-label={`Load ${title} on deck B`}>B</button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
            <TimelineVScrollbar scrollRef={listRef} controls="dj-browser-list" label="Scroll the track list up and down" />
          </div>
        </>
      )}
      <input ref={fileRef} type="file" multiple accept="audio/*,.mp3,.wav,.aif,.aiff,.m4a,.aac,.ogg,.flac" className="hidden" aria-label="Add music files to the track list"
        onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
    </section>
  );
}
