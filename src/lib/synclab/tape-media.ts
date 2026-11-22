/**
 * Tape & CD Recorder media: which machine is in use (reel, cassette deck, CD burner), the reel
 * and cassette shelves, the CD spindle and what is loaded. There is one tape engine
 * (reel-recorder.ts); this module swaps the right audio in and out of it, so every machine records
 * and plays for real. Items live in memory until Save puts them in the account (tape-shelf-store);
 * saved items come back on the shelf on every device and their audio downloads when loaded.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Capture } from "./bounce";
import { getReelRecorder } from "./reel-recorder";
import { cdRemainingSeconds } from "./cd-audio";
import {
  deleteFromShelf,
  listSaved,
  loadFromShelf,
  onAccountChange,
  saveToShelf,
} from "./tape-shelf-store";
import {
  addDiscTrack,
  captureSeconds,
  cassetteType,
  cassetteTypeFor,
  dubToCassette,
  discTrackSeconds,
  discType,
  editName,
  fitToReel,
  isStoredOnly,
  markDirty,
  markSaved,
  newReel,
  reelSeconds,
  reelType,
  reelTypeFor,
  releaseAudio,
  savedCassette,
  savedDisc,
  savedReel,
  seedReels,
  toSaved,
  withAudio,
  moveDiscTrack,
  newCassette,
  newDisc,
  otherSide,
  removeDiscTrack,
  renameCassette,
  renameDiscTrack,
  seedCassettes,
  seedDiscs,
  shownName,
  sideSeconds,
  writeSide,
  type Cassette,
  type CassetteSide,
  type Disc,
  type Reel,
  type SavedMeta,
  type ShelfKind,
} from "./tape-media-model";

export type Medium = "reel" | "cassette" | "cd";
export type DeckMotion = "idle" | "inserting" | "ejecting" | "flipping";
export type TrayMotion = "idle" | "opening" | "closing";
export type ReelMotion = "idle" | "loading" | "unloading";

export interface MediaState {
  medium: Medium;
  reels: Reel[];
  /** the reel threaded on the reel-to-reel */
  reelDeck: { reelId: string | null; motion: ReelMotion };
  cassettes: Cassette[];
  deck: { cassetteId: string | null; side: CassetteSide; motion: DeckMotion; doorOpen: boolean };
  discs: Disc[];
  tray: { discId: string | null; open: boolean; motion: TrayMotion };
  /** CD track now in the player (for Play / Next / Prev) */
  trackId: string | null;
  /** set while the CD files are being written */
  burn: { done: number; total: number } | null;
  /** saved reels/cassettes/CDs in the account */
  shelf: {
    /** the account's list has been read */
    ready: boolean;
    /** item being saved, with upload progress 0..1 */
    saving: { id: string; progress: number } | null;
    /** item whose audio is downloading */
    loading: string | null;
  };
}

/** Animation lengths; the state change lands at the visible moment of each move. */
export const INSERT_MS = 700;
export const EJECT_MS = 600;
export const FLIP_MS = 1100;
export const TRAY_MS = 700;
export const REEL_LOAD_MS = 900;
export const REEL_UNLOAD_MS = 700;

let counter = 0;
const makeId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

const startReels = seedReels(makeId);

class TapeMedia {
  private state: MediaState = {
    medium: "reel",
    reels: startReels,
    reelDeck: { reelId: startReels[0]!.id, motion: "idle" },
    cassettes: seedCassettes(makeId),
    deck: { cassetteId: null, side: "A", motion: "idle", doorOpen: true },
    discs: seedDiscs(makeId),
    tray: { discId: null, open: false, motion: "idle" },
    trackId: null,
    burn: null,
    shelf: { ready: false, saving: null, loading: null },
  };
  private listeners = new Set<() => void>();
  private hooked = false;
  private loads = new Map<string, Promise<boolean>>();

  subscribe = (fn: () => void) => {
    this.hook();
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;
  private update(patch: Partial<MediaState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }
  private get rec() {
    return getReelRecorder();
  }
  /** Every finished take or loaded file lands on whatever is in the machine. */
  private hook() {
    if (this.hooked) return;
    this.hooked = true;
    this.rec.onTapeChange((capture, why) => {
      if (why === "set") return;
      const { medium, deck, reelDeck } = this.state;
      if (medium === "reel" && reelDeck.reelId) this.reelTook(reelDeck.reelId, capture, why);
      else if (medium === "cassette" && deck.cassetteId && capture)
        this.update({
          cassettes: writeSide(this.state.cassettes, deck.cassetteId, deck.side, capture).map(
            (c) => (c.id === deck.cassetteId ? markDirty(c) : c),
          ),
        });
      else if (medium === "cd" && capture) this.takeToDisc(capture, why);
    });
    // The reel on the machine at start-up: adopt a tape already in the engine, set its length.
    const snap = this.rec.getSnapshot();
    if (this.state.medium === "reel" && snap.mode === "stopped") {
      const held = this.rec.getCapture();
      const reel = this.threadedReel();
      if (reel && held && !reel.capture) this.patchReel(reel.id, (r) => ({ ...r, capture: held }));
      this.loadReelTape();
    }
    void this.refreshShelf();
    onAccountChange(() => void this.refreshShelf());
  }

  /** The reel-to-reel's tape, for dubbing to CD. */
  reelTape = () => this.threadedReel()?.capture ?? null;
  threadedReel = () => this.state.reels.find((r) => r.id === this.state.reelDeck.reelId) ?? null;

  // ---------- reel-to-reel ----------
  private reelName(r: Reel) {
    return shownName(r.name, reelType(r.typeId).name);
  }
  private loadReelTape() {
    const r = this.threadedReel();
    if (!r) this.rec.setTape(null, "No reel", 0);
    else this.rec.setTape(r.capture, this.reelName(r), reelSeconds(r.typeId));
  }
  private patchReel(id: string, fn: (r: Reel) => Reel) {
    this.update({ reels: this.state.reels.map((r) => (r.id === id ? fn(r) : r)) });
  }
  private reelTook(id: string, capture: Capture | null, why: "record" | "load") {
    const fileName = this.rec.getSnapshot().name;
    this.patchReel(id, (r) => {
      // A file loaded onto a reel nobody named yet gives the reel its name.
      const unnamed = !r.name.trim() || r.name === reelType(r.typeId).name;
      return markDirty({
        ...r,
        capture,
        ...(why === "load" && unnamed ? { name: editName(fileName) } : {}),
      });
    });
    const r = this.threadedReel();
    if (r && why === "load") this.rec.configure({ name: this.reelName(r) });
  }
  /** Thread a reel from the shelf onto the machine (taking the current one off first). */
  loadReel = async (id: string) => {
    const deck = this.state.reelDeck;
    if (deck.motion !== "idle" || deck.reelId === id) return;
    await this.settle();
    if (!(await this.ensureLoaded("reel", id))) return;
    if (this.state.reelDeck.reelId) await this.removeReel();
    this.update({ reelDeck: { reelId: id, motion: "loading" } });
    if (this.state.medium === "reel") this.loadReelTape();
    await wait(REEL_LOAD_MS);
    this.update({ reelDeck: { ...this.state.reelDeck, motion: "idle" } });
  };
  /** Take the reel off the machine and put it back on the shelf. */
  removeReel = async () => {
    const id = this.state.reelDeck.reelId;
    if (!id || this.state.reelDeck.motion !== "idle") return;
    await this.settle();
    this.update({ reelDeck: { reelId: id, motion: "unloading" } });
    if (this.state.medium === "reel") this.rec.setTape(null, "No reel", 0);
    await wait(REEL_UNLOAD_MS);
    this.update({ reelDeck: { reelId: null, motion: "idle" } });
    this.patchReel(id, releaseAudio);
  };
  addReel = (typeId: string, name: string) => {
    const r = newReel(typeId, name.trim() ? name : reelType(typeId).name, makeId());
    this.update({ reels: [r, ...this.state.reels] });
    return r.id;
  };
  renameReel = (id: string, name: string) => {
    this.patchReel(id, (r) => markDirty({ ...r, name: editName(name) }));
    const r = this.threadedReel();
    if (r?.id === id && this.state.medium === "reel")
      this.rec.configure({ name: this.reelName(r) });
  };
  /** Erase a reel's tape (bulk eraser). */
  eraseReel = async (id: string) => {
    if (this.state.reelDeck.reelId === id) await this.settle();
    this.patchReel(id, (r) =>
      markDirty({
        ...r,
        capture: null,
        ...(r.store ? { store: { ...r.store, loaded: true } } : {}),
      }),
    );
    if (this.state.reelDeck.reelId === id && this.state.medium === "reel") this.loadReelTape();
  };

  insertedCassette = () =>
    this.state.cassettes.find((c) => c.id === this.state.deck.cassetteId) ?? null;
  trayDisc = () => this.state.discs.find((d) => d.id === this.state.tray.discId) ?? null;

  private sideName(c: Cassette, side: CassetteSide) {
    return `${shownName(c.name, cassetteType(c.typeId).name)} · Side ${side}`;
  }
  private loadSide() {
    const c = this.insertedCassette();
    const side = this.state.deck.side;
    if (!c) this.rec.setTape(null, "No cassette", 0);
    else this.rec.setTape(c.sides[side], this.sideName(c, side), sideSeconds(c.typeId));
  }
  private discLimit() {
    const d = this.trayDisc();
    return d && !this.state.tray.open
      ? cdRemainingSeconds(discTrackSeconds(d), discType(d.typeId).minutes)
      : 0;
  }
  private loadDisc() {
    const d = this.trayDisc();
    const track = d?.tracks.find((t) => t.id === this.state.trackId) ?? null;
    const title = d ? shownName(d.title, "My CD") : "No disc";
    this.rec.setTape(
      track?.capture ?? null,
      track ? track.title || title : title,
      this.discLimit(),
    );
  }
  /** Stop recording first (the take lands on the current medium), then wait for animations. */
  private async settle() {
    if (this.rec.getSnapshot().mode === "recording") await this.rec.stop();
  }

  setMedium = async (next: Medium) => {
    if (this.state.medium === next) return;
    await this.settle();
    this.update({ medium: next });
    if (next === "reel") this.loadReelTape();
    if (next === "cassette") this.loadSide();
    if (next === "cd") this.loadDisc();
  };

  // ---------- cassette deck ----------
  insertCassette = async (id: string) => {
    if (this.state.deck.motion !== "idle") return;
    if (this.state.deck.cassetteId === id) return;
    if (!(await this.ensureLoaded("cassette", id))) return;
    if (this.state.deck.cassetteId) await this.ejectCassette();
    await this.settle();
    this.update({ deck: { cassetteId: id, side: "A", motion: "inserting", doorOpen: true } });
    this.loadSide();
    await wait(INSERT_MS);
    this.update({ deck: { ...this.state.deck, motion: "idle", doorOpen: false } });
  };

  ejectCassette = async () => {
    if (!this.state.deck.cassetteId || this.state.deck.motion !== "idle") return;
    await this.settle();
    this.rec.setTape(null, "No cassette", 0);
    this.update({ deck: { ...this.state.deck, motion: "ejecting", doorOpen: true } });
    await wait(EJECT_MS);
    const id = this.state.deck.cassetteId;
    this.update({
      deck: { cassetteId: null, side: "A", motion: "idle", doorOpen: true },
      cassettes: this.state.cassettes.map((c) => (c.id === id ? releaseAudio(c) : c)),
    });
  };

  /** Eject, turn the cassette over and put it back: the other side's audio is loaded mid-flip. */
  flipCassette = async () => {
    if (!this.state.deck.cassetteId || this.state.deck.motion !== "idle") return;
    await this.settle();
    this.rec.setTape(null, "Flipping", 0);
    this.update({ deck: { ...this.state.deck, motion: "flipping", doorOpen: true } });
    await wait(FLIP_MS / 2);
    this.update({ deck: { ...this.state.deck, side: otherSide(this.state.deck.side) } });
    this.loadSide();
    await wait(FLIP_MS / 2);
    this.update({ deck: { ...this.state.deck, motion: "idle", doorOpen: false } });
  };

  addCassette = (typeId: string, name: string) => {
    const c = newCassette(typeId, name.trim() ? name : cassetteType(typeId).name, makeId());
    this.update({ cassettes: [c, ...this.state.cassettes] });
    return c.id;
  };
  renameCassette = (id: string, name: string) => {
    this.update({
      cassettes: renameCassette(this.state.cassettes, id, name).map((c) =>
        c.id === id ? markDirty(c) : c,
      ),
    });
    const c = this.insertedCassette();
    if (c?.id === id && this.state.medium === "cassette")
      this.rec.configure({ name: this.sideName(c, this.state.deck.side) });
  };
  /** Erase one side of a cassette (bulk eraser). */
  eraseSide = async (id: string, side: CassetteSide) => {
    if (!(await this.ensureLoaded("cassette", id))) return;
    this.update({
      cassettes: writeSide(this.state.cassettes, id, side, null).map((c) =>
        c.id === id ? markDirty(c) : c,
      ),
    });
    if (this.state.deck.cassetteId === id && this.state.deck.side === side) this.loadSide();
  };

  // ---------- CD burner ----------
  openTray = async () => {
    if (this.state.tray.motion !== "idle" || this.state.tray.open || this.state.burn) return;
    await this.settle();
    this.update({ tray: { ...this.state.tray, motion: "opening" } });
    await wait(TRAY_MS);
    this.update({ tray: { ...this.state.tray, open: true, motion: "idle" } });
    this.loadDisc();
  };
  closeTray = async () => {
    if (this.state.tray.motion !== "idle" || !this.state.tray.open) return;
    this.update({ tray: { ...this.state.tray, motion: "closing" } });
    await wait(TRAY_MS);
    this.update({ tray: { ...this.state.tray, open: false, motion: "idle" } });
    this.loadDisc();
  };
  /** Put a disc from the spindle on the tray (opening it first) and close it. */
  loadDiscOnTray = async (id: string) => {
    if (this.state.burn) return;
    if (!(await this.ensureLoaded("cd", id))) return;
    if (!this.state.tray.open) await this.openTray();
    const d = this.state.discs.find((x) => x.id === id);
    const before = this.state.tray.discId;
    this.update({
      tray: { ...this.state.tray, discId: id },
      trackId: d?.tracks[0]?.id ?? null,
      discs: this.state.discs.map((x) => (x.id === before && x.id !== id ? releaseAudio(x) : x)),
    });
    await wait(250);
    await this.closeTray();
  };
  removeDiscFromTray = async () => {
    if (!this.state.tray.open) await this.openTray();
    const id = this.state.tray.discId;
    this.update({
      tray: { ...this.state.tray, discId: null },
      trackId: null,
      discs: this.state.discs.map((d) => (d.id === id ? releaseAudio(d) : d)),
    });
    this.loadDisc();
  };
  addDisc = (typeId: string, title: string) => {
    const d = newDisc(typeId, title.trim() ? title : "My CD", makeId());
    this.update({ discs: [d, ...this.state.discs] });
    return d.id;
  };
  /** Every change to a disc goes through here, so a saved CD knows it has unsaved changes. */
  private patchDisc(id: string, fn: (d: Disc) => Disc) {
    this.update({ discs: this.state.discs.map((d) => (d.id === id ? markDirty(fn(d)) : d)) });
  }
  renameDisc = (id: string, patch: { title?: string; artist?: string }) =>
    this.patchDisc(id, (d) => ({
      ...d,
      ...(patch.title !== undefined ? { title: editName(patch.title) } : {}),
      ...(patch.artist !== undefined ? { artist: editName(patch.artist) } : {}),
    }));
  renameTrack = (discId: string, trackId: string, title: string) =>
    this.patchDisc(discId, (d) => renameDiscTrack(d, trackId, title));
  moveTrack = (discId: string, trackId: string, delta: number) =>
    this.patchDisc(discId, (d) => moveDiscTrack(d, trackId, delta));
  removeTrack = async (discId: string, trackId: string) => {
    await this.settle();
    this.patchDisc(discId, (d) => removeDiscTrack(d, trackId));
    if (this.state.trackId === trackId) this.update({ trackId: null });
    if (this.state.medium === "cd") this.loadDisc();
  };
  /** Add audio (song render, cassette side, reel tape) to the disc in the tray. */
  addToDisc = (capture: Capture, title: string): string | null => {
    const d = this.trayDisc();
    if (!d) return "Load a blank CD into the tray first.";
    if (this.state.tray.open) return "Close the tray first.";
    const result = addDiscTrack(d, { id: makeId(), title, capture });
    if (result.error) return result.error;
    this.patchDisc(d.id, () => result.disc);
    if (this.state.medium === "cd" && this.rec.getSnapshot().mode !== "playing") {
      this.update({ trackId: result.disc.tracks.at(-1)!.id });
      this.loadDisc();
    }
    return null;
  };
  private takeToDisc(capture: Capture, why: "record" | "load") {
    const d = this.trayDisc();
    const title =
      why === "load" ? this.rec.getSnapshot().name : `Live take ${d ? d.tracks.length + 1 : 1}`;
    const error = this.addToDisc(capture, title);
    if (error) {
      toast.error("Not added to the CD", { description: error });
      this.loadDisc();
    } else if (why === "record")
      toast.success(`${title} burned to the CD`, {
        description: `${Math.round(captureSeconds(capture))} s added.`,
      });
  }
  selectTrack = async (trackId: string | null) => {
    await this.settle();
    this.update({ trackId });
    this.loadDisc();
  };
  /** Play the CD from the chosen track; Next/Prev step through the disc. */
  playTrack = async (trackId: string) => {
    await this.selectTrack(trackId);
    await this.rec.play();
  };
  stepTrack = async (delta: number) => {
    const d = this.trayDisc();
    if (!d?.tracks.length) return;
    const at = d.tracks.findIndex((t) => t.id === this.state.trackId);
    const next = d.tracks[Math.max(0, Math.min(d.tracks.length - 1, (at < 0 ? 0 : at) + delta))]!;
    const wasPlaying = this.rec.getSnapshot().mode === "playing";
    await this.selectTrack(next.id);
    if (wasPlaying) await this.rec.play();
  };
  setBurn = (burn: MediaState["burn"]) => this.update({ burn });

  // ---------- dubbing from other parts of the studio (DJ Decks mix…) ----------
  /** Put a recording on the reel-to-reel (replacing the reel's tape) and show the reel. */
  sendToReel = async (capture: Capture, name: string) => {
    await this.settle();
    await this.setMedium("reel");
    const typeId = reelTypeFor(captureSeconds(capture));
    const fit = fitToReel(capture, typeId);
    const r = { ...newReel(typeId, name, makeId()), capture: fit.capture };
    this.update({ reels: [r, ...this.state.reels] });
    await this.loadReel(r.id);
    const type = reelType(typeId).name;
    return fit.cutSeconds > 0
      ? `Dubbed onto a new ${type} reel. The last ${Math.round(fit.cutSeconds)} s didn't fit.`
      : `Dubbed onto a new ${type} reel on the reel-to-reel.`;
  };
  /** Dub onto a new cassette long enough for it (side A, then side B) and put it in the deck. */
  sendToCassette = async (capture: Capture, name: string) => {
    await this.settle();
    const typeId = cassetteTypeFor(captureSeconds(capture));
    const c = newCassette(typeId, name, makeId());
    const { a, b, cutSeconds } = dubToCassette(capture, typeId);
    c.sides = { A: a, B: b };
    this.update({ cassettes: [c, ...this.state.cassettes] });
    await this.setMedium("cassette");
    await this.insertCassette(c.id);
    const type = cassetteType(typeId).name;
    return cutSeconds > 0
      ? `Dubbed onto a new ${type}. The last ${Math.round(cutSeconds)} s didn't fit on the cassette.`
      : b
        ? `Dubbed onto a new ${type}: side A, carrying on to side B.`
        : `Dubbed onto side A of a new ${type}.`;
  };
  /** Add as the next track on the CD in the tray, or on a fresh blank CD if that one can't take it. */
  sendToCd = async (capture: Capture, title: string) => {
    await this.settle();
    await this.setMedium("cd");
    let error = this.trayDisc() && !this.state.tray.open ? this.addToDisc(capture, title) : "none";
    if (error) {
      const d = newDisc("silver-80", title, makeId());
      this.update({ discs: [d, ...this.state.discs] });
      await this.loadDiscOnTray(d.id);
      error = this.addToDisc(capture, title);
      if (error) throw new Error(error);
      this.update({ trackId: this.trayDisc()?.tracks.at(-1)?.id ?? null });
      this.loadDisc();
      return `Track 1 on a new blank CD-R 80.`;
    }
    return `Added as track ${this.trayDisc()?.tracks.length ?? 1} on the CD in the tray.`;
  };
  /** Ready the deck for a fresh live recording (no CD track loaded, limit = room left). */
  readyLiveTake = () => {
    this.update({ trackId: null });
    this.loadDisc();
  };

  // ---------- saved in the account ----------
  private list(kind: ShelfKind): (Reel | Cassette | Disc)[] {
    return kind === "reel"
      ? this.state.reels
      : kind === "cassette"
        ? this.state.cassettes
        : this.state.discs;
  }
  private patchItem(
    kind: ShelfKind,
    id: string,
    fn: <T extends Reel | Cassette | Disc>(x: T) => T,
  ) {
    if (kind === "reel")
      this.update({ reels: this.state.reels.map((x) => (x.id === id ? fn(x) : x)) });
    else if (kind === "cassette")
      this.update({ cassettes: this.state.cassettes.map((x) => (x.id === id ? fn(x) : x)) });
    else this.update({ discs: this.state.discs.map((x) => (x.id === id ? fn(x) : x)) });
  }
  private inMachine(kind: ShelfKind, id: string) {
    return kind === "reel"
      ? this.state.reelDeck.reelId === id
      : kind === "cassette"
        ? this.state.deck.cassetteId === id
        : this.state.tray.discId === id;
  }
  find = (kind: ShelfKind, id: string) => this.list(kind).find((x) => x.id === id) ?? null;

  /** Download a saved item's audio before it goes in a machine. False when that failed. */
  private ensureLoaded(kind: ShelfKind, id: string): Promise<boolean> {
    const item = this.find(kind, id);
    if (!item || !isStoredOnly(item)) return Promise.resolve(!!item);
    const running = this.loads.get(id);
    if (running) return running;
    const job = (async () => {
      this.update({ shelf: { ...this.state.shelf, loading: id } });
      try {
        const audio = await loadFromShelf(id, item.store!.parts);
        this.patchItem(kind, id, (x) => withAudio(x, audio));
        return true;
      } catch (error) {
        toast.error("Couldn't load it", {
          description: error instanceof Error ? error.message : "Try again.",
        });
        return false;
      } finally {
        this.loads.delete(id);
        this.update({ shelf: { ...this.state.shelf, loading: null } });
      }
    })();
    this.loads.set(id, job);
    return job;
  }

  /** Recording of one part (reel tape, cassette side) for dubbing, read from the account if needed. */
  partCapture = async (kind: "reel" | "cassette", id: string, key: string) => {
    const item = this.find(kind, id);
    if (!item) return null;
    if (isStoredOnly(item)) {
      const part = item.store!.parts.filter((p) => p.key === key);
      return (await loadFromShelf(id, part)).get(key) ?? null;
    }
    return kind === "reel" ? (item as Reel).capture : (item as Cassette).sides[key as CassetteSide];
  };

  /** Save a reel, cassette or CD (name and recordings) to the account. */
  saveItem = async (kind: ShelfKind, id: string): Promise<boolean> => {
    if (this.state.shelf.saving) return false;
    if (this.inMachine(kind, id)) await this.settle();
    if (!(await this.ensureLoaded(kind, id))) return false;
    const item = this.find(kind, id);
    if (!item) return false;
    const { meta, audio } = toSaved(kind, item, Date.now());
    this.update({ shelf: { ...this.state.shelf, saving: { id, progress: 0 } } });
    try {
      const saved = await saveToShelf(meta, audio, (progress) =>
        this.update({ shelf: { ...this.state.shelf, saving: { id, progress } } }),
      );
      // Anything changed while uploading stays marked as unsaved.
      this.patchItem(kind, id, (x) => {
        const clean = markSaved(x, saved);
        return x === item
          ? clean
          : ({ ...clean, store: { ...clean.store!, dirty: true } } as typeof x);
      });
      return true;
    } catch (error) {
      toast.error("Not saved", {
        description: error instanceof Error ? error.message : "Try again.",
      });
      return false;
    } finally {
      this.update({ shelf: { ...this.state.shelf, saving: null } });
    }
  };

  /** Take an item off the shelf; saved items are deleted from the account too. */
  deleteItem = async (kind: ShelfKind, id: string): Promise<boolean> => {
    if (this.inMachine(kind, id)) return false;
    const item = this.find(kind, id);
    if (!item) return false;
    if (item.store) {
      try {
        await deleteFromShelf(id);
      } catch (error) {
        toast.error("Not deleted", {
          description: error instanceof Error ? error.message : "Try again.",
        });
        return false;
      }
    }
    if (kind === "reel") this.update({ reels: this.state.reels.filter((x) => x.id !== id) });
    else if (kind === "cassette")
      this.update({ cassettes: this.state.cassettes.filter((x) => x.id !== id) });
    else this.update({ discs: this.state.discs.filter((x) => x.id !== id) });
    return true;
  };

  /** Read the account's saved items onto the shelves (after start-up and on sign-in/out). */
  refreshShelf = async () => {
    let saved: SavedMeta[];
    try {
      saved = await listSaved();
    } catch {
      this.update({ shelf: { ...this.state.shelf, ready: true } });
      return;
    }
    const ids = new Set(saved.map((m) => m.id));
    const merge = <T extends Reel | Cassette | Disc>(
      list: T[],
      kind: ShelfKind,
      make: (m: SavedMeta) => T,
    ): T[] => {
      // Saved items no longer in the account (signed out, deleted elsewhere) leave the shelf,
      // unless they are in a machine or have unsaved changes.
      const kept = list.filter(
        (x) => !x.store || ids.has(x.id) || this.inMachine(kind, x.id) || x.store.dirty,
      );
      const have = new Set(kept.map((x) => x.id));
      const fresh = saved.filter((m) => m.kind === kind && !have.has(m.id)).map(make);
      return [...fresh, ...kept];
    };
    this.update({
      reels: merge(this.state.reels, "reel", savedReel),
      cassettes: merge(this.state.cassettes, "cassette", savedCassette),
      discs: merge(this.state.discs, "cd", savedDisc),
      shelf: { ...this.state.shelf, ready: true },
    });
  };
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const g = globalThis as typeof globalThis & { __synclabTapeMedia?: TapeMedia };
export const getTapeMedia = () => (g.__synclabTapeMedia ??= new TapeMedia());
export function useTapeMedia(): MediaState {
  const m = getTapeMedia();
  return useSyncExternalStore(m.subscribe, m.getSnapshot, m.getSnapshot);
}
