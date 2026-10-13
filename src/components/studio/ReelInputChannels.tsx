import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/synclab/store";
import { getEngine } from "@/lib/synclab/audio-engine";

const KEY = "synclab.reelInputs.v1";
const COUNT = 16;

/** 16 tape input strips. Each takes a timeline track; its needle reads the real track level and MUTE/SOLO change what reaches the song master (and so the tape). */
export function ReelInputChannels() {
  const { tracks, updateTrack } = useStudio();
  const [assign, setAssign] = useState<(string | null)[]>(() => Array(COUNT).fill(null));
  const root = useRef<HTMLDivElement>(null);
  const ids = useRef<(string | null)[]>([]);

  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (Array.isArray(v)) setAssign(Array.from({ length: COUNT }, (_, i) => v[i] ?? null)); } catch { /* ignore */ }
  }, []);
  const resolved = assign.map((id, i) => (id && tracks.some((t) => t.id === id) ? id : id === "" ? null : tracks[i]?.id ?? null));
  ids.current = resolved;

  const choose = (i: number, id: string) => {
    const next = [...assign]; next[i] = id; setAssign(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      const engine = getEngine();
      root.current?.querySelectorAll<SVGGElement>("[data-reel-needle]").forEach((g, i) => {
        const id = ids.current[i];
        const level = id ? engine.getTrackLevel(id) : 0;
        const db = level > 0 ? 20 * Math.log10(level) : -60;
        const frac = Math.max(0, Math.min(1, (db + 40) / 43));
        g.setAttribute("transform", `rotate(${-50 + frac * 100} 50 52)`);
        g.dataset["zone"] = db >= -1 ? "red" : db >= -6 ? "orange" : "green";
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div ref={root} className="mt-4 border-t border-border pt-3" aria-label="Tape input channels">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="label-xs">16 INPUT CHANNELS</h3>
        <span className="text-[10px] text-muted-foreground">Each channel takes a timeline track. Mute and solo change what the song master sends to tape.</span>
      </div>
      <div className="reel-channels">
        {resolved.map((id, i) => {
          const t = tracks.find((x) => x.id === id);
          return (
            <div key={i} className="reel-channel" data-active={!!t}>
              <span className="font-mono text-[10px] font-bold">CH {i + 1}</span>
              <svg viewBox="0 0 100 60" className="reel-mini-vu" role="img" aria-label={`Channel ${i + 1} analog meter`}>
                <path d="M12 46 Q50 4 88 46" className="vu-arc" />
                <path d="M72 18 Q82 28 88 46" className="vu-hot" />
                <text x="50" y="42" className="vu-number">VU</text>
                <g data-reel-needle transform="rotate(-50 50 52)"><path d="M50 52V12" className="vu-needle reel-mini-needle" /></g>
                <circle cx="50" cy="52" r="4" className="reel-center" />
              </svg>
              <select
                aria-label={`Channel ${i + 1} input`}
                value={id ?? ""}
                onChange={(e) => choose(i, e.target.value)}
                className="h-7 w-full rounded border border-input bg-background px-1 text-[10px]"
              >
                <option value="">— none —</option>
                {tracks.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <div className="flex w-full gap-1">
                <button type="button" disabled={!t} aria-pressed={!!t?.muted} aria-label={`Mute channel ${i + 1}`} onClick={() => t && updateTrack(t.id, { muted: !t.muted })} className={`reel-ch-btn ${t?.muted ? "is-mute" : ""}`}>M</button>
                <button type="button" disabled={!t} aria-pressed={!!t?.solo} aria-label={`Solo channel ${i + 1}`} onClick={() => t && updateTrack(t.id, { solo: !t.solo })} className={`reel-ch-btn ${t?.solo ? "is-solo" : ""}`}>S</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
