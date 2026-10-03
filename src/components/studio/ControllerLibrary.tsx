import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CONTROLLERS,
  MAKERS,
  chosenControllerId,
  setChosenControllerId,
  type ControllerProfile,
  type DeviceLook,
} from "@/lib/synclab/controller-profiles";

/** Drawn picture of a controller, built from its real control counts. */
export function DevicePicture({ look, className }: { look: DeviceLook; className?: string }) {
  const W = 240;
  const hasKeys = look.keys > 0;
  const H = hasKeys ? 120 : 90;
  const top = 10;
  const ctrlH = hasKeys ? 52 : 72;
  const knobCols = Math.min(look.knobs, 12);
  const knobRows = look.knobs > 12 ? Math.ceil(look.knobs / 8) : look.knobs ? 1 : 0;
  const perRow = knobRows > 1 ? Math.ceil(look.knobs / knobRows) : knobCols;
  const padCols = look.pads > 8 ? Math.ceil(look.pads / 2) : look.pads;
  const padRows = look.pads > 8 ? 2 : look.pads ? 1 : 0;
  const leftW = look.pads ? 92 : 0;
  const ctrlX = 12 + leftW;
  const ctrlW = W - ctrlX - 12;
  const knobArea = look.faders ? ctrlH * 0.42 : ctrlH;
  const white = Math.min(look.keys, 52) ? Math.round(look.keys * (7 / 12)) : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Controller illustration">
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="8" fill={look.body} stroke="rgba(255,255,255,0.15)" />
      {/* pads */}
      {Array.from({ length: look.pads }, (_, i) => {
        const r = Math.floor(i / padCols), c = i % padCols;
        const s = Math.min(18, (leftW - 8) / padCols - 3, (ctrlH - 4) / Math.max(1, padRows) - 3);
        return <rect key={`p${i}`} x={12 + c * (s + 3)} y={top + 4 + r * (s + 3)} width={s} height={s} rx="2" fill={look.accent} opacity={0.75} />;
      })}
      {/* knobs */}
      {Array.from({ length: look.knobs }, (_, i) => {
        const r = Math.floor(i / perRow), c = i % perRow;
        const rowH = knobArea / Math.max(1, knobRows);
        const rad = Math.max(2.5, Math.min(rowH / 2 - 2, ctrlW / perRow / 2 - 2, 7));
        const cx = ctrlX + (c + 0.5) * (ctrlW / perRow);
        const cy = top + rowH * (r + 0.5);
        return (
          <g key={`k${i}`}>
            <circle cx={cx} cy={cy} r={rad} fill="#3a3c42" stroke={look.accent} strokeOpacity={0.6} />
            <line x1={cx} y1={cy} x2={cx} y2={cy - rad} stroke={look.accent} strokeWidth="1.2" />
          </g>
        );
      })}
      {/* faders */}
      {Array.from({ length: look.faders }, (_, i) => {
        const fx = ctrlX + (i + 0.5) * (ctrlW / look.faders);
        const y0 = top + knobArea + 4;
        const len = ctrlH - knobArea - 6;
        return (
          <g key={`f${i}`}>
            <line x1={fx} y1={y0} x2={fx} y2={y0 + len} stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
            <rect x={fx - 4} y={y0 + len * (0.25 + ((i * 37) % 50) / 100)} width="8" height="5" rx="1" fill={look.accent} />
          </g>
        );
      })}
      {/* buttons */}
      {look.buttons > 0 && !hasKeys && (
        <g>
          {Array.from({ length: Math.min(look.buttons, 24) }, (_, i) => (
            <rect key={`b${i}`} x={12 + (i % 12) * 7} y={H - 14 + Math.floor(i / 12) * -6} width="5" height="3" rx="1" fill="#55585f" />
          ))}
        </g>
      )}
      {/* keys */}
      {hasKeys && (
        <g>
          {Array.from({ length: white }, (_, i) => {
            const kw = (W - 24) / white;
            return <rect key={`w${i}`} x={12 + i * kw} y={top + ctrlH + 4} width={kw - 0.8} height={H - ctrlH - 22} fill="#f4f4f4" rx="1" />;
          })}
          {Array.from({ length: white }, (_, i) => {
            const kw = (W - 24) / white;
            const n = i % 7;
            if (n === 2 || n === 6 || i === white - 1) return null;
            return <rect key={`bk${i}`} x={12 + (i + 1) * kw - kw * 0.3} y={top + ctrlH + 4} width={kw * 0.6} height={(H - ctrlH - 22) * 0.6} fill="#111" rx="1" />;
          })}
        </g>
      )}
    </svg>
  );
}

function LayoutList({ p }: { p: ControllerProfile }) {
  const rows = useMemo(() => {
    if (!p.map) return [];
    const byParam = new Map<string, number[]>();
    for (const [cc, hit] of Object.entries(p.map)) {
      const list = byParam.get(hit.param) ?? [];
      list.push(Number(cc));
      byParam.set(hit.param, list);
    }
    return [...byParam.entries()];
  }, [p]);
  if (!rows.length) return <p className="text-[11px] text-muted-foreground">No fixed layout — use the MIDI buttons beside any knob or fader to assign it.</p>;
  return (
    <ul className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
      {rows.map(([param, ccs]) => (
        <li key={param}><span className="uppercase text-foreground">{param}</span> · tracks 1–{ccs.length} · CC {Math.min(...ccs)}–{Math.max(...ccs)}</li>
      ))}
    </ul>
  );
}

/** Pick your controller's maker and model; its factory layout then maps automatically. */
export function ControllerLibrary({ trigger }: { trigger?: ReactNode }) {
  const [chosen, setChosen] = useState("auto");
  const [maker, setMaker] = useState<string>(MAKERS[0] as string);
  useEffect(() => {
    const id = chosenControllerId();
    setChosen(id);
    const p = CONTROLLERS.find((c) => c.id === id);
    if (p) setMaker(p.maker);
  }, []);
  const pick = (id: string) => {
    setChosenControllerId(id);
    setChosen(id);
  };
  const devices = CONTROLLERS.filter((c) => c.maker === maker);
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" variant="ghost" className="h-7 px-2 font-mono text-[10px] tracking-wider">CONTROLLERS</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="font-display text-sm uppercase tracking-widest">MIDI controller library</DialogTitle>
          <DialogDescription className="text-[11px]">
            Pick your maker and device. Devices with a fixed layout map to tracks 1–8 automatically; the rest play notes and use MIDI Learn. Pictures are drawings of each device's layout.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col sm:flex-row" style={{ maxHeight: "65vh" }}>
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2 sm:w-48 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r">
            <button
              onClick={() => pick("auto")}
              className={cn("flex items-center justify-between rounded-sm px-2 py-1.5 text-left text-[11px] whitespace-nowrap", chosen === "auto" ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:bg-surface-2")}
            >Detect automatically {chosen === "auto" && <Check className="size-3" />}</button>
            <button
              onClick={() => pick("off")}
              className={cn("flex items-center justify-between rounded-sm px-2 py-1.5 text-left text-[11px] whitespace-nowrap", chosen === "off" ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:bg-surface-2")}
            >No auto-mapping {chosen === "off" && <Check className="size-3" />}</button>
            <div className="hidden px-2 pt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground sm:block">Manufacturers</div>
            {MAKERS.map((m) => (
              <button
                key={m}
                onClick={() => setMaker(m)}
                className={cn("rounded-sm px-2 py-1.5 text-left text-[12px] whitespace-nowrap", maker === m ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface-2")}
              >{m}</button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-3 md:grid-cols-2">
            {devices.map((d) => (
              <button
                key={d.id}
                onClick={() => pick(d.id)}
                className={cn("flex flex-col gap-2 rounded-md border p-2 text-left transition-colors", chosen === d.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}
                aria-pressed={chosen === d.id}
              >
                <DevicePicture look={d.look} className="w-full" />
                <div className="flex items-center gap-2">
                  <span className="font-display text-[12px] font-semibold">{d.model}</span>
                  <span className={cn("ml-auto rounded-sm px-1.5 py-0.5 font-mono text-[8px] uppercase", d.map ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted-foreground")}>
                    {d.map ? "Auto-map" : "MIDI Learn"}
                  </span>
                  {chosen === d.id && <Check className="size-3.5 text-primary" />}
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">{d.summary}</p>
                <LayoutList p={d} />
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
