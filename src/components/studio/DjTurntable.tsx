import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
import { getEngine } from "@/lib/synclab/audio-engine";
import { getDj, type DeckId } from "@/lib/synclab/dj-engine";
import { angleDelta, DEG_PER_SEC, scrubTo } from "@/lib/synclab/dj";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { useFrame } from "./dj-frame";

/**
 * A silver direct-drive turntable per deck (classic club-turntable layout): strobe-dotted platter,
 * record with a picture label, tone arm with counterweight, START·STOP and 33/45 speed buttons.
 * The record angle and the tone arm's travel come from the deck's real play position, so it turns
 * only while the deck plays and stops dead on pause. Every button here works.
 * Grab the record and turn it: backwards winds the track back (fast spins travel further, so a
 * couple of spins reach the beginning), forwards moves ahead. The sound holds while your hand is on
 * the record and plays on from the new spot when you let go, if the deck was playing.
 */
export function Turntable({ id, compact = false }: { id: DeckId; compact?: boolean }) {
  const deck = getDj().deck(id);
  const s = deck.state;
  const platter = useRef<HTMLDivElement>(null);
  const arm = useRef<HTMLDivElement>(null);
  const pic = useRef<HTMLInputElement>(null);
  useFrame(s.playing, () => {
    const pos = deck.position();
    if (platter.current) platter.current.style.transform = `rotate(${((pos * DEG_PER_SEC) % 360).toFixed(1)}deg)`;
    const dur = deck.buffer?.duration ?? 0;
    arm.current?.style.setProperty("--arm-p", dur > 0 ? (pos / dur).toFixed(4) : "0");
  });
  const unlock = () => { void getEngine().init().resume?.(); };
  // turning the record by hand: starts after a few pixels so a plain tap still picks the label picture
  const spin = useRef<{ id: number; x: number; y: number; angle: number; t: number; on: boolean; moved: boolean } | null>(null);
  const angleAt = (e: React.PointerEvent) => {
    const r = canvasRect(platter.current!);
    const p = canvasPoint(e.clientX, e.clientY);
    return (Math.atan2(p.y - (r.top + r.height / 2), p.x - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const onDown = (e: React.PointerEvent) => {
    if (!deck.buffer || !platter.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    const p = canvasPoint(e.clientX, e.clientY);
    spin.current = { id: e.pointerId, x: p.x, y: p.y, angle: angleAt(e), t: e.timeStamp, on: false, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const g = spin.current;
    if (!g || g.id !== e.pointerId || !deck.buffer) return;
    if (!g.on) {
      const p = canvasPoint(e.clientX, e.clientY);
      if (Math.hypot(p.x - g.x, p.y - g.y) < 6) return;
      g.on = true; g.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      unlock();
      deck.grab();
    }
    const a = angleAt(e);
    const d = angleDelta(g.angle, a);
    const dt = Math.max(0.001, (e.timeStamp - g.t) / 1000);
    g.angle = a; g.t = e.timeStamp;
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
    if (spin.current?.moved) { e.preventDefault(); e.stopPropagation(); }
    spin.current = null;
  };
  const choose = (f: File | undefined) => { if (f && f.type.startsWith("image/")) deck.setArt(f); };
  const labelTitle = s.art ? (s.artFrom === "file" ? "Cover picture from the file — tap to choose your own" : "Your picture — tap to change it") : "Tap to put a picture on this record";
  return (
    <div className="dj-turntable" data-deck={id} data-playing={s.playing ? "1" : "0"} data-loaded={s.name ? "1" : "0"}>
      <div className="dj-plinth">
        <div ref={platter} className="dj-platter" data-grab={s.name ? "1" : "0"} title={s.name ? "Turn the record by hand — back to wind back to the start, forward to move ahead" : undefined}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClickCapture={swallowClick}>
          <span className="dj-strobe" aria-hidden />
          <span className="dj-strobe is-inner" aria-hidden />
          <div className="dj-vinyl" aria-hidden={!s.name}>
            <button type="button" className="dj-record-label" onClick={() => pic.current?.click()} title={labelTitle} aria-label={`Deck ${id} record picture — ${labelTitle}`}>
              {s.art ? <img src={s.art} alt="" draggable={false} /> : (
                <span className="dj-record-blank">
                  <img src={synclabLogoAsset.url} alt="" draggable={false} />
                  <b>{id}</b>
                </span>
              )}
            </button>
          </div>
          <span className="dj-spindle" aria-hidden />
        </div>
        <span className="dj-sheen" aria-hidden />
        <span className="dj-strobe-light" aria-hidden title={s.playing ? "Spinning" : "Stopped"} />
        <div className="dj-arm-base" aria-hidden>
          <span className="dj-counterweight" />
          <div ref={arm} className="dj-tonearm"><span className="dj-tonearm-head" /></div>
        </div>
        <span className="dj-armrest" aria-hidden />
        {!compact && (
          <>
            <button type="button" className="dj-startstop" disabled={!s.name || s.loading} aria-pressed={s.playing} onClick={() => { unlock(); deck.toggle(); }}
              aria-label={`Deck ${id} start / stop`} title="Start / stop the record">
              <span>START</span><span>STOP</span>
            </button>
            <div className="dj-rpm" role="group" aria-label={`Deck ${id} speed`}>
              {([33, 45] as const).map((r) => (
                <button key={r} type="button" className="dj-rpm-btn" aria-pressed={s.rpm === r} onClick={() => deck.setRpm(r)}
                  title={r === 45 ? "45 RPM — plays 1.35× faster (tempo and key)" : "33⅓ RPM — normal speed"}>{r}</button>
              ))}
            </div>
            <span className="dj-badge" aria-hidden><b>SYNCLAB</b><small>DIRECT DRIVE TURNTABLE</small></span>
          </>
        )}
        <button type="button" className="dj-pic-btn" onClick={() => pic.current?.click()} aria-label={`Choose a picture for the deck ${id} record`} title="Choose a record picture"><ImagePlus className="size-3.5" /></button>
      </div>
      <input ref={pic} type="file" accept="image/*" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
