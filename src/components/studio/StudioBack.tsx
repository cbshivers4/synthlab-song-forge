import { useLayoutEffect, useRef, useState } from "react";
import { Cable, Unplug, Cpu, Scan, ZoomIn, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { studioCablePatch } from "@/lib/synclab/studio-routing";
import { useStudio } from "@/lib/synclab/store";
import type { PluginInstance, Track } from "@/lib/synclab/types";
import { toast } from "sonner";
import roomImage from "@/assets/studio-room.jpg";

/**
 * Reason-style rear of the studio rack. Every cable mirrors the real signal
 * path (track → inserts → mixer channel → master → monitors/reel, plus bus
 * sends). Re-patching a cable performs the matching real routing change:
 * re-ordering inserts, bypassing effects, or setting a send level.
 */

type JackRef = { device: string; port: string };
type CableColor = "red" | "yellow" | "green" | "blue" | "orange" | "purple";
type Wire = {
  id: string;
  from: JackRef;
  to: JackRef;
  color: CableColor;
  label: string;
  /** What unplugging this wire does. */
  unplug?: (() => void) | undefined;
  fixed?: boolean;
};

const pkey = (p: JackRef) => `${p.device}|${p.port}`;
const SEND_BUSES = ["reverb", "delay", "chorus"] as const;

const trackOut = (t: Track): JackRef => ({ device: `track:${t.id}`, port: "out" });
const fxIn = (p: PluginInstance): JackRef => ({ device: `fx:${p.id}`, port: "in" });
const fxOut = (p: PluginInstance): JackRef => ({ device: `fx:${p.id}`, port: "out" });
const masterIn = (t: Track): JackRef => ({ device: "master", port: `in:${t.id}` });
const busIn = (b: string): JackRef => ({ device: `bus:${b}`, port: "in" });

export function StudioBack() {
  const { tracks, togglePluginBypass, updateTrack } = useStudio();
  const [pending, setPending] = useState<JackRef | null>(null);
  const [selectedWire, setSelectedWire] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [sourceKey, setSourceKey] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overview, setOverview] = useState(true);
  const [view, setView] = useState({ phone: false, scale: 1, width: 760, height: 0 });
  const [lines, setLines] = useState<{ id: string; d: string; color: CableColor; selected: boolean }[]>([]);

  // Scale the measured room and its cables together, never their individual jacks.
  useLayoutEffect(() => {
    const box = boxRef.current, scroll = scrollRef.current;
    if (!box || !scroll) return;
    const phoneQuery = window.matchMedia("(max-width: 767px), (orientation: landscape) and (max-width: 1100px) and (max-height: 600px)");
    const measure = () => {
      const phone = phoneQuery.matches;
      const width = Math.max(760, scroll.clientWidth);
      const height = box.offsetHeight;
      const scale = phone && overview && height > 0
        ? Math.min(1, scroll.clientWidth / width)
        : 1;
      setView(previous => previous.phone === phone && previous.width === width && previous.height === height && Math.abs(previous.scale - scale) < .001 ? previous : { phone, width, height, scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box); observer.observe(scroll);
    phoneQuery.addEventListener("change", measure);
    return () => { observer.disconnect(); phoneQuery.removeEventListener("change", measure); };
  }, [overview]);

  // ---- derive the wiring from real routing state ----
  const wires: Wire[] = [];
  for (const track of tracks) {
    const chain = (track.plugins ?? []).filter((p) => !p.bypass);
    let prev = trackOut(track);
    let prevName = track.name;
    for (const fx of chain) {
      wires.push({
        id: `${pkey(prev)}>${pkey(fxIn(fx))}`,
        from: prev,
        to: fxIn(fx),
        color: "red",
        label: `${prevName} → ${fx.name}`,
        unplug: () => togglePluginBypass(track.id, fx.id),
      });
      prev = fxOut(fx);
      prevName = fx.name;
    }
    wires.push({
      id: `${pkey(prev)}>${pkey(masterIn(track))}`,
      from: prev,
      to: masterIn(track),
      color: "yellow",
      label: `${prevName} → Mixer ${track.name}`,
      unplug:
        chain.length > 0
          ? () => {
              // Unplugging the feed to the mixer bypasses the tail of the chain.
              const last = chain[chain.length - 1];
              if (last) togglePluginBypass(track.id, last.id);
            }
          : undefined,
      fixed: chain.length === 0,
    });
    for (const bus of SEND_BUSES) {
      const level = track.sends?.[bus] ?? 0;
      if (level > 0)
        wires.push({
          id: `${pkey(trackOut(track))}>${pkey(busIn(bus))}`,
          from: trackOut(track),
          to: busIn(bus),
          color: "green",
          label: `${track.name} → ${bus} send ${(level * 100).toFixed(0)}%`,
          unplug: () => updateTrack(track.id, { sends: { reverb: 0, delay: 0, chorus: 0, ...track.sends, [bus]: 0 } }),
        });
    }
  }
  wires.push(
    { id: "master>monitor-l", from: { device: "master", port: "out" }, to: { device: "monitor-l", port: "in" }, color: "blue", label: "Master → Left studio monitor", fixed: true },
    { id: "master>monitor-r", from: { device: "master", port: "out" }, to: { device: "monitor-r", port: "in" }, color: "blue", label: "Master → Right studio monitor", fixed: true },
    { id: "master>reel", from: { device: "master", port: "out" }, to: { device: "reel", port: "in" }, color: "purple", label: "Master → Reel-to-reel input", fixed: true },
  );

  // ---- re-patch: turn a new connection into a real routing change ----
  const connect = (to: JackRef, from: JackRef | null = pending) => {
    setPending(null);
    if (!from || from.device === to.device) return;
    const fromTrack = from.device.startsWith("track:") ? from.device.slice(6) : null;
    const fromFx = from.device.startsWith("fx:") ? from.device.slice(3) : null;
    const track = tracks.find((t) => t.id === fromTrack) ?? tracks.find((t) => (t.plugins ?? []).some((p) => p.id === fromFx));
    if (!track) {
      toast("That connection isn't possible", { description: "Patch within one channel's chain, to the mixer, or to a send." });
      return;
    }

    const patch = studioCablePatch(track, from, to);
    if (patch) {
      updateTrack(track.id, patch);
      setAddOpen(false);
      return;
    }
    toast("That connection isn't possible", { description: "Monitors and the reel are always fed from the master output." });
  };

  // ---- draw cables from real jack positions ----
  useLayoutEffect(() => {
    const draw = () => {
      const box = boxRef.current;
      if (!box) return;
      // Layout offsets (not screen rects) so cables stay correct inside the
      // rotated sideways-phone canvas and while the rack scrolls.
      const pos = (p: JackRef) => {
        const el = box.querySelector<HTMLElement>(`[data-jack="${CSS.escape(pkey(p))}"]`);
        if (!el) return null;
        let x = el.offsetWidth / 2, y = el.offsetHeight / 2;
        let n: HTMLElement | null = el;
        while (n && n !== box) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null; }
        if (n !== box) return null;
        return { x, y };
      };
      setLines(
        wires.flatMap((w) => {
          const a = pos(w.from), b = pos(w.to);
          if (!a || !b) return [];
          const sag = Math.max(a.y, b.y) + 26 + (wires.indexOf(w) % 7) * 9;
          return [{ id: w.id, color: w.color, selected: selectedWire === w.id, d: `M${a.x},${a.y} C${a.x},${sag} ${b.x},${sag} ${b.x},${b.y}` }];
        }),
      );
    };
    draw();
    const ro = new ResizeObserver(draw);
    if (boxRef.current) ro.observe(boxRef.current);
    const t = window.setTimeout(draw, 60);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, selectedWire]);

  const jack = (p: JackRef, out: boolean, text: string, disabled = false) => {
    const isPending = !!pending && pkey(pending) === pkey(p);
    return (
      <div className="flex flex-col items-center gap-0.5" key={pkey(p)}>
        <Button
          variant="ghost"
          size="icon"
          data-jack={pkey(p)}
          disabled={disabled}
          aria-label={`${text} ${out ? "output — pick to start a cable" : "input — connect a cable here"}`}
          aria-pressed={out ? isPending : undefined}
          onClick={() => (out ? setPending(isPending ? null : p) : connect(p))}
          className={`modular-jack ${out ? "is-out" : "is-in"} ${isPending ? "is-pending" : ""} ${!out && pending ? "is-target" : ""}`}
        />
        <span className="modular-jack-label">{text}</span>
      </div>
    );
  };

  const unit = (id: string, title: string, sub: string, jacks: React.ReactNode, dim = false) => (
    <div key={id} className={`studio-back-unit ${dim ? "opacity-45" : ""}`} data-device={id}>
      <div className="studio-back-unit-face">
        <span className="studio-back-unit-vent" aria-hidden="true" />
        <span className="studio-back-unit-title">{title}</span>
        <span className="studio-back-unit-sub">{sub}</span>
      </div>
      <div className="studio-back-jacks">{jacks}</div>
    </div>
  );

  const selected = wires.find((w) => w.id === selectedWire);
  const sources = tracks.flatMap(t => [
    { jack: trackOut(t), label: `${t.name} · Audio out`, track: t },
    ...(t.plugins ?? []).filter(p => !p.bypass).map(p => ({ jack: fxOut(p), label: `${t.name} · ${p.name} out`, track: t })),
  ]);
  const source = sources.find(s => pkey(s.jack) === sourceKey);
  const targets = source ? [
    ...(source.track.plugins ?? []).map(p => ({ jack: fxIn(p), label: `${p.name} · In` })),
    { jack: masterIn(source.track), label: `Mixer · ${source.track.name}` },
    ...SEND_BUSES.map(b => ({ jack: busIn(b), label: `${b.toUpperCase()} · Send in` })),
  ].filter(t => studioCablePatch(source.track, source.jack, t.jack) !== null) : [];
  const target = targets.find(t => pkey(t.jack) === targetKey);

  return (
    <div className="studio-back flex min-h-0 flex-1 flex-col">
      <div className="studio-back-toolbar flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 text-xs">
        <Cable className="size-4 text-primary" />
        <Button variant="secondary" size="sm" className="min-h-11" onClick={() => { setSourceKey(sources[0] ? pkey(sources[0].jack) : ""); setTargetKey(""); setAddOpen(true); }} disabled={!tracks.length}><Plus className="size-4" />Add cable</Button>
        <Button variant="outline" size="sm" className="min-h-11" aria-expanded={listOpen} onClick={() => setListOpen(o => !o)}><Cable className="size-4" />Cables ({wires.length})</Button>
        <span className="font-mono text-[11px] text-muted-foreground">
          {pending ? "CONNECT CABLE" : "STUDIO · REAR CONNECTIONS"}
        </span>
        <div className="studio-back-view-controls ml-auto gap-1">
          <Button size="sm" variant={overview ? "secondary" : "ghost"} className="h-8" aria-label="Fit rear studio setup" aria-pressed={overview} onClick={() => { setOverview(true); scrollRef.current?.scrollTo(0, 0); }}><Scan className="size-4" />Fit</Button>
          <Button size="sm" variant={!overview ? "secondary" : "ghost"} className="h-8" aria-label="View rear studio at full size" aria-pressed={!overview} onClick={() => setOverview(false)}><ZoomIn className="size-4" />100%</Button>
        </div>
        {pending && (
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setPending(null)}>
            CANCEL
          </Button>
        )}
        {selected && !selected.fixed && selected.unplug && (
          <Button
            size="sm"
            variant="secondary"
            className="min-h-11 gap-1.5"
            onClick={() => {
              selected.unplug?.();
              setSelectedWire(null);
            }}
          >
            <Unplug className="size-4" /> Remove cable
          </Button>
        )}
        {selected && (selected.fixed || !selected.unplug) && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground uppercase">{selected.label} — fixed wiring</span>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto">
          <DialogTitle>Add cable</DialogTitle>
          <DialogDescription>Channel inserts and sends · Monitor and recorder feeds are fixed.</DialogDescription>
          <label className="grid gap-2 text-sm">From
            <Select value={sourceKey} onValueChange={v => { setSourceKey(v); setTargetKey(""); }}><SelectTrigger aria-label="Cable output" className="min-h-11"><SelectValue placeholder="Choose output" /></SelectTrigger><SelectContent>{sources.map(s => <SelectItem key={pkey(s.jack)} value={pkey(s.jack)}>{s.label}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className="grid gap-2 text-sm">To
            <Select value={targetKey} onValueChange={setTargetKey}><SelectTrigger aria-label="Cable input" className="min-h-11"><SelectValue placeholder="Choose input" /></SelectTrigger><SelectContent>{targets.map(t => <SelectItem key={pkey(t.jack)} value={pkey(t.jack)}>{t.label}</SelectItem>)}</SelectContent></Select>
          </label>
          <Button className="min-h-11" disabled={!source || !target} onClick={() => { if (source && target) connect(target.jack, source.jack); }}><Plus className="size-4" />Connect cable</Button>
        </DialogContent>
      </Dialog>
      <div ref={scrollRef} className="studio-back-scroll min-h-0 flex-1 overflow-auto" tabIndex={0} aria-label="Studio rear room">
      <div className="studio-back-canvas" style={view.phone ? { width: view.width * view.scale, height: view.height * view.scale } : undefined}>
      <div ref={boxRef} className="studio-back-rack relative" style={view.phone ? { width: view.width, transform: `scale(${view.scale})`, transformOrigin: "top left" } : undefined} aria-label="Back of the studio rack — audio cable routing">
        <img src={roomImage} alt="" className="studio-back-room-image" />
        <div className="studio-room-brand font-display">SYNCLAB<span>STUDIO · BACK</span></div>
        <div className="studio-rear-desk">
          <div className="studio-rear-monitor">{unit("monitor-l", "MONITOR L", "LEFT · MASTER FEED", jack({ device: "monitor-l", port: "in" }, false, "LEFT IN", true))}<div className="studio-rear-speaker-stand" /></div>
          <div className="studio-rear-console studio-back-mixing">{unit("master", "MIXING DESK", `${tracks.length} CHANNEL INPUTS · MASTER OUTPUT`, <>{tracks.map(t => jack(masterIn(t), false, t.name))}{jack({ device: "master", port: "out" }, true, "MASTER OUT")}</>)}<div className="studio-table-top" /><div className="studio-desk-legs" /></div>
          <div className="studio-rear-monitor">{unit("monitor-r", "MONITOR R", "RIGHT · MASTER FEED", jack({ device: "monitor-r", port: "in" }, false, "RIGHT IN", true))}<div className="studio-rear-speaker-stand" /></div>
        </div>
        <div className="studio-rear-furniture">
          <div className="studio-rear-recorder studio-back-tape">{unit("reel", "REEL TO REEL", "RECORDER · MASTER FEED", jack({ device: "reel", port: "in" }, false, "REC IN", true))}</div>
          <svg viewBox="0 0 180 195" role="img" aria-label="Rear of studio chair" className="studio-chair"><path d="M90 124v40m0 0-54 20m54-20 54 20m-54-20-20 24m20-24 20 24" className="studio-stand" /><rect x="54" y="12" width="72" height="78" rx="16" className="studio-chair-cushion" /><path d="M90 90v19M42 83v30m96-30v30" className="studio-stand" /><path d="M45 101h90l12 23H33z" className="studio-chair-cushion" /></svg>
          <svg viewBox="0 0 200 195" role="img" aria-label="Studio headphones" className="studio-rear-headphones"><path d="M40 120v-20q0-60 60-60t60 60v20" className="studio-stand" /><rect x="22" y="112" width="36" height="56" rx="16" className="studio-chair-cushion" /><rect x="142" y="112" width="36" height="56" rx="16" className="studio-chair-cushion" /></svg>
        </div>
        <div className="studio-rear-floor">
          <div className="studio-rear-instruments">{tracks.map(track => <div key={track.id} className="studio-rear-instrument">{unit(`track:${track.id}`, track.name, track.kind === "drum" ? "DRUM MACHINE" : track.kind === "sampler" ? "SAMPLER" : track.kind === "audio" || track.kind === "ai-vocal" ? "MICROPHONE" : track.instrument ?? "SYNTH", jack(trackOut(track), true, "AUDIO OUT"))}<svg viewBox="0 0 280 82" aria-hidden="true" className="studio-rear-instrument-stand"><path d="M60 3 213 75M220 3 67 75M43 78h51m102 0h51" className="studio-stand" /></svg></div>)}</div>
        <section className="studio-back-column studio-back-effects" data-column="effects" aria-label="Effect rack">
          <header className="studio-back-column-header"><Cpu className="size-4 text-primary" /><h3>EFFECT RACK</h3><span>{tracks.reduce((n, t) => n + (t.plugins?.length ?? 0), 0)}</span></header>
          <div className="studio-back-column-body">
            {tracks.filter(t => t.plugins?.length).map(track => <div key={track.id} className="studio-back-effect-chain"><h4>{track.name}</h4>{(track.plugins ?? []).map(fx => unit(`fx:${fx.id}`, fx.name, fx.bypass ? "BYPASSED" : "INSERT EFFECT", <>{jack(fxIn(fx), false, "IN")}{jack(fxOut(fx), true, "OUT")}</>, fx.bypass))}</div>)}
            <h4 className="studio-back-send-label">SEND EFFECTS</h4>
            {SEND_BUSES.map(b => unit(`bus:${b}`, b.toUpperCase(), "SEND INPUT", jack(busIn(b), false, "IN")))}
          </div>
        </section>
        </div>

        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
          {lines.map((l) => (
            <g key={l.id}>
              <title>{wires.find(w => w.id === l.id)?.label}</title>
              <path d={l.d} className="modular-cable-shadow" />
              <path d={l.d} className={`modular-cable cable-${l.color} ${l.selected ? "is-selected" : ""}`} style={l.selected ? { strokeWidth: 6 } : undefined} />
              <path d={l.d} className="modular-cable-sheen" />
              <path d={l.d} className="studio-rear-cable-hit" onClick={() => setSelectedWire(selectedWire === l.id ? null : l.id)} />
            </g>
          ))}
        </svg>
      </div>
      </div>
      </div>

      {/* wire list — tap a wire to select it for unplugging */}
      <div className={`studio-back-cables max-h-36 shrink-0 overflow-auto border-t border-border bg-surface px-3 py-1.5 ${listOpen ? "" : "is-closed"}`} aria-label="Patched cables">
        <Button variant="ghost" size="sm" className="h-9 w-full justify-start px-1 text-xs font-bold" aria-expanded={listOpen} onClick={() => setListOpen((o) => !o)}>CABLES ({wires.length}) {listOpen ? "▾ HIDE" : "▸ SHOW LIST"}</Button>
        {listOpen && <div className="flex flex-wrap gap-1">
          {wires.map((w) => (
            <Button
              variant="ghost"
              key={w.id}
              aria-pressed={selectedWire === w.id}
              onClick={() => setSelectedWire(selectedWire === w.id ? null : w.id)}
              className={`modular-add ${selectedWire === w.id ? "is-on" : ""}`}
            >
              <span className={`modular-swatch small cable-${w.color}`} aria-hidden />
              {w.label}
            </Button>
          ))}
        </div>}
      </div>
    </div>
  );
}
