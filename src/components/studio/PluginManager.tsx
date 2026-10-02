import { useEffect, useMemo, useState } from "react";
import { FolderPlus, FolderMinus, Loader2, PlugZap, RefreshCw, RotateCcw, ScanSearch, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { bridge, customPluginFolders, setCustomPluginFolders, type BridgePlugin } from "@/lib/synclab/bridge";
import { useBridge } from "@/components/studio/PluginBridge";

const VIEWS = ["Installed", "Failed", "Unsupported", "Favorites"] as const;
type View = (typeof VIEWS)[number];
const FAV_KEY = "synclab.plugins.favorites";
const RESET_KEY = "synclab.plugins.resetFailed";

const readList = (k: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const writeList = (k: string, v: string[]) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* blocked */
  }
};

function statusLabel(p: BridgePlugin) {
  if (p.status === "failed") return "Failed";
  if (p.status === "unsupported") return "Unsupported";
  return "Found";
}

/**
 * Settings → Audio → Plug-ins. Scans the computer's real plug-in folders through the desktop
 * scanner. Plug-ins are discovered and described, never loaded — native hosting is not built yet.
 */
export function PluginManager() {
  const state = useBridge();
  const desktop = typeof window !== "undefined" && Boolean(window.synclab?.desktop);
  const [folders, setFolders] = useState<string[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [view, setView] = useState<View>("Installed");
  const [q, setQ] = useState("");
  const connected = state.status === "connected";

  useEffect(() => {
    setFolders(customPluginFolders());
    setFavs(readList(FAV_KEY));
    setHidden(readList(RESET_KEY));
  }, []);

  const saveFolders = (next: string[]) => {
    setFolders(next);
    setCustomPluginFolders(next);
  };
  const addFolder = async () => {
    const res = await window.synclab?.chooseFolder?.();
    if (res?.ok && res.path && !folders.includes(res.path)) {
      saveFolders([...folders, res.path]);
      setTimeout(() => bridge.scan(), 0);
    }
  };
  const toggleFav = (uid: string) => {
    const next = favs.includes(uid) ? favs.filter((x) => x !== uid) : [...favs, uid];
    setFavs(next);
    writeList(FAV_KEY, next);
  };
  const resetFailed = () => {
    const next = state.plugins.filter((p) => p.status === "failed").map((p) => p.uid);
    setHidden(next);
    writeList(RESET_KEY, next);
    bridge.scan();
  };

  const counts = useMemo(
    () => ({
      Installed: state.plugins.filter((p) => !p.status || p.status === "ok").length,
      Failed: state.plugins.filter((p) => p.status === "failed" && !hidden.includes(p.uid)).length,
      Unsupported: state.plugins.filter((p) => p.status === "unsupported").length,
      Favorites: state.plugins.filter((p) => favs.includes(p.uid)).length,
    }),
    [state.plugins, hidden, favs],
  );
  const list = state.plugins
    .filter((p) =>
      view === "Installed"
        ? !p.status || p.status === "ok"
        : view === "Failed"
          ? p.status === "failed" && !hidden.includes(p.uid)
          : view === "Unsupported"
            ? p.status === "unsupported"
            : favs.includes(p.uid),
    )
    .filter((p) => (q ? `${p.name} ${p.vendor} ${p.format}`.toLowerCase().includes(q.toLowerCase()) : true));

  return (
    <section className="mt-6 space-y-3 border-t border-border pt-4" aria-label="Plug-ins">
      <div className="flex flex-wrap items-center gap-2">
        <p className="label-xs">PLUG-INS</p>
        <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
          {connected ? `${state.host ?? "Scanner"} · ${state.formats.join(" / ")}` : desktop ? "scanner not connected" : "desktop app required"}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {connected ? (
            <>
              <Button size="sm" className="h-8 gap-1.5 text-[11px]" disabled={state.scanning} onClick={() => bridge.scan()}>
                {state.scanning ? <Loader2 className="size-3.5 animate-spin" /> : <ScanSearch className="size-3.5" />}
                Scan all
              </Button>
              <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-[11px]" disabled={state.scanning} onClick={() => bridge.scan()}>
                <RefreshCw className="size-3.5" />
                Rescan
              </Button>
              <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-[11px]" onClick={addFolder}>
                <FolderPlus className="size-3.5" />
                Add folder
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-[11px]" onClick={resetFailed} disabled={counts.Failed === 0}>
                <RotateCcw className="size-3.5" />
                Reset failed
              </Button>
            </>
          ) : (
            desktop && (
              <Button size="sm" className="h-8 gap-1.5 text-[11px]" onClick={() => bridge.connect()}>
                {state.status === "connecting" ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5" />}
                Connect scanner
              </Button>
            )
          )}
        </div>
      </div>

      {!desktop && (
        <p className="rounded-[4px] border border-dashed border-border p-3 text-[11px] text-muted-foreground">
          Web browsers can't see the plug-ins installed on your computer. Open the SYNCLAB desktop app for Windows or Mac to scan your
          VST3, Audio Unit and CLAP folders.
        </p>
      )}
      {state.message && <p className="text-[11px] text-destructive">{state.message}</p>}

      {state.scanning && (
        <div className="space-y-1">
          <Progress value={state.progress && state.progress.total ? (state.progress.done / state.progress.total) * 100 : 5} />
          <p className="truncate font-mono text-[9px] text-muted-foreground">
            {state.progress ? `${state.progress.done} / ${state.progress.total} · ${state.progress.current}` : "Looking through plug-in folders…"}
          </p>
        </div>
      )}

      {connected && (
        <>
          <div className="space-y-1">
            <p className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">Folders scanned</p>
            {(state.folders.length ? state.folders : folders.map((f) => ({ path: f, exists: true, count: 0, custom: true }))).map((f) => (
              <div key={f.path} className="flex items-center gap-2 text-[11px]">
                <span className={`min-w-0 flex-1 truncate font-mono text-[10px] ${f.exists ? "" : "text-muted-foreground line-through"}`}>{f.path}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{f.exists ? `${f.count} found` : "not on this computer"}</span>
                {f.custom && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    aria-label={`Remove folder ${f.path}`}
                    onClick={() => {
                      saveFolders(folders.filter((x) => x !== f.path));
                      setTimeout(() => bridge.scan(), 0);
                    }}
                  >
                    <FolderMinus className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`rounded border px-2 py-0.5 text-[10px] ${view === v ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"}`}
              >
                {v} ({counts[v]})
              </button>
            ))}
            <Input className="ml-auto h-8 w-44 text-[11px]" placeholder="Search plug-ins" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="max-h-80 overflow-auto rounded-[4px] border border-border">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-card font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="p-1.5">Name</th>
                  <th className="p-1.5">Maker</th>
                  <th className="p-1.5">Format</th>
                  <th className="p-1.5">Version</th>
                  <th className="p-1.5">Location</th>
                  <th className="p-1.5">Status</th>
                  <th className="p-1.5" />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.uid} className="border-t border-border align-top">
                    <td className="p-1.5 font-medium">{p.name}</td>
                    <td className="p-1.5">{p.vendor}</td>
                    <td className="p-1.5 font-mono">{p.format}</td>
                    <td className="p-1.5 font-mono">{p.version ?? "—"}</td>
                    <td className="max-w-[14rem] truncate p-1.5 font-mono text-[9px] text-muted-foreground" title={p.path}>
                      <button type="button" className="hover:text-primary" onClick={() => window.synclab?.revealFile?.(p.path)}>
                        {p.path}
                      </button>
                    </td>
                    <td className="p-1.5">
                      <span className={p.status === "failed" ? "text-destructive" : p.status === "unsupported" ? "text-muted-foreground" : "text-primary"}>
                        {statusLabel(p)}
                      </span>
                      {p.error && <p className="text-[10px] text-muted-foreground">{p.error}</p>}
                    </td>
                    <td className="flex gap-1 p-1.5">
                      <Button size="icon" variant="ghost" className="size-6" aria-label={`Rescan ${p.name}`} title="Scan this plug-in again" onClick={() => bridge.scanOne(p.path)}>
                        <RefreshCw className="size-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-6" aria-label="Favorite" aria-pressed={favs.includes(p.uid)} onClick={() => toggleFav(p.uid)}>
                        <Star className={`size-3 ${favs.includes(p.uid) ? "fill-primary text-primary" : ""}`} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!state.scanning && list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-3 text-center text-muted-foreground">
                      Nothing here. Add a folder if your plug-ins live somewhere unusual, then press Rescan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground">
            "Found" means the plug-in is installed and its details could be read. SYNCLAB does not load or play these plug-ins yet — that
            needs a native audio bridge which isn't built. Scanning never runs plug-in code, so a bad plug-in can't crash SYNCLAB.
          </p>
        </>
      )}
    </section>
  );
}
