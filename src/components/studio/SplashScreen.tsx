import { useEffect, useState } from "react";
import synclabLogoAsset from "@/assets/synclab-logo.jpg.asset.json";

const DURATION_MS = 60_000;
const FADE_MS = 600;

export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("fade"), DURATION_MS);
    return () => window.clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== "fade") return;
    const t2 = window.setTimeout(() => setPhase("gone"), FADE_MS);
    return () => window.clearTimeout(t2);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      role="presentation"
      onClick={() => setPhase("fade")}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-background transition-opacity duration-500"
      style={{ opacity: phase === "fade" ? 0 : 1 }}
    >
      <div className="spin-stage">
        <img
          src={synclabLogoAsset.url}
          alt="SYNCLAB"
          className="spin-logo w-[min(72vw,560px)] rounded-2xl shadow-[0_0_80px_hsl(var(--primary)/0.35)]"
        />
      </div>
      <p className="mt-8 font-mono text-xs tracking-[0.5em] text-muted-foreground uppercase">
        Sound Design Studio
      </p>
      <p className="mt-2 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">
        Detroit Electronic
      </p>
      <p className="mt-6 animate-pulse font-mono text-[9px] tracking-[0.35em] text-muted-foreground/40 uppercase">
        Click to enter
      </p>
    </div>
  );
}
