import { useEffect, useMemo, useState } from "react";
import { Bluetooth, Cable, Plus, Trash2, Usb, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useStudio } from "@/lib/synclab/store";
import { connectedInterface } from "@/lib/synclab/audio-interface-detect";
import { GEAR_LABEL, LINK_LABEL, connectedGear, setPluggedGear, usePluggedGear, type Gear, type GearKind, type GearLink, type PluggedIn } from "@/lib/synclab/studio-gear";

/** Audio device names the browser reports (names stay blank until microphone access is allowed). */
function useAudioDevices() {
  const [devices, setDevices] = useState<{ inputs: { label: string }[]; outputs: { label: string }[] }>({ inputs: [], outputs: [] });
  useEffect(() => {
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md?.enumerateDevices) return;
    let alive = true;
    const scan = () => md.enumerateDevices().then((list) => {
      if (!alive) return;
      setDevices({
        inputs: list.filter((d) => d.kind === "audioinput" && d.label).map((d) => ({ label: d.label })),
        outputs: list.filter((d) => d.kind === "audiooutput" && d.label).map((d) => ({ label: d.label })),
      });
    }).catch(() => undefined);
    scan();
    md.addEventListener?.("devicechange", scan);
    return () => { alive = false; md.removeEventListener?.("devicechange", scan); };
  }, []);
  return devices;
}

export function useConnectedGear(): { gear: Gear[]; interfaceName: string | null; namesHidden: boolean } {
  const { midiInputs, midiOutputs } = useStudio();
  const audio = useAudioDevices();
  const plugged = usePluggedGear();
  const interfaceName = useMemo(() => connectedInterface(audio.inputs, audio.outputs), [audio]);
  const gear = useMemo(() => connectedGear({ midiInputs, midiOutputs, audioInputs: audio.inputs, interfaceName, plugged }), [midiInputs, midiOutputs, audio, interfaceName, plugged]);
  return { gear, interfaceName, namesHidden: audio.inputs.length === 0 };
}

export const LinkIcon = ({ link, className = "size-3" }: { link: GearLink; className?: string }) =>
  link === "bluetooth" ? <Bluetooth className={className} /> : link === "network" ? <Wifi className={className} /> : link === "cable" ? <Cable className={className} /> : <Usb className={className} />;

/** Simple line drawings in the studio's hardware style; the kind decides the silhouette. */
export function GearDrawing({ kind }: { kind: GearKind }) {
  if (kind === "guitar" || kind === "bass") {
    const bass = kind === "bass";
    return <svg viewBox="0 0 200 195" aria-hidden="true" className="studio-instrument-art" data-gear={kind}>
      <path d="M70 190l30-34 30 34M100 156v-14" className="studio-stand" />
      <rect x="95" y="6" width="10" height={bass ? 92 : 80} rx="2" className="studio-hardware-edge" />
      <rect x="90" y="0" width="20" height="14" rx="3" className="studio-hardware-face" />
      {Array.from({ length: bass ? 4 : 6 }, (_, i) => <circle key={i} cx={i % 2 ? 114 : 86} cy={3 + Math.floor(i / 2) * 5} r="2.4" className="studio-knob" />)}
      <path d={bass ? "M100 96c-30 0-38 14-30 28 6 10-10 14-6 30 6 22 66 22 72 0 4-16-12-20-6-30 8-14 0-28-30-28z" : "M100 84c-26 0-34 14-26 26 5 8-12 14-8 30 6 24 62 24 68 0 4-16-13-22-8-30 8-12 0-26-26-26z"} className="studio-hardware-face" />
      <rect x="86" y={bass ? 118 : 106} width="28" height="7" rx="1" className="studio-hardware-edge" />
      <rect x="84" y={bass ? 138 : 126} width="32" height="5" rx="1" className="studio-hardware-edge" />
      {[0, 1].map((i) => <circle key={i} cx={124 + i * 7} cy={bass ? 150 : 138} r="3.5" className="studio-knob" />)}
      {Array.from({ length: bass ? 4 : 6 }, (_, i) => <path key={i} d={`M${96 + i * (8 / (bass ? 3 : 5))} 8V${bass ? 142 : 130}`} className="studio-knob-mark" />)}
    </svg>;
  }
  if (kind === "mic" || kind === "headset") {
    return <svg viewBox="0 0 200 195" aria-hidden="true" className="studio-instrument-art" data-gear={kind}>
      {kind === "headset" ? <>
        <path d="M50 110v-20q0-50 50-50t50 50v20" fill="none" className="studio-stand" strokeWidth="8" />
        <rect x="34" y="104" width="30" height="46" rx="13" className="studio-hardware-face" />
        <rect x="136" y="104" width="30" height="46" rx="13" className="studio-hardware-face" />
        <path d="M50 150q10 26 40 22" className="studio-mic-cable" />
      </> : <>
        <path d="M100 78v96m0-42-52 55m52-55 52 55" className="studio-stand" />
        <path d="M84 58v9q0 18 16 18t16-18v-9" className="studio-stand" />
        <rect x="88" y="14" width="24" height="59" rx="12" className="studio-hardware-face" />
        {[24, 32, 40, 48, 56].map((y) => <path key={y} d={`M92 ${y}h16`} className="studio-knob-mark" />)}
      </>}
    </svg>;
  }
  if (kind === "interface") {
    return <svg viewBox="0 0 200 195" aria-hidden="true" className="studio-instrument-art" data-gear={kind}>
      <rect x="20" y="96" width="160" height="58" rx="6" className="studio-hardware-face" />
      {[0, 1].map((i) => <g key={i}><circle cx={52 + i * 40} cy="118" r="11" className="studio-knob" /><circle cx={52 + i * 40} cy="142" r="5" className="studio-speaker-inner" /></g>)}
      <circle cx="148" cy="122" r="16" className="studio-knob" />
      <path d="M148 108v8" className="studio-knob-mark" />
      <path d="M30 160h140" className="studio-hardware-edge" />
    </svg>;
  }
  const pads = kind === "pads" || kind === "drum";
  const dj = kind === "dj";
  return <svg viewBox="0 0 280 195" aria-hidden="true" className="studio-instrument-art" data-gear={kind}>
    <path d="M60 108 213 188M220 108 67 188M43 190h51m102 0h51" className="studio-stand" />
    <path d="M18 39h244l10 75H8z" className="studio-hardware-face" />
    <path d="M8 114h264v12H8z" className="studio-hardware-edge" />
    {dj ? <>{[78, 202].map((x) => <g key={x}><circle cx={x} cy="76" r="30" className="studio-speaker-cone" /><circle cx={x} cy="76" r="6" className="studio-speaker-inner" /></g>)}{[126, 140, 154].map((x) => <rect key={x} x={x - 3} y="54" width="6" height="40" rx="2" className="studio-hardware-edge" />)}</>
      : pads ? Array.from({ length: 16 }, (_, i) => <rect key={i} x={27 + (i % 8) * 29} y={62 + Math.floor(i / 8) * 25} width="22" height="19" rx="2" className="studio-pad" />)
      : <>{Array.from({ length: 7 }, (_, i) => <circle key={i} cx={111 + i * 21} cy="52" r="6" className="studio-knob" />)}{Array.from({ length: 24 }, (_, i) => <rect key={i} x={22 + i * 10} y="69" width="9" height="39" className="studio-white-key" />)}{Array.from({ length: 23 }, (_, i) => [0, 1, 3, 4, 5].includes(i % 7) ? <rect key={i} x={28 + i * 10} y="69" width="6" height="23" className="studio-black-key" /> : null)}</>}
  </svg>;
}

const PLUG_KINDS: PluggedIn["kind"][] = ["guitar", "bass", "mic", "keyboard", "synth", "drum"];

/** Front-of-room shelf: gear the browser reports plus what you said is plugged into your interface. */
export function StudioGearShelf() {
  const { gear, interfaceName, namesHidden } = useConnectedGear();
  const plugged = usePluggedGear();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PluggedIn["kind"]>("guitar");
  const [input, setInput] = useState("1");
  const [name, setName] = useState("");
  const add = () => {
    setPluggedGear([...plugged, { id: Math.random().toString(36).slice(2, 9), kind, input: Number(input), ...(name.trim() ? { name: name.trim() } : {}) }]);
    setName("");
  };
  return <div className="studio-gear-shelf" aria-label="Connected gear">
    <div className="studio-gear-head">
      <span className="font-display text-xs font-semibold">CONNECTED GEAR</span>
      <span className="text-[10px] text-muted-foreground">{gear.length ? `${gear.length} connected` : "Nothing reported yet"}</span>
      <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setOpen(true)}><Plus className="size-3" />What's plugged in?</Button>
    </div>
    {gear.length === 0 && <p className="px-2 pb-2 text-[11px] text-muted-foreground">
      USB and Bluetooth MIDI gear appears here by itself. A guitar, bass or mic on the end of a cable can't be seen by a browser — tap “What's plugged in?” to add it.
      {namesHidden ? " Allow the microphone in Settings to see audio device names." : ""}
    </p>}
    <div className="studio-gear-row">
      {gear.map((g) => <div key={g.id} className="studio-gear-item" data-gear-kind={g.kind} title={`${g.name} · ${g.detail}${g.reported ? "" : " (added by you)"}`}>
        <GearDrawing kind={g.kind} />
        <span className="studio-gear-name">{g.name}</span>
        <span className="studio-gear-link" data-link={g.link}><LinkIcon link={g.link} />{LINK_LABEL[g.link]}{g.link === "cable" ? ` · IN ${g.detail.match(/Input (\d+)/)?.[1] ?? ""}` : ""}</span>
      </div>)}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto">
        <DialogTitle>What's plugged into your interface?</DialogTitle>
        <DialogDescription>
          {interfaceName ? `${interfaceName} is connected. ` : "No audio interface is reported right now — you can still add gear for when it is. "}
          A browser can't see what's on the end of a cable, so tell the studio what's on each input. This stays on this device.
        </DialogDescription>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs">Instrument
            <Select value={kind} onValueChange={(v) => setKind(v as PluggedIn["kind"])}><SelectTrigger aria-label="Instrument" className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{PLUG_KINDS.map((k) => <SelectItem key={k} value={k}>{GEAR_LABEL[k]}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className="grid gap-1 text-xs">Interface input
            <Select value={input} onValueChange={setInput}><SelectTrigger aria-label="Interface input" className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <SelectItem key={n} value={String(n)}>Input {n}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className="col-span-2 grid gap-1 text-xs">Name (optional)
            <Input value={name} maxLength={40} placeholder={`e.g. ${kind === "guitar" ? "Les Paul" : kind === "bass" ? "P-Bass" : kind === "mic" ? "SM7B" : "Juno-106"}`} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <Button className="min-h-11" onClick={add}><Plus className="size-4" />Add to studio</Button>
        {plugged.length > 0 && <ul className="space-y-1">
          {plugged.map((p) => <li key={p.id} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
            <Cable className="size-3 text-primary" /><span className="flex-1">{p.name || GEAR_LABEL[p.kind]} · Input {p.input}</span>
            <Button variant="ghost" size="icon" aria-label={`Remove ${p.name || GEAR_LABEL[p.kind]}`} onClick={() => setPluggedGear(plugged.filter((x) => x.id !== p.id))}><Trash2 className="size-3" /></Button>
          </li>)}
        </ul>}
      </DialogContent>
    </Dialog>
  </div>;
}
