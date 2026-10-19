import { levelColor, peakOf, spectrumColor, dbColor, LEVEL_GREEN, LEVEL_ORANGE, LEVEL_RED } from "@/lib/synclab/level-colors";
import { useEffect, useRef } from "react";
import { getEngine } from "@/lib/synclab/audio-engine";

/** Live oscilloscope of an incoming microphone stream — used while a pad is recording. */
export function LiveWave({ stream, color = "hsl(0 85% 62%)", label = "Live input waveform" }: { stream: MediaStream | null; color?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!stream) return;
    const ctx = getEngine().ctx;
    const canvas = ref.current;
    if (!ctx || !canvas) return;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const g = canvas.getContext("2d");
      if (!g) return;
      const w = (canvas.width = canvas.clientWidth * 2);
      const h = (canvas.height = canvas.clientHeight * 2);
      analyser.getFloatTimeDomainData(data);
      g.clearRect(0, 0, w, h);
      g.lineWidth = 2;
      g.strokeStyle = getComputedStyle(canvas).getPropertyValue("--display-wave").trim();
      g.beginPath();
      for (let x = 0; x < w; x++) {
        const v = data[Math.floor((x / w) * data.length)] ?? 0;
        const y = h / 2 - v * (h / 2) * 0.9;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      analyser.disconnect();
    };
  }, [stream, color]);

  return <canvas ref={ref} aria-label={label} role="img" className="signal-screen h-full w-full" />;
}
