import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppWindow, Cable, Mic, Monitor, Music2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/synclab/store";
import { listAudioDevices, setPreferredInput, type AudioDeviceInfo } from "@/lib/synclab/mic";
import { getOutputAccess, getRoutes, listOutputs, onRoutesChange, sendTestNote, setRoute } from "@/lib/synclab/external-midi";

const VIRTUAL = /blackhole|loopback|soundflower|vb-?cable|virtual/i;

/** Bring other music apps on this computer into SYNCLAB: their sound, MIDI and a live window view. */
export function ExternalApps() {
  const { tracks } = useStudio();
  const [inputs, setInputs] = useState<AudioDeviceInfo[]>([]);
  const [outs, setOuts] = useState<{ id: string; name: string }[]>([]);
  const [routes, setRoutesState] = useState(getRoutes());
  const [level, setLevel] = useState(0);
  const [listenId, setListenId] = useState<string | null>(null);
  const [views, setViews] = useState<{ id: string; stream: MediaStream; label: string }[]>([]);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => onRoutesChange(() => setRoutesState({ ...getRoutes() })), []);
  useEffect(() => () => { stopRef.current(); views.forEach((v) => v.stream.getTracks().forEach((t) => t.stop())); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scanAudio = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); } catch { /* permission denied */ }
    const ins = (await listAudioDevices()).filter((d) => d.kind === "audioinput");
    setInputs(ins);
    if (!ins.some((d) => VIRTUAL.test(d.label))) toast.message("No virtual audio device found", { description: "Install BlackHole (free), then set your app's output to BlackHole." });
  };

  const scanMidi = async () => {
    const a = await getOutputAccess();
    if (!a) return toast.error("MIDI isn't available", { description: "Use Chrome, Edge or the SYNCLAB desktop app." });
    const list = listOutputs();
    setOuts(list);
    if (!list.length) toast.message("No MIDI outputs", { description: "On a Mac, open Audio MIDI Setup → MIDI Studio → IAC Driver and tick 'Device is online'." });
  };

  const listen = async (d: AudioDeviceInfo) => {
    stopRef.current();
    if (listenId === d.id) { setListenId(null); setLevel(0); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: d.id }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      const timer = window.setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let pk = 0;
        for (const v of buf) pk = Math.max(pk, Math.abs(v));
        setLevel(pk);
      }, 50);
      stopRef.current = () => { clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); void ctx.close(); };
      setListenId(d.id);
    } catch (e) {
      toast.error("Couldn't open that input", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const useForRecording = (d: AudioDeviceInfo) => {
    setPreferredInput(d.id);
    toast.success(`Recording input set to ${d.label}`, { description: "Arm an audio track and press record to capture the app's sound." });
  };

  const addView = async () => {
    const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: MediaDevices["getDisplayMedia"] };
    if (!md.getDisplayMedia) return toast.error("Window viewing isn't supported in this browser");
    try {
      const stream = await md.getDisplayMedia({ video: true, audio: false });
      const label = stream.getVideoTracks()[0]?.label || "App window";
      const id = crypto.randomUUID();
      stream.getVideoTracks()[0]?.addEventListener("ended", () => setViews((v) => v.filter((x) => x.id !== id)));
      setViews((v) => [...v, { id, stream, label }]);
    } catch { /* user cancelled */ }
  };

  const noteTracks = tracks.filter((t) => t.kind === "synth" || t.kind === "midi");
  const db = level > 0 ? 20 * Math.log10(level) : -Infinity;

  return (
    <div className="space-y-5 p-1">
      <p className="text-xs text-muted-foreground">
        Other apps can't run inside SYNCLAB, but you can hear and record them, play them from your tracks, and watch their windows here. You still use their knobs in the app itself.
      </p>

      <section className="space-y-2 rounded-md border border-border bg-surface/50 p-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Mic className="size-4 text-primary" /> 1. Hear and record an app</h3>
        <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
          <li>Install the free BlackHole audio driver on your Mac.</li>
          <li>In the other app's audio settings, set its output to BlackHole.</li>
          <li>Press Find inputs, then Use for recording, and record on an audio track.</li>
        </ol>
        <Button size="sm" variant="secondary" onClick={() => void scanAudio()}>Find inputs</Button>
        <div className="space-y-1">
          {inputs.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 rounded border border-border px-2 py-1 text-xs">
              <span className="min-w-0 flex-1 truncate">{d.label}{VIRTUAL.test(d.label) && <span className="ml-2 rounded bg-primary/20 px-1 text-[10px] text-primary">APP AUDIO</span>}</span>
              {listenId === d.id && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-24 overflow-hidden rounded bg-muted"><span className="block h-full bg-primary" style={{ width: `${Math.min(100, level * 100)}%` }} /></span>
                  <span className="w-12 tabular-nums text-muted-foreground">{Number.isFinite(db) ? `${db.toFixed(1)} dB` : "-∞"}</span>
                </span>
              )}
              <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => void listen(d)}>{listenId === d.id ? "Stop meter" : "Meter"}</Button>
              <Button size="sm" variant="secondary" className="h-6 text-[11px]" onClick={() => useForRecording(d)}>Use for recording</Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-md border border-border bg-surface/50 p-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Cable className="size-4 text-primary" /> 2. Play an app from your tracks</h3>
        <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
          <li>Open Audio MIDI Setup → Window → Show MIDI Studio → IAC Driver, and tick "Device is online".</li>
          <li>In the other app, pick IAC Driver as its MIDI input.</li>
          <li>Choose a track below. Its notes (playback, keyboard, recording) go to the app instead of SYNCLAB's synth.</li>
        </ol>
        <Button size="sm" variant="secondary" onClick={() => void scanMidi()}>Find MIDI outputs</Button>
        {outs.length > 0 && (
          <div className="space-y-1">
            {noteTracks.length === 0 && <p className="text-xs text-muted-foreground">Add a synth or MIDI track first.</p>}
            {noteTracks.map((t) => {
              const r = routes[t.id];
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-2 rounded border border-border px-2 py-1 text-xs">
                  <Music2 className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <select aria-label={`MIDI output for ${t.name}`} className="h-6 rounded border border-border bg-background px-1" value={r?.portId ?? ""} onChange={(e) => setRoute(t.id, e.target.value ? { portId: e.target.value, channel: r?.channel ?? 1 } : null)}>
                    <option value="">SYNCLAB synth</option>
                    {outs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  {r && (
                    <>
                      <select aria-label="MIDI channel" className="h-6 rounded border border-border bg-background px-1" value={r.channel} onChange={(e) => setRoute(t.id, { ...r, channel: Number(e.target.value) })}>
                        {Array.from({ length: 16 }, (_, i) => <option key={i} value={i + 1}>Ch {i + 1}</option>)}
                      </select>
                      <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => sendTestNote(r.portId, r.channel)}>Test note</Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-md border border-border bg-surface/50 p-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Monitor className="size-4 text-primary" /> 3. Watch an app's window</h3>
        <p className="text-xs text-muted-foreground">Shows a live picture of the app. To turn its knobs, click in the app itself. The first time, macOS asks for Screen Recording permission.</p>
        <Button size="sm" variant="secondary" onClick={() => void addView()}><AppWindow className="mr-1 size-4" /> Show an app window</Button>
        <div className="grid gap-3 md:grid-cols-2">
          {views.map((v) => (
            <div key={v.id} className="overflow-hidden rounded border border-border">
              <div className="flex items-center justify-between bg-muted/40 px-2 py-1 text-[11px]">
                <span className="truncate">{v.label}</span>
                <button aria-label="Close window view" onClick={() => { v.stream.getTracks().forEach((t) => t.stop()); setViews((x) => x.filter((y) => y.id !== v.id)); }}><X className="size-3.5" /></button>
              </div>
              <video className="block w-full bg-background" autoPlay muted playsInline ref={(el) => { if (el && el.srcObject !== v.stream) el.srcObject = v.stream; }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
