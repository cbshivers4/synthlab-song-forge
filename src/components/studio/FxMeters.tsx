import { useEffect, useRef, useState } from "react";
import type { PluginInstance } from "@/lib/synclab/types";
import { fxAnalysers, fxReadings } from "@/lib/synclab/fx-dsp";
import {
  detectPitch,
  noteLabel,
  tuneReadings,
  NOTE_NAMES,
  TUNE_SCALES,
} from "@/lib/synclab/vocal-tune";
import { VuFace } from "./VuFace";

const FPS_MS = 50; // meters draw at 20 fps
const val = (pl: PluginInstance, id: string, fb: number) =>
  pl.params.find((p) => p.id === id)?.value ?? fb;

function useTick(on: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setN((n) => (n + 1) % 1_000_000), FPS_MS);
    return () => window.clearInterval(t);
  }, [on]);
}

/** Live readings for analysis devices and gain-reduction meters; renders nothing for other effects. */
export function FxLiveMeter({ plugin }: { plugin: PluginInstance }) {
  switch (plugin.kind) {
    case "tuner":
      return <TunerMeter plugin={plugin} />;
    case "vumeter":
      return <VuPair plugin={plugin} />;
    case "vocaltune":
      return <TuneMeter plugin={plugin} />;
    case "channelstrip":
      return <Reduction plugin={plugin} labels={["COMP", "GATE"]} />;
    case "deesser":
      return <Reduction plugin={plugin} labels={["DE-ESS"]} />;
    case "expander":
      return <Reduction plugin={plugin} labels={["EXPAND"]} />;
    case "multiband":
      return <Reduction plugin={plugin} labels={["LOW", "MID", "HIGH"]} />;
    default:
      return null;
  }
}

function TunerMeter({ plugin }: { plugin: PluginInstance }) {
  useTick(!plugin.bypass);
  const smooth = useRef<{ midi: number; hold: number }>({ midi: -1, hold: 0 });
  const buf = useRef<Float32Array | null>(null);
  const ref = val(plugin, "reference", 440);
  const bass = val(plugin, "range", 0) >= 0.5;
  let hz = 0;
  const an = plugin.bypass ? undefined : fxAnalysers.get(plugin.id)?.[0];
  if (an) {
    if (!buf.current || buf.current.length !== an.fftSize)
      buf.current = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf.current as Float32Array<ArrayBuffer>);
    const src = buf.current,
      half = new Float32Array(src.length >> 1);
    for (let i = 0; i < half.length; i++) half[i] = (src[2 * i]! + src[2 * i + 1]!) * 0.5;
    hz = detectPitch(half, an.context.sampleRate / 2, bass ? 28 : 60, bass ? 400 : 1400);
  }
  const s = smooth.current;
  if (hz > 0) {
    const m = 69 + 12 * Math.log2(hz / ref);
    s.midi = s.midi < 0 || Math.abs(m - s.midi) > 0.5 ? m : s.midi + (m - s.midi) * 0.35;
    s.hold = 10;
  } else if (s.hold > 0) s.hold--;
  else s.midi = -1;
  const on = s.midi >= 0;
  const note = on ? Math.round(s.midi) : -1;
  const cents = on ? Math.round((s.midi - note) * 100) : 0;
  const inTune = on && Math.abs(cents) <= 3;
  const freq = on ? ref * Math.pow(2, (s.midi - 69) / 12) : 0;
  return (
    <div
      className="fx-tuner"
      data-on={on}
      data-in-tune={inTune}
      role="status"
      aria-live="off"
      aria-label={
        on ? `${noteLabel(note)} ${cents >= 0 ? "+" : ""}${cents} cents` : "No pitch detected"
      }
    >
      <div className="fx-tuner-note">
        <span className="fx-tuner-flat" data-lit={on && cents < -3}>
          ♭
        </span>
        <b>{on ? NOTE_NAMES[((note % 12) + 12) % 12] : "—"}</b>
        <small>{on ? Math.floor(note / 12) - 1 : ""}</small>
        <span className="fx-tuner-sharp" data-lit={on && cents > 3}>
          ♯
        </span>
      </div>
      <div className="fx-tuner-scale" aria-hidden="true">
        {Array.from({ length: 21 }, (_, i) => (
          <i key={i} data-center={i === 10} data-lit={on && Math.round(cents / 5) + 10 === i} />
        ))}
      </div>
      <div className="fx-tuner-read">
        <span>{on ? `${cents >= 0 ? "+" : ""}${cents} ct` : "play a note"}</span>
        <span>{on ? `${freq.toFixed(1)} Hz` : ""}</span>
        <span>
          A4 = {Math.round(ref)} Hz{val(plugin, "mute", 0) >= 0.5 ? " · MUTED" : ""}
        </span>
      </div>
    </div>
  );
}

function VuPair({ plugin }: { plugin: PluginInstance }) {
  useTick(!plugin.bypass);
  const st = useRef({ l: 0, r: 0, pk: -Infinity, t: 0, bufs: [] as Float32Array[] });
  const refDb = val(plugin, "reference", -18);
  const tau = val(plugin, "response", 0) >= 0.5 ? 0.02 : 0.1;
  const ans = plugin.bypass ? undefined : fxAnalysers.get(plugin.id);
  const s = st.current;
  const now = performance.now() / 1000,
    dt = s.t ? Math.min(0.2, now - s.t) : FPS_MS / 1000;
  s.t = now;
  const k = 1 - Math.exp(-dt / tau);
  let peak = 0;
  const rms = [0, 1].map((ch) => {
    const an = ans?.[ch];
    if (!an) return 0;
    const b = (s.bufs[ch] ??= new Float32Array(an.fftSize));
    an.getFloatTimeDomainData(b as Float32Array<ArrayBuffer>);
    let sum = 0;
    for (let i = 0; i < b.length; i++) {
      sum += b[i]! * b[i]!;
      peak = Math.max(peak, Math.abs(b[i]!));
    }
    return Math.sqrt(sum / b.length);
  });
  s.l += (rms[0]! - s.l) * k;
  s.r += (rms[1]! - s.r) * k;
  const toDb = (x: number) => (x > 1e-6 ? 20 * Math.log10(x) : -120);
  const pkDb = toDb(peak);
  s.pk = Math.max(pkDb, s.pk - dt * 8);
  const vu = (x: number) => Math.max(-60, toDb(x) - refDb);
  return (
    <div className="fx-vu-pair">
      <VuFace vuDb={vu(s.l)} sub="LEFT" ariaLabel="Left VU meter" />
      <VuFace vuDb={vu(s.r)} sub="RIGHT" ariaLabel="Right VU meter" />
      <div className="fx-vu-read">
        <span>0 VU = {refDb} dBFS</span>
        <span>
          RMS L {toDb(s.l) > -100 ? toDb(s.l).toFixed(1) : "−∞"} · R{" "}
          {toDb(s.r) > -100 ? toDb(s.r).toFixed(1) : "−∞"} dBFS
        </span>
        <span data-hot={s.pk > -0.5}>PEAK {s.pk > -100 ? s.pk.toFixed(1) : "−∞"} dBFS</span>
      </div>
    </div>
  );
}

function TuneMeter({ plugin }: { plugin: PluginInstance }) {
  useTick(!plugin.bypass);
  const r = plugin.bypass ? undefined : tuneReadings.get(plugin.id);
  const voiced = !!r && r.hz > 0;
  const cents = r ? Math.round(r.cents) : 0;
  const key = NOTE_NAMES[Math.round(val(plugin, "key", 0))] ?? "C";
  const scale = TUNE_SCALES[Math.round(val(plugin, "scale", 1))] ?? "Major";
  return (
    <div
      className="fx-tune"
      data-on={voiced}
      role="status"
      aria-label={
        voiced
          ? `Singing ${noteLabel(r!.note)}, tuned to ${noteLabel(r!.target)}`
          : "Waiting for a voice"
      }
    >
      <div className="fx-tune-notes">
        <div>
          <small>INPUT</small>
          <b>{voiced ? noteLabel(r!.note) : "—"}</b>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <small>TUNED TO</small>
          <b>{voiced ? noteLabel(r!.target) : "—"}</b>
        </div>
      </div>
      <div className="fx-tune-bar" aria-hidden="true">
        <i style={{ left: `${50 + Math.max(-50, Math.min(50, cents / 2))}%` }} />
      </div>
      <div className="fx-tune-read">
        <span>
          {key} {scale}
        </span>
        <span>
          CORRECTION {cents >= 0 ? "+" : ""}
          {cents} ct
        </span>
        {!r && !plugin.bypass && <span>Play or sing through the track to see pitch</span>}
      </div>
    </div>
  );
}

function Reduction({ plugin, labels }: { plugin: PluginInstance; labels: string[] }) {
  useTick(!plugin.bypass);
  const read = plugin.bypass ? undefined : fxReadings.get(plugin.id);
  const values = read ? read() : labels.map(() => 0);
  return (
    <div className="fx-gr" aria-label="Gain reduction">
      {labels.map((l, i) => {
        const v = Math.max(0, Math.min(24, values[i] ?? 0));
        return (
          <div key={l} className="fx-gr-row">
            <span>{l}</span>
            <div className="fx-gr-track">
              <i style={{ width: `${(v / 24) * 100}%` }} />
            </div>
            <b>-{v.toFixed(1)} dB</b>
          </div>
        );
      })}
    </div>
  );
}
