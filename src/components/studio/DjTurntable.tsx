import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
import { getEngine } from "@/lib/synclab/audio-engine";
import { getDj, type DeckId } from "@/lib/synclab/dj-engine";
import { useFrame } from "./dj-frame";

/** 33⅓ RPM: the record turns 200° for every second of the track (pitch and 45 speed both up alike). */
const DEG_PER_SEC = (100 / 3 / 60) * 360;

/**
 * A silver direct-drive turntable per deck (classic club-turntable layout): strobe-dotted platter,
 * record with a picture label, tone arm with counterweight, START·STOP and 33/45 speed buttons.
 * The record angle and the tone arm's travel come from the deck's real play position, so it turns
 * only while the deck plays and stops dead on pause. Every button here works.
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
  const choose = (f: File | undefined) => { if (f && f.type.startsWith("image/")) deck.setArt(f); };
  const labelTitle = s.art ? (s.artFrom === "file" ? "Cover picture from the file — tap to choose your own" : "Your picture — tap to change it") : "Tap to put a picture on this record";
  return (
    <div className="dj-turntable" data-deck={id} data-playing={s.playing ? "1" : "0"} data-loaded={s.name ? "1" : "0"}>
      <div className="dj-plinth">
        <div ref={platter} className="dj-platter">
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
