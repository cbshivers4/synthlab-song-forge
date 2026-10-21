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
  // 8-band fully parametric EQ (FabFilter Pro-Q style). Band type index maps to EQ_BAND_TYPES.
  paraeq: () =>
    [
      [1, 1, 30, 0, 0.7], // low cut, off
      [0, 0, 90, 0, 0.7], // low shelf
      [0, 2, 220, 0, 1],
      [0, 2, 700, 0, 1],
      [0, 2, 2000, 0, 1],
      [0, 2, 5000, 0, 1],
      [0, 4, 9000, 0, 0.7], // high shelf
      [1, 5, 19000, 0, 0.7], // high cut, off
    ].flatMap((b, i) => {
      const n = i + 1;
      const [on, type, freq, gain, q] = b as [number, number, number, number, number];
      return [
        p(`b${n}on`, `Band ${n} On`, on, 0, 1),
        p(`b${n}type`, `Band ${n} Type`, type, 0, 5),
        p(`b${n}freq`, `Band ${n} Freq`, freq, 20, 20000, "Hz"),
        p(`b${n}gain`, `Band ${n} Gain`, gain, -30, 30, "dB"),
        p(`b${n}q`, `Band ${n} Q`, q, 0.1, 18, "Q"),
      ];
    }).concat([p("output", "Output", 0, -24, 24, "dB")]),
  filter: () => [
    p("cutoff", "Cutoff", 8000, 60, 18000, "Hz"),
    p("resonance", "Resonance", 1, 0.1, 20, "Q"),
    p("type", "Mode", 0, 0, 2, ""),
    p("input", "Input", 0, -18, 18, "dB"),
    p("mix", "Mix", 1, 0, 1, ""),
    p("output", "Output", 0, -18, 12, "dB"),
  ],
  drive: () => [
    p("drive", "Drive", 0.3, 0, 1, ""),
    p("tone", "Tone", 6000, 500, 16000, "Hz"),
    p("output", "Output", 0, -18, 6, "dB"),
    p("input", "Input", 0, -18, 18, "dB"),
    p("lowcut", "Low Cut", 20, 20, 1000, "Hz"),
    p("mix", "Mix", 1, 0, 1, ""),
  ],
  compressor: () => [
    p("threshold", "Threshold", -18, -60, 0, "dB"),
    p("ratio", "Ratio", 4, 1, 20, ":1"),
    p("attack", "Attack", 8, 0.1, 200, "ms"),
    p("release", "Release", 140, 10, 1000, "ms"),
    p("makeup", "Makeup", 0, -6, 18, "dB"),
    p("knee", "Knee", 6, 0, 40, "dB"),
    p("input", "Input", 0, -18, 18, "dB"),
  ],
  delay: () => [
    p("time", "Time", 320, 10, 1200, "ms"),
    p("feedback", "Feedback", 0.35, 0, 0.92, ""),
    p("mix", "Mix", 0.25, 0, 1, ""),
    p("tone", "Tone", 12000, 800, 18000, "Hz"),
    p("lowcut", "Low Cut", 40, 20, 2000, "Hz"),
    p("output", "Output", 0, -18, 6, "dB"),
  ],
  gain: () => [p("gain", "Gain", 0, -24, 12, "dB"), p("pan", "Pan", 0, -1, 1, ""), p("phase", "Phase Invert", 0, 0, 1, "")],
  width: () => [p("width", "Width", 1, 0, 2, ""), p("output", "Output", 0, -12, 6, "dB"), p("pan", "Pan", 0, -1, 1, "")],
  reverb: () => [
    p("decay", "Decay", 1.8, 0.2, 8, "s"),
    p("predelay", "Pre-Delay", 20, 0, 200, "ms"),
    p("mix", "Mix", 0.3, 0, 1, ""),
    p("tone", "Tone", 9000, 800, 18000, "Hz"),
    p("lowcut", "Low Cut", 120, 20, 1000, "Hz"),
    p("output", "Output", 0, -18, 6, "dB"),
  ],
  chorus: () => [
    p("rate", "Rate", 1.2, 0.05, 8, "Hz"),
    p("depth", "Depth", 0.5, 0, 1, ""),
    p("mix", "Mix", 0.5, 0, 1, ""),
    p("delay", "Delay", 20, 5, 40, "ms"),
    p("feedback", "Feedback", 0, 0, 0.8, ""),
  ],
  flanger: () => [
    p("rate", "Rate", 0.4, 0.05, 5, "Hz"),
    p("depth", "Depth", 0.7, 0, 1, ""),
    p("feedback", "Feedback", 0.5, 0, 0.95, ""),
    p("mix", "Mix", 0.5, 0, 1, ""),
    p("manual", "Manual", 4, 1, 15, "ms"),
  ],
  phaser: () => [
    p("rate", "Rate", 0.5, 0.05, 8, "Hz"),
    p("depth", "Depth", 0.7, 0, 1, ""),
    p("center", "Center", 800, 200, 4000, "Hz"),
    p("mix", "Mix", 0.5, 0, 1, ""),
    p("stages", "Stages", 4, 2, 8, ""),
    p("resonance", "Resonance", 0.8, 0.2, 8, "Q"),
  ],
  tremolo: () => [
    p("rate", "Rate", 5, 0.1, 20, "Hz"),
    p("depth", "Depth", 0.6, 0, 1, ""),
    p("shape", "Shape", 0, 0, 2, ""),
    p("output", "Output", 0, -18, 6, "dB"),
  ],
  autopan: () => [
    p("rate", "Rate", 1, 0.05, 10, "Hz"),
    p("depth", "Depth", 0.8, 0, 1, ""),
    p("shape", "Shape", 0, 0, 2, ""),
    p("center", "Center", 0, -1, 1, ""),
  ],
  limiter: () => [
    p("ceiling", "Ceiling", -0.3, -12, 0, "dB"),
    p("release", "Release", 60, 5, 500, "ms"),
    p("input", "Input", 0, 0, 18, "dB"),
    p("output", "Output", 0, -18, 0, "dB"),
  ],
  bitcrusher: () => [
    p("bits", "Bits", 8, 2, 16, "bit"),
    p("mix", "Mix", 1, 0, 1, ""),
    p("input", "Input", 0, -18, 18, "dB"),
    p("tone", "Tone", 18000, 800, 18000, "Hz"),
    p("output", "Output", 0, -18, 6, "dB"),
  ],
  // Classic analogue-style vocoder: the channel signal is the modulator (voice)
  // and an internal oscillator bank is the carrier.
  vocoder: () => [
    p("bands", "Bands", 16, 8, 24, ""),
    p("carrier", "Carrier", 0, 0, 2, ""), // 0 saw, 1 pulse, 2 noise
    p("pitch", "Pitch", 110, 40, 440, "Hz"),
    p("detune", "Detune", 14, 0, 50, "ct"),
    p("formant", "Formant", 0, -12, 12, "st"),
    p("response", "Response", 18, 2, 200, "ms"),
    p("sense", "Sensitivity", 1.4, 0.2, 4, ""),
    p("sibilance", "Sibilance", 0.35, 0, 1, ""),
    p("mix", "Mix", 1, 0, 1, ""),
    p("output", "Output", 0, -24, 12, "dB"),
    p("play", "Play Mode", 0, 0, 1, ""), // 0 fixed pitch, 1 follow keyboard notes
    p("glide", "Glide", 30, 0, 1000, "ms"),
    p("unison", "Unison", 3, 1, 5, ""),
    p("tone", "Tone", 9000, 500, 16000, "Hz"),
    p("width", "Band Width", 1, 0.4, 3, ""),
    p("octave", "Octave", 0, -2, 2, ""),
  ],
  gate: () => [
    p("threshold", "Threshold", -45, -80, 0, "dB"),
    p("attack", "Attack", 2, 0.1, 50, "ms"),
    p("release", "Release", 80, 5, 1000, "ms"),
    p("range", "Range", -80, -80, 0, "dB"),
    p("output", "Output", 0, -18, 6, "dB"),
  ],
  stepfilter: () => [
    p("cutoff", "Cutoff", 12000, 80, 18000, "Hz"),
    p("resonance", "Resonance", 4, 0.1, 20, "Q"),
    p("rate", "Step Rate", 8, 0.5, 32, "Hz"),
    p("smooth", "Smoothing", 0.03, 0, 0.24, "s"),
    p("swing", "Swing", 0, 0, 0.6, ""),
    p("depth", "Depth", 0.85, 0, 1, ""),
    p("mix", "Mix", 1, 0, 1, ""),
    p("mode", "Mode", 0, 0, 2, ""),
    p("steps", "Steps", 16, 16, 32, ""),
    ...Array.from({ length: 32 }, (_, i) => p(`s${i + 1}`, `Step ${i + 1}`, i % 4 === 0 ? 0.9 : i % 2 === 0 ? 0.58 : 0.28, 0, 1, "")),
  ],
  resonator: () => [
    p("root", "Root", 48, 24, 84, "MIDI"),
    p("spread", "Spread", 0.35, 0, 1, ""),
    p("decay", "Decay", 1.8, 0.1, 8, "s"),
    p("damping", "Damping", 0.45, 0, 1, ""),
    p("mix", "Mix", 0.35, 0, 1, ""),
  ],
  scalechord: () => [
    p("root", "Root", 0, 0, 11, ""),
    p("scale", "Scale", 0, 0, 5, ""),
    p("chord", "Chord", 0, 0, 5, ""),
    p("inversion", "Inversion", 0, 0, 3, ""),
    p("range", "Range", 1, 1, 3, "oct"),
    p("filter", "Scale Filter", 1, 0, 1, ""),
  ],
  transient: () => [
    p("attack", "Attack", 0.35, -1, 1, ""),
    p("sustain", "Sustain", 0, -1, 1, ""),
    p("sensitivity", "Sensitivity", 0.55, 0, 1, ""),
    p("protect", "Clip Protect", 1, 0, 1, ""),
    p("output", "Output", 0, -12, 12, "dB"),
    p("mix", "Mix", 1, 0, 1, ""),
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
  def("Pro-EQ 8", "SYNCLAB", "Built-in", "paraeq"),
  def("Analog Filter", "SYNCLAB", "Built-in", "filter"),
  def("Tube Drive", "SYNCLAB", "Built-in", "drive"),
  def("Bus Compressor", "SYNCLAB", "Built-in", "compressor"),
  def("Stereo Delay", "SYNCLAB", "Built-in", "delay"),
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
  def("VX-16 Vintage Vocoder", "SYNCLAB", "Built-in", "vocoder"),
  def("Noise Gate", "SYNCLAB", "Built-in", "gate"),
  def("Pulse Grid Filter", "SYNCLAB", "Built-in", "stepfilter"),
  def("Harmonic Body", "SYNCLAB", "Built-in", "resonator"),
  def("Chord Compass", "SYNCLAB", "Built-in", "scalechord"),
  def("Transient Architect", "SYNCLAB", "Built-in", "transient"),
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

const SCALE_INTERVALS = [
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 3, 5, 7, 9, 10],
  [0, 2, 4, 7, 9],
  [0, 3, 5, 7, 10],
  [0, 1, 3, 5, 7, 8, 10],
] as const;

const CHORD_INTERVALS = [[0], [0, 4, 7], [0, 3, 7], [0, 4, 7, 11], [0, 3, 7, 10], [0, 7, 12]] as const;

/** Applies the active Chord Compass insert to a note before playback or recording. */
export function processMidiThroughPlugins(note: number, plugins: PluginInstance[] = []): number[] {
  const device = plugins.find((plugin) => plugin.kind === "scalechord" && !plugin.bypass);
  if (!device) return [note];
  const value = (id: string, fallback: number) => device.params.find((param) => param.id === id)?.value ?? fallback;
  const root = Math.round(value("root", 0)) % 12;
  const scale = SCALE_INTERVALS[Math.round(value("scale", 0))] ?? SCALE_INTERVALS[0];
  const pitchClass = ((note - root) % 12 + 12) % 12;
  let base = note;
  if (value("filter", 1) >= 0.5 && !scale.includes(pitchClass as never)) {
    let best: number = scale[0] ?? 0;
    let distance = 12;
    for (const degree of scale) {
      const d = Math.abs(degree - pitchClass);
      if (d < distance) {
        best = degree;
        distance = d;
      }
    }
    base = note + best - pitchClass;
  }
  const chord = CHORD_INTERVALS[Math.round(value("chord", 0))] ?? CHORD_INTERVALS[0];
  const inversion = Math.min(Math.round(value("inversion", 0)), chord.length - 1);
  const range = Math.round(value("range", 1));
  return chord.map((interval, index) => base + interval + (index < inversion ? 12 : 0) + (range > 1 && index === chord.length - 1 ? (range - 1) * 12 : 0));
}

export const PLUGIN_KINDS: PluginKind[] = [
  "eq",
  "paraeq",
  "filter",
  "drive",
  "compressor",
  "limiter",
  "gate",
  "delay",
  "reverb",
  "chorus",
  "flanger",
  "phaser",
  "tremolo",
  "autopan",
  "width",
  "bitcrusher",
  "vocoder",
  "gain",
  "stepfilter",
  "resonator",
  "scalechord",
  "transient",
];

/** Plugin bundle extensions we recognise when a folder or file is dropped in. */
export const PLUGIN_EXT: Record<string, PluginDef["format"]> = {
  vst3: "VST3",
  vst: "VST3",
  dll: "VST3",
  component: "AU",
  clap: "CLAP",
  aaxplugin: "AAX",
};

/** Guess a DSP category from the plugin's file name so the scanned entry gets sensible controls. */
export function guessPluginKind(fileName: string): PluginKind {
  const n = fileName.toLowerCase();
  const map: [RegExp, PluginKind][] = [
    [/(pro-?q|parametric|eq8|linear ?phase)/, "paraeq"],
    [/(vocoder|talkbox)/, "vocoder"],
    [/(eq|equal|channel ?strip)/, "eq"],
    [/(comp|1176|la-?2a|glue|bus ?comp)/, "compressor"],
    [/(limit|maxim|l1|l2)/, "limiter"],
    [/(gate|expander)/, "gate"],
    [/(delay|echo)/, "delay"],
    [/(verb|reverb|hall|plate|room)/, "reverb"],
    [/(chorus)/, "chorus"],
    [/(flang)/, "flanger"],
    [/(phas)/, "phaser"],
    [/(trem)/, "tremolo"],
    [/(pan)/, "autopan"],
    [/(filter|ladder|moog)/, "filter"],
    [/(sat|drive|tube|tape|dist|crunch)/, "drive"],
    [/(width|stereo|imager)/, "width"],
    [/(crush|lofi|bit)/, "bitcrusher"],
    [/(step.?filter|filterstep)/, "stepfilter"],
    [/(resonat)/, "resonator"],
    [/(scaler|chord|scale)/, "scalechord"],
    [/(transient|attack|sustain)/, "transient"],
  ];
  for (const [re, k] of map) if (re.test(n)) return k;
  return "eq";
}

/**
 * Turn dropped/selected files into plugin definitions. Browsers cannot execute a
 * VST/AU binary, so we read the bundle name and format and drive SYNCLAB's own DSP.
 */
export function defsFromFiles(files: File[], existingNames: string[] = []): PluginDef[] {
  const seen = new Set(existingNames.map((n) => n.toLowerCase()));
  const out: PluginDef[] = [];
  for (const f of files) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const parts = rel.split("/").filter(Boolean);
    const bundle = parts.find((seg) => {
      const ext = seg.split(".").pop()?.toLowerCase();
      return !!ext && ext in PLUGIN_EXT;
    });
    if (!bundle) continue;
    const ext = bundle.split(".").pop()?.toLowerCase() ?? "";
    const pluginName = bundle.replace(/\.[^.]+$/, "");
    if (!pluginName || seen.has(pluginName.toLowerCase())) continue;
    seen.add(pluginName.toLowerCase());
    const vendorGuess = parts.length > 1 && parts[0] !== bundle ? (parts[0] as string) : "3RD PARTY";
    out.push(def(pluginName, vendorGuess.toUpperCase(), PLUGIN_EXT[ext] ?? "VST3", guessPluginKind(pluginName)));
  }
  return out;
}

/** Fills in knobs added after a device was saved, so older projects show every control. */
export function withDefaultParams<T extends { kind: PluginKind; params: PluginParam[] }>(pl: T): PluginParam[] {
  const defaults = PARAMS_BY_KIND[pl.kind]?.() ?? [];
  const missing = defaults.filter((d) => !pl.params.some((x) => x.id === d.id));
  return missing.length ? [...pl.params, ...missing] : pl.params;
}
