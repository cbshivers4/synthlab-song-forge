import { FADER_MAX_GAIN } from "@/lib/synclab/fader-taper";
import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, NotebookPen, Palette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useStudio } from "@/lib/synclab/store";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
import type { AuxId, BusId, BusState, Track, VcaId } from "@/lib/synclab/types";
import { cn } from "@/lib/utils";
import { clearClip, peakHoldText, useClipped } from "@/lib/synclab/clip-monitor";
import { Knob } from "../Knob";
import { Scope } from "../Scope";
import { MidiLearnBlock } from "../MidiLearn";
import { TrackNotes } from "../TrackNotes";
import { TrackStylePicker } from "../TrackStyle";
import { RenameTrackButton } from "../RenameTrackButton";
import { EqCurve, useTrackEq } from "./ChannelEq";
import { InsertRack } from "./InsertRack";
import { useMasterFx } from "./MasterStrip";
import { BUSES, BUS_COLOR, SEND_KEYS, VCA_IDS, toDb } from "./shared";

/**
 * Phone mixer "⋯" window: every control from the top of the desk strip (gain, EQ, inserts, sends,
 * routing, record, channel tools, hardware control) laid out as big touch sections in tabs,
 * instead of a shrunken copy of the desk strip.
 */
export type PhoneChannelTarget =
  | { kind: "track"; track: Track; index: number }
  | { kind: "master" }
  | { kind: "bus"; id: BusId }
  | { kind: "vca"; id: VcaId }
  | { kind: "aux"; id: AuxId };

const BIG = "min-h-12 min-w-0 rounded-md border px-3 font-mono leading-tight [overflow-wrap:anywhere] text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40";
const OFF = "border-border bg-surface text-foreground hover:border-primary/60";
const ON = "border-primary bg-primary text-primary-foreground";
const KNOB = 56;

function BigButton({ on, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean | undefined }) {
  return (
    <button type="button" aria-pressed={on} className={cn(BIG, on ? ON : OFF, className)} {...rest}>
      {children}
    </button>
  );
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface-2/50 p-3", className)}>
      <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

const panText = (p: number) => (Math.abs(p) < 0.005 ? "C" : p < 0 ? `L${Math.round(-p * 100)}` : `R${Math.round(p * 100)}`);

export function PhoneChannelControls({ target, label }: { target: PhoneChannelTarget; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-auto !min-h-0 flex-1 basis-0 px-0 text-sm font-bold" aria-label={`More controls for ${label}`} title="Gain, EQ, effects, sends, routing and channel tools">
          <MoreHorizontal className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="phone-strip-dialog phone-channel-controls flex max-h-[88dvh] w-[min(96vw,760px)] max-w-[96vw] flex-col gap-2 overflow-hidden p-3">
        {open && <Body target={target} label={label} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ target, label }: { target: PhoneChannelTarget; label: string }) {
  const { tracks, buses, vcas, auxReturns } = useStudio();
  // Read the live track so edits made here show at once.
  const track = target.kind === "track" ? tracks.find((t) => t.id === target.track.id) : undefined;
  if (target.kind === "track" && !track) return null;
  const meterId = target.kind === "track" ? track!.id : target.kind === "master" ? "master" : `${target.kind}:${target.id}`;
  const color =
    target.kind === "track" ? track!.color
      : target.kind === "master" ? BUS_COLOR["master"]!
        : target.kind === "bus" ? (BUS_COLOR[target.id] ?? BUS_COLOR["master"]!)
          : target.kind === "vca" ? "oklch(0.82 0.14 70)" : "oklch(0.78 0.13 225)";
  const volume =
    target.kind === "track" ? track!.volume
      : target.kind === "master" ? buses.master.volume
        : target.kind === "bus" ? buses[target.id].volume
          : target.kind === "vca" ? vcas[target.id].volume : auxReturns[target.id].volume;
  const heading = target.kind === "track" ? `${target.index + 1}. ${track!.name}` : label;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" style={{ "--primary": color } as CSSProperties}>
      <DialogHeader className="space-y-0">
        <div className="flex items-center gap-2 pr-8">
          <span className="size-4 shrink-0 rounded-full border border-black/40" style={{ background: color }} aria-hidden />
          <DialogTitle className="min-w-0 flex-1 truncate text-base uppercase">{heading}</DialogTitle>
          <ReadoutChip label="Fader" value={volume === 0 ? "-∞" : `${toDb(volume).toFixed(1)} dB`} />
          <ReadoutChip label="Peak" value={peakHoldText(meterId)} />
          <ClipChip id={meterId} />
        </div>
        <DialogDescription className="sr-only">All controls for {heading}</DialogDescription>
      </DialogHeader>
      {target.kind === "track" ? <TrackPanel t={track!} index={target.index} color={color} />
        : target.kind === "master" ? <MasterPanel color={color} />
          : target.kind === "vca" ? <VcaPanel id={target.id} />
            : <RoutePanel kind={target.kind} id={target.id} color={color} />}
    </div>
  );
}

function ReadoutChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex shrink-0 flex-col items-center rounded-md border border-border bg-surface px-2 py-0.5 leading-tight">
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-bold text-foreground">{value}</span>
    </span>
  );
}

function ClipChip({ id }: { id: string }) {
  const clipped = useClipped(id);
  return (
    <button
      type="button"
      onClick={() => clearClip(id)}
      aria-label={clipped ? "Clipping — tap to reset the clip light and peak hold" : "No clipping — tap to reset the peak hold"}
      className={cn("h-10 shrink-0 rounded-md px-3 font-mono text-xs font-bold", clipped ? "animate-pulse bg-red-500 text-black" : "border border-border bg-surface text-muted-foreground")}
    >
      CLIP
    </button>
  );
}

function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" aria-label="Control sections" className="flex shrink-0 gap-1.5 overflow-x-auto">
      {tabs.map(([id, name]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn("min-h-11 flex-1 whitespace-nowrap rounded-md border px-3 font-mono text-xs font-bold uppercase tracking-wider", value === id ? ON : OFF)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div role="tabpanel" className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-2 overflow-y-auto overscroll-contain pr-1">{children}</div>;
}

/* ---------------- Track channel ---------------- */

type TrackTab = "sound" | "effects" | "routing" | "channel";

function TrackPanel({ t, index, color }: { t: Track; index: number; color: string }) {
  const [tab, setTab] = useState<TrackTab>("sound");
  return (
    <>
      <Tabs<TrackTab> tabs={[["sound", "Gain · EQ · Pan"], ["effects", "Effects · Sends"], ["routing", "Routing · Record"], ["channel", "Channel"]]} value={tab} onChange={setTab} />
      {tab === "sound" && <TrackSound t={t} color={color} />}
      {tab === "effects" && <TrackEffects t={t} />}
      {tab === "routing" && <TrackRouting t={t} />}
      {tab === "channel" && <TrackChannel t={t} index={index} />}
    </>
  );
}

function TrackSound({ t, color }: { t: Track; color: string }) {
  const { updateTrack } = useStudio();
  const { eq, setBand, band } = useTrackEq(t);
  return (
    <Panel>
      <Section title="Input gain & pan">
        <div className="flex items-center justify-around gap-3">
          <Knob label="Gain" ariaLabel={`${t.name} gain`} value={t.gain ?? 1} min={0} max={2} step={0.01} unit="×" defaultValue={1} size={KNOB} onChange={(v) => updateTrack(t.id, { gain: v })} midiTarget={{ id: t.id, param: "gain" }} />
          <Knob label="Pan" ariaLabel={`${t.name} pan`} value={t.pan} min={-1} max={1} step={0.01} defaultValue={0} format={panText} size={KNOB} onChange={(v) => updateTrack(t.id, { pan: v })} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <BigButton onClick={() => updateTrack(t.id, { gain: 1 })}>Gain 1×</BigButton>
          <BigButton onClick={() => updateTrack(t.id, { pan: 0 })}>Pan centre</BigButton>
        </div>
      </Section>
      <Section title="3-band EQ">
        <div className="flex items-center justify-around gap-2">
          {([["low", "Low"], ["mid", "Mid"], ["high", "High"]] as const).map(([id, name]) => (
            <Knob key={id} label={name} ariaLabel={`${t.name} EQ ${name}`} value={band(id)} min={-18} max={18} step={0.5} unit=" dB" defaultValue={0} size={KNOB - 4} onChange={(v) => setBand(id, v)} />
          ))}
        </div>
        <div className="mt-2 h-16">
          <EqCurve scopeId={`ch:${t.id}`} bands={[band("low"), band("mid"), band("high")]} color={color} bypass={!!eq?.bypass} onBand={(i, v) => { const id = ["low", "mid", "high"][i]; if (id) setBand(id, v); }} />
        </div>
      </Section>
      <Section title="Live signal" className="col-span-full">
        <Scope scopeId={`ch:${t.id}`} height={56} compact color={color} />
      </Section>
    </Panel>
  );
}

function TrackEffects({ t }: { t: Track }) {
  const { updateTrack, addPlugin, removePlugin, togglePluginBypass, setPluginParam } = useStudio();
  return (
    <Panel>
      <Section title="Sends to effect returns" className="col-span-full">
        <div className="flex items-center justify-around gap-2">
          {SEND_KEYS.map(([key, name]) => (
            <Knob
              key={key}
              label={name}
              ariaLabel={`${t.name} ${key} send`}
              value={t.sends?.[key] ?? 0}
              defaultValue={0}
              format={(v) => `${Math.round(v * 100)}%`}
              size={KNOB - 4}
              onChange={(v) => updateTrack(t.id, { sends: { reverb: 0, delay: 0, chorus: 0, ...(t.sends ?? {}), [key]: v } })}
            />
          ))}
        </div>
      </Section>
      <Section title="Insert effects" className="col-span-full">
        <InsertRack
          title={`${t.name} — inserts`}
          midiId={t.id}
          list={t.plugins ?? []}
          onAdd={(def) => addPlugin(t.id, def)}
          onRemove={(id) => removePlugin(t.id, id)}
          onBypass={(id) => togglePluginBypass(t.id, id)}
          onParam={(id, p, v) => setPluginParam(t.id, id, p, v)}
        />
      </Section>
    </Panel>
  );
}

function TrackRouting({ t }: { t: Track }) {
  const { updateTrack, transport, setTransport } = useStudio();
  return (
    <Panel>
      <Section title="Output — where this channel goes">
        <div className="grid grid-cols-2 gap-1.5">
          {BUSES.map((b) => (
            <BigButton key={b} className="px-2" on={t.bus === b} onClick={() => updateTrack(t.id, { bus: b })} aria-label={`Send ${t.name} to ${b}`} style={t.bus === b ? undefined : { borderLeft: `4px solid ${BUS_COLOR[b]}` }}>
              {b}
            </BigButton>
          ))}
        </div>
      </Section>
      <Section title="VCA group">
        <div className="grid grid-cols-5 gap-1.5">
          <BigButton on={!t.vca} onClick={() => updateTrack(t.id, { vca: undefined })} className="px-1">None</BigButton>
          {VCA_IDS.map((id) => (
            <BigButton key={id} on={t.vca === id} onClick={() => updateTrack(t.id, { vca: id })} aria-label={`${t.name} on VCA ${id}`} className="px-1">{id}</BigButton>
          ))}
        </div>
      </Section>
      <Section title="Record" className="col-span-full">
        <div className="grid grid-cols-2 gap-1.5">
          <BigButton on={t.armed} onClick={() => updateTrack(t.id, { armed: !t.armed })} aria-label={`Record arm ${t.name}`} className={t.armed ? "border-red-500 bg-red-500 text-black" : undefined}>
            ● {t.armed ? "Armed" : "Arm to record"}
          </BigButton>
          <BigButton on={t.armed && transport.monitor} disabled={!t.armed} onClick={() => setTransport({ monitor: !transport.monitor })} aria-label={`Monitor ${t.name} input`} title="Hear the live input on armed channels (studio-wide)">
            ⌁ {t.armed && transport.monitor ? "Monitoring" : "Monitor input"}
          </BigButton>
        </div>
      </Section>
    </Panel>
  );
}

function TrackChannel({ t, index }: { t: Track; index: number }) {
  const { tracks, updateTrack, moveTrack, duplicateTrack, removeTrack } = useStudio();
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <Panel>
      <Section title="Name, colour & notes">
        <RenameTrackButton track={t} className="h-12 w-full justify-start rounded-md border border-border bg-surface px-3 font-mono text-sm font-bold uppercase">
          <span className="min-w-0 flex-1 truncate text-left">{t.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">RENAME</span>
        </RenameTrackButton>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <TrackStylePicker track={t}>
            <BigButton className="flex items-center justify-center gap-2"><Palette className="size-4" /> Colour & icon</BigButton>
          </TrackStylePicker>
          <TrackNotes track={t}>
            <BigButton className="flex items-center justify-center gap-2"><NotebookPen className="size-4" /> {t.memo ? "Edit note" : "Notes"}</BigButton>
          </TrackNotes>
        </div>
      </Section>
      <Section title="Order & tools">
        <div className="grid grid-cols-2 gap-1.5">
          <BigButton disabled={index === 0} onClick={() => moveTrack(t.id, -1)} className="flex items-center justify-center gap-1"><ChevronLeft className="size-4" /> Move left</BigButton>
          <BigButton disabled={index >= tracks.length - 1} onClick={() => moveTrack(t.id, 1)} className="flex items-center justify-center gap-1">Move right <ChevronRight className="size-4" /></BigButton>
          <BigButton onClick={() => updateTrack(t.id, { volume: 0.8, pan: 0, muted: false, solo: false })}>Reset channel</BigButton>
          <BigButton onClick={() => duplicateTrack(t.id)}>Duplicate</BigButton>
          <BigButton
            className={cn("col-span-2 flex items-center justify-center gap-2", confirmDelete ? "border-destructive bg-destructive text-destructive-foreground" : "border-destructive/60 text-destructive")}
            onClick={() => (confirmDelete ? removeTrack(t.id) : setConfirmDelete(true))}
          >
            <Trash2 className="size-4" /> {confirmDelete ? "Tap again to delete" : "Delete channel"}
          </BigButton>
        </div>
      </Section>
      <Section title="Hardware control (MIDI learn)" className="col-span-full">
        <MidiLearnBlock id={t.id} title="Tap a control, then move a knob on your controller" />
      </Section>
    </Panel>
  );
}

/* ---------------- Master ---------------- */

type MasterTab = "sound" | "effects" | "midi";

function MasterPanel({ color }: { color: string }) {
  const [tab, setTab] = useState<MasterTab>("sound");
  const { buses, setBus, fxChains, addFxPlugin, removeFxPlugin, toggleFxBypass, setFxParam, installedPlugins } = useStudio();
  const eq = useMasterFx("eq");
  const width = useMasterFx("width");
  const list = fxChains["bus:master"] ?? [];
  const quick: [string, string][] = [["limiter", "Limiter"], ["compressor", "Glue"], ["paraeq", "Pro-EQ"], ["width", "Width"]];
  const add = (kind: string) => {
    const def = installedPlugins.find((d) => d.kind === kind) ?? BUILT_IN_PLUGINS.find((d) => d.kind === kind);
    if (def) addFxPlugin("bus:master", def);
  };
  const band = (id: string) => eq.get(id, 0);
  return (
    <>
      <Tabs<MasterTab> tabs={[["sound", "Gain · EQ · Width"], ["effects", "Mastering effects"], ["midi", "Hardware control"]]} value={tab} onChange={setTab} />
      {tab === "sound" && (
        <Panel>
          <Section title="Master gain & stereo width">
            <div className="flex items-center justify-around gap-3">
              <Knob label="Gain" ariaLabel="Master gain" value={buses.master.gain ?? 1} min={0} max={2} step={0.01} unit="×" defaultValue={1} size={KNOB} onChange={(v) => setBus("master", { gain: v })} midiTarget={{ id: "master", param: "gain" }} />
              <Knob label="Width" ariaLabel="Master stereo width" value={width.get("width", 1)} min={0} max={2} step={0.01} defaultValue={1} format={(n) => (n === 0 ? "MONO" : `${Math.round(n * 100)}%`)} size={KNOB} onChange={(v) => width.set("width", v)} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <BigButton onClick={() => setBus("master", { gain: 1 })}>Gain 1×</BigButton>
              <BigButton on={buses.master.muted} onClick={() => setBus("master", { muted: !buses.master.muted })} className={buses.master.muted ? "border-amber-500 bg-amber-500 text-black" : undefined}>
                {buses.master.muted ? "Muted" : "Mute master"}
              </BigButton>
            </div>
          </Section>
          <Section title="Master 3-band EQ">
            <div className="flex items-center justify-around gap-2">
              {([["low", "Low"], ["mid", "Mid"], ["high", "High"]] as const).map(([id, name]) => (
                <Knob key={id} label={name} ariaLabel={`Master EQ ${name}`} value={band(id)} min={-18} max={18} step={0.5} unit=" dB" defaultValue={0} size={KNOB - 4} onChange={(v) => eq.set(id, v)} />
              ))}
            </div>
            <div className="mt-2 h-16">
              <EqCurve scopeId="master" bands={[band("low"), band("mid"), band("high")]} color={color} bypass={!!eq.inst?.bypass} onBand={(i, v) => { const id = ["low", "mid", "high"][i]; if (id) eq.set(id, v); }} />
            </div>
          </Section>
          <Section title="Live output" className="col-span-full">
            <Scope scopeId="master" height={56} compact color={color} />
          </Section>
        </Panel>
      )}
      {tab === "effects" && (
        <Panel>
          <Section title="One-tap mastering">
            <div className="grid grid-cols-2 gap-1.5">
              {quick.map(([kind, name]) => <BigButton key={kind} onClick={() => add(kind)} aria-label={`Add ${name} to the master`}>+ {name}</BigButton>)}
            </div>
          </Section>
          <Section title="Master effect chain">
            <InsertRack
              title="Master effects"
              midiId="bus:master"
              midiPrefix="fx"
              list={list}
              onAdd={(def) => addFxPlugin("bus:master", def)}
              onRemove={(id) => removeFxPlugin("bus:master", id)}
              onBypass={(id) => toggleFxBypass("bus:master", id)}
              onParam={(id, p, v) => setFxParam("bus:master", id, p, v)}
            />
          </Section>
        </Panel>
      )}
      {tab === "midi" && (
        <Panel>
          <Section title="Hardware control (MIDI learn)" className="col-span-full">
            <MidiLearnBlock id="master" params={["volume", "mute", "gain"]} title="Tap a control, then move a knob on your controller" />
          </Section>
        </Panel>
      )}
    </>
  );
}

/* ---------------- Bus & aux return ---------------- */

type RouteTab = "level" | "effects" | "members" | "midi";

function RoutePanel({ kind, id, color }: { kind: "bus" | "aux"; id: BusId | AuxId; color: string }) {
  const { tracks, buses, setBus, auxReturns, setAuxReturn, fxChains, addFxPlugin, removeFxPlugin, toggleFxBypass, setFxParam, updateTrack } = useStudio();
  const [tab, setTab] = useState<RouteTab>("level");
  const state: BusState = kind === "bus" ? buses[id as BusId] : auxReturns[id as AuxId];
  const change = (p: Partial<BusState>) => (kind === "bus" ? setBus(id as BusId, p) : setAuxReturn(id as AuxId, p));
  const fxTarget = kind === "bus" ? `bus:${id}` : `send:${id}`;
  const meterId = `${kind}:${id}`;
  const list = fxChains[fxTarget] ?? [];
  const name = kind === "bus" ? `${id} bus` : `${id} return`;
  const tabs: [RouteTab, string][] = kind === "bus"
    ? [["level", "Level"], ["effects", "Bus effects"], ["members", "Channels"], ["midi", "Hardware control"]]
    : [["level", "Level"], ["effects", "Return effects"], ["members", "Who sends here"], ["midi", "Hardware control"]];
  return (
    <>
      <Tabs<RouteTab> tabs={tabs} value={tab} onChange={setTab} />
      {tab === "level" && (
        <Panel>
          <Section title={`${name} level`}>
            <div className="flex items-center justify-around gap-3">
              <Knob label="Level" ariaLabel={`${name} level`} value={state.volume} min={0} max={FADER_MAX_GAIN} step={0.01} defaultValue={1} format={(v) => (v === 0 ? "-∞" : `${toDb(v).toFixed(1)}`)} size={KNOB} onChange={(v) => change({ volume: v })} midiTarget={{ id: meterId, param: "volume" }} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <BigButton onClick={() => change({ volume: 1 })}>Unity 0 dB</BigButton>
              <BigButton on={state.muted} onClick={() => change({ muted: !state.muted })} className={state.muted ? "border-amber-500 bg-amber-500 text-black" : undefined}>{state.muted ? "Muted" : "Mute"}</BigButton>
            </div>
          </Section>
          <Section title="Live signal">
            <Scope scopeId={meterId} height={56} compact color={color} />
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Goes to → Master</p>
          </Section>
        </Panel>
      )}
      {tab === "effects" && (
        <Panel>
          <Section title={`${name} effects`} className="col-span-full">
            <InsertRack
              title={`${name} effects`}
              midiId={fxTarget}
              midiPrefix="fx"
              list={list}
              onAdd={(def) => addFxPlugin(fxTarget, def)}
              onRemove={(pid) => removeFxPlugin(fxTarget, pid)}
              onBypass={(pid) => toggleFxBypass(fxTarget, pid)}
              onParam={(pid, p, v) => setFxParam(fxTarget, pid, p, v)}
            />
          </Section>
        </Panel>
      )}
      {tab === "members" && (
        <Panel>
          <Section title={kind === "bus" ? `Channels playing into the ${name}` : `How much each channel sends to ${id}`} className="col-span-full">
            {tracks.length === 0 && <p className="text-sm text-muted-foreground">No channels yet.</p>}
            {kind === "bus" ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-1.5">
                {tracks.map((t) => (
                  <BigButton key={t.id} on={t.bus === id} onClick={() => updateTrack(t.id, { bus: t.bus === id ? "master" : (id as BusId) })} aria-label={`${t.name} into ${name}`} className="truncate normal-case" style={t.bus === id ? undefined : { borderLeft: `4px solid ${t.color}` }}>
                    {t.name}
                  </BigButton>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-around gap-3">
                {tracks.map((t) => (
                  <Knob
                    key={t.id}
                    label={t.name.slice(0, 10)}
                    ariaLabel={`${t.name} ${id} send`}
                    value={t.sends?.[id as AuxId] ?? 0}
                    defaultValue={0}
                    format={(v) => `${Math.round(v * 100)}%`}
                    size={KNOB - 8}
                    onChange={(v) => updateTrack(t.id, { sends: { reverb: 0, delay: 0, chorus: 0, ...(t.sends ?? {}), [id]: v } })}
                  />
                ))}
              </div>
            )}
          </Section>
        </Panel>
      )}
      {tab === "midi" && (
        <Panel>
          <Section title="Hardware control (MIDI learn)" className="col-span-full">
            <MidiLearnBlock id={meterId} params={["volume", "mute"]} title="Tap a control, then move a knob on your controller" />
          </Section>
        </Panel>
      )}
    </>
  );
}

/* ---------------- VCA ---------------- */

type VcaTab = "level" | "members" | "midi";

function VcaPanel({ id }: { id: VcaId }) {
  const { tracks, vcas, setVca, updateTrack } = useStudio();
  const [tab, setTab] = useState<VcaTab>("level");
  const state = vcas[id];
  const members = tracks.filter((t) => t.vca === id);
  return (
    <>
      <Tabs<VcaTab> tabs={[["level", "Level"], ["members", `Channels (${members.length})`], ["midi", "Hardware control"]]} value={tab} onChange={setTab} />
      {tab === "level" && (
        <Panel>
          <Section title={`VCA ${id} level`}>
            <div className="flex items-center justify-around gap-3">
              <Knob label="Level" ariaLabel={`VCA ${id} level`} value={state.volume} min={0} max={FADER_MAX_GAIN} step={0.01} defaultValue={1} format={(v) => (v === 0 ? "-∞" : `${toDb(v).toFixed(1)}`)} size={KNOB} onChange={(v) => setVca(id, { volume: v })} midiTarget={{ id: `vca:${id}`, param: "volume" }} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <BigButton onClick={() => setVca(id, { volume: 1 })}>Unity 0 dB</BigButton>
              <BigButton on={state.muted} onClick={() => setVca(id, { muted: !state.muted })} className={state.muted ? "border-amber-500 bg-amber-500 text-black" : undefined}>{state.muted ? "Muted" : "Mute group"}</BigButton>
            </div>
          </Section>
          <Section title="What a VCA does">
            <p className="text-sm text-muted-foreground">This fader turns all its channels up or down together. Their own faders stay where they are.</p>
            <p className="mt-2 font-mono text-xs font-bold uppercase text-foreground">{members.length ? members.map((t) => t.name).join(" · ") : "No channels yet — pick some in Channels"}</p>
          </Section>
        </Panel>
      )}
      {tab === "members" && (
        <Panel>
          <Section title={`Tap channels to put them on VCA ${id}`} className="col-span-full">
            {tracks.length === 0 && <p className="text-sm text-muted-foreground">No channels yet.</p>}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-1.5">
              {tracks.map((t) => (
                <BigButton key={t.id} on={t.vca === id} onClick={() => updateTrack(t.id, { vca: t.vca === id ? undefined : id })} aria-label={`${t.name} on VCA ${id}`} className="truncate normal-case" style={t.vca === id ? undefined : { borderLeft: `4px solid ${t.color}` }}>
                  {t.name}{t.vca && t.vca !== id ? ` (VCA ${t.vca})` : ""}
                </BigButton>
              ))}
            </div>
          </Section>
        </Panel>
      )}
      {tab === "midi" && (
        <Panel>
          <Section title="Hardware control (MIDI learn)" className="col-span-full">
            <MidiLearnBlock id={`vca:${id}`} params={["volume", "mute"]} title="Tap a control, then move a knob on your controller" />
          </Section>
        </Panel>
      )}
    </>
  );
}
