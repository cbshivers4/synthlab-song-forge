import { useEffect, useRef, useState } from "react";
import { editorPanelFor } from "@/lib/synclab/track-editor";
import { Cpu, FlipHorizontal2, Music2, SlidersHorizontal, Speaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import type { Track } from "@/lib/synclab/types";
import { getEngine } from "@/lib/synclab/audio-engine";
import { Scope } from "./Scope";
import { StudioBack } from "./StudioBack";
import roomImage from "@/assets/studio-room.jpg";

function InstrumentDrawing({ track }: { track: Track }) {
  const pads = track.kind === "drum" || track.kind === "sampler";
  const audio = track.kind === "audio" || track.kind === "ai-vocal";
  if (audio) return <svg viewBox="0 0 280 195" aria-hidden="true" className="studio-instrument-art" data-studio-microphone>
    <path d="M140 78v96m0-42-62 55m62-55 62 55m-62-13v17" className="studio-stand" />
    <path d="M121 58v9q0 20 19 20t19-20v-9" className="studio-stand" />
    <rect x="128" y="14" width="24" height="59" rx="12" className="studio-hardware-face" />
    {[24, 32, 40, 48, 56].map(y => <path key={y} d={`M132 ${y}h16`} className="studio-knob-mark" />)}
    <path d="M158 74q22 30 13 61t23 47h35" className="studio-mic-cable" />
  </svg>;
  return <svg viewBox="0 0 280 195" aria-hidden="true" className="studio-instrument-art">
    <path d="M60 108 213 188M220 108 67 188" className="studio-stand" />
    <path d="M43 190h51m102 0h51" className="studio-stand" />
    <path d="M18 29h244l10 85H8z" className="studio-hardware-face" />
    <path d="M8 114h264v12H8z" className="studio-hardware-edge" />
    <rect x="25" y="39" width="67" height="21" rx="2" className="studio-screen" />
    <text x="58" y="53" textAnchor="middle" className="studio-device-type">{pads ? "PADS" : audio ? "AUDIO" : "SYNTH"}</text>
    {Array.from({ length: 7 }, (_, i) => <g key={i}><circle cx={111 + i * 21} cy="48" r="6" className="studio-knob" /><path d={`M${111 + i * 21} 43v4`} className="studio-knob-mark" /></g>)}
    {pads ? Array.from({ length: 16 }, (_, i) => <rect key={i} x={27 + (i % 8) * 29} y={69 + Math.floor(i / 8) * 23} width="22" height="17" rx="2" className={i % 3 === 0 ? "studio-pad-lit" : "studio-pad"} />)
      : audio ? <g><rect x="25" y="72" width="227" height="30" className="studio-screen" /><text x="138" y="92" textAnchor="middle" className="studio-device-type">AUDIO CHANNEL</text></g>
      : <g>{Array.from({ length: 24 }, (_, i) => <rect key={i} x={22 + i * 10} y="69" width="9" height="39" className="studio-white-key" />)}{Array.from({ length: 23 }, (_, i) => [0, 1, 3, 4, 5].includes(i % 7) ? <rect key={i} x={28 + i * 10} y="69" width="6" height="23" className="studio-black-key" /> : null)}</g>}
  </svg>;
}

function EmptyStand() {
  return <svg viewBox="0 0 280 195" aria-hidden="true" className="studio-instrument-art" data-studio-empty-stand>
    <path d="M60 64 213 185M220 64 67 185M38 61h52m103 0h52M43 190h51m102 0h51" className="studio-stand" />
    <circle cx="140" cy="127" r="8" className="studio-hardware-face" />
  </svg>;
}

function ChairDrawing() {
  return <svg viewBox="0 0 180 195" role="img" aria-label="Studio chair" className="studio-chair" data-studio-chair>
    <path d="M90 124v40m0 0-54 20m54-20 54 20m-54-20-20 24m20-24 20 24" className="studio-stand" />
    <rect x="54" y="12" width="72" height="78" rx="16" className="studio-chair-cushion" />
    <path d="M64 49h52M67 63h46" className="studio-knob-mark" />
    <path d="M90 90v19M42 83v30m96-30v30" className="studio-stand" />
    <path d="M45 101h90l12 23H33z" className="studio-chair-cushion" />
    {[36, 70, 110, 144].map(x => <circle key={x} cx={x} cy="186" r="5" className="studio-speaker-cone" />)}
  </svg>;
}

function RecorderDrawing() {
  return <svg viewBox="0 0 240 195" aria-hidden="true" className="studio-instrument-art" data-studio-recorder>
    <path d="M37 154v32m166-32v32" className="studio-stand" />
    <rect x="18" y="18" width="204" height="145" rx="5" className="studio-hardware-face" />
    {[70, 170].map(x => <g key={x}><circle cx={x} cy="63" r="39" className="studio-speaker-cone" /><circle cx={x} cy="63" r="34" className="reel-rim" />{[0, 120, 240].map(angle => <ellipse key={angle} cx={x} cy="42" rx="9" ry="12" transform={`rotate(${angle} ${x} 63)`} className="reel-cutout" />)}<circle cx={x} cy="63" r="7" className="reel-center" /></g>)}
    <path d="M70 102 100 116h40l30-14" className="studio-mic-cable" />
    {[49, 137].map(x => <g key={x}><rect x={x} y="127" width="54" height="22" rx="2" className="studio-recorder-meter" /><path d={`M${x + 27} 147l-12-14`} className="studio-recorder-needle" /></g>)}
  </svg>;
}

function MonitorDrawing() {
  return <svg viewBox="0 0 120 240" aria-hidden="true" className="!size-full shrink-0">
    <rect x="18" y="5" width="84" height="127" rx="5" className="studio-hardware-face" />
    <circle cx="60" cy="35" r="13" className="studio-speaker-cone" data-studio-tweeter />
    <circle cx="60" cy="85" r="33" className="studio-speaker-cone" data-studio-woofer />
    <circle cx="60" cy="85" r="21" className="studio-speaker-inner" data-studio-woofer />
    <circle cx="60" cy="85" r="10" className="studio-hardware-edge" />
    <circle cx="90" cy="121" r="2" className="studio-pad-lit" />
    <path d="M60 132v95M27 231h66" className="studio-stand" />
  </svg>;
}

function HeadphonesDrawing() {
  return <svg viewBox="0 0 200 195" role="img" aria-label="Studio headphones" className="studio-instrument-art" data-studio-headphones>
    <path d="M40 120v-20q0-60 60-60t60 60v20" fill="none" className="studio-stand" strokeWidth="10" />
    <path d="M40 120v-20q0-60 60-60t60 60v20" fill="none" className="studio-hardware-edge" strokeWidth="4" />
    <rect x="22" y="112" width="36" height="56" rx="16" className="studio-hardware-face" />
    <rect x="142" y="112" width="36" height="56" rx="16" className="studio-hardware-face" />
    <circle cx="40" cy="140" r="11" className="studio-speaker-cone" data-studio-woofer />
    <circle cx="160" cy="140" r="11" className="studio-speaker-cone" data-studio-woofer />
    <circle cx="40" cy="140" r="5" className="studio-speaker-inner" data-studio-tweeter />
    <circle cx="160" cy="140" r="5" className="studio-speaker-inner" data-studio-tweeter />
    <path d="M160 168q14 16 8 27h18" className="studio-mic-cable" />
  </svg>;
}

/** Drives monitor tweeters/woofers and headphone cups from the real post-master signal. */
function StudioSpeakerDrive({ root }: { root: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    let smooth = 0;
    const draw = () => {
      const data = getEngine().getScopeWave("master");
      let peak = 0;
      if (data) for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i] ?? 0); if (v > peak) peak = v; }
      smooth = Math.max(peak, smooth * 0.82);
      const woofer = 1 + Math.min(0.22, smooth * 0.28);
      const tweeter = 1 + Math.min(0.1, smooth * 0.14);
      root.current?.querySelectorAll<HTMLElement>("[data-studio-woofer]").forEach((node) => { node.style.transform = `scale(${woofer})`; });
      root.current?.querySelectorAll<HTMLElement>("[data-studio-tweeter]").forEach((node) => { node.style.transform = `scale(${tweeter})`; });
    };
    draw();
    const timer = window.setInterval(draw, 50);
    return () => window.clearInterval(timer);
  }, [root]);
  return null;
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
        node.dataset["peak"] = level >= 0.999 ? "clip" : level > 0.7 ? "hot" : "normal";
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
  const [back, setBack] = useState(false);
  const roomRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const inserts = tracks.flatMap(track => (track.plugins ?? []).map(plugin => ({ track, plugin })));
  const buses = Object.entries(fxChains).flatMap(([bus, plugins]) => plugins.map(plugin => ({ bus, plugin })));
  // The room must be seen whole: when it is shorter than the equipment layout,
  // scale the whole layout down uniformly instead of hiding stands below a scrollbar.
  useEffect(() => {
    if (back) return;
    const room = roomRef.current, content = contentRef.current;
    if (!room || !content) return;
    const measure = () => {
      const avail = room.clientHeight, natural = content.offsetHeight;
      if (!avail || !natural) return;
      const ratio = avail / natural;
      const next = ratio >= 0.97 ? 1 : ratio >= 0.6 ? ratio : 1;
      setFit((prev) => (Math.abs(prev - next) < 0.004 ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(room); ro.observe(content);
    return () => ro.disconnect();
  }, [back, tracks.length, inserts.length + buses.length]);
  const open = (panel: PanelId, id?: string) => { if (id) select(id); setPanel(panel); };
  const instrumentPanel = (track: Track): PanelId => track.kind === "audio" || track.kind === "ai-vocal" ? "mixer" : editorPanelFor(track) ?? "synth";
  return <div className="studio-visual flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-3 py-2 text-xs">
      <span className="font-display font-semibold">MY STUDIO</span>
      <span className="text-muted-foreground"><Speaker className="mr-1 inline size-3 align-[-2px]" />{tracks.length} channels · {inserts.length + buses.length} effects · {tracks.filter(t => t.armed).length} armed · stereo master</span>
      <div className="ml-auto flex gap-1">
        <Button variant={back ? "secondary" : "ghost"} size="sm" aria-pressed={back} onClick={() => setBack(!back)}><FlipHorizontal2 className="size-4" />{back ? "Front" : "Back · Cables"}</Button>
        <Button variant="ghost" size="sm" onClick={() => open("mixer")}><SlidersHorizontal className="size-4" />Mixer</Button>
        <Button variant="ghost" size="sm" onClick={() => open("plugins")}><Cpu className="size-4" />Effects</Button>
      </div>
    </div>
    {back ? <StudioBack /> : <>
    <StudioSpeakerDrive root={roomRef} />
    <div ref={roomRef} className="studio-room relative min-h-[540px] flex-1 overflow-auto" data-studio-fit={fit < 1 ? "true" : undefined}>
      <img src={roomImage} width={1536} height={1024} alt="Graphite music studio with acoustic wall panels" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      <div ref={contentRef} className="studio-room-content relative" style={fit < 1 ? { transform: `scale(${fit})`, transformOrigin: "top center" } : undefined}>
        <div className="studio-room-brand font-display">SYNCLAB<span>CREATE. RECORD. PRODUCE. FINISH.</span></div>
        <div className="studio-control-desk">
          <Button variant="ghost" className="studio-monitor" aria-label="Left studio monitor — open mastering" onClick={() => open("mastering")}><MonitorDrawing /><span>MONITOR L</span></Button>
          <div className="studio-desk-center">
            <div className="studio-console"><Button variant="ghost" className="h-8 w-full justify-between px-2 text-xs" onClick={() => open("mixer")}><SlidersHorizontal className="size-4" /> MIXING DESK <span>{tracks.length} CH</span></Button><StudioMeters /></div>
            <div className="studio-table-top" role="img" aria-label="Mixer table" />
            <div className="studio-desk-legs" aria-hidden="true" />
          </div>
          <Button variant="ghost" className="studio-monitor" aria-label="Right studio monitor — open mastering" onClick={() => open("mastering")}><MonitorDrawing /><span>MONITOR R</span></Button>
        </div>
        <div className="studio-default-equipment">
          <Button variant="ghost" className="studio-recorder studio-instrument" aria-label="Open reel-to-reel recorder" onClick={() => open("reel-recorder")}><RecorderDrawing /><span className="studio-instrument-preset">REEL TO REEL</span></Button>
          <ChairDrawing />
          <div className="studio-instrument" role="img" aria-label="Studio headphones"><HeadphonesDrawing /><span className="studio-instrument-preset">HEADPHONES</span></div>
        </div>
        <div className="studio-equipment-floor">
          <div className="studio-instruments">{tracks.map(track => <Button key={track.id} variant="ghost" aria-label={`Open ${track.name} ${track.kind === "audio" || track.kind === "ai-vocal" ? "channel" : "instrument"}`} aria-pressed={selectedId === track.id} className="studio-instrument" onClick={() => open(instrumentPanel(track), track.id)}>
            <span className="studio-instrument-label"><Music2 className="size-3" /><span>{track.name}</span></span>
            <InstrumentDrawing track={track} />
            <span className="studio-instrument-preset">{track.kind === "audio" || track.kind === "ai-vocal" ? "Microphone" : track.kind === "drum" ? "Drum Machine" : track.kind === "sampler" ? track.sampler?.name ?? "Sampler" : track.instrument ?? track.patch?.name ?? "Synth"}</span>
          </Button>)}{!tracks.some(track => track.kind !== "audio" && track.kind !== "ai-vocal") && <div className="studio-instrument" role="img" aria-label="Empty keyboard stand"><EmptyStand /><span className="studio-instrument-preset">KEYBOARD STAND</span></div>}</div>
          {inserts.length + buses.length > 0 && <div className="studio-rack-cabinet">
            <Button variant="ghost" className="h-9 w-full justify-start gap-2 text-xs" onClick={() => open("plugins")}><Cpu className="size-4" />EFFECTS RACK</Button>
            {inserts.map(({ track, plugin }) => <div key={plugin.id} className="studio-rack-unit"><Button variant="ghost" className="h-auto min-h-11 w-full flex-col items-start gap-1 whitespace-normal px-3 py-2 text-left" onClick={() => open("plugins", track.id)}><span className="text-[10px] text-muted-foreground">{track.name}</span><span className="text-xs font-semibold">{plugin.name}{plugin.bypass ? " · BYPASS" : ""}</span></Button><Scope scopeId={plugin.bypass ? `bypassed:${plugin.id}` : plugin.id} height={34} compact /></div>)}
            {buses.map(({ bus, plugin }) => <Button key={`${bus}:${plugin.id}`} variant="ghost" className="studio-rack-unit h-auto min-h-12 w-full flex-col items-start gap-1 whitespace-normal text-left" onClick={() => open("mixer")}><span className="text-[10px] text-muted-foreground">{bus.toUpperCase()}</span><span className="text-xs">{plugin.name}</span></Button>)}
            {inserts.length + buses.length === 0 && <div className="studio-rack-empty">EMPTY RACK</div>}
            <div className="studio-rack-vent" aria-hidden="true" />
          </div>}
        </div>
      </div>
    </div>
    </>}
  </div>;
}