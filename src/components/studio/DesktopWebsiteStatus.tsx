import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { desktopApi } from "@/lib/synclab/desktop";

/** Script bundles currently running in this window. */
function loadedBundles(): string[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"))
    .map((s) => new URL(s.src, location.href).pathname)
    .filter((p) => p.startsWith("/assets/"))
    .sort();
}

/**
 * Desktop only: compares the website version this window loaded with the
 * currently published one and offers a restart when they differ.
 */
export function DesktopWebsiteStatus() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [status, setStatus] = useState<"checking" | "latest" | "outdated" | "offline">("checking");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!desktopApi()) return;
    setIsDesktop(true);
    const mine = loadedBundles();
    const check = async () => {
      try {
        const html = await (await fetch(`/?v=${Date.now()}`, { cache: "no-store" })).text();
        const live = Array.from(new Set(html.match(/\/assets\/[^"'\s]+\.js/g) ?? [])).sort();
        const entry = (list: string[]) => list.find((p) => /\/assets\/index-/.test(p));
        const a = entry(mine);
        const b = entry(live);
        setStatus(a && b && a !== b ? "outdated" : "latest");
      } catch {
        setStatus("offline");
      }
      setCheckedAt(new Date());
    };
    void check();
    const id = window.setInterval(check, 5 * 60 * 1000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!isDesktop) return null;
  const time = checkedAt?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (status === "outdated") {
    return (
      <div className="fixed bottom-4 left-1/2 z-[100] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-md border border-primary bg-card px-4 py-2 text-sm text-card-foreground shadow-lg">
        <RefreshCw className="size-4 text-primary" />
        <span>A newer SYNCLAB version is live. Save your work, then restart to use it.</span>
        <button
          type="button"
          onClick={() => location.reload()}
          className="rounded-[3px] bg-primary px-3 py-1 font-mono text-[11px] font-semibold tracking-widest text-primary-foreground uppercase"
        >
          Restart now
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-2 right-2 z-[90] flex items-center gap-1.5 rounded-[3px] border border-border bg-card/90 px-2 py-1 font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
      title="Compared with the published website"
    >
      {status === "latest" && <CheckCircle2 className="size-3 text-primary" />}
      {status === "checking" && "Checking version…"}
      {status === "latest" && `Latest version · checked ${time}`}
      {status === "offline" && `Offline · can't check version`}
    </div>
  );
}
