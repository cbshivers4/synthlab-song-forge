import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { desktopApi } from "@/lib/synclab/desktop";

interface Release {
  version: string;
  notes?: string;
  downloads?: Record<string, string>;
}

function newer(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

/** Desktop only: tells the user when a newer SYNCLAB app build is published. */
export function DesktopUpdateBanner() {
  const [release, setRelease] = useState<Release | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const api = desktopApi();
    if (!api?.appVersion) return;
    const current = api.appVersion;
    const check = () =>
      fetch(`/desktop-release.json?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((r: Release | null) => {
          if (r?.version && newer(r.version, current)) setRelease(r);
        })
        .catch(() => {});
    check();
    const id = window.setInterval(check, 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!release || hidden) return null;
  const api = desktopApi();
  const arch = /arm|aarch/i.test(navigator.userAgent) ? "arm64" : "x64";
  const url = release.downloads?.[`${api?.platform}-${arch}`] || release.downloads?.[`${api?.platform}-x64`];

  return (
    <div className="fixed left-1/2 top-3 z-[100] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-md border border-primary bg-card px-4 py-2 text-sm text-card-foreground shadow-lg">
      <span>
        SYNCLAB Vocal Forge {release.version} is available (you have {api?.appVersion}).
        {release.notes ? ` ${release.notes}` : ""}
      </span>
      {url ? (
        <Button size="sm" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <Download className="mr-1 size-4" /> Update
          </a>
        </Button>
      ) : (
        <span className="text-muted-foreground">Contact support for the new download.</span>
      )}
      <button aria-label="Dismiss update notice" onClick={() => setHidden(true)} className="p-1">
        <X className="size-4" />
      </button>
    </div>
  );
}
