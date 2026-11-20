import { useEffect, useState } from "react";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";

const MAX_MS = 60_000; // hard ceiling — never longer than this
const MIN_MS = 4200; // let the slow spin read before fading out
const FADE_MS = 600;

export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  // Leave as soon as the app is ready (window load / fonts), capped at 60s.
  useEffect(() => {
    let done = false;
    const leave = () => {
      if (done) return;
      done = true;
      setPhase("fade");
    };
    const start = Date.now();
    const ready = () => window.setTimeout(leave, Math.max(0, MIN_MS - (Date.now() - start)));

    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });

    const cap = window.setTimeout(leave, MAX_MS);
    return () => {
      window.clearTimeout(cap);
      window.removeEventListener("load", ready);
    };
  }, []);

  useEffect(() => {
    if (phase !== "fade") return;
    const t = window.setTimeout(() => setPhase("gone"), FADE_MS);
    return () => window.clearTimeout(t);
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
          className="spin-logo w-[min(38vw,290px)] rounded-2xl shadow-[0_0_60px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
        />
      </div>
      <p className="mt-8 font-mono text-xs tracking-[0.5em] text-muted-foreground uppercase">
        Sound Design Studio
      </p>
      <p className="mt-2 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">
        Detroit Electronic
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setPhase("fade");
        }}
        className="mt-7 rounded-[3px] border border-border bg-surface-2 px-5 py-1.5 font-mono text-[10px] tracking-[0.35em] text-foreground uppercase transition-colors hover:bg-surface"
      >
        Skip
      </button>
    </div>
  );
}
