import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { sidewaysCanvas } from "@/lib/synclab/canvas-point";
import { getEngine } from "@/lib/synclab/audio-engine";
import { decodeAudioFile } from "@/lib/synclab/aiff-decode";

/** Source-relative coordinates from the visible, scrolled (and possibly rotated) waveform. */
export function waveformFraction(el: HTMLElement, clientX: number, clientY: number) {
  const box = el.getBoundingClientRect();
  const width = sidewaysCanvas() ? box.height : box.width;
  const offset = sidewaysCanvas() ? clientY - box.top : clientX - box.left;
  return Math.max(0, Math.min(1, offset / Math.max(1, width)));
}

/** Decode only for inspection; never replace the source, playback settings or stored peaks. */
export function useWaveformDetail(url: string, fallback: number[]) {
  const [detail, setDetail] = useState<{ url: string; peaks: number[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;
        const buffer = await decodeAudioFile(getEngine().init(), await response.arrayBuffer());
        const count = Math.min(16384, buffer.length);
        const peaks = Array.from({ length: count }, () => 0);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const pcm = buffer.getChannelData(channel);
          for (let i = 0; i < count; i++) {
            let peak = peaks[i] ?? 0;
            for (let j = Math.floor(i * pcm.length / count); j < Math.floor((i + 1) * pcm.length / count); j++) {
              peak = Math.max(peak, Math.abs(pcm[j] ?? 0));
            }
            peaks[i] = peak;
          }
        }
        if (!cancelled) setDetail({ url, peaks });
      } catch { /* Stored peaks remain usable when the source is unavailable. */ }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [url]);
  return detail?.url === url ? detail.peaks : fallback;
}

export function WaveformZoom({ duration, label, children }: { duration: number; label: string; children: ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const start = position * (1 - 1 / zoom);
  const changeZoom = (next: number) => {
    const value = Math.max(1, Math.min(32, next));
    const center = start + 0.5 / zoom;
    const offset = value === 1 ? 0 : Math.max(0, Math.min(1, (center - 0.5 / value) / (1 - 1 / value)));
    setZoom(value);
    setPosition(offset);
  };
  useEffect(() => {
    const el = viewport.current;
    if (el) el.scrollLeft = position * Math.max(0, el.scrollWidth - el.clientWidth);
  }, [zoom, position]);
  return (
    <section className="min-w-0 space-y-1" aria-label={`${label} zoom editor`}>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="outline" size="icon" className="size-10" aria-label="Zoom out waveform" title="Zoom out waveform" disabled={zoom === 1} onClick={() => changeZoom(zoom / 2)}><ZoomOut className="size-4" /></Button>
        <span className="w-12 text-center font-mono text-xs text-primary" aria-label="Waveform zoom">{zoom}×</span>
        <Button variant="outline" size="icon" className="size-10" aria-label="Zoom in waveform" title="Zoom in waveform" disabled={zoom === 32} onClick={() => changeZoom(zoom * 2)}><ZoomIn className="size-4" /></Button>
        <Button variant="ghost" size="icon" className="size-10" aria-label="Fit whole waveform" title="Fit whole waveform" onClick={() => changeZoom(1)}><Maximize className="size-4" /></Button>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{(start * duration).toFixed(3)}s – {((start + 1 / zoom) * duration).toFixed(3)}s</span>
      </div>
      <div ref={viewport} className="min-w-0 overflow-x-auto overscroll-x-contain" aria-label={`${label} waveform viewport`} onScroll={(e) => {
        const el = e.currentTarget;
        const span = el.scrollWidth - el.clientWidth;
        if (span > 0) setPosition(el.scrollLeft / span);
      }}>
        <div style={{ width: `${zoom * 100}%` }}>{children}</div>
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground" aria-label={`${label} time ruler`}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => <span key={f}>{((start + f / zoom) * duration).toFixed(3)}s</span>)}
      </div>
      <Slider className="min-h-10" aria-label="Waveform scroll position" min={0} max={1} step={0.001} value={[position]} disabled={zoom === 1} onValueChange={([value = 0]) => setPosition(value)} />
    </section>
  );
}