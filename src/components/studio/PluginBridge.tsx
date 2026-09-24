import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, Monitor, Plug, PlugZap, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { bridge, savedBridgeUrl, type BridgeEditor } from "@/lib/synclab/bridge";

/** Live subscription to the Desktop Audio Bridge client. */
export function useBridge() {
  return useSyncExternalStore(
    (fn) => bridge.subscribe(fn),
    () => bridge.snapshot,
    () => bridge.snapshot,
  );
}

/** The plugin's own window, streamed from the bridge, with every click and key sent back to it. */
function EditorView({ editor }: { editor: BridgeEditor }) {
  const surface = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / Math.max(1, editor.width)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editor.width]);

  const at = useCallback(
    (e: { clientX: number; clientY: number; currentTarget: Element }) => {
      const r = e.currentTarget.getBoundingClientRect();
      return { x: Math.round((e.clientX - r.left) / scale), y: Math.round((e.clientY - r.top) / scale) };
    },
    [scale],
  );

  return (
    <div ref={surface} className="space-y-2">
      <div
        tabIndex={0}
        role="application"
        aria-label={`${editor.name} plugin window`}
        className="relative overflow-hidden rounded-[4px] border border-border bg-black outline-none focus-visible:ring-1 focus-visible:ring-primary"
        style={{ width: editor.width * scale, height: editor.height * scale }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = at(e);
          bridge.pointer(editor.id, "down", p.x, p.y, e.button);
        }}
        onPointerMove={(e) => {
          const p = at(e);
          bridge.pointer(editor.id, "move", p.x, p.y, e.buttons ? e.button : -1);
        }}
        onPointerUp={(e) => {
          const p = at(e);
          bridge.pointer(editor.id, "up", p.x, p.y, e.button);
        }}
        onWheel={(e) => {
          const p = at(e);
          bridge.wheel(editor.id, p.x, p.y, e.deltaY);
        }}
        onKeyDown={(e) => bridge.key(editor.id, "down", e)}
        onKeyUp={(e) => bridge.key(editor.id, "up", e)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {editor.frame ? (
          <img
            src={editor.frame}
            alt={`${editor.name} interface`}
            draggable={false}
            className="pointer-events-none absolute left-0 top-0 origin-top-left select-none"
            style={{ width: editor.width, height: editor.height, transform: `scale(${scale})` }}
          />
        ) : (
          <div className="grid h-full place-items-center gap-2 text-center">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="text-[11px] text-muted-foreground">Waiting for the first picture of the plugin window…</p>
          </div>
        )}
      </div>
      <p className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
        Click, drag and type here — it goes straight to the plugin on your computer.
      </p>
      {editor.params.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {editor.params.slice(0, 40).map((p) => (
            <div key={p.index} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{p.name}</span>
              <Slider
                className="flex-1"
                min={0}
                max={1}
                step={0.001}
                value={[p.value]}
                onValueChange={([v = p.value]) => bridge.setParam(editor.id, p.index, v)}
              />
              <span className="w-16 shrink-0 text-right font-mono text-[10px] text-primary">{p.text ?? p.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = ["All", "Instruments", "Effects", "Synthesizers", "Samplers", "Drums", "EQ", "Compression", "Reverb", "Delay", "Modulation", "Distortion", "Mastering", "Utility", "Favorites", "Recently Used"] as const;
const FAV_KEY = "synclab.plugins.favorites";
const RECENT_KEY = "synclab.plugins.recent";
const readList = (k: string): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const writeList = (k: string, v: string[]) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked */
  }
};
const CAT_WORDS: Record<string, RegExp> = {
  Synthesizers: /synth/i,
  Samplers: /sampl/i,
  Drums: /drum|percussion|beat/i,
  EQ: /\beq\b|equali/i,
  Compression: /compress|dynamics|limit/i,
  Reverb: /reverb|room|hall/i,
  Delay: /delay|echo/i,
  Modulation: /chorus|flang|phas|modul|trem/i,
  Distortion: /distort|satur|drive|crush/i,
  Mastering: /master|loud/i,
  Utility: /util|meter|analy|gain|tool/i,
};
function matchesTab(p: BridgePlugin, tab: (typeof TABS)[number], favs: string[], recent: string[]) {
  if (tab === "All") return true;
  if (tab === "Instruments") return !!p.isInstrument;
  if (tab === "Effects") return !p.isInstrument;
  if (tab === "Favorites") return favs.includes(p.uid);
  if (tab === "Recently Used") return recent.includes(p.uid);
  const re = CAT_WORDS[tab];
  return !!re && re.test(`${p.category ?? ""} ${p.name}`);
}

export function PluginBridge() {
  const state = useBridge();
  const [url, setUrl] = useState(savedBridgeUrl());
  const [filter, setFilter] = useState("");
  const editors = Object.values(state.editors);
  const connected = state.status === "connected";
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [favs, setFavs] = useState<string[]>(() => readList(FAV_KEY));
  const [recent, setRecent] = useState<string[]>(() => readList(RECENT_KEY));
  const toggleFav = (uid: string) => {
    const next = favs.includes(uid) ? favs.filter((x) => x !== uid) : [...favs, uid];
    setFavs(next);
    writeList(FAV_KEY, next);
  };
  const openPlugin = (uid: string) => {
    bridge.open(uid);
    const next = [uid, ...recent.filter((x) => x !== uid)].slice(0, 12);
    setRecent(next);
    writeList(RECENT_KEY, next);
  };
  const failed = state.plugins.filter((p) => p.status === "failed");
  const list = state.plugins
    .filter((p) => (filter ? `${p.name} ${p.vendor} ${p.category ?? ""}`.toLowerCase().includes(filter.toLowerCase()) : true))
    .filter((p) => matchesTab(p, tab, favs, recent))
    .sort((a, b) => (tab === "Recently Used" ? recent.indexOf(a.uid) - recent.indexOf(b.uid) : a.name.localeCompare(b.name)));

  return (
    <div className="space-y-3">
      <div className="panel space-y-2 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`size-2 rounded-full ${connected ? "bg-primary shadow-[0_0_8px] shadow-primary" : state.status === "error" ? "bg-destructive" : "bg-muted-foreground"}`}
          />
          <p className="label-xs">DESKTOP AUDIO BRIDGE</p>
          <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
            {connected ? `${state.host ?? "connected"} · ${state.formats.join(" ") || "no formats reported"}` : state.status === "connecting" ? "connecting…" : "not connected"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Input className="h-8 w-48 font-mono text-[10px]" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Bridge address" />
            {connected ? (
              <>
                <Button size="sm" variant="secondary" className="h-8 gap-1.5 font-mono text-[10px] tracking-widest" onClick={() => bridge.scan()}>
                  <RefreshCw className={`size-3.5 ${state.scanning ? "animate-spin" : ""}`} />
                  RESCAN
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 font-mono text-[10px] tracking-widest" onClick={() => bridge.disconnect()}>
                  <X className="size-3.5" />
                  DISCONNECT
                </Button>
              </>
            ) : (
              <Button size="sm" className="h-8 gap-1.5 font-mono text-[10px] tracking-widest" onClick={() => bridge.connect(url)}>
                {state.status === "connecting" ? <Loader2 className="size-3.5 animate-spin" /> : <PlugZap className="size-3.5" />}
                CONNECT
              </Button>
            )}
          </div>
        </div>

        {state.message && <p className="text-[11px] text-destructive">{state.message}</p>}

        {!connected && (
          <div className="space-y-1 rounded-[4px] border border-dashed border-border p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium">
              <Plug className="size-3.5 text-primary" />
              Desktop Audio Bridge required
            </p>
            <p className="text-[10px] text-muted-foreground">
              No web browser can run a VST3, AU or CLAP plugin — that code only runs on your computer. To use your own plugins
              with their real windows and controls, run the SYNCLAB bridge program on the same computer and press CONNECT. It
              hosts the plugin, sends its window here picture by picture, and passes your clicks, typing and knob moves back to
              it. Until it is running, nothing is loaded and this app will never pretend otherwise.
            </p>
          </div>
        )}
      </div>

      {connected && (
        <div className="panel space-y-2 p-2">
          <div className="flex items-center gap-2">
            <p className="label-xs">PLUGINS ON THIS COMPUTER</p>
            <span className="font-mono text-[9px] text-muted-foreground">{state.scanning ? "scanning…" : `${list.length}`}</span>
            <Input
              className="ml-auto h-8 w-44 text-[11px]"
              placeholder="Search plugins"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <p className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
            {state.plugins.length} found · {state.plugins.length - failed.length} available · {failed.length} failed
          </p>
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                className={`rounded border px-2 py-0.5 text-[10px] ${tab === t ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
          {!state.scanning && list.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              The bridge is connected but reported no plugins. Point it at your plugin folders and press RESCAN.
            </p>
          )}
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) =>
              p.status === "failed" ? (
                <div key={p.uid} className="panel space-y-1 border-destructive/60 px-2 py-1.5">
                  <p className="text-[11px] font-medium text-destructive">Plugin Scan Failed — {p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.error ?? "The plugin did not load during scanning."} SYNCLAB kept running.</p>
                  <Button size="sm" variant="ghost" className="h-6 px-2 font-mono text-[9px]" onClick={() => bridge.scan()}>
                    RESCAN
                  </Button>
                </div>
              ) : (
                <div key={p.uid} className="panel flex items-center gap-2 px-2 py-1.5 hover:border-primary">
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("application/x-synclab-plugin", p.uid)}
                    onClick={() => openPlugin(p.uid)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    title="Open the plugin window"
                  >
                    <Monitor className="size-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium">{p.name}</span>
                      <span className="block truncate font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
                        {p.vendor} · {p.format}
                        {p.version ? ` · v${p.version}` : ""}
                        {p.category ? ` · ${p.category}` : p.isInstrument ? " · INSTRUMENT" : " · EFFECT"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFav(p.uid)}
                    aria-pressed={favs.includes(p.uid)}
                    aria-label={favs.includes(p.uid) ? "Remove from favorites" : "Add to favorites"}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Star className={`size-3.5 ${favs.includes(p.uid) ? "fill-primary text-primary" : ""}`} />
                  </button>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {editors.map((editor) => (
        <div key={editor.id} className="panel space-y-2 p-2">
          <div className="flex items-center gap-2">
            <Monitor className="size-3.5 text-primary" />
            <span className="text-[11px] font-medium">{editor.name}</span>
            <span className="font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
              {editor.width}×{editor.height}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 font-mono text-[10px]" onClick={() => bridge.preset(editor.id, "prev")}>
                PREV
              </Button>
              <Button size="sm" variant="ghost" className="h-7 font-mono text-[10px]" onClick={() => bridge.preset(editor.id, "next")}>
                NEXT
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => bridge.close(editor.id)} aria-label="Close plugin window">
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
          <EditorView editor={editor} />
        </div>
      ))}

      {connected && state.audio === false && (
        <p className="text-[10px] text-muted-foreground">
          This bridge reports picture-and-control only: you see and drive the plugin, but its sound is produced on your computer,
          not inside this tab. A bridge build that streams audio back will report it and the channel will use it automatically.
        </p>
      )}
    </div>
  );
}
