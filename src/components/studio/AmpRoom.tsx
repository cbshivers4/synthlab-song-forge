import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Guitar, Headphones, Mic, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudio } from "@/lib/synclab/store";
import { availableEffects, effectBrand } from "@/lib/synclab/effect-catalog";
import { isAmp, isPedal, isRigDevice, otherInserts, rigDevices } from "@/lib/synclab/guitar-rig";
import type { PluginDef, PluginInstance } from "@/lib/synclab/types";
import { RackEffect } from "./RackEffect";

/** Short plain names for the pedal and amp types, shown under the brand name. */
const TYPE: Record<string, string> = {
  overdrive: "Overdrive", fuzz: "Fuzz", wah: "Wah", octaver: "Octave", analogdelay: "Delay", springverb: "Spring reverb",
  pedalcomp: "Compressor", boost: "Boost", univibe: "Vibe", rotary: "Rotary", amp: "Guitar & bass amp", leadamp: "Lead guitar amp", bassamp: "Bass amp",
};

const dragPayload = (d: PluginDef) => JSON.stringify({ type: "plugin", defId: d.id });

/**
 * Amp Room: its own area for guitar and bass amps and effect pedals. The rig is the chosen
 * track's real effect chain — pedals and amps are ordinary inserts, so the mixer, FX Rack,
 * saving and exports all hear the same thing. Arm + Hear me routes the live input through it.
 */
export function AmpRoom() {
  const { tracks, selected, select, addTrack, addPlugin, updateTrack, togglePluginBypass, installedPlugins, transport, setTransport, setPanel } = useStudio();
  const [trackId, setTrackId] = useState<string | null>(() => selected?.id ?? tracks.find((t) => rigDevices(t.plugins).length)?.id ?? tracks[0]?.id ?? null);
  const track = tracks.find((t) => t.id === trackId) ?? null;
  const chain = track?.plugins ?? [];
  const rig = rigDevices(chain);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = rig.find((x) => x.plugin.id === editId) ?? rig[rig.length - 1] ?? null;

  useEffect(() => { if (!track && tracks[0]) setTrackId(tracks[0].id); }, [track, tracks]);

  const defs = useMemo(() => availableEffects(installedPlugins).filter((d) => isRigDevice(d.kind)), [installedPlugins]);
  const pedalDefs = defs.filter((d) => isPedal(d.kind));
  const ampDefs = defs.filter((d) => isAmp(d.kind));
  const pedals = rig.filter((x) => isPedal(x.plugin.kind));
  const amps = rig.filter((x) => isAmp(x.plugin.kind));

  const add = (d: PluginDef, target = track?.id) => {
    if (!target) { toast("Add a track first", { description: "Use New guitar track or New bass track." }); return; }
    const id = addPlugin(target, d, { rig: true, quiet: true });
    setEditId(id);
    toast.success(`${effectBrand(d)} plugged in`, { description: isPedal(d.kind) ? "Placed before the amp." : "Placed after the pedals." });
  };

  const newRigTrack = (bass: boolean) => {
    const id = addTrack("audio", bass ? "BASS" : "GUITAR", undefined, { keepPanel: true });
    const amp = ampDefs.find((d) => d.kind === (bass ? "bassamp" : "leadamp")) ?? ampDefs[0];
    for (const t of tracks) if (t.armed) updateTrack(t.id, { armed: false });
    updateTrack(id, { armed: true });
    setTrackId(id);
    select(id);
    if (amp) add(amp, id);
  };

  const armed = !!track?.armed;
  const toggleArm = () => {
    if (!track) return;
    if (!armed) for (const t of tracks) if (t.armed && t.id !== track.id) updateTrack(t.id, { armed: false });
    updateTrack(track.id, { armed: !armed });
  };
  const inputTrack = track && (track.kind === "audio" || track.kind === "ai-vocal" || track.kind === "sampler");

  return (
    <div className="amproom hardware-device space-y-3 rounded-md p-3">
      <header className="flex flex-wrap items-center gap-2">
        <Guitar className="size-6 text-primary" aria-hidden="true" />
        <h2 className="amproom-brand">SYNCLAB <b>Amp Room</b></h2>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">GUITAR · BASS · PEDALS</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" className="h-10 gap-1.5" onClick={() => newRigTrack(false)}><Plus className="size-4" />New guitar track</Button>
          <Button size="sm" variant="secondary" className="h-10 gap-1.5" onClick={() => newRigTrack(true)}><Plus className="size-4" />New bass track</Button>
        </div>
      </header>

      {track ? (
        <>
          <div className="amproom-input flex flex-wrap items-center gap-2">
            <span className="label-xs">RIG ON</span>
            <Select value={track.id} onValueChange={(id) => { setTrackId(id); setEditId(null); select(id); }}>
              <SelectTrigger className="h-10 w-48" aria-label="Track the rig is on"><SelectValue /></SelectTrigger>
              <SelectContent>{tracks.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{rigDevices(t.plugins).length ? ` · ${rigDevices(t.plugins).length} in rig` : ""}</SelectItem>)}</SelectContent>
            </Select>
            {inputTrack && <>
              <Button size="sm" variant={armed ? "default" : "outline"} aria-pressed={armed} className="h-10 gap-1.5" onClick={toggleArm}><Mic className="size-4" />{armed ? "ARMED" : "ARM"}</Button>
              <Button size="sm" variant={transport.monitor ? "default" : "outline"} aria-pressed={!!transport.monitor} className="h-10 gap-1.5" onClick={() => setTransport({ monitor: !transport.monitor })}><Headphones className="size-4" />HEAR ME</Button>
            </>}
            <p className="w-full text-[11px] text-muted-foreground">
              {inputTrack
                ? "Plug your guitar or bass into your audio interface, ARM, then HEAR ME to play through the rig. Use headphones — the browser adds a little delay. Takes record clean and play back through the rig, so you can change the sound later."
                : "This track plays its own notes through the rig. For a real guitar or bass, use New guitar track."}
            </p>
          </div>

          <div className="amproom-flow" aria-label="Signal flow">
            <span className="amproom-jack">IN</span>
            {rig.length === 0 && <span className="text-[11px] text-muted-foreground">No amps or pedals yet — add some below.</span>}
            {rig.map(({ plugin }) => (
              <button key={plugin.id} type="button" data-fx-skin={plugin.kind} data-bypassed={plugin.bypass} aria-pressed={editing?.plugin.id === plugin.id}
                className="amproom-flow-chip amproom-raw" onClick={() => setEditId(plugin.id)}>{effectBrand(plugin)}</button>
            ))}
            <span className="amproom-jack">MIXER</span>
            {otherInserts(chain) > 0 && <span className="text-[10px] text-muted-foreground">+ {otherInserts(chain)} other effect{otherInserts(chain) === 1 ? "" : "s"} on this track</span>}
          </div>

          <div className="amproom-stage">
            <section className="amproom-board" aria-label="Pedalboard">
              <p className="label-xs amproom-board-label">PEDALBOARD</p>
              <div className="amproom-board-row">
                {pedals.length === 0 && <p className="amproom-empty">Add pedals from the list below. They plug in before the amp.</p>}
                {pedals.map(({ plugin }) => <PedalTile key={plugin.id} plugin={plugin} active={editing?.plugin.id === plugin.id} onEdit={() => setEditId(plugin.id)} onStomp={() => togglePluginBypass(track.id, plugin.id)} />)}
              </div>
            </section>
            <section className="amproom-stack" aria-label="Amp">
              {amps.length === 0 && <p className="amproom-empty">No amp yet. Pick one below.</p>}
              {amps.map(({ plugin }) => <AmpTile key={plugin.id} plugin={plugin} active={editing?.plugin.id === plugin.id} onEdit={() => setEditId(plugin.id)} onPower={() => togglePluginBypass(track.id, plugin.id)} />)}
            </section>
          </div>

          <div className="amproom-shop">
            <div>
              <p className="label-xs mb-1.5">ADD PEDAL · tap, or drag onto a timeline track</p>
              <div className="amproom-shop-list">{pedalDefs.map((d) => <ShopItem key={d.id} def={d} onAdd={() => add(d)} />)}</div>
            </div>
            <div>
              <p className="label-xs mb-1.5">ADD AMP</p>
              <div className="amproom-shop-list">{ampDefs.map((d) => <ShopItem key={d.id} def={d} onAdd={() => add(d)} />)}</div>
            </div>
          </div>

          {editing && (
            <section aria-label="Edit rig device" className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="label-xs">EDIT · {effectBrand(editing.plugin)}</p>
                <Button size="sm" variant="ghost" className="ml-auto h-9 gap-1.5 text-[11px]" onClick={() => setPanel("plugins")}><SlidersHorizontal className="size-3.5" />Whole chain in FX Rack</Button>
              </div>
              <RackEffect trackId={track.id} plugin={editing.plugin} index={editing.index} count={chain.length} />
            </section>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Start with New guitar track or New bass track.</p>
      )}
    </div>
  );
}

function ShopItem({ def, onAdd }: { def: PluginDef; onAdd: () => void }) {
  return (
    <button type="button" data-fx-skin={def.kind} draggable className="amproom-shop-item amproom-raw"
      onDragStart={(e) => { const payload = dragPayload(def); e.dataTransfer.setData("application/synclab", payload); e.dataTransfer.setData("text/plain", payload); e.dataTransfer.effectAllowed = "copy"; }}
      onClick={onAdd} aria-label={`Add ${effectBrand(def)}`}>
      <span className="amproom-shop-swatch" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[12px] font-semibold">{effectBrand(def)}</span>
        <span className="block truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{TYPE[def.kind] ?? def.name}</span>
      </span>
      <Plus className="size-4 shrink-0 text-primary" aria-hidden="true" />
    </button>
  );
}

function PedalTile({ plugin, active, onEdit, onStomp }: { plugin: PluginInstance; active: boolean; onEdit: () => void; onStomp: () => void }) {
  const on = !plugin.bypass;
  return (
    <div className="amproom-pedal" data-fx-skin={plugin.kind} data-active={active} data-on={on} style={{ "--pedal-tilt": "0deg" } as CSSProperties}>
      <button type="button" className="amproom-pedal-face amproom-raw" onClick={onEdit} aria-label={`Edit ${effectBrand(plugin)}`}>
        <span className="amproom-pedal-knobs" aria-hidden="true"><i /><i /><i /></span>
        <span className="amproom-pedal-name">{effectBrand(plugin)}</span>
        <span className="amproom-pedal-type">{TYPE[plugin.kind] ?? plugin.name}</span>
      </button>
      <span className="fx-pedal-led" data-on={on} aria-hidden="true" />
      <button type="button" className="amproom-footswitch amproom-raw" aria-pressed={on} aria-label={`${effectBrand(plugin)} ${on ? "on — stomp to bypass" : "bypassed — stomp to turn on"}`} onClick={onStomp} />
      <span className="amproom-pedal-state">{on ? "ON" : "BYPASS"}</span>
    </div>
  );
}

function AmpTile({ plugin, active, onEdit, onPower }: { plugin: PluginInstance; active: boolean; onEdit: () => void; onPower: () => void }) {
  const on = !plugin.bypass;
  return (
    <div className="amproom-amp" data-fx-skin={plugin.kind} data-active={active} data-on={on}>
      <button type="button" className="amproom-amp-head amproom-raw" onClick={onEdit} aria-label={`Edit ${effectBrand(plugin)}`}>
        <span className="amproom-amp-name">{effectBrand(plugin)}</span>
        <span className="amproom-amp-knobs" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</span>
      </button>
      <div className="amproom-amp-power">
        <span className="fx-pedal-led" data-on={on} aria-hidden="true" />
        <Button size="sm" variant="outline" className="h-9 text-[10px]" aria-pressed={on} onClick={onPower}>{on ? "ON" : "STANDBY"}</Button>
      </div>
      <div className="amproom-cab" aria-hidden="true"><span>{TYPE[plugin.kind] ?? plugin.name}</span></div>
    </div>
  );
}
