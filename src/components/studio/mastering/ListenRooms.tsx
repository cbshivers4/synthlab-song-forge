import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bluetooth,
  Car,
  CassetteTape,
  Clapperboard,
  Headphones,
  House,
  Laptop,
  Play,
  Radio,
  Repeat,
  Smartphone,
  Speaker,
  Square,
  Tv,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getEngine } from "@/lib/synclab/audio-engine";
import type { Capture } from "@/lib/synclab/bounce";
import { LISTEN_ROOMS, buildRoomChain, roomById, type ListenRoom, type RoomChain } from "@/lib/synclab/listen-rooms";

const ICONS: Record<string, LucideIcon> = {
  studio: Speaker,
  car: Car,
  club: Volume2,
  walkman: CassetteTape,
  home: House,
  theater: Clapperboard,
  phone: Smartphone,
  earbuds: Headphones,
  laptop: Laptop,
  tv: Tv,
  radio: Radio,
  bluetooth: Bluetooth,
};

type Source = "master" | "original";
type Route = { chain: RoomChain; fade: GainNode };

const bufferCache = new WeakMap<Capture, AudioBuffer>();
function toBuffer(ctx: BaseAudioContext, cap: Capture) {
  const hit = bufferCache.get(cap);
  if (hit && hit.sampleRate === cap.sampleRate) return hit;
  const buf = ctx.createBuffer(2, cap.left.length, cap.sampleRate);
  buf.getChannelData(0).set(cap.left);
  buf.getChannelData(1).set(cap.right.length === cap.left.length ? cap.right : cap.left);
  bufferCache.set(cap, buf);
  return buf;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Frequency response of the room's speaker + EQ, straight from the same biquad settings the player uses. */
function RoomCurve({ room }: { room: ListenRoom }) {
  const [path, setPath] = useState("");
  useEffect(() => {
    const Ctor = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor(1, 1, 48000);
    const N = 120;
    const freqs = new Float32Array(N);
    for (let i = 0; i < N; i++) freqs[i] = 20 * Math.pow(1000, i / (N - 1));
    const total = new Float32Array(N).fill(0);
    const add = (f: BiquadFilterNode) => {
      const mag = new Float32Array(N);
      const ph = new Float32Array(N);
      f.getFrequencyResponse(freqs, mag, ph);
      for (let i = 0; i < N; i++) total[i] = (total[i] ?? 0) + 20 * Math.log10(Math.max(mag[i] ?? 1, 1e-6));
    };
    const mk = (type: BiquadFilterType, freq: number, gain = 0, q = Math.SQRT1_2) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.gain.value = gain;
      f.Q.value = q;
      return f;
    };
    if (room.highpass) for (let k = 0; k < 2; k++) add(mk("highpass", room.highpass));
    if (room.lowpass) for (let k = 0; k < 2; k++) add(mk("lowpass", room.lowpass));
    for (const b of room.eq) add(mk(b.type, b.freq, b.gain, b.q ?? 1));
    const pts: string[] = [];
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * 300;
      const v = Math.max(-24, Math.min(12, (total[i] ?? 0) + room.level));
      const y = 50 - (v / 24) * 40;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    setPath(pts.join(" "));
  }, [room]);
  return (
    <svg viewBox="0 0 300 80" className="h-16 w-full rounded-sm border border-border bg-background" aria-label={`${room.name} frequency response`}>
      {[100, 1000, 10000].map((f) => {
        const x = (Math.log10(f / 20) / 3) * 300;
        return <line key={f} x1={x} x2={x} y1={0} y2={80} className="stroke-border" strokeWidth={0.5} />;
      })}
      <line x1={0} x2={300} y1={50} y2={50} className="stroke-muted-foreground" strokeWidth={0.5} strokeDasharray="2 3" />
      <path d={path} className="fill-none stroke-primary" strokeWidth={1.5} />
      <text x={2} y={78} className="fill-muted-foreground text-[7px]">20 Hz</text>
      <text x={268} y={78} className="fill-muted-foreground text-[7px]">20 kHz</text>
    </svg>
  );
}

/**
 * Sound section: plays the original or mastered bounce through a modelled playback
 * system (car, club, Walkman…). Output goes straight to the speakers, never through
 * the SYNCLAB master, so nothing is recaptured or changed.
 */
export function ListenRooms({ original, mastered }: { original: Capture | null; mastered: Capture | null }) {
  const [roomId, setRoomId] = useState("car");
  const [source, setSource] = useState<Source>("master");
  const [noise, setNoise] = useState(true);
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const room = useMemo(() => roomById(roomId), [roomId]);

  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const routeRef = useRef<Route | null>(null);
  const startedAt = useRef(0);
  /** where Stop left off, so Play carries on from there */
  const pausedAt = useRef(0);
  const duration = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const tick = useRef<number | null>(null);
  const loopRef = useRef(loop);
  loopRef.current = loop;

  const cap = source === "master" ? (mastered ?? null) : original;
  const available = !!cap;

  const position = () => {
    const ctx = getEngine().ctx;
    if (!srcRef.current) return pausedAt.current;
    if (!ctx || duration.current <= 0) return 0;
    const t = ctx.currentTime - startedAt.current;
    return loopRef.current ? ((t % duration.current) + duration.current) % duration.current : Math.min(duration.current, Math.max(0, t));
  };

  const paint = () => {
    const p = position();
    const d = duration.current || 1;
    if (barRef.current) barRef.current.style.width = `${(p / d) * 100}%`;
    if (timeRef.current) timeRef.current.textContent = `${clock(p)} / ${clock(duration.current)}`;
  };

  const makeRoute = (ctx: AudioContext, r: ListenRoom, withNoise: boolean, startGain: number): Route => {
    const chain = buildRoomChain(ctx, r, withNoise);
    const fade = ctx.createGain();
    fade.gain.value = startGain;
    chain.output.connect(fade).connect(ctx.destination);
    return { chain, fade };
  };

  const retire = (route: Route | null, src: AudioBufferSourceNode | null) => {
    if (!route) return;
    const ctx = getEngine().ctx;
    if (ctx) {
      route.fade.gain.cancelScheduledValues(ctx.currentTime);
      route.fade.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    }
    window.setTimeout(() => {
      try {
        src?.disconnect(route.chain.input);
      } catch {
        /* source already gone */
      }
      route.chain.dispose();
      route.fade.disconnect();
    }, 150);
  };

  const stop = () => {
    if (tick.current) window.clearInterval(tick.current);
    tick.current = null;
    if (srcRef.current) pausedAt.current = position();
    const src = srcRef.current;
    srcRef.current = null;
    if (src) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* not started */
      }
    }
    retire(routeRef.current, src);
    routeRef.current = null;
    setPlaying(false);
    paint();
  };

  const play = (from: number, capture = cap, r = room, withNoise = noise) => {
    if (!capture) return;
    const ctx = getEngine().init();
    void ctx.resume();
    stop();
    const buf = toBuffer(ctx, capture);
    duration.current = buf.duration;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loopRef.current;
    const route = makeRoute(ctx, r, withNoise, 1);
    src.connect(route.chain.input);
    const at = ctx.currentTime + 0.03;
    const offset = Math.max(0, Math.min(buf.duration - 0.05, from));
    src.start(at, offset);
    route.chain.start(at);
    startedAt.current = at - offset;
    src.onended = () => {
      if (srcRef.current !== src) return;
      stop();
      pausedAt.current = 0;
      paint();
    };
    srcRef.current = src;
    routeRef.current = route;
    setPlaying(true);
    tick.current = window.setInterval(paint, 50);
  };

  /** Switch room while playing: crossfade to a fresh chain, the music never stops. */
  const swapRoom = (r: ListenRoom, withNoise: boolean) => {
    const ctx = getEngine().ctx;
    const src = srcRef.current;
    if (!ctx || !src) return;
    const next = makeRoute(ctx, r, withNoise, 0);
    src.connect(next.chain.input);
    next.chain.start(ctx.currentTime);
    next.fade.gain.setTargetAtTime(1, ctx.currentTime, 0.02);
    retire(routeRef.current, src);
    routeRef.current = next;
  };

  const pickRoom = (id: string) => {
    setRoomId(id);
    if (srcRef.current) swapRoom(roomById(id), noise);
  };

  useEffect(() => {
    if (srcRef.current) srcRef.current.loop = loop;
  }, [loop]);

  // a re-rendered master (knob tweak) keeps playing from the same spot so you can hear the change in the room;
  // a brand-new bounce starts again from the top
  const lastOriginal = useRef(original);
  useEffect(() => {
    const sameSong = lastOriginal.current === original;
    lastOriginal.current = original;
    const wasPlaying = !!srcRef.current;
    const pos = sameSong ? position() : 0;
    if (wasPlaying) stop();
    pausedAt.current = pos;
    duration.current = cap ? cap.left.length / cap.sampleRate : 0;
    if (wasPlaying && sameSong && cap) play(pos, cap);
    else paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, mastered]);

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    play(frac * (cap.left.length / cap.sampleRate));
  };

  return (
    <section className="space-y-2 rounded-md border border-border bg-surface-2/50 p-3" aria-label="Sound check">
      <div className="flex flex-wrap items-center gap-2">
        <Headphones className="size-4 text-primary" />
        <span className="font-display text-[11px] font-semibold tracking-[0.2em]">SOUND CHECK</span>
        <span className="label-xs">hear your mix on other systems</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
        {LISTEN_ROOMS.map((r) => {
          const Icon = ICONS[r.id] ?? Speaker;
          return (
            <button
              key={r.id}
              type="button"
              title={r.note}
              aria-pressed={roomId === r.id}
              onClick={() => pickRoom(r.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-sm border px-1.5 py-2 text-center transition-transform active:scale-95",
                roomId === r.id ? "border-primary bg-primary/15 text-foreground" : "border-border bg-surface-2 text-muted-foreground",
              )}
            >
              <Icon className={cn("size-5", roomId === r.id && "text-primary")} />
              <span className="font-mono text-[9px] uppercase leading-tight tracking-wider">{r.name}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_minmax(0,300px)]">
        <div className="space-y-2">
          <div className="text-[11px] text-foreground">
            <span className="font-semibold">{room.name}:</span> <span className="text-muted-foreground">{room.note}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-sm border border-border">
              {(["original", "master"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={source === m}
                  disabled={m === "master" ? !mastered : !original}
                  onClick={() => {
                    setSource(m);
                    const next = m === "master" ? mastered : original;
                    if (srcRef.current && next) play(position(), next);
                  }}
                  className={cn(
                    "px-2 py-1 font-mono text-[10px] uppercase disabled:opacity-40",
                    source === m ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant={playing ? "destructive" : "default"}
              className="h-8 gap-1.5"
              disabled={!available}
              onClick={() => (playing ? stop() : play(position()))}
            >
              {playing ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
              {playing ? "Stop" : `Play in ${room.name.toLowerCase()}`}
            </Button>
            <Button
              size="sm"
              variant={loop ? "default" : "outline"}
              className="h-8 gap-1"
              aria-pressed={loop}
              onClick={() => setLoop((v) => !v)}
            >
              <Repeat className="size-3.5" /> Loop
            </Button>
            <label className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
              Background noise
              <Switch
                checked={noise}
                disabled={!room.noise}
                onCheckedChange={(v) => {
                  setNoise(v);
                  if (srcRef.current) swapRoom(room, v);
                }}
              />
            </label>
          </div>
          <div
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={-1}
            onPointerDown={seek}
            className={cn("relative h-3 overflow-hidden rounded-sm border border-border bg-background", available ? "cursor-pointer" : "opacity-50")}
          >
            <div ref={barRef} className="absolute inset-y-0 left-0 w-0 bg-primary/60" />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span ref={timeRef} className="font-mono">0:00 / 0:00</span>
            {!available && <span>Bounce &amp; master first, then pick a place to hear it.</span>}
          </div>
        </div>
        <div>
          <div className="label-xs mb-1">Speaker &amp; room tone</div>
          <RoomCurve room={room} />
        </div>
      </div>

      <p className="text-[9px] leading-relaxed text-muted-foreground">
        These are modelled systems built from typical speaker ranges, EQ, imaging and room reverb — a quick way to catch problems, not a
        measurement of any real car or club. Background noise is added on purpose and is never part of your file.
      </p>
    </section>
  );
}
