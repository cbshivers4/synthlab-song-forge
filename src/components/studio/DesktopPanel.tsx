import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, Cpu, HardDrive, Cloud, Sparkles, Waves, LayoutGrid, Plug, Download, Apple, AppWindow } from "lucide-react";
import { ARCHITECTURE, isDesktop, runtimeLabel, platformName, desktopApi, saveBytes } from "@/lib/synclab/desktop";
import { useBridge } from "@/components/studio/PluginBridge";
import { bridge, savedBridgeUrl } from "@/lib/synclab/bridge";
import { toast } from "sonner";

const ICONS: Record<string, typeof Monitor> = {
  ui: LayoutGrid,
  engine: Cpu,
  audio: Waves,
  native: Plug,
  files: HardDrive,
  ai: Sparkles,
  cloud: Cloud,
};

type ReleaseInfo = { version: string; notes?: string; downloads: Record<string, string> };

const DOWNLOADS: { key: string; label: string; sub: string; Icon: typeof Monitor }[] = [
  { key: "win32-x64", label: "Windows", sub: "64-bit installer", Icon: AppWindow },
  { key: "darwin-arm64", label: "Mac", sub: "Apple silicon (M1–M4)", Icon: Apple },
  { key: "darwin-x64", label: "Mac", sub: "Intel", Icon: Apple },
];

/** Download buttons fed by public/desktop-release.json; empty URLs mean that build is not published yet. */
function DesktopDownloads() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  useEffect(() => {
    fetch("/desktop-release.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setRelease(j as ReleaseInfo | null))
      .catch(() => setRelease(null));
  }, []);
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {DOWNLOADS.map(({ key, label, sub, Icon }) => {
          const url = release?.downloads?.[key] ?? "";
          return (
            <div key={key} className="flex flex-col gap-2 rounded-md border border-border/60 bg-background p-2.5">
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-primary" />
                <div>
                  <div className="text-[13px] font-semibold">{label}</div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{sub}</div>
                </div>
              </div>
              {url ? (
                <Button size="sm" asChild>
                  <a href={url} download>
                    <Download className="size-3.5" /> Download {release?.version ? `v${release.version}` : ""}
                  </a>
                </Button>
              ) : (
                <span className="rounded-sm border border-dashed border-border px-2 py-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Not published yet
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Installers are built and signed on a real Mac or Windows machine (see DESKTOP_BUILD.md) and published here —
        this panel reads the live release list, so a button appears the moment a build is published. No fake links.
      </p>
    </div>
  );
}

/** What the studio runs on, what the desktop shell adds, and how the layers fit together. */
export function DesktopPanel() {
  const desktop = isDesktop();
  const api = desktopApi();
  const bridgeState = useBridge();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="label-xs mb-2">This computer</div>
        <div className="grid gap-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
          <span>Runtime — {runtimeLabel()}</span>
          <span>System — {platformName()}</span>
          <span>Shell — {api ? `Electron ${api.versions.electron}` : "Browser tab"}</span>
          <span>
            Audio Bridge —{" "}
            {bridgeState.status === "connected"
              ? `${bridgeState.host ?? "connected"} · ${bridgeState.plugins.length} plugins`
              : "not connected"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {bridgeState.status === "connected" ? (
            <Button size="sm" variant="secondary" onClick={() => bridge.disconnect()}>
              Disconnect bridge
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => bridge.connect(savedBridgeUrl())}>
              Connect Audio Bridge
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const res = await saveBytes(
                "synclab-desktop-check.txt",
                new Blob([`SYNCLAB runtime check\n${runtimeLabel()}\n${new Date().toISOString()}\n`]),
                [{ name: "Text", extensions: ["txt"] }],
              );
              if (res.canceled) return;
              toast.success(res.path ? `Written to ${res.path}` : "Downloaded (browser tabs cannot choose a folder)");
            }}
          >
            Test file saving
          </Button>
        </div>
        {!desktop && (
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            You are in a browser tab. Everything in the studio works here except native plugin hosting and saving
            straight to a folder you pick — those need the desktop app, and the app tells you so wherever they appear.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="label-xs mb-2">How SYNCLAB is built</div>
        <div className="space-y-2">
          {ARCHITECTURE.map((layer) => {
            const Icon = ICONS[layer.id] ?? Monitor;
            return (
              <div key={layer.id} className="flex gap-3 rounded-md border border-border/60 bg-background p-2.5">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold">{layer.name}</span>
                    <span className="rounded-sm border border-border px-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      {layer.where}
                    </span>
                    {layer.status === "bridge required" && (
                      <span className="rounded-sm bg-primary/15 px-1 font-mono text-[9px] uppercase tracking-widest text-primary">
                        bridge required
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{layer.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="label-xs mb-2">Download the desktop app</div>
        <DesktopDownloads />
      </div>

      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="label-xs mb-2">Desktop app</div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The macOS and Windows app is the same studio in its own window, plus real Save and Open dialogs on your disk
          and a home for the Audio Bridge. It loads the studio over the network, so it needs a connection to start.
          Plugin hosting stays in the bridge process — that is the only way a plugin binary can run on your machine.
        </p>
      </div>
    </div>
  );
}
