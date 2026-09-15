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
