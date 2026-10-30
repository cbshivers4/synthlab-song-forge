import { type CSSProperties } from "react";
import { Settings2, Waves } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { TrackIcon } from "@/components/studio/TrackStyle";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
import type { Track } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { clearClip } from "@/lib/synclab/clip-monitor";
import { Scope } from "../Scope";
import { ChannelEq } from "./ChannelEq";
import { InsertRack } from "./InsertRack";
import { MasterStrip } from "./MasterStrip";
import { ClipLed, FADER_CAP, Meter, toDb } from "./shared";

/** Phone mixer: add effects to the selected channel from one menu. */
export function PhoneFxMenu() {
  const { tracks, selectedId, addPlugin, removePlugin, togglePluginBypass, setPluginParam } = useStudio();
  const track = tracks.find((t) => t.id === selectedId);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!track}
          title={track ? `Add effects to ${track.name}` : "Select a channel first"}
          className="flex h-9 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 font-mono text-[10px] uppercase tracking-wider text-foreground hover:text-primary disabled:opacity-40"
        >
          <Settings2 className="size-4" /> Add effects
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[70vh] w-[min(92vw,360px)] overflow-y-auto p-3"
        onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) e.preventDefault(); }}
      >
        {track ? (
          <InsertRack
            title={`${track.name} — inserts`}
            midiId={track.id}
            list={track.plugins ?? []}
            onAdd={(def) => addPlugin(track.id, def)}
            onRemove={(id) => removePlugin(track.id, id)}
            onBypass={(id) => togglePluginBypass(track.id, id)}
            onParam={(id, p, v) => setPluginParam(track.id, id, p, v)}
          />
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tap a channel first, then add effects here.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Phone mixer: one-tap 3-band EQ on the selected channel. */
export function PhoneEqButton() {
  const { tracks, selectedId, addPlugin, installedPlugins } = useStudio();
  const track = tracks.find((t) => t.id === selectedId);
  const eq = track?.plugins?.find((p) => p.kind === "eq");
  const addEq = () => {
    if (!track) return;
    const def = installedPlugins.find((d) => d.kind === "eq") ?? BUILT_IN_PLUGINS.find((d) => d.kind === "eq");
    if (def) addPlugin(track.id, def);
  };
  return (
    <button
      type="button"
      onClick={addEq}
      disabled={!track || !!eq}
      title={!track ? "Select a channel first" : eq ? `${track.name} already has a Channel EQ` : `Add a 3-band EQ to ${track.name}`}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-sm border px-3 font-mono text-[10px] uppercase tracking-wider disabled:opacity-40",
        eq ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-surface text-foreground hover:text-primary"
      )}
    >
      {eq ? "EQ on" : "+ EQ"}
    </button>
  );
}

function PhoneChannel({ track, level, selected, index }: { track?: Track; level: number; selected: boolean; index: number }) {
  const { updateTrack, buses, setBus, transport, setTransport, select, setPanel } = useStudio();
  const name = track?.name ?? "MASTER";
  const volume = track?.volume ?? buses.master.volume;
  const choose = () => { if (track) { select(track.id); setPanel("mixer"); } };
  const channelColor = track?.color;
  return <section aria-label={`${name} mixer channel`} style={{ "--mixer-channel-color": channelColor ?? "var(--mixer-output-accent)" } as CSSProperties} className={cn("phone-mix-channel flex w-[216px] shrink-0 snap-start flex-col border-r border-border bg-surface", selected && "ring-2 ring-inset ring-primary")}>
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-border px-2"
      style={channelColor ? { background: channelColor } : undefined}
    >
      <Button variant="ghost" className={cn("h-12 min-w-0 justify-start px-1", channelColor && "text-[#0b0d0e] hover:text-[#0b0d0e]")} onClick={choose} title={name}><span className="truncate font-semibold">{track ? `${index + 1}. ${name}` : name}</span></Button>
      {track ? <span style={channelColor ? { color: "#0b0d0e" } : undefined}><PhoneChannelFxMenu track={track} /></span> : <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="size-12" aria-label={`${name} channel controls`} title="Channel controls"><Settings2 className="size-5" /></Button></DialogTrigger><DialogContent className="phone-channel-details max-h-[88dvh] w-[min(94vw,420px)] overflow-y-auto"><DialogHeader><DialogTitle className="truncate">{name}</DialogTitle></DialogHeader><div className="flex justify-center"><MasterStrip level={level} /></div></DialogContent></Dialog>}
    </div>
    <div className="flex items-center justify-between px-3 py-2"><span className="font-mono text-base font-bold text-foreground">{toDb(volume).toFixed(1)} dB</span><ClipLed id={track?.id ?? "master"} /></div>
    <div className="flex h-48 items-stretch justify-center gap-4 px-3 py-2">
      <div aria-hidden className="flex flex-col items-end justify-between py-1 font-mono text-[10px] font-bold leading-none text-foreground">
        {(track ? ["0", "-6", "-12", "-24", "-∞"] : ["+6", "0", "-6", "-12", "-24", "-∞"]).map((m) => <span key={m}>{m}</span>)}
      </div>
      <Slider aria-label={`${name} volume`} orientation="vertical" className={cn("mx-fader h-full w-12", FADER_CAP)} value={[volume]} min={0} max={track ? 1.2 : 1.5} step={0.01} onValueChange={([v = 0]) => track ? updateTrack(track.id, { volume: v }) : setBus("master", { volume: v })} /><Meter id={track?.id ?? "master"} level={level} tall />
    </div>
    {track ? <>
      <div className="grid h-14 grid-cols-[auto_minmax(0,1fr)_48px] items-center gap-2 border-y border-border px-3"><span aria-hidden className="font-mono text-[10px] font-bold text-foreground">PAN</span><Slider aria-label={`${name} pan`} className="h-12" value={[track.pan]} min={-1} max={1} step={0.01} onValueChange={([pan = 0]) => updateTrack(track.id, { pan })} /><Button variant="ghost" className="size-12 px-0 font-mono text-xs font-bold text-foreground" title="Reset pan to centre" onClick={() => updateTrack(track.id, { pan: 0 })}>{track.pan === 0 ? "C" : `${track.pan < 0 ? "L" : "R"}${Math.round(Math.abs(track.pan) * 100)}`}</Button></div>
      <div className="grid grid-cols-4 gap-1 p-2"><Button variant={track.muted ? "secondary" : "outline"} className="h-12 p-0" aria-label={`Mute ${name}`} aria-pressed={track.muted} onClick={() => updateTrack(track.id, { muted: !track.muted })}>M</Button><Button variant={track.solo ? "secondary" : "outline"} className="h-12 p-0" aria-label={`Solo ${name}`} aria-pressed={track.solo} onClick={() => updateTrack(track.id, { solo: !track.solo })}>S</Button><Button variant={track.armed ? "destructive" : "outline"} className="h-12 p-0" aria-label={`Record arm ${name}`} aria-pressed={track.armed} onClick={() => updateTrack(track.id, { armed: !track.armed })}><span className="size-4 rounded-full bg-destructive" /></Button><Button variant={transport.monitor ? "secondary" : "outline"} className="h-12 p-0" aria-label={`Monitor ${name}`} aria-pressed={transport.monitor} onClick={() => setTransport({ monitor: !transport.monitor })}><Waves className="size-5" /></Button></div>
      <div className="mx-row-scope h-12 shrink-0 border-t border-border p-1"><Scope scopeId={`ch:${track.id}`} height={40} compact color={track.color} /></div>
      <div className="mx-row-icon flex h-14 shrink-0 items-center justify-center border-t border-border" title={name} aria-hidden><TrackIcon track={track} className="size-7" /></div>
    </> : <div className="flex h-[120px] items-center justify-center"><Button variant="outline" className="h-12" onClick={() => clearClip("master")}>Reset clip</Button></div>}
    {track && <ChannelEq t={track} />}
  </section>;
}

/** Phone mixer channel header: effects & EQ menu for one track (no desktop strip). */
function PhoneChannelFxMenu({ track }: { track: Track }) {
  const { addPlugin, removePlugin, togglePluginBypass, setPluginParam, installedPlugins } = useStudio();
  const eq = track.plugins?.find((p) => p.kind === "eq");
  const count = track.plugins?.length ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Effects and EQ for ${track.name}`}
          title={`Effects and EQ for ${track.name}`}
          className={cn("flex size-12 flex-col items-center justify-center gap-0.5 rounded-sm font-mono text-[9px] uppercase tracking-wider", count > 0 ? "text-primary" : "text-foreground")}
        >
          <Settings2 className="size-5" />
          <span>{count > 0 ? `FX ${count}` : "FX"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(55dvh,420px)] w-[min(92vw,360px)] overflow-y-auto p-3"
        onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.("[role=dialog]")) e.preventDefault(); }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 bg-popover pb-2">
          <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {track.name} — effects & EQ
          </span>
          <button
            type="button"
            disabled={!!eq}
            title={eq ? `${track.name} already has a Channel EQ` : `Add a 3-band EQ to ${track.name}`}
            onClick={() => {
              const def = installedPlugins.find((d) => d.kind === "eq") ?? BUILT_IN_PLUGINS.find((d) => d.kind === "eq");
              if (def) addPlugin(track.id, def);
            }}
            className={`shrink-0 rounded-sm border px-2 py-1 font-mono text-[9px] uppercase tracking-wider disabled:opacity-70 ${
              eq ? "border-primary/60 text-primary" : "border-border text-foreground hover:text-primary"
            }`}
          >
            {eq ? "EQ on" : "+ EQ"}
          </button>
        </div>
        <InsertRack
          title={`${track.name} — inserts`}
          midiId={track.id}
          list={track.plugins ?? []}
          onAdd={(def) => addPlugin(track.id, def)}
          onRemove={(id) => removePlugin(track.id, id)}
          onBypass={(id) => togglePluginBypass(track.id, id)}
          onParam={(id, p, v) => setPluginParam(track.id, id, p, v)}
        />
      </PopoverContent>
    </Popover>
  );
}
