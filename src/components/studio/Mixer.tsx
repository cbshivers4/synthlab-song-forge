import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Maximize2, Minimize2, Palette, Sliders, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStudio } from "@/lib/synclab/store";
import { MidiLearnStrip } from "./MidiLearn";
import { QuickNotes } from "@/components/studio/QuickNotes";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { BusStrip, ControlStrip } from "./mixer/BusStrips";
import { MasterStrip } from "./mixer/MasterStrip";
import { PhoneEqButton, PhoneFxMenu } from "./mixer/PhoneMixer";
import { Strip } from "./mixer/Strip";
import { AUX_IDS, BUS_STRIPS, CONSOLE_STYLES, type ConsoleStyle, type ConsoleStyleId, LabelRail, SOLID_PRESETS, VCA_IDS, accentInk, fracToDb, useMeters } from "./mixer/shared";

export function Mixer({ phonePage = 0, phoneChannels, phoneControlPage = "levels", desktopLayout = false }: { phonePage?: number; phoneChannels?: number; phoneControlPage?: "levels" | "performance"; desktopLayout?: boolean }) {
  const mobileDevice = useIsMobile();
  const isMobile = mobileDevice && !desktopLayout;
  const { tracks, selectedId, select, setPanel, buses, setBus, vcas, setVca, auxReturns, setAuxReturn, updateTrack, addTrack } = useStudio();
  const levels = useMeters(tracks);
  const [narrow, setNarrow] = useState(false);
  // Phone: shrink every strip uniformly so the whole mixer fits the screen without scrolling.
  const stripsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripsRef.current;
    if (!el || !el.closest(".phone-console")) return;
    el.dataset.phoneFit = "true";
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--mx-fit", "1");
        const kids = Array.from(el.children) as HTMLElement[];
        const h = Math.max(1, ...kids.map((k) => k.scrollHeight));
        const w = kids.reduce((sum, k) => sum + k.offsetWidth, 0) || 1;
        const z = Math.max(0.3, Math.min(1, (el.clientHeight - 2) / h, (el.clientWidth - 2) / w));
        el.style.setProperty("--mx-fit", z.toFixed(3));
      });
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    const mo = new MutationObserver(fit); mo.observe(el, { childList: true });
    return () => { cancelAnimationFrame(frame); ro.disconnect(); mo.disconnect(); };
  }, []);
  // Timeline tracks are always mirrored in the mixer. Extra routing strips open on request.
  const [showBuses, setShowBuses] = useState(false);
  const [showVcas, setShowVcas] = useState(false);
  const [showAux, setShowAux] = useState(false);
  // How many bus / VCA / aux strips to show. Bus 0 = auto (only buses in use).
  const [counts, setCounts] = useState<{ bus: number; vca: number; aux: number }>({ bus: 0, vca: VCA_IDS.length, aux: AUX_IDS.length });
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("synclab.mixer.counts");
      if (raw) {
        const c = JSON.parse(raw);
        setCounts({
          bus: Math.min(BUS_STRIPS.length, Math.max(0, Number(c.bus) || 0)),
          vca: Math.min(VCA_IDS.length, Math.max(0, Number(c.vca ?? VCA_IDS.length))),
          aux: Math.min(AUX_IDS.length, Math.max(0, Number(c.aux ?? AUX_IDS.length))),
        });
      }
    } catch { /* ignore */ }
  }, []);
  const setCount = (k: "bus" | "vca" | "aux", v: number) => {
    setCounts((prev) => {
      const next = { ...prev, [k]: v };
      try { window.localStorage.setItem("synclab.mixer.counts", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const [styleId, setStyleId] = useState<ConsoleStyleId>(() => {
    if (typeof window === "undefined") return "studiopro";
    const saved = window.localStorage.getItem("synclab.mixer.style") as ConsoleStyleId | null;
    return CONSOLE_STYLES.some((s) => s.id === saved) ? (saved as ConsoleStyleId) : "studiopro";
  });
  const [solid, setSolid] = useState<string>(() => {
    if (typeof window === "undefined") return "#1a1b1e";
    return window.localStorage.getItem("synclab.mixer.solid") ?? "#1a1b1e";
  });
  useEffect(() => {
    window.localStorage.setItem("synclab.mixer.solid", solid);
  }, [solid]);
  const desk = CONSOLE_STYLES.find((s) => s.id === styleId) ?? (CONSOLE_STYLES[0] as ConsoleStyle);
  useEffect(() => {
    window.localStorage.setItem("synclab.mixer.style", styleId);
  }, [styleId]);
  // The Solid Colour desk paints its single picked colour across the whole panel.
  const deskColors =
    desk.id === "solid" ? { a: solid, b: solid, c: solid } : { a: desk.a, b: desk.b, c: desk.c };
  const soloed = tracks.some((t) => t.solo);
  const muted = tracks.some((t) => t.muted);
  // Only show bus strips that actually have channels routed to them.
  const activeBuses = BUS_STRIPS.filter((id) => tracks.some((t) => t.bus === id));
  return (
    <div
      className={cn("mx-console flex flex-col overflow-hidden border border-border bg-surface shadow-panel", isMobile && "mx-phone", mobileDevice && "mx-phone-master")}
      data-console={desk.id}
      data-touch-console={mobileDevice ? "true" : undefined}
      data-phone-controls={phoneControlPage}
      style={
        {
          "--mx-a": deskColors.a,
          "--mx-b": deskColors.b,
          "--mx-c": deskColors.c,
          "--mx-accent": desk.accent,
          "--mx-screw-display": desk.screws ? "inline-block" : "none",
          // Highlight colours inside the console follow the desk accent, not the app blue.
          "--primary": desk.accent,
          "--primary-foreground": accentInk(desk.accent),
          "--ring": desk.accent,
        } as CSSProperties
      }
    >
      {/* console toolbar */}
      <div className="mx-console-toolbar flex min-h-10 items-center gap-3 overflow-x-auto border-b border-border px-3 py-2">
        {mobileDevice && (() => { const st = tracks.find((x) => x.id === selectedId); return st ? <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="shrink-0" aria-label="Mixer MIDI Learn">MIDI Learn</Button></PopoverTrigger><PopoverContent className="w-[min(88vw,520px)]"><MidiLearnStrip id={st.id} label={`${st.name} channel — move a knob/fader after tapping`} /></PopoverContent></Popover> : null; })()}
        {isMobile ? (
          <>
            <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">Mixer</span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button variant="secondary" size="sm" className="shrink-0" aria-label="Toggle full screen mixer" onClick={() => window.dispatchEvent(new CustomEvent("synclab:mixer-full"))}>Full screen</Button>
              <QuickNotes label />
              <PhoneFxMenu />
              <PhoneEqButton />
            </div>
          </>
        ) : (
          <>
        <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">Mix Console</span>

        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {tracks.length} ch · {activeBuses.length} buses
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {mobileDevice && <Button variant="secondary" size="sm" className="shrink-0" aria-label="Toggle full screen mixer" onClick={() => window.dispatchEvent(new CustomEvent("synclab:mixer-full"))}>Full screen</Button>}
          <QuickNotes label />
          <Popover>
            <PopoverTrigger asChild>
              <button title="Choose how many bus, VCA and aux channels to show" className="flex h-6 items-center gap-1 rounded-sm bg-surface px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Channels
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
              <div className="mb-2 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">Channel count</div>
              {([
                ["bus", "Buses", BUS_STRIPS.length],
                ["vca", "VCA groups", VCA_IDS.length],
                ["aux", "Aux returns", AUX_IDS.length],
              ] as const).map(([k, label, max]) => (
                <div key={k} className="mb-2">
                  <div className="mb-1 text-[11px] text-foreground">{label}</div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: max + 1 }, (_, n) => (
                      <button
                        key={n}
                        onClick={() => setCount(k, n)}
                        className={cn("h-7 min-w-7 rounded-sm border px-1.5 font-mono text-[10px]", counts[k] === n ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                      >
                        {k === "bus" && n === 0 ? "Auto" : n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[10px] leading-snug text-muted-foreground">Up to {BUS_STRIPS.length} buses, {VCA_IDS.length} VCAs and {AUX_IDS.length} aux returns are available. Auto shows only buses that have tracks.</p>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button
                title="Choose console"
                className="flex h-6 items-center gap-1 rounded-sm bg-surface px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <span className="size-2.5 rounded-[2px] border border-black/60" style={{ background: desk.accent }} />
                {desk.name}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1">
              <div className="px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
                Console desk
              </div>
              {CONSOLE_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyleId(s.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-surface-2",
                    s.id === styleId && "bg-surface-2"
                  )}
                >
                  <span
                    className="h-7 w-5 shrink-0 rounded-[2px] border border-black/60"
                    style={{
                      background: s.id === "solid" ? solid : `linear-gradient(180deg, ${s.a}, ${s.b} 45%, ${s.c})`,
                      boxShadow: `inset 0 2px 0 0 ${s.accent}`,
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-foreground">{s.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{s.desc}</span>
                  </span>
                </button>
              ))}
              {styleId === "solid" && (
                <div className="mt-1 border-t border-border px-2 pb-2 pt-2">
                  <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
                    Solid colour
                  </div>
                  <div className="mt-1.5 grid grid-cols-8 gap-1">
                    {SOLID_PRESETS.map((p) => (
                      <button
                        key={p.hex}
                        title={p.name}
                        aria-label={`${p.name} solid colour`}
                        onClick={() => setSolid(p.hex)}
                        className={cn(
                          "h-6 w-full rounded-[3px] border transition-transform hover:scale-105",
                          solid.toLowerCase() === p.hex ? "border-primary ring-1 ring-primary" : "border-black/60"
                        )}
                        style={{ background: p.hex }}
                      />
                    ))}
                  </div>
                  <label className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Custom</span>
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(solid) ? solid : "#1a1b1e"}
                      onChange={(e) => setSolid(e.target.value)}
                      title="Pick any solid colour"
                      aria-label="Custom mixer colour"
                      className="h-7 w-full cursor-pointer rounded-[3px] border border-border bg-surface p-0.5"
                    />
                  </label>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <button
            onClick={() => tracks.forEach((t) => t.solo && updateTrack(t.id, { solo: false }))}
            disabled={!soloed}
            className={cn(
              "flex h-6 items-center gap-1 rounded-sm px-2 font-mono text-[9px] uppercase tracking-wider transition-colors",
              soloed ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-surface text-muted-foreground opacity-60"
            )}
          >
            Clear solo
          </button>
          <button
            onClick={() => tracks.forEach((t) => t.muted && updateTrack(t.id, { muted: false }))}
            disabled={!muted}
            className={cn(
              "flex h-6 items-center gap-1 rounded-sm px-2 font-mono text-[9px] uppercase tracking-wider transition-colors",
              muted ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-surface text-muted-foreground opacity-60"
            )}
          >
            <VolumeX className="size-3" /> Unmute all
          </button>
          <button
            onClick={() => setShowBuses((v) => !v)}
            className={cn(
              "h-6 rounded-sm px-2 font-mono text-[9px] uppercase tracking-wider transition-colors",
              showBuses ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            Buses
          </button>
          <Button variant={showVcas ? "secondary" : "ghost"} size="sm" className="h-7 text-[10px]" onClick={() => setShowVcas((v) => !v)} aria-pressed={showVcas}>VCA</Button>
          <Button variant={showAux ? "secondary" : "ghost"} size="sm" className="h-7 text-[10px]" onClick={() => setShowAux((v) => !v)} aria-pressed={showAux}>Aux</Button>
          <button
            onClick={() => setNarrow((v) => !v)}
            title={narrow ? "Wide strips" : "Narrow strips"}
            className="flex h-6 items-center gap-1 rounded-sm bg-surface px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {narrow ? <Maximize2 className="size-3" /> : <Minimize2 className="size-3" />}
            {narrow ? "Wide" : "Narrow"}
          </button>
        <span className="flex h-6 items-center gap-1 rounded-sm bg-surface px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            <Palette className="size-3" /> Out {fracToDb(levels.master).toFixed(0)} dB
          </span>
        </div>
          </>
        )}
      </div>

      {!mobileDevice && (() => { const st = tracks.find((x) => x.id === selectedId); return st ? <div className="px-2 py-1"><MidiLearnStrip id={st.id} label={`${st.name} channel — move a knob/fader after tapping`} /></div> : null; })()}
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <Sliders className="size-7 text-muted-foreground/60" />
          <div className="font-display text-[12px] font-bold uppercase tracking-widest text-foreground">
            Console empty
          </div>
          <p className="max-w-sm font-mono text-[10px] uppercase leading-relaxed tracking-wider text-muted-foreground">
            Channels appear here as soon as you add tracks. Drag a tool from the left rail onto the timeline, or start
            with one below.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
            {(
              [
                ["audio", "Audio"],
                ["midi", "MIDI"],
                ["instrument", "Synth"],
                ["drum", "Drums"],
                ["sampler", "Sampler"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                onClick={() => addTrack(kind, label.toUpperCase())}
                className="h-7 rounded-sm border border-border bg-surface-2 px-3 font-mono text-[9px] uppercase tracking-wider text-foreground transition-colors hover:border-primary/60 hover:text-primary"
              >
                + {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={stripsRef} className="mobile-mixer-strips flex overflow-x-auto" role="region" aria-label="Mixer channels" tabIndex={0}>
          {!isMobile && <LabelRail />}
          {(isMobile && phoneChannels != null ? tracks.slice(phonePage * phoneChannels, (phonePage + 1) * phoneChannels) : tracks).map((t) => (
            <Strip
              key={t.id}
              t={t}
              index={tracks.indexOf(t)}
              narrow={isMobile || narrow}
              level={t.muted ? 0 : (levels.tracks[t.id] ?? 0)}
              selected={t.id === selectedId}
              onSelect={() => { select(t.id); setPanel("mixer"); }}
            />
          ))}
          {showBuses &&
            (counts.bus === 0 ? activeBuses : BUS_STRIPS.slice(0, counts.bus)).map((id) => (
              <BusStrip key={id} id={id} state={buses[id]} level={levels.buses[id] ?? 0} onChange={(p) => setBus(id, p)} />
            ))}
          {showVcas && VCA_IDS.slice(0, counts.vca).map((id) => (
            <ControlStrip key={`vca-${id}`} kind="VCA" name={id} state={vcas[id]} level={levels.vcas[id] ?? 0} memberCount={tracks.filter((t) => t.vca === id).length} onChange={(patch) => setVca(id, patch)} />
          ))}
          {showAux && AUX_IDS.slice(0, counts.aux).map((id) => (
            <ControlStrip key={`aux-${id}`} kind="AUX" name={id} state={auxReturns[id]} level={levels.aux[id] ?? 0} onChange={(patch) => setAuxReturn(id, patch)} />
          ))}
          <div className={cn("mx-output-dock bg-surface", !isMobile && "sticky right-0 z-10")}>
            <MasterStrip level={levels.master} />
          </div>
        </div>
      )}
    </div>
  );
}
