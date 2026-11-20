import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
import { getEngine } from "@/lib/synclab/audio-engine";
import { getDj, type DeckId } from "@/lib/synclab/dj-engine";
import { angleDelta, armFraction, DEG_PER_SEC, scrubTo } from "@/lib/synclab/dj";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { useFrame } from "./dj-frame";
import "./dj-replay.css";

/**
 * A silver direct-drive turntable per deck (classic club-turntable layout): strobe-dotted platter,
 * record with a picture label, tone arm with counterweight, START·STOP and 33/45 speed buttons.
 * The record angle and the tone arm's travel come from the deck's real play position, so it turns
 * only while the deck plays and stops dead on pause. Every button here works.
 * Grab the record and turn it: you hear it move forwards or backwards at your hand's speed
 * (ScratchVoice; fast spins travel further, so a couple of spins reach the beginning). Holding it
 * still is silent; letting go plays on from the new spot if the deck was playing.
 * Pick up the tone arm and set it down anywhere on the record to play from that spot (outer edge =
 * start, near the label = end); the music is silent while the arm is lifted.
 */
export function Turntable({ id, compact = false }: { id: DeckId; compact?: boolean }) {
  const dj = getDj();
  const deck = dj.deck(id);
  // during "Replay moves" this is the recorded performance, otherwise the live deck
  const s = deck.shown;
  const replay = dj.replaying;
  // the record already on the deck when the panel opens isn't dropped again; every later load is
  const mountSeq = useRef(s.loadSeq);
  const platter = useRef<HTMLDivElement>(null);
  const arm = useRef<HTMLDivElement>(null);
  const pic = useRef<HTMLInputElement>(null);
  useFrame(s.playing || replay, () => {
    const pos = deck.shownPosition();
    if (platter.current)
      platter.current.style.transform = `rotate(${((pos * DEG_PER_SEC) % 360).toFixed(1)}deg)`;
    const dur = deck.shownDuration;
    arm.current?.style.setProperty("--arm-p", dur > 0 ? (pos / dur).toFixed(4) : "0");
  });
  const unlock = () => {
    void getEngine().init().resume?.();
  };
  // turning the record by hand: starts after a few pixels so a plain tap still picks the label picture
  const spin = useRef<{
    id: number;
    x: number;
    y: number;
    angle: number;
    t: number;
    on: boolean;
    moved: boolean;
  } | null>(null);
  const angleAt = (e: React.PointerEvent) => {
    const r = canvasRect(platter.current!);
    const p = canvasPoint(e.clientX, e.clientY);
    return (Math.atan2(p.y - (r.top + r.height / 2), p.x - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const onDown = (e: React.PointerEvent) => {
    if (replay || !deck.buffer || !platter.current || (e.pointerType === "mouse" && e.button !== 0))
      return;
    const p = canvasPoint(e.clientX, e.clientY);
    spin.current = {
      id: e.pointerId,
      x: p.x,
      y: p.y,
      angle: angleAt(e),
      t: e.timeStamp,
      on: false,
      moved: false,
    };
  };
  const onMove = (e: React.PointerEvent) => {
    const g = spin.current;
    if (!g || g.id !== e.pointerId || !deck.buffer) return;
    if (!g.on) {
      const p = canvasPoint(e.clientX, e.clientY);
      if (Math.hypot(p.x - g.x, p.y - g.y) < 6) return;
      g.on = true;
      g.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      unlock();
      deck.grab({ sound: true });
    }
    const a = angleAt(e);
    const d = angleDelta(g.angle, a);
    const dt = Math.max(0.001, (e.timeStamp - g.t) / 1000);
    g.angle = a;
    g.t = e.timeStamp;
    deck.dragTo(scrubTo(deck.position(), d / DEG_PER_SEC, dt, deck.buffer.duration));
  };
  const onUp = (e: React.PointerEvent) => {
    const g = spin.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.on) deck.release();
    // keep `moved` until the click that follows this release has been swallowed
    spin.current = g.moved ? { ...g, on: false, id: -1 } : null;
  };
  const swallowClick = (e: React.MouseEvent) => {
    if (spin.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
    spin.current = null;
  };
  // the tone arm: pick it up and set the needle down anywhere on the record (outer edge = start,
  // near the label = end). Like lifting a real needle, the music is silent while the arm is up.
  const armBase = useRef<HTMLDivElement>(null);
  const armDrag = useRef<number | null>(null);
  const armAt = (e: React.PointerEvent) => {
    const base = armBase.current,
      plinth = base?.parentElement;
    if (!base || !plinth || !deck.buffer) return null;
    const r = canvasRect(base);
    const p = canvasPoint(e.clientX, e.clientY);
    const cs = getComputedStyle(plinth);
    const start = parseFloat(cs.getPropertyValue("--arm-start")) || 0;
    const sweep = parseFloat(cs.getPropertyValue("--arm-sweep")) || 1;
    const deg =
      (Math.atan2(p.y - (r.top + r.height / 2), p.x - (r.left + r.width / 2)) * 180) / Math.PI;
    return armFraction(deg, start, sweep);
  };
  const placeArm = (e: React.PointerEvent) => {
    const f = armAt(e);
    if (f == null || !deck.buffer) return;
    arm.current?.style.setProperty("--arm-p", f.toFixed(4));
    deck.dragTo(f * deck.buffer.duration);
  };
  const onArmDown = (e: React.PointerEvent) => {
    if (replay || !deck.buffer || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    unlock();
    armDrag.current = e.pointerId;
    deck.grab();
    arm.current?.closest(".dj-turntable")?.setAttribute("data-arm-held", "1");
  };
  const onArmMove = (e: React.PointerEvent) => {
    if (armDrag.current === e.pointerId) placeArm(e);
  };
  const onArmUp = (e: React.PointerEvent) => {
    if (armDrag.current !== e.pointerId) return;
    armDrag.current = null;
    arm.current?.closest(".dj-turntable")?.removeAttribute("data-arm-held");
    deck.release();
  };
  const choose = (f: File | undefined) => {
    if (f && f.type.startsWith("image/")) deck.setArt(f);
  };
  const labelTitle = s.art
    ? s.artFrom === "file"
      ? "Cover picture from the file — tap to choose your own"
      : "Your picture — tap to change it"
    : "Tap to put a picture on this record";
  return (
    <div
      className="dj-turntable"
      data-replay={replay ? "1" : undefined}
      data-deck={id}
      data-playing={s.playing ? "1" : "0"}
      data-loaded={s.name ? "1" : "0"}
    >
      <div className="dj-plinth">
        <div
          ref={platter}
          className="dj-platter"
          data-grab={s.name ? "1" : "0"}
          title={
            s.name
              ? "Turn the record by hand — back to wind back to the start, forward to move ahead"
              : undefined
          }
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onClickCapture={swallowClick}
        >
          <span className="dj-strobe" aria-hidden />
          <span className="dj-strobe is-inner" aria-hidden />
          {/* keyed by the load: every new record is placed onto the platter (also when a replay changes records) */}
          <div
            key={s.loadSeq}
            className="dj-vinyl"
            data-drop={s.loadSeq && s.loadSeq !== mountSeq.current ? "1" : undefined}
            aria-hidden={!s.name}
          >
            <button
              type="button"
              className="dj-record-label"
              onClick={() => pic.current?.click()}
              title={labelTitle}
              aria-label={`Deck ${id} record picture — ${labelTitle}`}
            >
              {s.art ? (
                <img src={s.art} alt="" draggable={false} />
              ) : (
                <span className="dj-record-blank">
                  <img src={synclabLogoAsset.url} alt="" draggable={false} />
                  {s.name && <small className="dj-record-title">{s.name}</small>}
                  <b>{id}</b>
                </span>
              )}
            </button>
          </div>
          <span className="dj-spindle" aria-hidden />
        </div>
        <span className="dj-sheen" aria-hidden />
        <span className="dj-strobe-light" aria-hidden title={s.playing ? "Spinning" : "Stopped"} />
        <div ref={armBase} className="dj-arm-base">
          <span className="dj-counterweight" aria-hidden />
          <div ref={arm} className="dj-tonearm">
            <span className="dj-tonearm-head" aria-hidden />
            <span
              className="dj-arm-grab"
              role="slider"
              tabIndex={s.name ? 0 : -1}
              aria-label={`Deck ${id} tone arm — drag onto the record to play from that spot`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(
                deck.buffer && s.duration ? (deck.position() / s.duration) * 100 : 0,
              )}
              aria-disabled={!s.name}
              data-grab={s.name ? "1" : "0"}
              title={
                s.name
                  ? "Pick up the tone arm and set it down anywhere on the record — the outer edge is the start, near the label is the end"
                  : undefined
              }
              onPointerDown={onArmDown}
              onPointerMove={onArmMove}
              onPointerUp={onArmUp}
              onPointerCancel={onArmUp}
              onKeyDown={(e) => {
                if (!deck.buffer || !s.duration) return;
                const step =
                  e.key === "ArrowRight" || e.key === "ArrowDown"
                    ? 5
                    : e.key === "ArrowLeft" || e.key === "ArrowUp"
                      ? -5
                      : 0;
                if (!step) return;
                e.preventDefault();
                deck.seek(deck.position() + step);
              }}
            />
          </div>
        </div>
        <span className="dj-armrest" aria-hidden />
        {!compact && (
          <>
            <button
              type="button"
              className="dj-startstop"
              disabled={!s.name || s.loading}
              aria-pressed={s.playing}
              onClick={() => {
                unlock();
                deck.toggle();
              }}
              aria-label={`Deck ${id} start / stop`}
              title="Start / stop the record"
            >
              <span>START</span>
              <span>STOP</span>
            </button>
            <div className="dj-rpm" role="group" aria-label={`Deck ${id} speed`}>
              {([33, 45] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className="dj-rpm-btn"
                  aria-pressed={s.rpm === r}
                  onClick={() => deck.setRpm(r)}
                  title={
                    r === 45
                      ? "45 RPM — plays 1.35× faster (tempo and key)"
                      : "33⅓ RPM — normal speed"
                  }
                >
                  {r}
                </button>
              ))}
            </div>
            <span className="dj-badge" aria-hidden>
              <b>SYNCLAB</b>
              <small>DIRECT DRIVE TURNTABLE</small>
            </span>
          </>
        )}
        <button
          type="button"
          className="dj-pic-btn"
          onClick={() => pic.current?.click()}
          aria-label={`Choose a picture for the deck ${id} record`}
          title="Choose a record picture"
        >
          <ImagePlus className="size-3.5" />
        </button>
      </div>
      <input
        ref={pic}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
