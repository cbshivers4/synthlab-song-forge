import { claimControllerMidi, getMidiAccess, type RawMidi } from "./midi";
import { peekDj, type DeckId } from "./dj-engine";
import { getPlaylists } from "./dj-playlist-store";
import {
  djActionKind, djActionLabel, djEvent, djProfileFor, learnBinding, learnable, relativeDelta, resolveDjAction, tempoPitch,
  type DjEvent, type DjProfile,
} from "./dj-midi-map";

/**
 * DJ Decks hardware controller (browser side). Listens through the app's one shared MIDI
 * subscription (claimControllerMidi), so connecting a DJ controller never adds a second listener
 * and its buttons never also play instrument notes. Known controllers (port name) use their
 * built-in layout; Learn adds or overrides any control. Settings are device-only localStorage.
 */
const KEY = "synclab.dj.midi.v1";
type Saved = { learned: Record<string, string>; reverseTempo: boolean; jogSigned: boolean };

class DjMidiController {
  learned: Record<string, string> = {};
  reverseTempo = false;
  /** generic jog wheels: false = centred on 64 (most), true = 1/127 style */
  jogSigned = false;
  learning: string | null = null;
  /** last control the hardware moved, for the on-screen activity light */
  last: { label: string; port: string; at: number; mapped: boolean } | null = null;
  /** playlist row the Browse knob points at */
  cursor = -1;
  /** set while DJ Decks is open; the controller waits for it */
  loader: ((deck: DeckId, index: number) => void) | null = null;
  version = 0;
  private listeners = new Set<() => void>();
  private loaded = false;
  private msb: Record<DeckId, number> = { A: 64, B: 64 };
  private nudgeTimer: Record<DeckId, ReturnType<typeof setTimeout> | null> = { A: null, B: null };
  private emitAt = 0;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  /** ports currently sending, so lights go to the matching output */
  ports = new Map<string, DjProfile | null>();

  load() {
    if (this.loaded || typeof window === "undefined") return;
    this.loaded = true;
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Saved> | null;
      if (s?.learned && typeof s.learned === "object") this.learned = s.learned;
      this.reverseTempo = !!s?.reverseTempo;
      this.jogSigned = !!s?.jogSigned;
    } catch { /* fresh device */ }
  }
  private save() {
    try { localStorage.setItem(KEY, JSON.stringify({ learned: this.learned, reverseTempo: this.reverseTempo, jogSigned: this.jogSigned } satisfies Saved)); } catch { /* private mode */ }
  }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => void this.listeners.delete(fn); }
  /** Jog wheels send dozens of messages a second: the screen updates at most ~12 times a second. */
  private emit(now = false) {
    const go = () => { this.emitTimer = null; this.emitAt = performance.now(); this.version++; this.listeners.forEach((l) => l()); };
    if (now) { if (this.emitTimer) clearTimeout(this.emitTimer); go(); return; }
    if (this.emitTimer) return;
    const wait = Math.max(0, 80 - (performance.now() - this.emitAt));
    this.emitTimer = setTimeout(go, wait);
  }

  startLearn(actionId: string) { this.learning = actionId; this.emit(true); }
  cancelLearn() { this.learning = null; this.emit(true); }
  clear(actionId: string) {
    this.learned = Object.fromEntries(Object.entries(this.learned).filter(([, v]) => v !== actionId));
    this.save(); this.emit(true);
  }
  clearAll() { this.learned = {}; this.save(); this.emit(true); }
  setReverseTempo(on: boolean) { this.reverseTempo = on; this.save(); this.emit(true); }
  setJogSigned(on: boolean) { this.jogSigned = on; this.save(); this.emit(true); }
  learnedKeyFor(actionId: string) { return Object.entries(this.learned).find(([, v]) => v === actionId)?.[0] ?? null; }
  moveCursor(delta: number) {
    const n = getPlaylists().tracks.length;
    if (!n) return;
    this.cursor = Math.max(0, Math.min(n - 1, (this.cursor < 0 ? (delta > 0 ? -1 : n) : this.cursor) + delta));
    this.emit(true);
  }
  setCursor(i: number) { if (i !== this.cursor) { this.cursor = i; this.emit(true); } }

  /** Raw message from any enabled MIDI input. Returns true when it belongs to DJ Decks. */
  handle(m: RawMidi): boolean {
    this.load();
    const ev = djEvent(m.status, m.d1, m.d2);
    if (!ev) return false;
    const profile = djProfileFor(m.portName);
    if (this.learning) {
      if (!learnable(djActionKind(this.learning), ev)) return true;
      const action = this.learning;
      this.learned = learnBinding(this.learned, ev.key, action);
      this.learning = null;
      this.save();
      this.last = { label: `Learned: ${djActionLabel(action)}`, port: m.portName, at: performance.now(), mapped: true };
      this.emit(true);
      return true;
    }
    const action = resolveDjAction(ev.key, this.learned, profile);
    if (!action && !profile) return false;
    // keys learned on an ordinary keyboard/pad controller only belong to DJ Decks while it is open
    if (!profile && !this.loader) return false;
    if (!this.ports.has(m.portName)) { this.ports.set(m.portName, profile); this.emit(true); }
    this.last = { label: action ? djActionLabel(action) : "Not used by DJ Decks", port: m.portName, at: performance.now(), mapped: !!action };
    if (action) this.apply(action, ev, profile != null && !this.learned[ev.key]);
    this.emit();
    return true;
  }

  private apply(action: string, ev: DjEvent, fromLayout: boolean) {
    const dj = peekDj();
    if (!dj) return;
    const [scope, verb = "", arg] = action.split(":");
    const raw = ev.type === "value" ? ev.raw : 0;
    const v = raw / 127;
    const press = ev.type === "press" || (ev.type === "value" && raw > 0 && djActionKind(action) === "button");
    if (scope === "mix") {
      if (verb === "crossfader") dj.setCrossfader(v * 2 - 1);
      else if (verb === "master") dj.setMaster(v * 1.2);
      else if (verb === "phonesLevel") dj.setPhonesLevel(v * 1.5);
      else if (verb === "phonesMix") dj.setPhonesMix(v);
      else if (verb === "browse" && ev.type === "value") this.moveCursor(Math.sign(relativeDelta(raw, "signed")));
      else if (verb === "record" && press) { if (dj.state.recording) dj.stopRecording(); else void dj.startRecording().catch(() => undefined); }
      return;
    }
    const id = scope as DeckId;
    if (id !== "A" && id !== "B") return;
    const deck = dj.deck(id);
    const jogStyle = fromLayout || !this.jogSigned ? "centre" : "signed";
    switch (verb) {
      case "play": if (press) deck.toggle(); return;
      case "cue": if (press) deck.cue(); return;
      case "start": if (press) deck.toStart(); return;
      case "sync": if (press) deck.sync(dj.other(id)); return;
      case "phones": if (press) deck.setPhones(!deck.state.phones); return;
      case "load": if (press) this.loader?.(id, Math.max(0, this.cursor)); return;
      case "loopoff": if (press && deck.state.loop) deck.exitLoop(); return;
      case "loop": if (press && arg) deck.loop(Number(arg)); return;
      case "gain": deck.setGain(v * 2); return;
      case "eqHigh": deck.setEq("high", v); return;
      case "eqMid": deck.setEq("mid", v); return;
      case "eqLow": deck.setEq("low", v); return;
      case "filter": deck.setFilter(v); return;
      case "fader": deck.setFader(v); return;
      case "pitch": this.msb[id] = raw; deck.setPitch(tempoPitch(raw, null, deck.state.range, this.reverseTempo)); return;
      case "pitchFine": deck.setPitch(tempoPitch(this.msb[id], raw, deck.state.range, this.reverseTempo)); return;
      case "touch":
        if (ev.type === "press" || (ev.type === "value" && raw > 0)) deck.grab({ sound: true });
        else deck.release();
        return;
      case "jog": {
        if (ev.type !== "value") return;
        const d = relativeDelta(raw, jogStyle);
        // one turn of a DJ jog wheel ≈ 1.8 s of music, like a record at 33 RPM
        if (deck.isHeld) deck.dragTo(deck.position() + d * 0.0025);
        else this.bend(id, d);
        return;
      }
      case "nudge": if (ev.type === "value") this.bend(id, relativeDelta(raw, jogStyle)); return;
      case "search": if (ev.type === "value") deck.seek(deck.position() + relativeDelta(raw, jogStyle) * 0.2); return;
    }
    const cue = /^(hot|clear)cue(\d)$/.exec(verb);
    if (cue && press) {
      const i = Number(cue[2]) - 1;
      if (cue[1] === "hot") deck.hotCue(i); else deck.clearHotCue(i);
    }
  }

  /** Turning the jog wheel edge speeds up / slows down the record for a moment (like pushing a platter). */
  private bend(id: DeckId, d: number) {
    const deck = peekDj()?.deck(id);
    if (!deck) return;
    if (!deck.state.playing) { deck.seek(deck.position() + d * 0.0025 * 4); return; }
    deck.setNudge(Math.max(-0.1, Math.min(0.1, d * 0.008)));
    const t = this.nudgeTimer[id];
    if (t) clearTimeout(t);
    this.nudgeTimer[id] = setTimeout(() => { this.nudgeTimer[id] = null; peekDj()?.deck(id).setNudge(0); }, 120);
  }

  /** Light the controller's buttons (play, cue, headphone cue, hot cues, loops) to match the decks. */
  private sent = new Map<string, number>();
  async syncLights() {
    const dj = peekDj();
    if (!dj || ![...this.ports.values()].some(Boolean)) return;
    const a = await getMidiAccess();
    const outs = (a as unknown as { outputs?: Map<string, { name?: string | null; send(data: number[]): void }> } | null)?.outputs;
    if (!outs) return;
    for (const out of outs.values()) {
      const profile = djProfileFor(out.name);
      if (!profile) continue;
      for (const [action, key] of Object.entries(profile.leds)) {
        const [, chs, nums] = key.split(":");
        const [deckId, verb = "", arg] = action.split(":");
        const s = dj.deck(deckId as DeckId).state;
        const cue = /^hotcue(\d)$/.exec(verb);
        const lit = verb === "play" ? s.playing : verb === "cue" ? !!s.name && !s.playing : verb === "phones" ? s.phones
          : cue ? s.hotCues[Number(cue[1]) - 1] != null : verb === "loop" ? s.loop?.beats === Number(arg) : false;
        const val = lit ? 127 : 0;
        const id = `${out.name}|${key}`;
        if (this.sent.get(id) === val) continue;
        this.sent.set(id, val);
        try { out.send([0x90 | Number(chs), Number(nums), val]); } catch { /* port went away */ }
      }
    }
  }
}

let ctl: DjMidiController | null = null;
export function getDjMidi() {
  if (!ctl) {
    ctl = new DjMidiController();
    const c = ctl;
    claimControllerMidi((m) => c.handle(m));
  }
  return ctl;
}

// Listen from app start, so a DJ controller's pads never play instrument notes before DJ Decks opens.
if (typeof window !== "undefined") getDjMidi();
