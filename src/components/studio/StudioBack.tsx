import { useLayoutEffect, useRef, useState } from "react";
import { Cable, Unplug, SlidersHorizontal, Cpu, Drum, KeyboardMusic, Mic, Disc3, Speaker, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import type { PluginInstance, Track } from "@/lib/synclab/types";
import { toast } from "sonner";

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
  const boxRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ id: string; d: string; color: CableColor; selected: boolean }[]>([]);

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
    { id: "master>monitors", from: { device: "master", port: "out" }, to: { device: "monitors", port: "in" }, color: "blue", label: "Master → Studio monitors", fixed: true },
    { id: "master>reel", from: { device: "master", port: "out" }, to: { device: "reel", port: "in" }, color: "purple", label: "Master → Reel-to-reel input", fixed: true },
  );

  // ---- re-patch: turn a new connection into a real routing change ----
  const connect = (to: JackRef) => {
    const from = pending;
    setPending(null);
    if (!from || from.device === to.device) return;
    const fromTrack = from.device.startsWith("track:") ? from.device.slice(6) : null;
    const fromFx = from.device.startsWith("fx:") ? from.device.slice(3) : null;
    const track = tracks.find((t) => t.id === fromTrack) ?? tracks.find((t) => (t.plugins ?? []).some((p) => p.id === fromFx));
    if (!track) {
      toast("That connection isn't possible", { description: "Patch within one channel's chain, to the mixer, or to a send." });
      return;
    }

    if (to.device.startsWith("fx:")) {
      const fxId = to.device.slice(3);
      const list = track.plugins ?? [];
      const fx = list.find((p) => p.id === fxId);
      if (!fx) return;
      if (fx.bypass) togglePluginBypass(track.id, fx.id);
      // Move the effect to sit right after the source node in the chain, in one update.
      const ordered = [...list];
      const fromIdx = ordered.findIndex((p) => p.id === fxId);
      if (fromIdx >= 0) {
        const [item] = ordered.splice(fromIdx, 1);
        const anchor = fromFx ? ordered.findIndex((p) => p.id === fromFx) + 1 : 0;
        if (item) ordered.splice(anchor, 0, item);
        updateTrack(track.id, { plugins: ordered });
      }
      toast.success(`${fx.name} re-patched`, { description: `It now sits after ${fromFx ? "the previous effect" : track.name} in the chain.` });
      return;
    }
    if (to.device === "master") {
      // Patching straight to the mixer bypasses everything after the source.
      const list = track.plugins ?? [];
      const after = fromFx ? list.slice(list.findIndex((p) => p.id === fromFx) + 1) : list;
      after.filter((p) => !p.bypass).forEach((p) => togglePluginBypass(track.id, p.id));
      toast.success(`${track.name} patched straight to the mixer`, { description: after.length ? `${after.length} effect${after.length === 1 ? "" : "s"} bypassed.` : "No effects were in the way." });
      return;
    }
    if (to.device.startsWith("bus:")) {
      const bus = to.device.slice(4) as (typeof SEND_BUSES)[number];
      updateTrack(track.id, { sends: { reverb: 0, delay: 0, chorus: 0, ...track.sends, [bus]: 0.5 } });
      toast.success(`${track.name} → ${bus} send`, { description: "Send set to 50% — adjust it in the mixer." });
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
          const dx = Math.max(40, Math.abs(b.x - a.x) * 0.45);
          const sag = 18 + Math.abs(a.y - b.y) * 0.08;
          const dir = b.x >= a.x ? 1 : -1;
          return [{ id: w.id, color: w.color, selected: selectedWire === w.id, d: `M${a.x},${a.y} C${a.x + dx * dir},${a.y + sag} ${b.x - dx * dir},${b.y + sag} ${b.x},${b.y}` }];
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

  return (
    <div className="studio-back flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 text-xs">
        <Cable className="size-4 text-primary" />
        <span className="font-mono text-[11px] text-muted-foreground">
          {pending ? "Cable in hand — tap a glowing input jack to connect." : "Tap an output jack, then an input jack, to re-patch. Cables show the real signal path."}
        </span>
        {pending && (
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setPending(null)}>
            CANCEL
          </Button>
        )}
        {selected && !selected.fixed && selected.unplug && (
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto h-7 gap-1.5"
            onClick={() => {
              selected.unplug?.();
              setSelectedWire(null);
              toast.success(`Unplugged ${selected.label}`);
            }}
          >
            <Unplug className="size-3.5" /> UNPLUG {selected.label.toUpperCase()}
          </Button>
        )}
        {selected && (selected.fixed || !selected.unplug) && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground uppercase">{selected.label} — fixed wiring</span>
        )}
      </div>

      <div className="studio-back-scroll min-h-0 flex-1 overflow-auto" tabIndex={0} aria-label="Studio device columns">
      <div ref={boxRef} className="studio-back-rack relative" aria-label="Back of the studio rack — audio cable routing">
        <div className="studio-back-stage" data-stage="sources">
        {([
          { id: "synths", title: "SYNTHS", icon: KeyboardMusic, items: tracks.filter(t => t.kind !== "drum" && t.kind !== "sampler" && t.kind !== "audio" && t.kind !== "ai-vocal"), kind: "SYNTH" },
          { id: "drums", title: "DRUM MACHINES", icon: Drum, items: tracks.filter(t => t.kind === "drum"), kind: "DRUM MACHINE" },
          { id: "samplers", title: "SAMPLERS", icon: AudioLines, items: tracks.filter(t => t.kind === "sampler"), kind: "SAMPLER" },
          { id: "microphones", title: "MICROPHONES", icon: Mic, items: tracks.filter(t => t.kind === "audio" || t.kind === "ai-vocal"), kind: "AUDIO CHANNEL" },
        ]).map(({ id, title, icon: Icon, items, kind }) => (
          <section key={id} hidden={!items.length} className="studio-back-column" data-column={id} aria-label={title}>
            <header className="studio-back-column-header"><Icon className="size-4 text-primary" /><h3>{title}</h3><span>{items.length}</span></header>
            <div className="studio-back-column-body">
              {items.map(track => unit(`track:${track.id}`, track.name, kind, jack(trackOut(track), true, "AUDIO OUT")))}
              
            </div>
          </section>
        ))}
        </div>
        <div className="studio-back-stage" data-stage="effects">
        <section className="studio-back-column studio-back-effects" data-column="effects" aria-label="Effect rack">
          <header className="studio-back-column-header"><Cpu className="size-4 text-primary" /><h3>EFFECT RACK</h3><span>{tracks.reduce((n, t) => n + (t.plugins?.length ?? 0), 0)}</span></header>
          <div className="studio-back-column-body">
            {tracks.filter(t => t.plugins?.length).map(track => <div key={track.id} className="studio-back-effect-chain"><h4>{track.name}</h4>{(track.plugins ?? []).map(fx => unit(`fx:${fx.id}`, fx.name, fx.bypass ? "BYPASSED" : "INSERT EFFECT", <>{jack(fxIn(fx), false, "IN")}{jack(fxOut(fx), true, "OUT")}</>, fx.bypass))}</div>)}
            <h4 className="studio-back-send-label">SEND EFFECTS</h4>
            {SEND_BUSES.map(b => unit(`bus:${b}`, b.toUpperCase(), "SEND INPUT", jack(busIn(b), false, "IN")))}
          </div>
        </section>
        </div>
        <div className="studio-back-stage" data-stage="mix">
        <section className="studio-back-column studio-back-mixing" data-column="mixer" aria-label="Mixing desk">
          <header className="studio-back-column-header"><SlidersHorizontal className="size-4 text-primary" /><h3>MIXING DESK</h3><span>{tracks.length} CH</span></header>
          <div className="studio-back-column-body">
            {unit("master", "MIXING DESK", "CHANNEL INPUTS · MASTER OUTPUT", <>{tracks.map(t => jack(masterIn(t), false, t.name))}{jack({ device: "master", port: "out" }, true, "MASTER OUT")}</>)}
          </div>
        </section>
        </div>
        <div className="studio-back-stage" data-stage="outputs">
        <section className="studio-back-column studio-back-tape" data-column="reel" aria-label="Reel-to-reel recorder">
          <header className="studio-back-column-header"><Disc3 className="size-4 text-primary" /><h3>REEL TO REEL</h3><span>REC</span></header>
          <div className="studio-back-column-body">{unit("reel", "REEL TO REEL", "RECORDER · MASTER FEED", jack({ device: "reel", port: "in" }, false, "REC IN", true))}</div>
        </section>
        <section className="studio-back-column studio-back-monitors" data-column="monitors" aria-label="Studio monitors">
          <header className="studio-back-column-header"><Speaker className="size-4 text-primary" /><h3>STUDIO MONITORS</h3><span>L / R</span></header>
          <div className="studio-back-column-body">{unit("monitors", "STUDIO MONITORS", "STEREO · MASTER FEED", jack({ device: "monitors", port: "in" }, false, "IN", true))}</div>
        </section>
        </div>

        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
          {lines.map((l) => (
            <g key={l.id}>
              <path d={l.d} className="modular-cable-shadow" />
              <path d={l.d} className={`modular-cable cable-${l.color} ${l.selected ? "is-selected" : ""}`} style={l.selected ? { strokeWidth: 6 } : undefined} />
              <path d={l.d} className="modular-cable-sheen" />
            </g>
          ))}
        </svg>
      </div>
      </div>

      {/* wire list — tap a wire to select it for unplugging */}
      <div className="max-h-36 shrink-0 overflow-auto border-t border-border bg-surface px-3 py-1.5" aria-label="Patched cables">
        <Button variant="ghost" size="sm" className="h-9 w-full justify-start px-1 text-xs font-bold" aria-expanded={listOpen} onClick={() => setListOpen((o) => !o)}>CABLES ({wires.length}) {listOpen ? "▾ HIDE" : "▸ SHOW LIST"}</Button>
        <div className="flex flex-wrap gap-1" hidden={!listOpen}>
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
        </div>
      </div>
    </div>
  );
}
