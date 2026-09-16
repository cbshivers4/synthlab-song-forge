import type { PluginDef, PluginInstance, PluginKind, PluginParam } from "./types";
import { uid } from "./presets";

const p = (id: string, name: string, value: number, min: number, max: number, unit?: string): PluginParam => ({
  id,
  name,
  value,
  min,
  max,
  ...(unit ? { unit } : {}),
});

export const PARAMS_BY_KIND: Record<PluginKind, () => PluginParam[]> = {
  eq: () => [
    p("low", "Low", 0, -18, 18, "dB"),
    p("mid", "Mid", 0, -18, 18, "dB"),
    p("midFreq", "Mid Freq", 900, 200, 6000, "Hz"),
    p("high", "High", 0, -18, 18, "dB"),
    p("mix", "Output", 0, -12, 12, "dB"),
  ],
  filter: () => [
    p("cutoff", "Cutoff", 8000, 60, 18000, "Hz"),
    p("resonance", "Resonance", 1, 0.1, 20, "Q"),
    p("type", "Mode", 0, 0, 2, ""),
  ],
  drive: () => [
    p("drive", "Drive", 0.3, 0, 1, ""),
    p("tone", "Tone", 6000, 500, 16000, "Hz"),
    p("output", "Output", 0, -18, 6, "dB"),
  ],
  compressor: () => [
    p("threshold", "Threshold", -18, -60, 0, "dB"),
    p("ratio", "Ratio", 4, 1, 20, ":1"),
    p("attack", "Attack", 8, 0.1, 200, "ms"),
    p("release", "Release", 140, 10, 1000, "ms"),
    p("makeup", "Makeup", 0, -6, 18, "dB"),
  ],
  delay: () => [
    p("time", "Time", 320, 10, 1200, "ms"),
    p("feedback", "Feedback", 0.35, 0, 0.92, ""),
    p("mix", "Mix", 0.25, 0, 1, ""),
  ],
  gain: () => [p("gain", "Gain", 0, -24, 12, "dB")],
  width: () => [p("width", "Width", 1, 0, 2, ""), p("output", "Output", 0, -12, 6, "dB")],
  reverb: () => [
    p("decay", "Decay", 1.8, 0.2, 8, "s"),
    p("predelay", "Pre-Delay", 20, 0, 200, "ms"),
    p("mix", "Mix", 0.3, 0, 1, ""),
  ],
  chorus: () => [
    p("rate", "Rate", 1.2, 0.05, 8, "Hz"),
    p("depth", "Depth", 0.5, 0, 1, ""),
    p("mix", "Mix", 0.5, 0, 1, ""),
  ],
  flanger: () => [
    p("rate", "Rate", 0.4, 0.05, 5, "Hz"),
    p("depth", "Depth", 0.7, 0, 1, ""),
    p("feedback", "Feedback", 0.5, 0, 0.95, ""),
    p("mix", "Mix", 0.5, 0, 1, ""),
  ],
  phaser: () => [
    p("rate", "Rate", 0.5, 0.05, 8, "Hz"),
    p("depth", "Depth", 0.7, 0, 1, ""),
    p("center", "Center", 800, 200, 4000, "Hz"),
    p("mix", "Mix", 0.5, 0, 1, ""),
  ],
  tremolo: () => [
    p("rate", "Rate", 5, 0.1, 20, "Hz"),
    p("depth", "Depth", 0.6, 0, 1, ""),
  ],
  autopan: () => [
    p("rate", "Rate", 1, 0.05, 10, "Hz"),
    p("depth", "Depth", 0.8, 0, 1, ""),
  ],
  limiter: () => [
    p("ceiling", "Ceiling", -0.3, -12, 0, "dB"),
    p("release", "Release", 60, 5, 500, "ms"),
  ],
  bitcrusher: () => [
    p("bits", "Bits", 8, 2, 16, "bit"),
    p("mix", "Mix", 1, 0, 1, ""),
  ],
  gate: () => [
    p("threshold", "Threshold", -45, -80, 0, "dB"),
    p("attack", "Attack", 2, 0.1, 50, "ms"),
    p("release", "Release", 80, 5, 1000, "ms"),
  ],
};

const def = (name: string, vendor: string, format: PluginDef["format"], kind: PluginKind): PluginDef => ({
  id: `${vendor}-${name}`.toLowerCase().replace(/\s+/g, "-"),
  name,
  vendor,
  format,
  kind,
  params: PARAMS_BY_KIND[kind](),
});

export const BUILT_IN_PLUGINS: PluginDef[] = [
  def("Channel EQ", "SYNCLAB", "Built-in", "eq"),
  def("Analog Filter", "SYNCLAB", "Built-in", "filter"),
  def("Tube Drive", "SYNCLAB", "Built-in", "drive"),
  def("Bus Compressor", "SYNCLAB", "Built-in", "compressor"),
  def("Tape Echo", "SYNCLAB", "Built-in", "delay"),
  def("Stereo Width", "SYNCLAB", "Built-in", "width"),
  def("Utility Gain", "SYNCLAB", "Built-in", "gain"),
  def("Hall Reverb", "SYNCLAB", "Built-in", "reverb"),
  def("Studio Chorus", "SYNCLAB", "Built-in", "chorus"),
  def("Jet Flanger", "SYNCLAB", "Built-in", "flanger"),
  def("Phase Shifter", "SYNCLAB", "Built-in", "phaser"),
  def("Tremolo", "SYNCLAB", "Built-in", "tremolo"),
  def("Auto Panner", "SYNCLAB", "Built-in", "autopan"),
  def("Brickwall Limiter", "SYNCLAB", "Built-in", "limiter"),
  def("Bit Crusher", "SYNCLAB", "Built-in", "bitcrusher"),
  def("Noise Gate", "SYNCLAB", "Built-in", "gate"),
];

export const makeDef = (name: string, vendor: string, format: PluginDef["format"], kind: PluginKind) =>
  def(name, vendor, format, kind);

export const instantiate = (d: PluginDef): PluginInstance => ({
  id: uid(),
  defId: d.id,
  name: d.name,
  vendor: d.vendor,
  format: d.format,
  kind: d.kind,
  bypass: false,
  params: d.params.map((x) => ({ ...x })),
});

export const PLUGIN_KINDS: PluginKind[] = ["eq", "filter", "drive", "compressor", "delay", "width", "gain"];
