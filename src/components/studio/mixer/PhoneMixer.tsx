import { useRef, type CSSProperties } from "react";
import { Settings2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { TrackIcon } from "@/components/studio/TrackStyle";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
import type { AuxId, BusId, BusState, Track, VcaId } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { clearClip } from "@/lib/synclab/clip-monitor";
import { TimelineHScrollbar } from "../timeline/HScrollbar";
import { FxMenu, VcaAssign } from "./BusStrips";
import { InsertRack } from "./InsertRack";
import { PhoneChannelControls } from "./PhoneChannelControls";
import { BUS_COLOR, FADER_CAP, Meter, toDb } from "./shared";

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

/**
 * Sideways-phone mixer with finger-sized controls: every channel shows its name, a tall fader with meter,
 * M / S, effects and a "More" window that opens that channel's complete desk strip (gain, EQ, inserts,
 * sends, routing) at full size, so nothing from the desk is lost.
 */
export type TouchStripSize = "narrow" | "normal" | "wide";
type MixLevels = { tracks: Record<string, number>; buses: Record<string, number>; vcas: Record<string, number>; aux: Record<string, number>; master: number };

const VCA_COLOR = "oklch(0.82 0.14 70)";
const AUX_COLOR = "oklch(0.78 0.13 225)";

export function PhoneTouchStrips({
  levels,
  routing,
  size = "normal",
}: {
  levels: MixLevels;
  routing?: { buses: BusId[]; vcas: VcaId[]; aux: AuxId[] };
  size?: TouchStripSize;
}) {
  const { tracks, selectedId, buses, setBus, vcas, setVca, auxReturns, setAuxReturn } = useStudio();
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        id="phone-mixer-channels"
        data-strip-size={size}
        className="phone-touch-strips flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
        role="region"
        aria-label="Mixer channels"
      >
        {tracks.map((t, i) => (
          <TouchChannel key={t.id} track={t} index={i} level={t.muted ? 0 : (levels.tracks[t.id] ?? 0)} selected={t.id === selectedId} />
        ))}
        {routing?.buses.map((id) => (
          <TouchRouteChannel key={`bus-${id}`} kind="BUS" id={id} color={BUS_COLOR[id] ?? AUX_COLOR} state={buses[id]} level={levels.buses[id] ?? 0} onChange={(p) => setBus(id, p)} memberCount={tracks.filter((t) => t.bus === id).length} />
        ))}
        {routing?.vcas.map((id) => (
          <TouchRouteChannel key={`vca-${id}`} kind="VCA" id={id} color={VCA_COLOR} state={vcas[id]} level={levels.vcas[id] ?? 0} onChange={(p) => setVca(id, p)} memberCount={tracks.filter((t) => t.vca === id).length} />
        ))}
        {routing?.aux.map((id) => (
          <TouchRouteChannel key={`aux-${id}`} kind="AUX" id={id} color={AUX_COLOR} state={auxReturns[id]} level={levels.aux[id] ?? 0} onChange={(p) => setAuxReturn(id, p)} />
        ))}
        <TouchChannel level={levels.master} index={-1} selected={false} />
      </div>
      <TimelineHScrollbar scrollRef={scrollRef} label="Scroll the mixer channels left and right" controls="phone-mixer-channels" className="mixer-hscroll-row" />
    </div>
  );
}

/** Bus, VCA or aux return as a finger-sized strip: name, fader + meter, mute and its effects/members. */
function TouchRouteChannel({ kind, id, color, state, level, onChange, memberCount = 0 }: {
  kind: "BUS" | "VCA" | "AUX";
  id: string;
  color: string;
  state: BusState;
  level: number;
  onChange: (p: Partial<BusState>) => void;
  memberCount?: number;
}) {
  const name = kind === "BUS" ? `${id} bus` : kind === "VCA" ? `VCA ${id}` : `${id} return`;
  const meterId = kind === "BUS" ? `bus:${id}` : kind === "VCA" ? `vca:${id}` : `aux:${id}`;
  const volume = state.volume;
  return (
    <section
      aria-label={`${name} mixer channel`}
      data-route-kind={kind.toLowerCase()}
      style={{ "--mixer-channel-color": color } as CSSProperties}
      className="touch-mix-channel touch-mix-route flex min-w-[118px] max-w-[190px] flex-1 basis-0 flex-col border-r border-border"
    >
      <div className="touch-mix-name flex h-10 shrink-0 items-center gap-1.5 px-2" style={{ background: color, color: INK }} title={name}>
        <span className="shrink-0 rounded-sm border border-current px-1 font-mono text-[10px] font-bold leading-4">{kind}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase">{id}</span>
      </div>
      <div className="flex min-h-0 flex-1 gap-1.5 p-1.5">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="font-mono text-xs font-bold leading-none text-foreground">{volume === 0 ? "-∞" : toDb(volume).toFixed(1)}</span>
          <div className="flex min-h-0 flex-1 items-stretch gap-1">
            <Slider
              aria-label={`${name} volume`}
              aria-valuetext={volume === 0 ? "Silent" : `${toDb(volume).toFixed(1)} decibels`}
              orientation="vertical"
              className={cn("touch-mix-fader h-full w-9 shrink-0", FADER_CAP)}
              value={[volume]}
              min={0}
              max={1.2}
              step={0.01}
              onDoubleClick={() => onChange({ volume: 1 })}
              onValueChange={([v = 0]) => onChange({ volume: v })}
            />
            <span className="touch-mix-meter flex h-full shrink-0"><Meter id={meterId} level={state.muted ? 0 : level} tall /></span>
          </div>
        </div>
        <div className="flex w-11 shrink-0 flex-col gap-1">
          <Button
            variant={state.muted ? "secondary" : "outline"}
            className={cn(TOUCH_BTN, state.muted && "bg-amber-500 text-black hover:bg-amber-400")}
            aria-label={`Mute ${name}`}
            aria-pressed={state.muted}
            onClick={() => onChange({ muted: !state.muted })}
          >
            M
          </Button>
          <div className="flex min-h-0 flex-1 basis-0 [&>button]:!h-full [&>button]:!min-h-0 [&>button]:flex-col [&>button]:gap-0.5 [&>button]:rounded-md [&>button]:border [&>button]:border-border [&>button]:px-0 [&>button]:text-[9px]">
            {kind === "VCA" ? (
              <VcaAssign id={id as VcaId} memberCount={memberCount} short className="h-full text-[10px] font-bold" />
            ) : (
              <FxMenu target={kind === "BUS" ? `bus:${id}` : `send:${id}`} label="FX" />
            )}
          </div>
          <PhoneChannelControls target={kind === "BUS" ? { kind: "bus", id: id as BusId } : kind === "VCA" ? { kind: "vca", id: id as VcaId } : { kind: "aux", id: id as AuxId }} label={name} />
        </div>
      </div>
      <div className="flex h-11 shrink-0 items-center justify-center border-t border-border px-1 text-center font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {kind === "VCA" ? `${memberCount} track${memberCount === 1 ? "" : "s"}` : kind === "BUS" ? `${memberCount} in → master` : "→ master"}
      </div>
    </section>
  );
}

const INK = "#0b0d0e";
const TOUCH_BTN = "h-auto !min-h-0 flex-1 basis-0 px-0 text-sm font-bold";

function TouchChannel({ track, level, selected, index }: { track?: Track | undefined; level: number; selected: boolean; index: number }) {
  const { updateTrack, buses, setBus, select } = useStudio();
  const name = track?.name ?? "MASTER";
  const volume = track?.volume ?? buses.master.volume;
  const color = track?.color;
  return (
    <section
      aria-label={`${name} mixer channel`}
      data-selected={selected || undefined}
      style={{ "--mixer-channel-color": color ?? "var(--mixer-output-accent)" } as CSSProperties}
      className={cn(
        "touch-mix-channel flex min-w-[118px] max-w-[190px] flex-1 basis-0 flex-col border-r border-border",
        !track && "touch-mix-master sticky right-0 z-10",
        selected && "ring-2 ring-inset ring-primary",
      )}
    >
      <button
        type="button"
        onClick={() => track && select(track.id)}
        title={name}
        aria-label={track ? `Select ${name} mixer channel` : "Master channel"}
        className="touch-mix-name flex h-10 !min-h-0 shrink-0 items-center gap-1.5 px-2 text-left"
        style={{ background: color ?? "var(--mixer-output-accent)", color: INK }}
      >
        {track ? <TrackIcon track={track} className="size-4 shrink-0" /> : null}
        <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase">{track ? `${index + 1}. ${name}` : name}</span>
      </button>
      <div className="flex min-h-0 flex-1 gap-1.5 p-1.5">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="font-mono text-xs font-bold leading-none text-foreground">{volume === 0 ? "-∞" : toDb(volume).toFixed(1)}</span>
          <div className="flex min-h-0 flex-1 items-stretch gap-1">
            <Slider
              aria-label={`${name} volume`}
              aria-valuetext={volume === 0 ? "Silent" : `${toDb(volume).toFixed(1)} decibels`}
              orientation="vertical"
              className={cn("touch-mix-fader h-full w-9 shrink-0", FADER_CAP)}
              value={[volume]}
              min={0}
              max={track ? 1.2 : 1.5}
              step={0.01}
              onDoubleClick={() => (track ? updateTrack(track.id, { volume: 0.8 }) : setBus("master", { volume: 1 }))}
              onValueChange={([v = 0]) => (track ? updateTrack(track.id, { volume: v }) : setBus("master", { volume: v }))}
            />
            <span className="touch-mix-meter flex h-full shrink-0"><Meter id={track?.id ?? "master"} level={level} tall /></span>
          </div>
        </div>
        <div className="flex w-11 shrink-0 flex-col gap-1">
          {track ? (
            <>
              <Button variant={track.muted ? "secondary" : "outline"} className={cn(TOUCH_BTN, track.muted && "bg-amber-500 text-black hover:bg-amber-400")} aria-label={`Mute ${name}`} aria-pressed={track.muted} onClick={() => updateTrack(track.id, { muted: !track.muted })}>M</Button>
              <Button variant={track.solo ? "secondary" : "outline"} className={cn(TOUCH_BTN, track.solo && "bg-primary text-primary-foreground hover:bg-primary/90")} aria-label={`Solo ${name}`} aria-pressed={track.solo} onClick={() => updateTrack(track.id, { solo: !track.solo })}>S</Button>
              <div className="flex min-h-0 flex-1 basis-0 [&>button]:!min-h-0 [&>button]:size-full [&>button]:rounded-md [&>button]:border [&>button]:border-border"><PhoneChannelFxMenu track={track} /></div>
            </>
          ) : (
            <Button variant="outline" className={TOUCH_BTN} onClick={() => clearClip("master")} aria-label="Reset master clip light">CLIP</Button>
          )}
          <PhoneChannelControls target={track ? { kind: "track", track, index } : { kind: "master" }} label={track ? track.name : "Master"} />
        </div>
      </div>
      {track ? (
        <div className="grid h-11 shrink-0 grid-cols-[minmax(0,1fr)_40px] items-center gap-1 border-t border-border px-2">
          <Slider aria-label={`${name} pan`} className="touch-mix-pan h-10 [&_[role=slider]]:size-6" value={[track.pan]} min={-1} max={1} step={0.01} onValueChange={([pan = 0]) => updateTrack(track.id, { pan })} />
          <Button variant="ghost" className="h-10 px-0 font-mono text-xs font-bold text-foreground" title="Reset pan to centre" aria-label={`Reset ${name} pan to centre`} onClick={() => updateTrack(track.id, { pan: 0 })}>{track.pan === 0 ? "C" : `${track.pan < 0 ? "L" : "R"}${Math.round(Math.abs(track.pan) * 100)}`}</Button>
        </div>
      ) : (
        <div className="flex h-11 shrink-0 items-center justify-center border-t border-border font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Main out</div>
      )}
    </section>
  );
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
