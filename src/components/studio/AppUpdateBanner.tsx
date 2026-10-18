import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SYNCLAB_VERSION } from "@/lib/synclab/support";
import { desktopApi } from "@/lib/synclab/desktop";

interface AppRelease {
  version: string;
  notes?: string;
}

function newer(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

/**
 * Web studio: tells the user when a newer SYNCLAB version has been published
 * than the one this tab loaded, and offers a one-tap refresh. The desktop app
 * gets its own banner (DesktopUpdateBanner) with a real installer download.
 */
export function AppUpdateBanner() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (desktopApi()) return; // desktop shell uses DesktopUpdateBanner instead
    const check = () =>
      fetch(`/app-version.json?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((r: AppRelease | null) => {
          if (r?.version && newer(r.version, SYNCLAB_VERSION)) setRelease(r);
        })
        .catch(() => {});
    check();
    const id = window.setInterval(check, 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!release || hidden) return null;

  return (
    <div className="fixed left-1/2 top-3 z-[100] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-md border border-primary bg-card px-4 py-2 text-sm text-card-foreground shadow-lg">
      <span>
        SYNCLAB {release.version} is available (you have {SYNCLAB_VERSION}).
        {release.notes ? ` ${release.notes}` : ""}
      </span>
      <Button size="sm" onClick={() => window.location.reload()}>
        <RefreshCw className="mr-1 size-4" /> Refresh to update
      </Button>
      <button aria-label="Dismiss update notice" onClick={() => setHidden(true)} className="p-1">
        <X className="size-4" />
      </button>
    </div>
  );
}
