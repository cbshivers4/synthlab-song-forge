import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FilePlus2, ListMusic, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDj, type DeckId } from "@/lib/synclab/dj-engine";
import { clock } from "@/lib/synclab/dj";
import { getPlaylists } from "@/lib/synclab/dj-playlist-store";
import { MAX_PLAYLIST_NAME, playlistSeconds, type PlaylistTrack } from "@/lib/synclab/dj-playlist";
import { getLocalFile } from "@/lib/synclab/local-files";
import { getEngine } from "@/lib/synclab/audio-engine";
import { NameEditDialog } from "./NameEditDialog";
import { TimelineVScrollbar } from "./timeline/VScrollbar";

export const DJ_TRACK_DRAG = "djtrack";

function usePlaylists() {
  const s = getPlaylists();
  useSyncExternalStore((fn) => s.subscribe(fn), () => s.version, () => 0);
  return s;
}

/** Puts a playlist entry on a deck (used by the row buttons and by dragging a row onto a deck). */
export async function loadPlaylistTrack(deckId: DeckId, trackId: string) {
  const s = getPlaylists();
  const t = s.tracks.find((x) => x.id === trackId);
  if (!t) return;
  void getEngine().init().resume?.();
  const blob = await s.audioFor(t);
  if (!blob) { toast.error(`Couldn't find the music for ${t.name}`, { description: "Remove it from the playlist and add the file again." }); return; }
  const deck = getDj().deck(deckId);
  await deck.load(blob, t.name);
  if (deck.state.error) { toast.error(deck.state.error); return; }
  s.markOnDeck(deckId, t.id);
  if (deck.state.duration) s.setDuration(t.key, deck.state.duration);
}

type Confirm = { message: string; yes: string; run: () => void | Promise<void> };

/**
 * The DJ playlist: build an ordered list of music, load any entry onto deck A or B, and save or
 * delete named playlists. Saved playlists keep a copy of their music in this browser.
 */
export function DjPlaylist({ sheet = false, onClose }: { sheet?: boolean; onClose?: () => void }) {
  const s = usePlaylists();
  const dj = getDj();
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [naming, setNaming] = useState<null | "save" | "rename">(null);
  const [draft, setDraft] = useState("");
  useEffect(() => { void s.init(); }, [s]);

  const add = (files: File[]) => {
    if (!files.length) return;
    const r = s.addFiles(files);
    if (r.added) requestAnimationFrame(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; });
    const notes = [r.duplicates && `${r.duplicates} already in the list`, r.notAudio && `${r.notAudio} not a music file`, r.overLimit && `${r.overLimit} over the 200-track limit`].filter(Boolean);
    if (r.added) toast.success(`Added ${r.added} track${r.added === 1 ? "" : "s"} to ${s.displayName}`, notes.length ? { description: `Skipped: ${notes.join(", ")}.` } : undefined);
    else toast(`Nothing added`, { description: notes.length ? `Skipped: ${notes.join(", ")}.` : undefined });
  };
  const drop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setOver(false);
    const files = [...(e.dataTransfer.files ?? [])];
    if (files.length) { add(files); return; }
    try {
      const v = JSON.parse(e.dataTransfer.getData("application/synclab") || e.dataTransfer.getData("text/plain")) as { type?: string; id?: string };
      const local = v?.type === "localfile" && v.id ? getLocalFile(v.id) : null;
      if (local) add([local.file]);
    } catch { /* not a file */ }
  };

  /** Runs `then` straight away, or after asking when there are unsaved changes. */
  const guard = (then: () => void) => {
    if (!s.dirty) { then(); return; }
    setConfirm({ message: `${s.displayName} has changes you haven't saved. Throw them away?`, yes: "Discard changes", run: then });
  };

  const doSave = async (name?: string) => {
    setBusy(true);
    try {
      const p = await s.save(name);
      toast.success(`Saved playlist "${p.name}"`, { description: `${p.tracks.length} track${p.tracks.length === 1 ? "" : "s"} · kept on this device` });
    } catch (e) { toast.error("Couldn't save the playlist", { description: (e as Error).message }); }
    finally { setBusy(false); }
  };
  const onSave = () => {
    if (!s.currentId) { setDraft(s.name); setNaming("save"); return; }
    void doSave();
  };
  const onDelete = () => {
    const cur = s.current;
    if (cur) {
      setConfirm({
        message: `Delete the playlist "${cur.name}"? Your original music files stay where they are.`,
        yes: "Delete playlist",
        run: async () => {
          setBusy(true);
          try { await s.deletePlaylist(cur.id); toast.success(`Deleted "${cur.name}"`); }
          catch (e) { toast.error("Couldn't delete the playlist", { description: (e as Error).message }); }
          finally { setBusy(false); }
        },
      });
    } else if (s.tracks.length) {
      setConfirm({ message: "Clear this unsaved playlist?", yes: "Clear list", run: () => s.clear() });
    }
  };

  const total = playlistSeconds(s.tracks);
  const status = s.current ? (s.dirty ? "Unsaved changes" : "Saved on this device") : s.tracks.length ? "Not saved yet" : "New playlist";
  const deckName = (id: DeckId) => dj.deck(id).state.name;
  const onDeck = (t: PlaylistTrack): DeckId[] => (["A", "B"] as DeckId[]).filter((d) => s.onDeck[d] === t.id && deckName(d) === t.name);

  return (
    <section
      className={`dj-playlist${sheet ? " is-sheet" : ""}${over ? " is-over" : ""}`}
      aria-label="DJ playlist"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={drop}
    >
      <header className="dj-pl-head">
        <ListMusic className="size-4 shrink-0 text-primary" />
        <span className="dj-label">PLAYLIST</span>
        <div className="dj-pl-title min-w-0">
          <b className="truncate" title={s.displayName}>{s.displayName}{s.dirty && <i className="dj-pl-dot" aria-label="unsaved changes" />}</b>
          <small>{s.tracks.length} track{s.tracks.length === 1 ? "" : "s"}{total > 0 && ` · ${clock(total).replace(/\.\d$/, "")}`} · {status}</small>
        </div>
        <div className="dj-pl-actions">
          <Button size="sm" variant="secondary" className="dj-pl-btn" onClick={() => fileRef.current?.click()}><FilePlus2 className="size-4" />Add music</Button>
          <Button size="sm" variant="secondary" className="dj-pl-btn" disabled={busy} onClick={() => guard(() => s.newPlaylist())}><Plus className="size-4" />New</Button>
          <Button size="sm" className="dj-pl-btn" disabled={busy || !s.tracks.length || (!!s.current && !s.dirty)} onClick={onSave}><Save className="size-4" />{busy ? "Saving…" : "Save"}</Button>
          <Button size="sm" variant="secondary" className="dj-pl-btn" disabled={busy || !s.current} onClick={() => { setDraft(s.name); setNaming("rename"); }} aria-label="Rename playlist"><Pencil className="size-4" />Rename</Button>
          <Button size="sm" variant="outline" className="dj-pl-btn dj-pl-delete" disabled={busy || (!s.current && !s.tracks.length)} onClick={onDelete} aria-label={s.current ? "Delete playlist" : "Clear playlist"}><Trash2 className="size-4" />{s.current ? "Delete" : "Clear"}</Button>
          {sheet && <Button size="sm" variant="ghost" className="dj-pl-btn" onClick={onClose} aria-label="Close playlist"><X className="size-4" />Close</Button>}
        </div>
      </header>

      {confirm && (
        <div className="dj-pl-confirm" role="alertdialog" aria-label="Confirm">
          <span>{confirm.message}</span>
          <Button size="sm" variant="destructive" className="dj-pl-btn" onClick={() => { const c = confirm; setConfirm(null); void c.run(); }}>{confirm.yes}</Button>
          <Button size="sm" variant="secondary" className="dj-pl-btn" onClick={() => setConfirm(null)}>Cancel</Button>
        </div>
      )}

      <div className="dj-pl-body">
        <nav className="dj-pl-saved" aria-label="Saved playlists">
          <span className="dj-label">SAVED ({s.saved.length})</span>
          {!s.ready ? <p className="dj-pl-empty">Loading…</p> : s.saved.length === 0 ? <p className="dj-pl-empty">No saved playlists yet. Add music, then press Save.</p> : (
            <ul>
              {s.saved.map((p) => (
                <li key={p.id}>
                  <button type="button" className="dj-pl-saved-item" aria-current={p.id === s.currentId ? "true" : undefined} onClick={() => { if (p.id !== s.currentId) guard(() => s.open(p.id)); }}>
                    <b className="truncate">{p.name}</b><small>{p.tracks.length} track{p.tracks.length === 1 ? "" : "s"}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
        <div className="dj-pl-list-wrap">
          <div ref={listRef} id="dj-pl-list" className="dj-pl-scroll">
          <ol className="dj-pl-list">
            {s.tracks.length === 0 && (
              <li className="dj-pl-empty is-drop">
                <button type="button" onClick={() => fileRef.current?.click()}>Add music files, or drag them here from your computer or the left menu.</button>
              </li>
            )}
            {s.tracks.map((t, i) => {
              const on = onDeck(t);
              return (
                <li key={t.id} className="dj-pl-row" data-on={on.join("") || undefined} draggable
                  onDragStart={(e) => { e.dataTransfer.setData("application/synclab", JSON.stringify({ type: DJ_TRACK_DRAG, id: t.id })); e.dataTransfer.effectAllowed = "copy"; }}>
                  <span className="dj-pl-num">{i + 1}</span>
                  <span className="dj-pl-name truncate" title={t.name}>{t.name}</span>
                  {on.map((d) => <span key={d} className="dj-pl-ondeck" data-deck={d}>ON {d}</span>)}
                  <span className="dj-pl-time">{t.duration ? clock(t.duration).replace(/\.\d$/, "") : "—"}</span>
                  <button type="button" className="dj-pl-load" data-deck="A" onClick={() => void loadPlaylistTrack("A", t.id)} aria-label={`Load ${t.name} on deck A`}>A</button>
                  <button type="button" className="dj-pl-load" data-deck="B" onClick={() => void loadPlaylistTrack("B", t.id)} aria-label={`Load ${t.name} on deck B`}>B</button>
                  <button type="button" className="dj-pl-icon" disabled={i === 0} onClick={() => s.move(t.id, -1)} aria-label={`Move ${t.name} up`}><ArrowUp className="size-4" /></button>
                  <button type="button" className="dj-pl-icon" disabled={i === s.tracks.length - 1} onClick={() => s.move(t.id, 1)} aria-label={`Move ${t.name} down`}><ArrowDown className="size-4" /></button>
                  <button type="button" className="dj-pl-icon is-remove" onClick={() => s.remove(t.id)} aria-label={`Remove ${t.name} from the playlist`}><X className="size-4" /></button>
                </li>
              );
            })}
          </ol>
          </div>
          <TimelineVScrollbar scrollRef={listRef} controls="dj-pl-list" label="Scroll the playlist up and down" />
        </div>
      </div>

      <input ref={fileRef} type="file" multiple accept="audio/*,.mp3,.wav,.aif,.aiff,.m4a,.aac,.ogg,.flac" className="hidden" aria-label="Add music files to the playlist"
        onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />

      <NameEditDialog
        open={naming !== null}
        title={naming === "rename" ? "Rename playlist" : "Name this playlist"}
        label={`Playlist name (up to ${MAX_PLAYLIST_NAME} letters)`}
        value={draft}
        onChange={(v) => setDraft(v.slice(0, MAX_PLAYLIST_NAME))}
        onClose={() => setNaming(null)}
        busy={busy}
        onSave={() => {
          // saving a new list names it; renaming a saved list saves it under the new name
          setNaming(null);
          void doSave(draft);
        }}
      />
    </section>
  );
}
