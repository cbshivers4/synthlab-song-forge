/**
 * Tape & CD Recorder media: which machine is in use (reel, cassette deck, CD burner), the cassette
 * shelf, the blank CD spindle and what is loaded. There is one tape engine (reel-recorder.ts);
 * this module swaps the right audio in and out of it, so every machine records and plays for real.
 * Media live for the session (in memory) — Save file / Add to project / Burn keep the audio.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Capture } from "./bounce";
import { getReelRecorder } from "./reel-recorder";
import { cdRemainingSeconds } from "./cd-audio";
import {
  addDiscTrack,
  captureSeconds,
  cassetteType,
  discTrackSeconds,
  discType,
  editName,
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
} from "./tape-media-model";

export type Medium = "reel" | "cassette" | "cd";
export type DeckMotion = "idle" | "inserting" | "ejecting" | "flipping";
export type TrayMotion = "idle" | "opening" | "closing";

export interface MediaState {
  medium: Medium;
  cassettes: Cassette[];
  deck: { cassetteId: string | null; side: CassetteSide; motion: DeckMotion; doorOpen: boolean };
  discs: Disc[];
  tray: { discId: string | null; open: boolean; motion: TrayMotion };
  /** CD track now in the player (for Play / Next / Prev) */
  trackId: string | null;
  /** set while the CD files are being written */
  burn: { done: number; total: number } | null;
}

/** Animation lengths; the state change lands at the visible moment of each move. */
export const INSERT_MS = 700;
export const EJECT_MS = 600;
export const FLIP_MS = 1100;
export const TRAY_MS = 700;

let counter = 0;
const makeId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

class TapeMedia {
  private state: MediaState = {
    medium: "reel",
    cassettes: seedCassettes(makeId),
    deck: { cassetteId: null, side: "A", motion: "idle", doorOpen: true },
    discs: seedDiscs(makeId),
    tray: { discId: null, open: false, motion: "idle" },
    trackId: null,
    burn: null,
  };
  private listeners = new Set<() => void>();
  private reel: { capture: Capture | null; name: string } = {
    capture: null,
    name: "Untitled tape",
  };
  private hooked = false;

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
      const { medium, deck } = this.state;
      if (medium === "reel") this.reel = { capture, name: this.rec.getSnapshot().name };
      else if (medium === "cassette" && deck.cassetteId && capture)
        this.update({
          cassettes: writeSide(this.state.cassettes, deck.cassetteId, deck.side, capture),
        });
      else if (medium === "cd" && capture) this.takeToDisc(capture, why);
    });
  }

  /** The reel-to-reel's tape (also while another machine is in use), for dubbing to CD. */
  reelTape = () => (this.state.medium === "reel" ? this.rec.getCapture() : this.reel.capture);

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
    if (this.state.medium === "reel")
      this.reel = { capture: this.rec.getCapture(), name: this.rec.getSnapshot().name };
    this.update({ medium: next });
    if (next === "reel") this.rec.setTape(this.reel.capture, this.reel.name, null);
    if (next === "cassette") this.loadSide();
    if (next === "cd") this.loadDisc();
  };

  // ---------- cassette deck ----------
  insertCassette = async (id: string) => {
    if (this.state.deck.motion !== "idle") return;
    if (this.state.deck.cassetteId === id) return;
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
    this.update({ deck: { cassetteId: null, side: "A", motion: "idle", doorOpen: true } });
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
    this.update({ cassettes: renameCassette(this.state.cassettes, id, name) });
    const c = this.insertedCassette();
    if (c?.id === id && this.state.medium === "cassette")
      this.rec.configure({ name: this.sideName(c, this.state.deck.side) });
  };
  removeCassette = (id: string) => {
    if (this.state.deck.cassetteId === id) return;
    this.update({ cassettes: this.state.cassettes.filter((c) => c.id !== id) });
  };
  /** Erase one side of a cassette (bulk eraser). */
  eraseSide = (id: string, side: CassetteSide) => {
    this.update({ cassettes: writeSide(this.state.cassettes, id, side, null) });
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
    if (!this.state.tray.open) await this.openTray();
    const d = this.state.discs.find((x) => x.id === id);
    this.update({ tray: { ...this.state.tray, discId: id }, trackId: d?.tracks[0]?.id ?? null });
    await wait(250);
    await this.closeTray();
  };
  removeDiscFromTray = async () => {
    if (!this.state.tray.open) await this.openTray();
    this.update({ tray: { ...this.state.tray, discId: null }, trackId: null });
    this.loadDisc();
  };
  addDisc = (typeId: string, title: string) => {
    const d = newDisc(typeId, title.trim() ? title : "My CD", makeId());
    this.update({ discs: [d, ...this.state.discs] });
    return d.id;
  };
  removeDisc = (id: string) => {
    if (this.state.tray.discId === id) return;
    this.update({ discs: this.state.discs.filter((d) => d.id !== id) });
  };
  private patchDisc(id: string, fn: (d: Disc) => Disc) {
    this.update({ discs: this.state.discs.map((d) => (d.id === id ? fn(d) : d)) });
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
  /** Ready the deck for a fresh live recording (no CD track loaded, limit = room left). */
  readyLiveTake = () => {
    this.update({ trackId: null });
    this.loadDisc();
  };
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const g = globalThis as typeof globalThis & { __synclabTapeMedia?: TapeMedia };
export const getTapeMedia = () => (g.__synclabTapeMedia ??= new TapeMedia());
export function useTapeMedia(): MediaState {
  const m = getTapeMedia();
  return useSyncExternalStore(m.subscribe, m.getSnapshot, m.getSnapshot);
}
