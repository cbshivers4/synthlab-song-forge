import { availableEffects } from "@/lib/synclab/effect-catalog";
import { EffectPicker } from "../EffectPicker";
import { type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Knob } from "../Knob";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { MidiLearnBlock } from "../MidiLearn";
import { TrackNotes } from "@/components/studio/TrackNotes";
import { TrackIcon } from "@/components/studio/TrackStyle";
import type { BusId, Track, VcaId } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { clearClip, peakHoldDb, peakHoldText, useClipped } from "@/lib/synclab/clip-monitor";
import { Scope } from "../Scope";
import { ChannelEq } from "./ChannelEq";
import { DeviceSlots, SendsMenu } from "./InsertRack";
import { BUSES, BUS_COLOR, ChannelGain, ClipLed, ColorDot, DB_TICKS, FADER_CAP, KindIcon, Meter, PANEL, ROW, SEND_KEYS, VCA_IDS, fracToDb, toDb } from "./shared";

const panText = (p: number) => (Math.abs(p) < 0.005 ? "C" : p < 0 ? `L${Math.round(-p * 100)}` : `R${Math.round(p * 100)}`);

/** Channel menu: rename, quick inserts, reset, duplicate, delete. */

function ChannelMenu({ t }: { t: Track }) {
  const { updateTrack, duplicateTrack, removeTrack, addPlugin, installedPlugins } = useStudio();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${t.name} channel menu`} title="Channel menu"
          className="channel-menu-trigger size-6 shrink-0 text-foreground hover:bg-accent"
        >
          <MoreVertical className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="mx-channel-menu w-56 space-y-2 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="label-xs">Channel</div>
        <input
          aria-label={`${t.name} channel name`} value={t.name}
          onChange={(e) => updateTrack(t.id, { name: e.target.value })}
          className="h-7 w-full rounded-sm border border-border bg-surface-2 px-2 font-mono text-[10px] uppercase"
        />
        <div className="label-xs pt-1">Add effect</div>
        <EffectPicker effects={availableEffects(installedPlugins)} onAdd={def => addPlugin(t.id, def)} />
        <MidiLearnBlock id={t.id} />
        <div className="grid grid-cols-2 gap-1 pt-1">
          <button
            onClick={() => updateTrack(t.id, { volume: 0.8, pan: 0, muted: false, solo: false })}
            className="h-6 rounded-sm border border-border bg-secondary font-mono text-[9px] uppercase text-secondary-foreground hover:bg-accent"
          >
            Reset
          </button>
          <button
            onClick={() => duplicateTrack(t.id)}
            className="h-6 rounded-sm border border-border bg-secondary font-mono text-[9px] uppercase text-secondary-foreground hover:bg-accent"
          >
            Duplicate
          </button>
        </div>
        <button
          onClick={() => removeTrack(t.id)}
          className="h-6 w-full rounded-sm border border-destructive/50 font-mono text-[8px] uppercase text-destructive hover:bg-destructive/10"
        >
          Delete channel
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function Strip({
  t,
  level,
  selected,
  narrow,
  index,
  onSelect,
}: {
  t: Track;
  level: number;
  selected: boolean;
  narrow: boolean;
  index: number;
  onSelect: () => void;
}) {
  const { updateTrack, moveTrack, tracks, transport, setTransport, vcas } = useStudio();
  const vcaState = t.vca ? vcas[t.vca] : undefined;
  const vcaGain = vcaState ? (vcaState.muted ? 0 : vcaState.volume) : 1;
  const effective = t.volume * vcaGain;
  const advanced = useApp().mode === "advanced";

  const clip = useClipped(t.id);

  const tint = (pct: number) => `color-mix(in oklab, ${t.color} ${pct}%, transparent)`;
  return (
    <div
      role="group" onClick={(e) => { if (e.currentTarget.contains(e.target as Node)) onSelect(); }}
      className={cn(
        "mx-channel flex shrink-0 cursor-pointer flex-col border-r border-border transition-colors",
        narrow ? "w-[92px]" : "w-[132px]"
      )}
      data-selected={selected}
      aria-label={`${t.name} mixer channel`}
      style={{
        "--mixer-channel-color": t.color,
        background: selected
          ? `linear-gradient(${tint(16)}, ${tint(16)}), ${PANEL}`
          : `linear-gradient(${tint(8)}, ${tint(8)}), ${PANEL}`,
        boxShadow: `inset 4px 0 0 0 ${t.color}, inset 0 1px 0 0 rgba(255,255,255,0.08)${selected ? `, inset 0 0 0 1px ${tint(45)}` : ""}`,
      } as CSSProperties}
    >
      {/* channel name plate — sits above the controls and never floats over the level meter */}
      <div
        className={cn(ROW.name, "flex items-center gap-1.5 border-b border-black/40 px-1.5")}
        style={{
          background: `linear-gradient(90deg, color-mix(in oklab, ${t.color} 70%, transparent), color-mix(in oklab, ${t.color} 40%, transparent))`,
          boxShadow: `inset 0 2px 0 0 ${t.color}`,
        }}
        title={t.name}
      >
        <KindIcon t={t} className="size-4 shrink-0" />
        <Button
          variant="ghost"
          aria-label={`Select ${t.name} mixer channel`}
          aria-pressed={selected}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="mx-name-btn h-full min-w-0 flex-1 truncate rounded-none p-0 text-left font-mono text-[12px] font-bold uppercase tracking-wide text-foreground"
        >
          {t.name}
        </Button>
        <button
          onClick={(e) => { e.stopPropagation(); clearClip(t.id); }}
          title="Clip indicator — click to reset"
          aria-label={`Clip indicator for ${t.name} — click to reset`}
          className={cn(
            "size-2.5 shrink-0 rounded-full border border-black/60 transition-shadow",
            clip ? "bg-red-500 shadow-[0_0_6px_1px_rgba(239,68,68,0.8)]" : "bg-black/50"
          )}
        />
      </div>

      {/* channel header: number, colour, notes, menu, ordering */}
      <div
        className={cn(ROW.head, "flex items-center gap-1.5 border-b border-black/50 px-1.5")}
        style={{ background: tint(18) }}
      >
        <span className="font-mono text-[11px] font-bold text-foreground">{index + 1}</span>
        <ColorDot t={t} />
        <TrackNotes track={t} />
        <ChannelMenu t={t} />
        <button
          onClick={(e) => { e.stopPropagation(); moveTrack(t.id, -1); }}
          disabled={index === 0}
          title="Move channel left"
          aria-label="Move channel left"
          className="flex h-5 w-4 items-center justify-center rounded-[2px] text-foreground hover:text-primary disabled:opacity-30"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); moveTrack(t.id, 1); }}
          disabled={index >= tracks.length - 1}
          title="Move channel right"
          aria-label="Move channel right"
          className="flex h-5 w-4 items-center justify-center rounded-[2px] text-foreground hover:text-primary disabled:opacity-30"
        >
          <ChevronRight className="size-3.5" />
        </button>
        <ChannelGain t={t} narrow={narrow} />
      </div>

      <div className={cn(ROW.scope, "border-b border-border/60 p-[3px]")}>
          <Scope scopeId={`ch:${t.id}`} height={40} compact color={t.color} />
        </div>

      <ChannelEq t={t} />

      <DeviceSlots t={t} narrow={narrow} />

      {/* sends */}
      <div className={cn(ROW.sends, "border-b border-border/60 px-1 py-[2px]")}>
        <SendsMenu t={t} />
      </div>

      {/* send amount bars */}
      {advanced && (
        <div className={cn(ROW.sendBars, "flex items-center gap-1 border-b border-border/60 px-1.5")}>
          {SEND_KEYS.map(([key, label]) => {
            const v = t.sends?.[key] ?? 0;
            return (
              <div key={key} className="flex-1" title={`${label} ${Math.round(v * 100)}%`}>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: t.color }} />
                </div>
                <div className="mt-[1px] text-center font-mono text-[7px] text-muted-foreground">{label}</div>
              </div>
            );
          })}
        </div>
      )}


      {/* audio-to routing */}
      <div className={cn(ROW.io, "flex flex-col justify-center gap-0.5 border-b border-border/60 px-1")}>
        <Select value={t.bus} onValueChange={(v) => updateTrack(t.id, { bus: v as BusId })}>
          <SelectTrigger aria-label={`${t.name} output bus`}
            onClick={(e) => e.stopPropagation()}
            className="h-6 w-full rounded-sm border-border px-1 font-mono text-[8px] uppercase"
            style={{ background: `color-mix(in oklab, ${BUS_COLOR[t.bus] ?? t.color} 22%, var(--surface-2, transparent))` }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUSES.map((b) => (
              <SelectItem key={b} value={b} className="text-xs uppercase">
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={t.vca ?? "none"} onValueChange={(v) => updateTrack(t.id, { vca: v === "none" ? undefined : v as VcaId })}>
          <SelectTrigger onClick={(e) => e.stopPropagation()} aria-label={`${t.name} VCA group`} className="h-5 w-full rounded-sm border-border px-1 font-mono text-[8px] uppercase">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No VCA</SelectItem>
            {VCA_IDS.map((id) => <SelectItem key={id} value={id}>VCA {id}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* pan */}
      <div
        className={cn(ROW.pan, "flex items-center justify-center border-b border-border/60 px-1.5")}
        style={{ "--primary": t.color } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <Knob
          label="PAN"
          ariaLabel={`${t.name} pan`}
          layout="inline"
          size={30}
          value={t.pan}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          format={panText}
          onChange={(v) => updateTrack(t.id, { pan: v })}
        />
      </div>

      {/* fader + scale + meter */}
      <div
        className={cn(ROW.fader, "flex items-stretch justify-center gap-1 border-b border-border/60 py-1")}
        style={{ "--primary": t.color } as CSSProperties}
      >
        {!narrow && (
          <div className="flex flex-col justify-between py-1">
            {DB_TICKS.map((db) => (
              <div key={db} className="flex items-center gap-0.5">
                <span className="font-mono text-[7px] leading-none text-muted-foreground">
                  {db > 0 ? `+${db}` : db}
                </span>
                <span className="h-px w-1 bg-border" />
              </div>
            ))}
          </div>
        )}
        <Slider
          aria-label={`${t.name} volume`} aria-valuetext={t.volume === 0 ? "Silent" : `${toDb(t.volume).toFixed(1)} decibels`}
          orientation="vertical"
          className={cn("h-full w-8", FADER_CAP)}
          value={[t.volume]}
          min={0}
          max={1.2}
          step={0.01}
          onDoubleClick={() => updateTrack(t.id, { volume: 0.8 })}
          onValueChange={([v = 0]) => updateTrack(t.id, { volume: v })}
        />
        {vcaState && (
          <div className="relative w-2 shrink-0 rounded-sm bg-surface-2" title={`After VCA ${t.vca}: ${toDb(effective).toFixed(1)} dB`} aria-label={`Level after VCA ${t.vca}`}>
            <div className="absolute inset-x-0 bottom-0 rounded-sm bg-primary/70 transition-[height] duration-75" style={{ height: `${effective * 100}%` }} />
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[7px] text-primary">{t.vca}</span>
          </div>
        )}
        <Meter id={t.id} level={level} tall />
      </div>

      {/* fader dB + live peak dB */}
      <div className={cn(ROW.readout, "flex items-center justify-between border-b border-border/60 px-1.5")}>
        <span className={cn("font-mono text-[9px]", vcaState ? "text-primary" : "text-muted-foreground")} title={vcaState ? `Fader ${toDb(t.volume).toFixed(1)} dB, after VCA ${t.vca}` : undefined}>{toDb(effective).toFixed(1)}</span>
        <span className={cn("font-mono text-[9px]", peakHoldDb(t.id) > -0.2 ? "text-red-400" : "text-foreground/70")} title="Peak hold (dBFS) — highest level since reset; click CLIP to reset" aria-label={`${t.name} peak hold ${peakHoldText(t.id)} dB`}>
          {peakHoldText(t.id)}
        </span>
        <ClipLed id={t.id} compact />
      </div>

      {/* M / S / REC / MON — Studio Pro style letter buttons at the bottom (2x2 so they stay big and tappable) */}
      <div className={cn(ROW.buttons, "grid grid-cols-2 gap-1 px-1")}>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { muted: !t.muted }); }}
          className={cn(
            "h-8 w-full rounded-[3px] font-mono text-[13px] font-bold leading-none transition-colors",
            t.muted
              ? "bg-orange-500 text-black shadow-[0_0_10px_rgba(249,115,22,0.8)]"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
          title={t.muted ? "Muted — click to unmute" : "Mute this channel"}
          aria-label={`Mute ${t.name}`}
          aria-pressed={t.muted}
        >
          M
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { solo: !t.solo }); }}
          className={cn(
            "h-8 w-full rounded-[3px] font-mono text-[13px] font-bold leading-none transition-colors",
            t.solo
              ? "bg-emerald-400 text-black shadow-[0_0_10px_rgba(52,211,153,0.8)]"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
          title={t.solo ? "Soloed — click to unsolo" : "Solo this channel"}
          aria-label={`Solo ${t.name}`}
          aria-pressed={t.solo}
        >
          S
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateTrack(t.id, { armed: !t.armed }); }}
          title={t.armed ? "Armed for recording" : "Arm this channel for recording"}
          aria-label={`Record arm ${t.name}`}
          aria-pressed={t.armed}
          className={cn(
            "flex h-8 w-full items-center justify-center rounded-[3px] transition-colors",
            t.armed ? "bg-red-500/20" : "bg-black/30 hover:bg-black/50"
          )}
        >
          <span className={cn("size-4 rounded-full border", t.armed ? "border-red-300 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" : "border-red-500/60 bg-red-500/20")} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setTransport({ monitor: !transport.monitor });
          }}
          disabled={!t.armed}
          title={
            t.armed
              ? "Input monitoring — hear the live input on armed channels. This switch is studio-wide."
              : "Arm this channel to monitor its input"
          }
          aria-label={`Monitor ${t.name} input`}
          aria-pressed={t.armed && transport.monitor}
          className={cn(
            "h-8 w-full rounded-[3px] font-mono text-[13px] font-bold leading-none transition-colors disabled:opacity-40",
            t.armed && transport.monitor
              ? "bg-sky-400 text-black"
              : "bg-black/30 text-muted-foreground hover:text-foreground"
          )}
        >
          ⌁
        </button>
      </div>

      {/* channel icon — centred at the foot of the strip, in its own row so nothing overlaps */}
      <div
        className={cn(ROW.icon, "flex shrink-0 items-center justify-center border-t border-border/60")}
        title={t.name}
        aria-hidden
      >
        <TrackIcon track={t} className="size-5" />
      </div>
    </div>
  );
}
