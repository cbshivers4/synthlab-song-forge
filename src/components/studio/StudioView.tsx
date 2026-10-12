import { useEffect, useRef } from "react";
import { Cpu, Music2, SlidersHorizontal, Speaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import type { Track } from "@/lib/synclab/types";
import { getEngine } from "@/lib/synclab/audio-engine";
import { Scope } from "./Scope";
import roomImage from "@/assets/studio-room.jpg";

function InstrumentDrawing({ track }: { track: Track }) {
  const pads = track.kind === "drum" || track.kind === "sampler";
  const audio = track.kind === "audio" || track.kind === "ai-vocal";
  return <svg viewBox="0 0 280 195" aria-hidden="true" className="studio-instrument-art">
    <path d="M60 108 213 188M220 108 67 188" className="studio-stand" />
    <path d="M43 190h51m102 0h51" className="studio-stand" />
    <path d="M18 29h244l10 85H8z" className="studio-hardware-face" />
    <path d="M8 114h264v12H8z" className="studio-hardware-edge" />
    <rect x="25" y="39" width="67" height="21" rx="2" className="studio-screen" />
    <path d="M30 50h8l3-6 5 13 5-9 5 4h29" className="studio-screen-line" />
    {Array.from({ length: 7 }, (_, i) => <g key={i}><circle cx={111 + i * 21} cy="48" r="6" className="studio-knob" /><path d={`M${111 + i * 21} 43v4`} className="studio-knob-mark" /></g>)}
    {pads ? Array.from({ length: 16 }, (_, i) => <rect key={i} x={27 + (i % 8) * 29} y={69 + Math.floor(i / 8) * 23} width="22" height="17" rx="2" className={i % 3 === 0 ? "studio-pad-lit" : "studio-pad"} />)
      : audio ? <g><rect x="25" y="72" width="227" height="30" className="studio-screen" /><text x="138" y="92" textAnchor="middle" className="studio-device-type">AUDIO CHANNEL</text></g>
      : <g>{Array.from({ length: 24 }, (_, i) => <rect key={i} x={22 + i * 10} y="69" width="9" height="39" className="studio-white-key" />)}{Array.from({ length: 23 }, (_, i) => [0, 1, 3, 4, 5].includes(i % 7) ? <rect key={i} x={28 + i * 10} y="69" width="6" height="23" className="studio-black-key" /> : null)}</g>}
  </svg>;
}

function MonitorDrawing() {
  return <svg viewBox="0 0 120 240" aria-hidden="true" className="h-full w-full">
    <rect x="18" y="5" width="84" height="127" rx="5" className="studio-hardware-face" />
    <circle cx="60" cy="35" r="13" className="studio-speaker-cone" />
    <circle cx="60" cy="85" r="33" className="studio-speaker-cone" />
    <circle cx="60" cy="85" r="21" className="studio-speaker-inner" />
    <circle cx="60" cy="85" r="10" className="studio-hardware-edge" />
    <circle cx="90" cy="121" r="2" className="studio-pad-lit" />
    <path d="M60 132v95M27 231h66" className="studio-stand" />
  </svg>;
}

/** One visual timer reads actual engine levels; no animation or simulated signal. */
function StudioMeters() {
  const root = useRef<HTMLDivElement>(null);
  const { tracks } = useStudio();
  const ids = useRef(tracks.map(t => t.id));
  ids.current = tracks.map(t => t.id);
  useEffect(() => {
    const draw = () => {
      const engine = getEngine();
      root.current?.querySelectorAll<HTMLElement>("[data-studio-meter]").forEach((node, i) => {
        const id = ids.current[i];
        const level = id ? engine.getTrackLevel(id) : 0;
        const fraction = Math.max(0, Math.min(1, (20 * Math.log10(Math.max(0.001, level)) + 60) / 60));
        node.style.transform = `scaleY(${fraction})`;
        node.dataset.peak = level >= 0.999 ? "clip" : level > 0.7 ? "hot" : "normal";
      });
    };
    draw();
    const timer = window.setInterval(draw, 50);
    return () => window.clearInterval(timer);
  }, []);
  return <div ref={root} className="studio-console-channels">{tracks.map(track => <div key={track.id} className="studio-console-channel" title={track.name}>
    <div className="studio-console-knob" />
    <div className="studio-console-meter"><i data-studio-meter /></div>
    <div className="studio-console-fader"><i style={{ bottom: `${Math.min(1, track.volume) * 75}%` }} /></div>
    <span className={track.muted ? "text-destructive" : "text-primary"}>{track.muted ? "M" : track.solo ? "S" : "•"}</span>
    <span className="truncate">{track.name}</span>
  </div>)}</div>;
}

export function StudioView() {
  const { tracks, selectedId, select, setPanel, fxChains } = useStudio();
  const inserts = tracks.flatMap(track => (track.plugins ?? []).map(plugin => ({ track, plugin })));
  const buses = Object.entries(fxChains).flatMap(([bus, plugins]) => plugins.map(plugin => ({ bus, plugin })));
  const open = (panel: PanelId, id?: string) => { if (id) select(id); setPanel(panel); };
  const instrumentPanel = (track: Track): PanelId => track.kind === "drum" ? "drums" : track.kind === "sampler" ? "sampler" : track.kind === "audio" || track.kind === "ai-vocal" ? "mixer" : "synth";
  return <div className="studio-visual flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-3 py-2 text-xs">
      <span className="font-display font-semibold">MY STUDIO</span>
      <span className="text-muted-foreground">{tracks.length} channels · {inserts.length + buses.length} effects</span>
      <div className="ml-auto flex gap-1"><Button variant="ghost" size="sm" onClick={() => open("mixer")}><SlidersHorizontal className="size-4" />Mixer</Button><Button variant="ghost" size="sm" onClick={() => open("plugins")}><Cpu className="size-4" />Effects</Button></div>
    </div>
    <div className="studio-room relative min-h-[540px] flex-1 overflow-auto">
      <img src={roomImage} width={1536} height={1024} alt="Graphite music studio with acoustic wall panels" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <div className="studio-room-content relative">
        <div className="studio-room-brand font-display">SYNCLAB<span>CREATE. RECORD. PRODUCE. FINISH.</span></div>
        <div className="studio-control-desk">
          <Button variant="ghost" className="studio-monitor" aria-label="Left studio monitor — open mastering" onClick={() => open("mastering")}><MonitorDrawing /><span>MONITOR L</span></Button>
          <div className="studio-desk-center">
            <div className="studio-console"><Button variant="ghost" className="h-8 w-full justify-between px-2 text-xs" onClick={() => open("mixer")}><SlidersHorizontal className="size-4" /> MIXING DESK <span>{tracks.length} CH</span></Button><StudioMeters /></div>
            <div className="studio-desk-legs" aria-hidden="true" />
          </div>
          <Button variant="ghost" className="studio-monitor" aria-label="Right studio monitor — open mastering" onClick={() => open("mastering")}><MonitorDrawing /><span>MONITOR R</span></Button>
        </div>
        <div className="studio-equipment-floor">
          <div className="studio-instruments">{tracks.map(track => <Button key={track.id} variant="ghost" aria-label={`Open ${track.name} ${track.kind === "audio" || track.kind === "ai-vocal" ? "channel" : "instrument"}`} aria-pressed={selectedId === track.id} className="studio-instrument" onClick={() => open(instrumentPanel(track), track.id)}>
            <span className="studio-instrument-label"><Music2 className="size-3" /><span>{track.name}</span></span>
            <InstrumentDrawing track={track} />
            <span className="studio-instrument-preset">{track.kind === "drum" ? "Drum Machine" : track.kind === "sampler" ? track.sampler?.name ?? "Sampler" : track.instrument ?? (track.kind === "audio" || track.kind === "ai-vocal" ? "Audio" : "Synth")}</span>
          </Button>)}{tracks.length === 0 && <div className="flex min-h-40 items-center justify-center text-sm text-foreground">No channels in this project</div>}</div>
          <div className="studio-rack-cabinet">
            <Button variant="ghost" className="h-9 w-full justify-start gap-2 text-xs" onClick={() => open("plugins")}><Cpu className="size-4" />EFFECTS RACK</Button>
            {inserts.map(({ track, plugin }) => <div key={plugin.id} className="studio-rack-unit"><Button variant="ghost" className="h-auto min-h-11 w-full flex-col items-start gap-1 whitespace-normal px-3 py-2 text-left" onClick={() => open("plugins", track.id)}><span className="text-[10px] text-muted-foreground">{track.name}</span><span className="text-xs font-semibold">{plugin.name}{plugin.bypass ? " · BYPASS" : ""}</span></Button><Scope scopeId={plugin.bypass ? `bypassed:${plugin.id}` : plugin.id} height={34} compact /></div>)}
            {buses.map(({ bus, plugin }) => <Button key={`${bus}:${plugin.id}`} variant="ghost" className="studio-rack-unit h-auto min-h-12 w-full flex-col items-start gap-1 whitespace-normal text-left" onClick={() => open("mixer")}><span className="text-[10px] text-muted-foreground">{bus.toUpperCase()}</span><span className="text-xs">{plugin.name}</span></Button>)}
            {inserts.length + buses.length === 0 && <div className="studio-rack-empty">EMPTY RACK</div>}
            <div className="studio-rack-vent" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2 border-t border-border bg-surface px-3 py-2 text-xs text-muted-foreground"><Speaker className="size-4" /><span>Stereo master output</span><span className="ml-auto">{tracks.filter(t => t.armed).length} armed</span></div>
  </div>;
}