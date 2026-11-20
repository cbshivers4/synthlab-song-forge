import { useEffect, useRef, useState } from "react";
import { Mic, Square, Headphones, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { openMic, releaseMic, getInputGainDb } from "@/lib/synclab/mic";
import { encodeMp3, downloadBlob } from "@/lib/synclab/bounce";

/**
 * Quick idea recorder: opens the audio input on its own, shows live L/R input meters,
 * optional headphone monitoring, and records straight to an MP3 — no song/timeline needed.
 */
const toDb = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);

function Meter({ level, peak, label }: { level: number; peak: number; label: string }) {
  const db = toDb(level);
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  const pdb = toDb(peak);
  const color =
    db >= -1
      ? "bg-destructive"
      : db >= -6
        ? "bg-orange-500"
        : db >= -12
          ? "bg-yellow-400"
          : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 font-mono text-muted-foreground">{label}</span>
      <div className="relative h-3 flex-1 overflow-hidden rounded bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`w-14 text-right font-mono ${pdb >= -1 ? "text-destructive" : "text-muted-foreground"}`}
      >
        {Number.isFinite(pdb) ? `${pdb.toFixed(1)} dB` : "-∞ dB"}
      </span>
    </div>
  );
}

export function IdeaRecorder({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState({ l: 0, r: 0, pl: 0, pr: 0 });
  const [monitor, setMonitor] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [last, setLast] = useState<{ blob: Blob; name: string } | null>(null);
  const [kbps, setKbps] = useState(192);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const monRef = useRef<GainNode | null>(null);
  const recRef = useRef<{ l: Float32Array[]; r: Float32Array[]; on: boolean }>({
    l: [],
    r: [],
    on: false,
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      setError(null);
      const res = await openMic(
        { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        "idea-recorder",
      );
      if (cancelled) {
        if ("stream" in res) releaseMic(res.stream);
        return;
      }
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      streamRef.current = res.stream;
      const src = ctx.createMediaStreamSource(res.stream);
      const gain = ctx.createGain();
      gain.gain.value = Math.pow(10, getInputGainDb() / 20);
      // Mono interfaces (e.g. Volt 1) are spread to both sides.
      const stereo = ctx.createGain();
      stereo.channelCountMode = "explicit";
      stereo.channelCount = 2;
      src.connect(gain).connect(stereo);
      const split = ctx.createChannelSplitter(2);
      stereo.connect(split);
      const aL = ctx.createAnalyser();
      const aR = ctx.createAnalyser();
      aL.fftSize = aR.fftSize = 1024;
      split.connect(aL, 0);
      split.connect(aR, 1);
      const mon = ctx.createGain();
      mon.gain.value = 0;
      stereo.connect(mon).connect(ctx.destination);
      monRef.current = mon;
      const proc = ctx.createScriptProcessor(4096, 2, 2);
      stereo.connect(proc);
      const sink = ctx.createGain();
      sink.gain.value = 0;
      proc.connect(sink).connect(ctx.destination);
      proc.onaudioprocess = (e) => {
        if (!recRef.current.on) return;
        recRef.current.l.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        recRef.current.r.push(new Float32Array(e.inputBuffer.getChannelData(1)));
      };
      const buf = new Float32Array(1024);
      let pl = 0,
        pr = 0,
        holdL = 0,
        holdR = 0;
      const peakOf = (a: AnalyserNode) => {
        a.getFloatTimeDomainData(buf);
        let p = 0;
        for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i] ?? 0));
        return p;
      };
      timer = setInterval(() => {
        const l = peakOf(aL),
          r = peakOf(aR);
        if (l >= pl) {
          pl = l;
          holdL = 30;
        } else if (--holdL <= 0) pl *= 0.95;
        if (r >= pr) {
          pr = r;
          holdR = 30;
        } else if (--holdR <= 0) pr *= 0.95;
        setLevels({ l, r, pl, pr });
        if (recRef.current.on) setSeconds((recRef.current.l.length * 4096) / ctx.sampleRate);
      }, 50);
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      recRef.current.on = false;
      setRecording(false);
      setMonitor(false);
      releaseMic(streamRef.current);
      streamRef.current = null;
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (monRef.current && ctxRef.current)
      monRef.current.gain.setTargetAtTime(monitor ? 1 : 0, ctxRef.current.currentTime, 0.02);
  }, [monitor]);

  const start = () => {
    recRef.current = { l: [], r: [], on: true };
    setSeconds(0);
    setLast(null);
    setRecording(true);
  };
  const stop = () => {
    const ctx = ctxRef.current;
    recRef.current.on = false;
    setRecording(false);
    if (!ctx) return;
    const join = (parts: Float32Array[]) => {
      const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0;
      for (const p of parts) {
        out.set(p, o);
        o += p.length;
      }
      return out;
    };
    const blob = encodeMp3(
      { left: join(recRef.current.l), right: join(recRef.current.r), sampleRate: ctx.sampleRate },
      kbps,
    );
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    const item = { blob, name: `SYNCLAB-idea-${stamp}.mp3` };
    setLast(item);
    downloadBlob(item.blob, item.name);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o && recording) stop();
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={compact ? "size-11" : "h-8 gap-1"}
          title="Input meters and quick MP3 idea recorder"
          aria-label="Input meters and idea recorder"
        >
          <Mic className={`size-4 ${recording ? "text-destructive" : ""}`} />
          {!compact && <span className="text-xs">IDEA</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] space-y-3">
        <div>
          <div className="text-sm font-semibold">Input monitor & idea recorder</div>
          <p className="text-xs text-muted-foreground">
            Shows the sound coming in and records it straight to MP3 — no song or track needed.
          </p>
        </div>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Meter label="L" level={levels.l} peak={levels.pl} />
              <Meter label="R" level={levels.r} peak={levels.pr} />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={monitor ? "default" : "outline"}
                onClick={() => setMonitor((m) => !m)}
                className="gap-1"
              >
                <Headphones className="size-4" /> {monitor ? "Monitoring" : "Monitor off"}
              </Button>
              <select
                value={kbps}
                onChange={(e) => setKbps(Number(e.target.value))}
                disabled={recording}
                className="h-8 rounded border border-input bg-background px-2 text-xs"
                aria-label="MP3 quality"
              >
                {[128, 192, 256, 320].map((k) => (
                  <option key={k} value={k}>
                    {k} kbps
                  </option>
                ))}
              </select>
            </div>
            {monitor && (
              <p className="text-[11px] text-muted-foreground">
                Use headphones while monitoring to avoid feedback.
              </p>
            )}
            <div className="flex items-center gap-2">
              {recording ? (
                <Button size="sm" variant="destructive" onClick={stop} className="gap-1">
                  <Square className="size-4" /> Stop & save MP3
                </Button>
              ) : (
                <Button size="sm" onClick={start} className="gap-1">
                  <span className="size-3 rounded-full bg-destructive" /> Record idea
                </Button>
              )}
              <span className="font-mono text-sm">{fmt(seconds)}</span>
            </div>
            {last && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => downloadBlob(last.blob, last.name)}
              >
                <Download className="size-4" /> Download again ({last.name})
              </Button>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
