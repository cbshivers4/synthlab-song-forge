import { useEffect, useRef } from 'react';
import { cachedStyle, elementSize } from "@/lib/display-cache";
import { modularScopeId, readModularScope } from '@/lib/synclab/modular-scopes';
import { waveformDisplayGain } from '@/lib/synclab/signal-display';
import { ExpandScopeButton } from './ExpandScopeButton';

export function ModularScope({ trackId, moduleId, label }: { trackId: string; moduleId: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { w, h } = elementSize(canvas), dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colors = cachedStyle(canvas);
      ctx.strokeStyle = colors.getPropertyValue('--display-grid').trim();
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4); ctx.stroke();
      }
      const data = readModularScope(modularScopeId(trackId, moduleId));
      let peak = 0; for (const sample of data ?? []) peak = Math.max(peak, Math.abs(sample));
      const gain = waveformDisplayGain(peak);
      ctx.strokeStyle = colors.getPropertyValue('--display-wave').trim(); ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (data) for (let i = 0; i < data.length; i++) {
        const x = i / (data.length - 1) * w, y = h / 2 - Math.max(-1, Math.min(1, (data[i] ?? 0) * gain)) * (h / 2 - 3);
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      } else { ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); }
      ctx.stroke();
    };
    draw(); const timer = window.setInterval(draw, 50);
    return () => window.clearInterval(timer);
  }, [trackId, moduleId]);
  return <div className="modular-scope-window relative"><span>OUT · SCOPE</span><ExpandScopeButton source={{ id: modularScopeId(trackId, moduleId), label, kind: 'modular' }} view="wave" className="absolute right-0.5 top-0.5" /><canvas ref={canvasRef} role="img" aria-label={`${label} live output scope`} /></div>;
}