import * as React from "react";
import { RotateCcw } from "lucide-react";

/**
 * Phones open in landscape only: when a phone is held upright, cover the app
 * with a rotate prompt. Browsers cannot force rotation, so on Android Chrome
 * we also offer a real fullscreen + orientation lock attempt.
 */
const PORTRAIT_PHONE_QUERY =
  "(orientation: portrait) and (max-width: 767px) and (pointer: coarse), (orientation: portrait) and (max-width: 600px)";

export function RotateGate() {
  const [portrait, setPortrait] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [lockNote, setLockNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    const mql = window.matchMedia(PORTRAIT_PHONE_QUERY);
    // Some phone browsers (iOS Safari, in-app browsers) miss matchMedia change
    // events on rotation, so re-check from the real window size too.
    const check = () => {
      const w = window.visualViewport?.width ?? window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      setPortrait(h > w && mql.matches);
    };
    const later = () => { check(); window.setTimeout(check, 250); window.setTimeout(check, 700); };
    mql.addEventListener("change", later);
    window.addEventListener("resize", later);
    window.addEventListener("orientationchange", later);
    window.visualViewport?.addEventListener("resize", later);
    check();
    return () => {
      mql.removeEventListener("change", later);
      window.removeEventListener("resize", later);
      window.removeEventListener("orientationchange", later);
      window.visualViewport?.removeEventListener("resize", later);
    };
  }, []);

  const goFullscreen = React.useCallback(async () => {
    setLockNote(null);
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      const orientation = (window.screen as Screen & {
        orientation?: ScreenOrientation & { lock?: (o: string) => Promise<void> };
      }).orientation;
      if (orientation?.lock) {
        await orientation.lock("landscape");
      } else {
        setLockNote("This browser can't lock the rotation — just turn your phone sideways.");
      }
    } catch {
      setLockNote("This browser can't lock the rotation — just turn your phone sideways.");
    }
  }, []);

  if (!portrait || dismissed) return null;

  return (
    <div
      data-testid="rotate-gate"
      role="alertdialog"
      aria-label="Rotate your phone"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center text-foreground"
    >
      <div className="rotate-gate-icon flex h-24 w-24 items-center justify-center rounded-3xl border border-border bg-surface" aria-hidden="true">
        <RotateCcw className="size-12 text-primary" />
      </div>
      <div>
        <p className="text-lg font-semibold tracking-wide">Rotate your phone</p>
        <p className="mt-1 text-sm text-muted-foreground">
          SYNCLAB opens sideways only. Turn your phone to landscape to continue.
        </p>
      </div>
      <button
        type="button"
        onClick={goFullscreen}
        className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
      >
        Full screen &amp; lock sideways
      </button>
      {lockNote && <p className="text-xs text-muted-foreground">{lockNote}</p>}
      <p className="absolute bottom-6 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Synclab · Create. Record. Produce. Finish.
      </p>
    </div>
  );
}
