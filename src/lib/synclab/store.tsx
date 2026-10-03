import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { getEngine } from "./audio-engine";
import { stepsPerBar, setBeatsPerBar, getBeatsPerBar, STEPS_PER_BEAT, songSteps, stepSeconds, barsForSteps } from "./timebase";
import { openInOwnTab } from "./mic";
import { TRACK_COLORS, applyPreset, defaultPads, defaultPatch, uid } from "./presets";
import { BUILT_IN_PLUGINS, instantiate, processMidiThroughPlugins } from "./plugins";
import { getMidiAccess, listInputs, midiSupported, subscribe, type MidiPortInfo } from "./midi";
import { getPadBank, setPadBank } from "./pad-session";
import { getLooper } from "./live-looper";
import { padNote } from "./drum-notes";
import { markLiveHit, isLiveHit, clearLiveHits } from "./live-take";
import { keyDown, keyUp } from "./active-keys";
import { autoMapEnabled, isKorgMixer, korgAutoMap } from "./korg-automap";
import type { CloudSession } from "./cloud";
import type {
  AudioClip,
  AutomationLane,
  AutomationParam,
  AutomationPoint,
  BusId,
  AuxId,
  VcaId,
  BusState,
  DrumPad,
  MidiNote,
  PluginDef,
  PluginInstance,

  PluginParam,
  SamplerState,
  SongSection,
  SynthPatch,
  Track,
  TrackKind,
  Transport,
} from "./types";
import { clipRate, clipSeconds, SECTION_COLORS } from "./types";

/** A persistent hardware CC destination. Namespaced parameters identify device controls. */
export interface MidiTarget {
  id: string;
  param: string;
}

export const midiTargetKey = (t: MidiTarget) => `${t.id}:${t.param}`;
const MIDI_MAP_KEY = "synclab.midimap";
const MIDI_INPUT_KEY = "synclab.midi.input";
const AUTOSAVE_KEY = "synclab.autosave.v1";

/** Preserve the untouched portions of an older take when a new recording covers only part of it. */
/** Snaps where a finished take lands to the edit grid (defaults to the nearest step). */
export function snapRecStart(step: number, snap?: number): number {
  const g = snap && snap > 0 ? snap : 1;
  return Math.max(0, Math.round(step / g) * g);
}

export function replaceTakeRegion(clips: AudioClip[], start: number, end: number, stepDur: number): AudioClip[] {
  return clips.flatMap((clip) => {
    const from = clip.start ?? 0;
    const rate = clipRate(clip);
    const length = clip.length ?? clip.duration;
    const until = from + length / rate / stepDur;
    if (until <= start || from >= end) return [clip];
    const left = Math.max(0, Math.min(start, until) - from) * stepDur * rate;
    const right = Math.max(0, until - Math.max(end, from)) * stepDur * rate;
    const pieces: AudioClip[] = [];
    if (left > 0.01) pieces.push({
      ...clip, id: uid(), length: left,
      offset: (clip.offset ?? 0) + (clip.reverse ? length - left : 0),
      fadeOut: Math.min(clip.fadeOut ?? 0.01, left / rate / 2),
    });
    if (right > 0.01) pieces.push({
      ...clip, id: uid(), start: until - right / rate / stepDur, length: right,
      offset: (clip.offset ?? 0) + (clip.reverse ? 0 : length - right),
      fadeIn: Math.min(clip.fadeIn ?? 0.004, right / rate / 2),
    });
    return pieces;
  });
}

const ccRange = (value: number, min: number, max: number, step = 0) => {
  const scaled = min + value * (max - min);
  return step ? Math.round(scaled / step) * step : scaled;
};

/** Use the same ranges as the visible controls; never map a CC to an unsupported audio parameter. */
const synthRanges: Record<string, [number, number, number?]> = {
  cutoff: [40, 16000, 10], resonance: [0, 28, 0.5], drive: [0, 1], glide: [0, 0.5, 0.01],
  noise: [0, 1], keyTracking: [0, 1], velocitySens: [0, 1], analog: [0, 1],
  "filter2.cutoff": [40, 16000, 10], "filter2.resonance": [0, 28, 0.5],
  "filterEnv.amount": [-6000, 6000, 50],
  "unison.voices": [1, 7, 1], "unison.detune": [0, 60, 1],
  "arp.octaves": [1, 4, 1], "arp.rate": [0.5, 4, 0.5],
};
const drumRanges: Record<string, [number, number, number?]> = {
  volume: [0, 1], pan: [-1, 1], pitch: [-12, 12, 1], decay: [0, 1], attack: [0, 1],
  sustain: [0, 1], release: [0, 1], start: [0, 1], end: [0, 1], tone: [0, 1],
  drive: [0, 1], compressor: [0, 1], snap: [0, 1], noise: [0, 1], width: [0, 1],
  crush: [0, 1], mutation: [0, 1], cutoff: [0, 1], resonance: [0, 1],
  filterEnv: [-1, 1], choke: [0, 4, 1],
};

const busFor = (kind: TrackKind): BusId =>
  kind === "drum"
    ? "drums"
    : kind === "ai-vocal" || kind === "audio"
      ? "vocals"
      : kind === "sampler"
        ? "fx"
        : "synths";

export const newTrack = (kind: TrackKind, name: string, index: number, preset?: string): Track => ({
  id: uid(),
  name,
  kind,
  color: TRACK_COLORS[index % TRACK_COLORS.length] as string,
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  armed: false,
  frozen: false,
  hidden: false,
  input: kind === "audio" ? "Microphone" : kind === "midi" ? "MIDI Keyboard" : "Internal",
  bus: busFor(kind),
  sends: { reverb: 0, delay: 0, chorus: 0 },
  steps: 16,
  patch: kind === "drum" ? undefined : preset ? applyPreset(preset) : defaultPatch(),
  notes: kind === "drum" ? undefined : [],
  pads: kind === "drum" ? defaultPads(16) : undefined,
  clips: [],
});

const initialTracks = (): Track[] => [];

/** Plays one note: a sampler channel uses its loaded file, everything else the synth. */
function triggerNote(
  engine: ReturnType<typeof getEngine>,
  t: Track,
  midi: number,
  dur: number,
  vel: number,
  when?: number,
) {
  if (t.kind === "sampler" && t.sampler) {
    const s = t.sampler;
    const chops = s.slices ?? [];
    const idx = midi - s.rootNote;
    if (chops.length > 1 && idx >= 0 && idx < chops.length) {
      // each key from the root upwards plays one chop at its original pitch
      const start = chops[idx] as number;
      const end = (chops[idx + 1] ?? s.end) as number;
      engine.playSample(t.id, { ...s, start, end, loop: false, oneShot: true }, s.rootNote, dur, vel, when);
      return;
    }
    engine.playSample(t.id, s, midi, dur, vel, when);
    return;
  }
  if (t.patch) for (const pitch of processMidiThroughPlugins(midi, t.plugins)) engine.playNote(t.id, t.patch, pitch, dur, vel, when);
}

export type PanelId =
  | "mixer"
  | "mastering"
  | "synth"
  | "drums"
  | "piano"
  | "settings"
  | "keys"
  | "browser"
  | "plugins"
  | "appearance"
  | "sampler"
  | "pads"
  | "notes"
  | "reference"
  | "live"
  | "looper"
  | null;

export type EditTool = "select" | "draw" | "split" | "razor";

interface StudioState {
  tracks: Track[];
  transport: Transport;
  selectedId: string | null;
  selectedIds: string[];
  editTool: EditTool;
  panel: PanelId;
  userPresets: SynthPatch[];
  buses: Record<BusId, BusState>;
  vcas: Record<VcaId, BusState>;
  auxReturns: Record<AuxId, BusState>;
  sections: SongSection[];
}

/** Shaped value of an automation curve at a step, held flat outside the drawn range. */
function valueAt(points: AutomationPoint[], step: number): number {
  const first = points[0]!;
  if (step <= first.step) return first.value;
  const last = points[points.length - 1]!;
  if (step >= last.step) return last.value;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (step <= b.step) {
      const span = b.step - a.step || 1;
      const linear = (step - a.step) / span;
      const curve = Math.max(-1, Math.min(1, a.curve ?? 0));
      const shaped = curve >= 0
        ? Math.pow(linear, 1 + curve * 3)
        : 1 - Math.pow(1 - linear, 1 - curve * 3);
      return a.value + shaped * (b.value - a.value);
    }
  }
  return last.value;
}

interface StudioApi extends StudioState {
  snapshot: () => CloudSession;
  restore: (session: CloudSession) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** timestamp of the last automatic local save, null before the first one */
  savedAt: number | null;
  selected: Track | null;
  setBus: (id: BusId, patch: Partial<BusState>) => void;
  setVca: (id: VcaId, patch: Partial<BusState>) => void;
  setAuxReturn: (id: AuxId, patch: Partial<BusState>) => void;
  addSection: (name?: string, start?: number, length?: number) => void;
  updateSection: (id: string, patch: Partial<SongSection>) => void;
  removeSection: (id: string) => void;
  /** copy a section and everything inside it, pushing later material along */
  duplicateSection: (id: string) => void;
  /** move the playhead (and loop, when it is on) to a section */
  gotoSection: (id: string) => void;
  autoSections: () => void;
  setPanel: (p: PanelId) => void;
  select: (id: string) => void;
  setEditTool: (t: EditTool) => void;
  selectAll: () => void;
  toggleSelectId: (id: string) => void;
  splitClipAt: (trackId: string, frac: number) => void;
  razorAt: (trackId: string, posSteps: number) => void;
  splitAtPlayhead: () => void;
  addTrack: (kind: TrackKind, name?: string, preset?: string) => string;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  duplicateTrack: (id: string) => void;
  moveTrack: (id: string, dir: -1 | 1) => void;
  clipboardName: string | null;
  copyTrack: (id: string) => void;
  cutTrack: (id: string) => void;
  pasteTrack: () => void;
  clipClipboardName: string | null;
  copyClip: (trackId: string, clipId: string) => void;
  cutClip: (trackId: string, clipId: string) => void;
  pasteClip: (atEnd?: boolean) => void;
  updatePatch: (id: string, patch: Partial<SynthPatch>) => void;
  updatePad: (trackId: string, padId: string, patch: Partial<DrumPad>) => void;
  toggleStep: (trackId: string, padId: string, step: number) => void;
  setStepCount: (trackId: string, steps: number) => void;
  addPad: (trackId: string) => void;
  setNotes: (trackId: string, notes: MidiNote[]) => void;
  setTransport: (t: Partial<Transport>) => void;
  togglePlay: () => void;
  toggleRecord: () => void;
  stop: () => void;
  pause: () => void;
  changeInstrument: (trackId: string, preset: string) => void;
  setActiveClip: (trackId: string, clipId: string) => void;
  toggleAutomationLane: (trackId: string, param: AutomationParam) => void;
  setAutomationPoints: (trackId: string, param: AutomationParam, points: AutomationPoint[], label?: string) => void;
  undoAutomationEdit: (trackId: string, param: AutomationParam) => void;
  redoAutomationEdit: (trackId: string, param: AutomationParam) => void;
  automationHistory: (
    trackId: string,
    param: AutomationParam,
  ) => { canUndo: boolean; canRedo: boolean; undoLabel: string | null; redoLabel: string | null };
  setAutomationMode: (trackId: string, param: AutomationParam, mode: AutomationLane["mode"]) => void;
  setAutomationLaneLock: (trackId: string, param: AutomationParam, locked: boolean) => void;
  previewAutomation: (trackId: string, param: AutomationParam, value: number) => void;
  removeClip: (trackId: string, clipId: string) => void;
  addClip: (trackId: string, clip: AudioClip) => void;
  updateClip: (trackId: string, clipId: string, patch: Partial<AudioClip>) => void;
  previewClip: (trackId: string, clipId: string) => void;
  savePreset: (name: string) => void;
  loadPreset: (trackId: string, name: string) => void;
  generateBeat: (trackId: string, genre: string, energy: number) => void;
  previewNote: (trackId: string, midi: number) => void;
  /** Writes a note into the live timeline recording without playing it (the caller already sounded it). */
  captureNote: (trackId: string, midi: number, velocity?: number) => void;
  loadSample: (trackId: string, file: File) => Promise<void>;
  updateSampler: (trackId: string, patch: Partial<SamplerState>) => void;
  clearSample: (trackId: string) => void;
  stopSamples: (trackId?: string) => void;
  installedPlugins: PluginDef[];
  installPlugin: (def: PluginDef) => void;
  uninstallPlugin: (defId: string) => void;
  addPlugin: (trackId: string, def: PluginDef) => void;
  removePlugin: (trackId: string, instanceId: string) => void;
  togglePluginBypass: (trackId: string, instanceId: string) => void;
  movePlugin: (trackId: string, instanceId: string, dir: -1 | 1) => void;
  setPluginParam: (trackId: string, instanceId: string, paramId: string, value: number) => void;
  midiInputs: MidiPortInfo[];
  midiInputId: string | null;
  midiLearning: boolean;
  midiMap: Record<string, MidiTarget>;
  midiLearn: MidiTarget | null;
  startMidiLearn: (t: MidiTarget) => void;
  cancelMidiLearn: () => void;
  clearMidiMapping: (t: MidiTarget) => void;
  enableMidi: () => void;
  setMidiInput: (id: string | null) => void;
  fxChains: Record<string, PluginInstance[]>;
  addFxPlugin: (target: string, def: PluginDef) => void;
  removeFxPlugin: (target: string, instanceId: string) => void;
  toggleFxBypass: (target: string, instanceId: string) => void;
  setFxParam: (target: string, instanceId: string, paramId: string, value: number) => void;
}


// Reuse a single context across hot-reloaded module instances so provider and
// consumers never end up bound to two different copies of this module.
const g = globalThis as typeof globalThis & { __synclabCtx?: React.Context<StudioApi | null> };
const Ctx = (g.__synclabCtx ??= createContext<StudioApi | null>(null));

export function StudioProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editTool, setEditTool] = useState<EditTool>("select");
  const [panel, setPanel] = useState<PanelId>(null);
  const [userPresets, setUserPresets] = useState<SynthPatch[]>([]);
  const [transport, setTransportState] = useState<Transport>({
    playing: false,
    recording: false,
    bpm: 128,
    swing: 0,
    step: 0,
    metronome: false,
    countIn: true,
    countInBars: 1,
    countInLeft: null,
    loop: true,
    loopStart: 0,
    loopEnd: 16,
    bars: 4,
    paused: false,
    overdub: false,
    punchIn: null,
    punchOut: null,
    monitor: false,
  });

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const transportRef = useRef(transport);
  transportRef.current = transport;
  setBeatsPerBar(transport.beatsPerBar);
  const countInTimerRef = useRef<number | null>(null);
  /** timeline step where the current take started, so the clip lands there */
  const recStartStepRef = useRef(0);
  /** punch recording hooks, filled in once the record helpers exist */
  const punchRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const loopStopRef = useRef<(() => void) | null>(null);

  const [sections, setSections] = useState<SongSection[]>([]);
  const sectionsRef = useRef<SongSection[]>([]);
  sectionsRef.current = sections;
  const [buses, setBuses] = useState<Record<BusId, BusState>>({
    drums: { volume: 1, muted: false },
    vocals: { volume: 1, muted: false },
    instruments: { volume: 1, muted: false },
    synths: { volume: 1, muted: false },
    fx: { volume: 1, muted: false },
    master: { volume: 1, muted: false },
  });
  const [vcas, setVcas] = useState<Record<VcaId, BusState>>({
    A: { volume: 1, muted: false }, B: { volume: 1, muted: false },
    C: { volume: 1, muted: false }, D: { volume: 1, muted: false },
  });
  const [auxReturns, setAuxReturns] = useState<Record<AuxId, BusState>>({
    reverb: { volume: 1, muted: false }, delay: { volume: 1, muted: false }, chorus: { volume: 1, muted: false },
  });

  const [installedPlugins, setInstalledPlugins] = useState<PluginDef[]>(BUILT_IN_PLUGINS);
  const [fxChains, setFxChains] = useState<Record<string, PluginInstance[]>>({});
  const [midiInputs, setMidiInputs] = useState<MidiPortInfo[]>([]);
  const midiInputsRef = useRef(midiInputs);
  midiInputsRef.current = midiInputs;
  // Chosen controller is remembered so it reconnects on its own next visit.
  const [midiInputId, setMidiInputId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(MIDI_INPUT_KEY);
    } catch {
      return null;
    }
  });
  const [midiLearning, setMidiLearning] = useState(false);
  // Hardware mixer control: CC number -> mixer target, remembered between sessions.
  const [midiMap, setMidiMap] = useState<Record<string, MidiTarget>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(MIDI_MAP_KEY) || "{}") as Record<string, MidiTarget>;
    } catch {
      return {};
    }
  });
  const [midiLearn, setMidiLearn] = useState<MidiTarget | null>(null);
  const midiMapRef = useRef(midiMap);
  midiMapRef.current = midiMap;
  const midiLearnRef = useRef(midiLearn);
  midiLearnRef.current = midiLearn;
  const [clipboardName, setClipboardName] = useState<string | null>(null);
  const clipboardRef = useRef<Track | null>(null);
  const [clipClipboardName, setClipClipboardName] = useState<string | null>(null);
  const clipClipboardRef = useRef<AudioClip | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const heldRef = useRef(new Map<number, { ids: string[]; trackId: string; t0: number; startStep: number }>());
  const recordedNoteIdsRef = useRef(new Set<string>());
  // last scheduled step + its audio-clock time, so note capture can stamp the
  // true sub-step position instead of the rounded playhead step
  const lastStepRef = useRef<{ step: number; time: number; dur: number } | null>(null);
  /** TOUCH releases shortly after a gesture; LATCH holds until playback stops. */
  const automationGestureRef = useRef(new Map<string, { touchedUntil: number; latched: boolean }>());
  // Per-lane edit history so a device automation lane can be stepped back on its
  // own without rewinding the rest of the project.
  const automationHistoryRef = useRef(
    new Map<string, { past: { points: AutomationPoint[]; label: string }[]; future: { points: AutomationPoint[]; label: string }[] }>(),
  );
  const automationLastPushRef = useRef(new Map<string, { label: string; at: number }>());
  const [automationHistoryTick, setAutomationHistoryTick] = useState(0);

  // ---- Undo / redo history + local autosave -------------------------------
  const pastRef = useRef<CloudSession[]>([]);
  const futureRef = useRef<CloudSession[]>([]);
  const lastSnapRef = useRef<CloudSession | null>(null);
  const applyingRef = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const enableMidi = useCallback((opts?: { quiet?: boolean }) => {
    const quiet = !!opts?.quiet;
    if (!midiSupported()) {
      if (!quiet)
        toast.error("MIDI not available", {
          description: "This browser can't see MIDI controllers. Chrome or Edge support them.",
        });
      return;
    }
    void getMidiAccess().then((a) => {
      const list = listInputs(a);
      setMidiInputs(list);
      if (!list.length) {
        if (!quiet) toast("No MIDI controller found", { description: "Plug one in, then press MIDI again." });
        return;
      }
      setMidiInputId((cur) => {
        // Keep the remembered controller; fall back to the first one only if it is gone.
        if (cur && list.some((i) => i.id === cur)) return cur;
        const next = list[0]?.id ?? null;
        try {
          if (next) window.localStorage.setItem(MIDI_INPUT_KEY, next);
        } catch {
          /* storage unavailable */
        }
        return next;
      });
      if (!quiet)
        toast.success(`${list.length} MIDI input${list.length > 1 ? "s" : ""} connected`, {
          description: list.map((i) => i.name).join(", "),
        });
      if (a)
        a.onstatechange = () => {
          // A controller was plugged in or removed — refresh and re-attach the
          // remembered one as soon as it appears again.
          const now = listInputs(a);
          setMidiInputs(now);
          setMidiInputId((cur) => {
            if (cur && now.some((i) => i.id === cur)) return cur;
            let saved: string | null = null;
            try {
              saved = window.localStorage.getItem(MIDI_INPUT_KEY);
            } catch {
              /* storage unavailable */
            }
            if (saved && now.some((i) => i.id === saved)) return saved;
            return now[0]?.id ?? cur;
          });
        };
    });
  }, []);

  // Controllers stay connected: once MIDI was allowed before, reconnect quietly
  // on every visit so there is nothing to press again.
  const midiAutoTriedRef = useRef(false);
  useEffect(() => {
    if (midiAutoTriedRef.current || !midiSupported()) return;
    midiAutoTriedRef.current = true;
    const tryConnect = () => enableMidi({ quiet: true });
    const perms = (navigator as unknown as { permissions?: { query(q: { name: string }): Promise<{ state: string }> } }).permissions;
    if (perms?.query) {
      void perms
        .query({ name: "midi" })
        .then((p) => {
          if (p.state === "granted") tryConnect();
        })
        .catch(() => {
          /* older browsers: connecting quietly is still safe */
          tryConnect();
        });
    } else {
      tryConnect();
    }
  }, [enableMidi]);

  // Remember which controller the user picked in Settings.
  const setMidiInputPersist = useCallback((id: string | null) => {
    setMidiInputId(id);
    try {
      if (id) window.localStorage.setItem(MIDI_INPUT_KEY, id);
      else window.localStorage.removeItem(MIDI_INPUT_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Live MIDI controller input: plays the armed/selected instrument and
  // records notes onto it while the transport is recording.
  useEffect(() => {
    if (!midiInputId) {
      setMidiLearning(false);
      return;
    }
    let off = () => {};
    let cancelled = false;
    void getMidiAccess().then((a) => {
      if (cancelled) return;
      off = subscribe(a, midiInputId, (msg) => {
        // Hardware mixer: knobs and faders send control-change messages.
        if (msg.type === "cc") {
          const key = `${msg.channel}:${msg.cc}`;
          const learning = midiLearnRef.current;
          if (learning) {
            setMidiMap((m) => {
              // one control per CC, and one CC per control
              const next: Record<string, MidiTarget> = {};
              for (const [k, v] of Object.entries(m)) {
                if (k === key) continue;
                if (v.id === learning.id && v.param === learning.param) continue;
                next[k] = v;
              }
              next[key] = learning;
              try {
                window.localStorage.setItem(MIDI_MAP_KEY, JSON.stringify(next));
              } catch {
                /* storage unavailable */
              }
              return next;
            });
            setMidiLearn(null);
            toast.success(`CC ${msg.cc} mapped`, { description: `Controls ${learning.param} on this channel.` });
            return;
          }
          const target = midiMapRef.current[key];
          if (!target) {
            // Korg 8-channel mixer: faders, knobs and S/M/R buttons follow track order automatically.
            const portName = midiInputsRef.current.find((p) => p.id === midiInputId)?.name;
            const hit = autoMapEnabled() && (midiInputId === "all" || isKorgMixer(portName)) ? korgAutoMap(msg.cc) : null;
            if (!hit) return;
            const track = tracksRef.current[hit.strip];
            if (!track) return;
            const v = msg.value;
            if ((hit.param === "solo" || hit.param === "mute" || hit.param === "arm") && v < 0.5) return; // toggle on press only
            setTracks((ts) => ts.map((t) => {
              if (t.id !== track.id) return t;
              if (hit.param === "volume") return { ...t, volume: v * 1.2 };
              if (hit.param === "pan") return { ...t, pan: v * 2 - 1 };
              if (hit.param === "solo") return { ...t, solo: !t.solo };
              if (hit.param === "mute") return { ...t, muted: !t.muted };
              return { ...t, armed: !t.armed };
            }));
            return;
          }
          const v = msg.value;
           if (target.id === "transport") {
             if (target.param === "bpm") setTransportState((s) => ({ ...s, bpm: ccRange(v, 60, 190, 1) }));
             else if (target.param === "swing") setTransportState((s) => ({ ...s, swing: ccRange(v, 0, 0.6, 0.01) }));
             return;
           }
           if (target.id.startsWith("looper:") && target.param === "volume") {
             const index = Number(target.id.slice(7));
             if (Number.isInteger(index) && index >= 0 && index < 8) getLooper().setVolume(index, ccRange(v, 0, 1.2));
             return;
           }
           if (target.id.startsWith("bus:") || target.id.startsWith("vca:") || target.id.startsWith("aux:")) {
             const [kind, id] = target.id.split(":");
             if (!id || !["volume", "mute"].includes(target.param)) return;
             const patch = target.param === "volume" ? { volume: ccRange(v, 0, 1.2) } : { muted: v >= 0.5 };
             if (kind === "bus" && ["drums", "synths", "vocals", "fx", "master"].includes(id))
               setBuses((b) => ({ ...b, [id]: { ...b[id as BusId], ...patch } }));
             if (kind === "vca" && ["A", "B", "C", "D"].includes(id))
               setVcas((b) => ({ ...b, [id]: { ...b[id as VcaId], ...patch } }));
             if (kind === "aux" && ["reverb", "delay", "chorus"].includes(id))
               setAuxReturns((b) => ({ ...b, [id]: { ...b[id as AuxId], ...patch } }));
             return;
           }
          if (target.id === "master") {
            if (target.param === "volume") setBuses((b) => ({ ...b, master: { ...b.master, volume: v * 1.2 } }));
            else if (target.param === "mute") setBuses((b) => ({ ...b, master: { ...b.master, muted: v >= 0.5 } }));
            return;
          }
           if (target.param.startsWith("synth:")) {
             const path = target.param.slice(6).split(":");
             const field = path[0];
             setTracks((ts) => ts.map((t) => {
               if (t.id !== target.id || !t.patch || !field) return t;
               const patch = t.patch;
               if (path.length === 1 && synthRanges[field]) {
                 const [min, max, step] = synthRanges[field];
                 return { ...t, patch: { ...patch, [field]: ccRange(v, min, max, step) } };
               }
               if (field === "macro" && path[1] && /^[0-3]$/.test(path[1])) {
                 const macros = [...(patch.macros ?? [0, 0, 0, 0])];
                 macros[Number(path[1])] = v;
                 return { ...t, patch: { ...patch, macros } };
               }
               if (field === "fx" && path[1] && Object.hasOwn(patch.fx, path[1]) && typeof patch.fx[path[1] as keyof typeof patch.fx] === "number")
                 return { ...t, patch: { ...patch, fx: { ...patch.fx, [path[1]]: v } } };
               if (["amp", "filterEnv", "modEnv", "filter2", "unison", "arp"].includes(field) && path[1]) {
                 const group = patch[field as "amp" | "filterEnv" | "modEnv" | "filter2" | "unison" | "arp"];
                 if (!group || typeof group !== "object" || typeof (group as Record<string, unknown>)[path[1]] !== "number") return t;
                 const range = synthRanges[`${field}.${path[1]}`];
                 const max = field === "amp" || field === "filterEnv" || field === "modEnv" ? (path[1] === "sustain" ? 1 : 3) : 1;
                 const value = range ? ccRange(v, ...range) : ccRange(v, 0, max);
                 return { ...t, patch: { ...patch, [field]: { ...group, [path[1]]: value } } };
               }
               if ((field === "osc" || field === "lfo") && path[1] && path[2]) {
                 const index = Number(path[1]);
                  const property = path[2];
                 const list = field === "osc" ? patch.oscillators : patch.lfos;
                 const item = list[index];
                  if (!property || !item || typeof (item as unknown as Record<string, unknown>)[property] !== "number") return t;
                   const range = field === "osc" ? ({ octave: [-3, 3, 1], semitone: [-12, 12, 1], fine: [-50, 50, 1], detune: [-50, 50, 1], pulseWidth: [0.05, 0.95], pan: [-1, 1] } as Record<string, [number, number, number?]>)[property] : property === "rate" ? [0.05, 20, 0.05] as [number, number, number?] : undefined;
                  const updated = list.map((item, i) => i === index ? { ...item, [property]: range ? ccRange(v, ...range) : v } : item);
                 return { ...t, patch: { ...patch, [field === "osc" ? "oscillators" : "lfos"]: updated } };
               }
               return t;
             }));
             return;
           }
           if (target.param.startsWith("drum:")) {
             const [, padId, field] = target.param.split(":");
             const range = field ? drumRanges[field] : undefined;
             if (padId && field && range) setTracks((ts) => ts.map((t) => t.id === target.id && t.pads
               ? { ...t, pads: t.pads.map((pad) => pad.id === padId ? { ...pad, [field]: ccRange(v, ...range) } : pad) } : t));
             return;
           }
           if (target.param.startsWith("sampler:")) {
             const field = target.param.slice(8);
             const ranges: Record<string, [number, number, number?]> = {
               start: [0, 1, 0.001], end: [0, 1, 0.001], gain: [0, 2, 0.01],
               pitch: [-24, 24, 0.1], rootNote: [24, 96, 1], attack: [0, 2, 0.001],
               release: [0.005, 4, 0.005], decay: [0, 3, 0.005], sustain: [0, 1, 0.01],
               fadeIn: [0, 2, 0.005], fadeOut: [0, 2, 0.005], resonance: [0.1, 20, 0.1],
               sampleBpm: [60, 200, 1],
             };
              const range = ranges[field];
              if (field === "cutoff" || range) setTracks((ts) => ts.map((t) => {
               if (t.id !== target.id || !t.sampler) return t;
                const value = field === "cutoff" ? Math.round(Math.pow(10, ccRange(v, Math.log10(20), Math.log10(20000)))) : range ? ccRange(v, ...range) : 0;
               const bounded = field === "start" ? Math.min(value, t.sampler.end - 0.002) : field === "end" ? Math.max(value, t.sampler.start + 0.002) : value;
               return { ...t, sampler: { ...t.sampler, [field]: bounded } };
             }));
             return;
           }
           if (target.param.startsWith("plugin:")) {
             const [, instanceId, paramId] = target.param.split(":");
             if (instanceId && paramId) setTracks((ts) => ts.map((t) => t.id === target.id ? { ...t, plugins: (t.plugins ?? []).map((p) => p.id === instanceId
               ? { ...p, params: p.params.map((param) => param.id === paramId ? { ...param, value: ccRange(v, param.min, param.max) } : param) } : p) } : t));
             return;
           }
           if (target.param.startsWith("fx:")) {
             const [, instanceId, paramId] = target.param.split(":");
             if (instanceId && paramId) setFxChains((chains) => ({ ...chains, [target.id]: (chains[target.id] ?? []).map((p) => p.id === instanceId
               ? { ...p, params: p.params.map((param) => param.id === paramId ? { ...param, value: ccRange(v, param.min, param.max) } : param) } : p) }));
             return;
           }
           if (target.id.startsWith("sampler-pad:") && target.param.startsWith("pad:")) {
             const index = Number(target.id.slice("sampler-pad:".length));
             const field = target.param.slice(4);
             const ranges: Record<string, [number, number, number?]> = {
               gain: [0, 2, 0.01], pitch: [-24, 24, 0.1], attack: [0, 1, 0.001],
               release: [0.005, 4, 0.005], choke: [0, 4, 1],
             };
             const range = ranges[field];
             if (Number.isInteger(index) && range) {
               const pads = getPadBank();
               const pad = pads[index];
               if (pad) setPadBank({ ...pads, [index]: { ...pad, [field]: ccRange(v, ...range) } });
             }
             return;
           }
          setTracks((ts) =>
            ts.map((t) =>
               t.id === target.id && ["volume", "pan", "mute", "solo"].includes(target.param)
                ? target.param === "volume"
                  ? { ...t, volume: v * 1.2 }
                  : target.param === "pan"
                    ? { ...t, pan: v * 2 - 1 }
                    : target.param === "mute"
                      ? { ...t, muted: v >= 0.5 }
                      : { ...t, solo: v >= 0.5 }
                : t,
            ),
          );
          return;
        }
        if (msg.type === "pitchbend") return;
        const { type, pitch, velocity } = msg;

        // A drum controller speaks General MIDI notes. When an armed drum track
        // owns the incoming note, that pad plays — and while recording, the note
        // is written onto the step that is sounding, exactly like tapping a pad.
        const drumTarget =
          tracksRef.current.find((t) => t.armed && t.kind === "drum" && t.pads?.length) ??
          (tracksRef.current.find((t) => t.id === selectedIdRef.current && t.kind === "drum" && t.pads?.length) as
            | Track
            | undefined);
        if (drumTarget?.pads) {
          const hit = drumTarget.pads.find((p) => padNote(p, drumTarget.pads!) === pitch);
          if (hit) {
            if (type === "on") {
              keyDown(pitch);
              const engine = getEngine();
              engine.init();
              engine.syncMix(tracksRef.current);
              engine.playDrum(drumTarget.id, hit, Math.max(0.15, velocity));
              const tp = transportRef.current;
              if (tp.recording && tp.playing) {
                const total = hit.steps.length || drumTarget.steps || 16;
                const at = tp.step % total;
                markLiveHit(drumTarget.id, hit.id, at);
                setTracks((ts) =>
                  ts.map((t) =>
                    t.id === drumTarget.id
                      ? {
                          ...t,
                          pads: (t.pads ?? []).map((p) =>
                            p.id === hit.id
                              ? { ...p, steps: p.steps.map((v, i) => (i === at ? Math.max(0.15, velocity) : v)) }
                              : p,
                          ),
                        }
                      : t,
                  ),
                );
              }
            } else {
              keyUp(pitch);
            }
            return;
          }
        }

        const notable = (t: Track) => t.kind === "instrument" || t.kind === "midi" || t.kind === "sampler";
        const target =
          tracksRef.current.find((t) => t.armed && notable(t)) ??
          tracksRef.current.find((t) => t.id === selectedIdRef.current && notable(t)) ??
          tracksRef.current.find(notable);
        if (!target) return;
        const engine = getEngine();
        engine.init();
        const tp = transportRef.current;
        const stepDur = stepSeconds(tp.bpm);
        if (type === "on") {
          keyDown(pitch);
          setMidiLearning(true);
          engine.syncMix(tracksRef.current);
          triggerNote(engine, target, pitch, 0.6, Math.max(0.15, velocity));
          if (tp.recording) {
            const pitches = processMidiThroughPlugins(pitch, target.plugins);
            const notes: MidiNote[] = pitches.map((recordedPitch) => ({
              id: uid(),
              step: tp.step,
              length: 1,
              pitch: recordedPitch,
              velocity: Math.max(0.15, velocity),
            }));
            notes.forEach((note) => recordedNoteIdsRef.current.add(note.id));
            heldRef.current.set(pitch, { ids: notes.map((note) => note.id), trackId: target.id, t0: performance.now(), startStep: tp.step });
            setTracks((ts) =>
              ts.map((t) => (t.id === target.id ? { ...t, notes: [...(t.notes ?? []), ...notes] } : t)),
            );
          }
        } else {
          keyUp(pitch);
          setMidiLearning(false);
          const held = heldRef.current.get(pitch);
          if (!held) return;
          heldRef.current.delete(pitch);
          const elapsed = Math.round(((performance.now() - held.t0) / 1000 / stepDur) * 4) / 4;
          // A held note may cross bar lines, but never the end of the loop
          // region being recorded.
          const regionEnd = tp.loop && (tp.loopEnd ?? 0) > (tp.loopStart ?? 0)
            ? (tp.loopEnd ?? 0)
            : Number.POSITIVE_INFINITY;
          const steps = Math.max(0.25, Math.min(elapsed, regionEnd - held.startStep));
          setTracks((ts) =>
            ts.map((t) =>
              t.id === held.trackId
                ? { ...t, notes: (t.notes ?? []).map((n) => (held.ids.includes(n.id) ? { ...n, length: steps } : n)) }
                : t,
            ),
          );
        }
      });
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [midiInputId]);

  useEffect(() => {
    if (typeof window !== "undefined" && getEngine().ctx) {
      getEngine().syncMix(tracks);
      for (const t of tracks) getEngine().setInserts(t.id, t.plugins ?? []);
    }
  }, [tracks]);

  // A new recording pass starts with an empty "played live" list, so earlier
  // takes keep sounding while only this pass's live notes skip re-voicing.
  useEffect(() => {
    if (transport.recording) {
      recordedNoteIdsRef.current = new Set();
      clearLiveHits();
    } else {
      clearLiveHits();
    }
  }, [transport.recording]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const [id, b] of Object.entries(buses)) getEngine().setBus(id, b.volume, b.muted);
  }, [buses]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    getEngine().setVcaStates(vcas, tracksRef.current);
  }, [vcas]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const [id, value] of Object.entries(auxReturns)) getEngine().setAuxReturn(id, value.volume, value.muted);
  }, [auxReturns]);

  useEffect(() => {
    if (typeof window === "undefined" || !getEngine().ctx) return;
    for (const [target, list] of Object.entries(fxChains)) getEngine().setFxInserts(target, list);
  }, [fxChains]);


  // step clock — a look-ahead scheduler. Steps are queued against the audio
  // clock a little before they sound, so playback stays tight even when the
  // browser stalls the timer or a render blocks the main thread.
  useEffect(() => {
    if (!transport.playing) {
      automationGestureRef.current.clear();
      return;
    }
    const engine = getEngine();
    const ctx = engine.init();
    engine.syncMix(tracksRef.current);
    for (const track of tracksRef.current) engine.setInserts(track.id, track.plugins ?? []);
    for (const [target, list] of Object.entries(fxChains)) engine.setFxInserts(target, list);
    // make sure every arrangement clip is decoded before the playhead reaches it
    for (const t of tracksRef.current)
      for (const c of t.clips ?? []) if (c.url) void engine.ensureBuffer(c.url);

    const LOOKAHEAD = 0.14; // seconds of audio scheduled in advance
    const TICK = 20; // ms between scheduler passes
    let step = transportRef.current.step ?? 0;
    let nextTime = ctx.currentTime + 0.06;
    let cancelled = false;
    let lastScheduled: number | null = null;
    /** steps already handed to the audio clock, drained by the visual loop */
    const queue: { step: number; time: number }[] = [];

    /** Queue everything that makes sound for one step at an exact audio time. */
    const scheduleStep = (n: number, when: number) => {
      const tp = transportRef.current;
      const stepDur = stepSeconds(tp.bpm);
      engine.tempo = tp.bpm;
      const list = tracksRef.current;
      const anySolo = list.some((t) => t.solo);
      const totalSteps = songSteps(tp.bars);
      // swing pushes every off-beat 16th later, up to half a step — the shuffle
      // a drum machine gives you. Arrangement clips keep their exact position.
      const swung = when + (n % 2 === 1 ? Math.min(0.9, Math.max(0, tp.swing ?? 0)) * 0.5 * stepDur : 0);
      for (const t of list) {
        if (t.muted || t.frozen || (anySolo && !t.solo)) continue;
        const len = Math.max(1, t.steps);
        const s = n % len;
        // arrangement clips fire at their own position on the timeline
        if (t.clips?.length && !t.recording &&
            (!(["instrument", "midi", "drum"].includes(t.kind)) || t.printedAudio)) {
          const at = n % totalSteps;
          // after a start or jump (loop wrap), pick up clips already in progress
          const jumped = lastScheduled === null || at !== (lastScheduled + 1) % totalSteps;
          for (const c of t.clips) {
            if (!c.url) continue;
            const cs = c.start ?? 0;
            const rate = clipRate(c);
            const fullLen = c.length ?? c.duration ?? 0;
            let skip = 0;
            let startWhen = when;
            if (cs >= at && cs < at + 1) {
              // A replacement can leave a clip starting between grid steps.
              startWhen += (cs - at) * stepDur;
            } else if (jumped && at > cs) {
              skip = (at - cs) * stepDur * rate;
              if (skip >= fullLen - 0.02) continue;
            } else continue;
            engine.playClip(
              t.id,
              {
                url: c.url,
                // Reversed playback starts at the far end of the trim window:
                // shortening its length advances the heard start, not its offset.
                offset: (c.offset ?? 0) + (c.reverse ? 0 : skip),
                length: fullLen - skip,
                gain: c.gain ?? 1,
                fadeIn: skip ? 0.01 : (c.fadeIn ?? 0.004),
                fadeOut: c.fadeOut ?? 0.01,
                rate,
                reverse: c.reverse ?? false,
              },
              startWhen,
            );
          }
        }
        if (t.printedAudio && t.clips?.length && !t.recording) continue;
        if (t.kind === "drum" && t.pads) {
          const padSolo = t.pads.some((p) => p.solo);
          for (const pad of t.pads) {
            if (pad.muted || (padSolo && !pad.solo)) continue;
            const v = pad.steps[s] ?? 0;
            if (v <= 0) continue;
            // a hit just played live into this take was already heard — don't double it
            if (tp.recording && isLiveHit(t.id, pad.id, s)) continue;
            // a step with a chance below 100% only fires that often
            const chance = pad.probability?.[s];
            if (typeof chance === "number" && chance < 1 && Math.random() > chance) continue;
            const retrig = Math.max(1, Math.min(4, Math.round(pad.retrig?.[s] ?? 1)));
            const flam = Math.max(0, Math.min(1, pad.flam?.[s] ?? 0));
            const glitch = Math.max(0, Math.min(1, pad.glitch?.[s] ?? 0));
            const stepPad = {
              ...pad,
              pitch: pad.pitch + (pad.stepPitch?.[s] ?? 0) + (glitch > 0 && Math.random() < glitch ? (Math.random() < 0.5 ? -12 : 12) : 0),
              decay: Math.max(0, pad.decay * (pad.stepDecay?.[s] ?? 1) * (glitch > 0 ? 1 - Math.random() * glitch * 0.7 : 1)),
              crush: Math.max(pad.crush ?? 0, glitch > 0 && Math.random() < glitch ? glitch : 0),
            };
            const spacing = stepDur / retrig;
            for (let hit = 0; hit < retrig; hit++) engine.playDrum(t.id, stepPad, v * Math.pow(0.88, hit), swung + hit * spacing);
            if (flam > 0) engine.playDrum(t.id, stepPad, v * (0.35 + flam * 0.4), swung + 0.012 + flam * 0.035);
          }
        } else if (t.kind === "sampler" && t.sampler && t.notes) {
          for (const note of t.notes) {
            // recorded notes keep a sub-step fraction for quantize; the
            // scheduler fires on whole steps only, so compare the floored step
            const step0 = Math.floor(note.step);
            if (tp.recording && recordedNoteIdsRef.current.has(note.id)) continue;
            if (step0 % len === s && (note.recordedEnd == null || (n >= step0 && n < note.recordedEnd))) triggerNote(engine, t, note.pitch, note.length * stepDur, note.velocity, swung);
          }
        } else if (t.patch && t.notes) {
          for (const note of t.notes) {
            const step0 = Math.floor(note.step);
            // notes played live into this take were already heard — don't double them
            if (tp.recording && recordedNoteIdsRef.current.has(note.id)) continue;
            if (step0 % len !== s || (note.recordedEnd != null && (n < step0 || n >= note.recordedEnd))) continue;
            const dur = (note.length * stepDur) / (t.patch.arp.on ? 2 : 1);
            if (t.patch.arp.on) {
              const oct = t.patch.arp.octaves;
              for (let i = 0; i < note.length; i++) {
                const shift = (i % Math.max(1, oct)) * 12;
                const dir = t.patch.arp.direction === "down" ? -shift : shift;
                engine.playNote(t.id, t.patch, note.pitch + dir, stepDur * t.patch.arp.gate, note.velocity, swung + i * stepDur);
              }
            } else {
              engine.playNote(t.id, t.patch, note.pitch, dur, note.velocity, swung);
            }
          }
        }
      }
      if (tp.metronome && n % STEPS_PER_BEAT === 0) {
        const downbeat = n % stepsPerBar() === 0;
        engine.playDrum(
          "metronome",
          {
            id: "m",
            name: "click",
            kind: downbeat ? "rim" : "hat",
            volume: 0.35,
            pan: 0,
            pitch: downbeat ? 5 : 0,
            decay: 0,
            muted: false,
            solo: false,
            steps: [],
          },
          1,
          when,
        );
      }
    };

    /** Everything that should happen the moment a step is actually heard. */
    let prevAt = -1;
    const reachStep = (n: number) => {
      const tp = transportRef.current;
      const list = tracksRef.current;
      const anySolo = list.some((t) => t.solo);
      const totalSteps = songSteps(tp.bars);
      const at = n % totalSteps;
      // a loop wrap ends the take: recording never runs past the selected bars
      if (tp.loop && prevAt >= 0 && at < prevAt) {
        const lo = Math.max(0, Math.min(totalSteps - 1, tp.loopStart ?? 0));
        if (at === lo) loopStopRef.current?.();
      }
      prevAt = at;
      // punch in / out: the take starts and stops itself at the markers
      if (tp.punchIn != null && at === tp.punchIn) punchRef.current?.start();
      if (tp.punchOut != null && at === tp.punchOut) punchRef.current?.stop();
      for (const t of list) {
        if (t.muted || t.frozen || (anySolo && !t.solo)) continue;
        if (!t.automation?.length) continue;
        const ride: Record<string, number> = {};
        for (const lane of t.automation) {
          const gesture = automationGestureRef.current.get(`${t.id}:${lane.param}`);
          const touching = (gesture?.touchedUntil ?? 0) > performance.now();
          const writing =
            !lane.locked && (lane.mode === "write" || (lane.mode === "latch" && gesture?.latched) || (lane.mode === "touch" && touching));
          if (writing && lane.param.startsWith("plugin:")) {
            const [, pluginId = "", paramId = ""] = lane.param.split(":");
            const plugin = (t.plugins ?? []).find((item) => item.id === pluginId);
            const control = plugin?.params.find((item) => item.id === paramId);
            if (control) {
              const normalized = control.max > control.min ? (control.value - control.min) / (control.max - control.min) : 0;
              const points = [...lane.points.filter((point) => point.step !== at), { step: at, value: normalized }].sort(
                (a, b) => a.step - b.step,
              );
              setTracks((current) =>
                current.map((track) =>
                  track.id === t.id
                    ? { ...track, automation: (track.automation ?? []).map((item) => (item.param === lane.param ? { ...item, points } : item)) }
                    : track,
                ),
              );
            }
            continue;
          }
          if ((lane.mode === "read" || lane.mode === "touch") && !touching && lane.points.length > 0) ride[lane.param] = valueAt(lane.points, at);
        }
        if (Object.keys(ride).length > 0) engine.automate(t.id, ride);
      }
      setTransportState((t) => (t.step === at ? t : { ...t, step: at }));
    };

    const pump = () => {
      if (cancelled) return;
      const now = ctx.currentTime;
      // a suspended or stalled context can leave us far behind; resync instead of
      // firing a burst of late notes
      if (nextTime < now - 0.25) {
        nextTime = now + 0.04;
        step = transportRef.current.step ?? step;
        lastScheduled = null;
        queue.length = 0;
      }
      while (nextTime < now + LOOKAHEAD) {
        const tp = transportRef.current;
        const total = songSteps(tp.bars);
        const stepDur = stepSeconds(tp.bpm);
        scheduleStep(step, nextTime);
        lastScheduled = step % total;
        queue.push({ step: step % total, time: nextTime });
        lastStepRef.current = { step: step % total, time: nextTime, dur: stepDur };
        nextTime += stepDur;
        step += 1;
        if (tp.loop) {
          const lo = Math.max(0, Math.min(total - 1, tp.loopStart ?? 0));
          const hi = Math.min(total, Math.max(lo + 1, tp.loopEnd ?? total));
          if (step >= hi) step = lo;
        } else if (step >= total) {
          step = 0;
        }
      }
    };

    const frame = () => {
      if (cancelled) return;
      const now = ctx.currentTime;
      let reached = -1;
      while (queue.length > 0 && queue[0]!.time <= now) reached = queue.shift()!.step;
      if (reached >= 0) reachStep(reached);
      raf = requestAnimationFrame(frame);
    };

    void ctx.resume?.();
    pump();
    let raf = requestAnimationFrame(frame);
    const interval = window.setInterval(pump, TICK);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      engine.silenceChannels(tracksRef.current.map((track) => track.id));
      engine.removeChannel("metronome");
    };
  }, [transport.playing]);


  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  // Arming an audio channel opens the microphone so its meter moves and, when
  // monitoring is on, you hear yourself. Recording is a separate step.
  const armedInputId =
    tracks.find((t) => t.armed && (t.kind === "audio" || t.kind === "ai-vocal" || t.kind === "sampler"))?.id ?? null;
  const monitorOn = transport.monitor ?? false;
  useEffect(() => {
    const engine = getEngine();
    if (!armedInputId) {
      engine.stopInputMonitoring();
      return;
    }
    let cancelled = false;
    void engine.startInputMonitoring(armedInputId, monitorOn).catch((err: unknown) => {
      if (cancelled) return;
      toast.error("Microphone unavailable", {
        description: err instanceof Error ? err.message : "The microphone could not be opened.",
        duration: 9000,
        action: { label: "Open in tab", onClick: openInOwnTab },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [armedInputId, monitorOn]);

  const finishRecording = useCallback(async () => {
    const engine = getEngine();
    if (!engine.isRecording) return;
    const target = tracksRef.current.find(
      (t) => t.recording && (t.kind === "audio" || t.kind === "ai-vocal" || t.kind === "sampler"),
    );
    let result: Awaited<ReturnType<typeof engine.stopInputRecording>> = null;
    try {
      result = await engine.stopInputRecording();
    } catch (err) {
      toast.error("Take couldn't be kept", { description: err instanceof Error ? err.message : undefined });
    }
    if (!target) return;
    if (!result) {
      updateTrack(target.id, { recording: false });
      return;
    }
    const takeNo = (target.clips?.length ?? 0) + 1;
    const clip: AudioClip = {
      id: uid(),
      name: `TAKE ${takeNo}`,
      peaks: result.peaks,
      duration: result.duration,
      url: result.url,
      start: snapRecStart(recStartStepRef.current, transportRef.current.snap),
      offset: 0,
      length: result.duration,
      gain: 1,
    };
    const replace = !!transportRef.current.replace;
    const stepDur = 60 / (transportRef.current.bpm || 120) / 4;
    const newEnd = (clip.start ?? 0) + (clip.length ?? clip.duration) / stepDur;
    const oldClips = target.clips ?? [];
    const kept = replace ? replaceTakeRegion(oldClips, clip.start ?? 0, newEnd, stepDur) : oldClips;
    const replaced = oldClips.filter((c) => (c.start ?? 0) < newEnd && (c.start ?? 0) + (c.length ?? c.duration) / clipRate(c) / stepDur > (clip.start ?? 0)).length;
    setTracks((ts) =>
      ts.map((t) =>
        t.id === target.id ? { ...t, recording: false, clips: [...kept, clip], activeClipId: clip.id } : t,
      ),
    );
    toast.success(`${clip.name} recorded on ${target.name}`, {
      description: replace
        ? `${result.duration.toFixed(1)}s captured — replaced ${replaced} overlapping take${replaced === 1 ? "" : "s"} in the recorded region. Undo brings them back.`
        : `${result.duration.toFixed(1)}s captured — pick your best take on the track.`,
    });
  }, [updateTrack]);

  const finishTrackRecording = useCallback(async () => {
    const engine = getEngine();
    if (!engine.isTrackRecording) return;
    // Held MIDI notes cannot extend past the end of the recorded region:
    // the loop end when looping, otherwise where the transport stopped.
    const tp = transportRef.current;
    const endStep = tp.step;
    const regionEnd = tp.loop && (tp.loopEnd ?? 0) > (tp.loopStart ?? 0)
      ? (tp.loopEnd ?? 0)
      : endStep;
    for (const [pitch, held] of heldRef.current) {
      heldRef.current.delete(pitch);
      const end = regionEnd >= held.startStep ? regionEnd : regionEnd + songSteps(tp.bars);
      const length = Math.max(0.25, end - held.startStep);
      setTracks((ts) => ts.map((t) => t.id === held.trackId ? { ...t, notes: (t.notes ?? []).map((n) => held.ids.includes(n.id) ? { ...n, length } : n) } : t));
    }
    try {
      const result = await engine.stopTrackRecording();
      if (!result) return;
      const target = tracksRef.current.find((t) => t.id === result.trackId);
      if (!target) return;
      const stepDur = stepSeconds(transportRef.current.bpm);
      const takeEnd = Math.min(songSteps(transportRef.current.bars), recStartStepRef.current + Math.max(1, Math.ceil(result.duration / stepDur)));
      const capturedIds = recordedNoteIdsRef.current;
      setTracks((ts) => ts.map((t) => t.id === result.trackId ? {
        ...t, notes: (t.notes ?? []).map((n) => capturedIds.has(n.id) ? {
          ...n, recordedEnd: takeEnd,
          length: Math.max(0.25, Math.min(n.length, takeEnd - n.step)),
        } : n),
      } : t));
      recordedNoteIdsRef.current = new Set();
      const clip: AudioClip = {
        id: uid(), name: `${target.name} TAKE ${(target.clips?.length ?? 0) + 1}`,
        peaks: result.peaks, duration: result.duration, url: result.url,
        start: snapRecStart(recStartStepRef.current, transportRef.current.snap), offset: 0, length: result.duration, gain: 1,
      };
      // Keep the editable notes/steps intact. The printed audio takes their place
      // during playback until the user explicitly switches back to the pattern.
      // Only the explicit overdub mode should stack printed takes at the same position.
      const replace = !!transportRef.current.replace || !transportRef.current.overdub;
      const newEnd = (clip.start ?? 0) + (clip.length ?? clip.duration) / stepDur;
      setTracks((ts) => ts.map((t) => t.id === result.trackId
        ? { ...t, clips: [...(replace ? replaceTakeRegion(t.clips ?? [], clip.start ?? 0, newEnd, stepDur) : (t.clips ?? [])), clip], activeClipId: clip.id, printedAudio: true }
        : t));
      toast.success(`${clip.name} recorded`, { description: "Double-click the waveform to edit it; switch to Notes to edit the pattern." });
    } catch (err) {
      toast.error("Take couldn't be kept", { description: err instanceof Error ? err.message : undefined });
    }
  }, []);

  // keep the punch hooks pointing at the current record helpers
  useEffect(() => {
    punchRef.current = {
      start: () => {
        const engine = getEngine();
        if (engine.isRecording) return;
        const target = tracksRef.current.find((t) => t.armed && (t.kind === "audio" || t.kind === "ai-vocal"));
        if (!target) return;
        recStartStepRef.current = transportRef.current.step ?? 0;
        void engine
          .startInputRecording(target.id, transportRef.current.monitor ?? false)
          .then(() => {
            updateTrack(target.id, { recording: true });
            setTransportState((t) => ({ ...t, recording: true }));
            toast("Punched in", { description: `Recording ${target.name}.` });
          })
          .catch((err: unknown) =>
            toast.error("Microphone unavailable", {
              description: err instanceof Error ? err.message : "The microphone could not be opened.",
              duration: 9000,
              action: { label: "Open in tab", onClick: openInOwnTab },
            }),
          );
      },
      stop: () => {
        if (!getEngine().isRecording) return;
        void finishRecording();
        setTransportState((t) => ({ ...t, recording: false }));
        toast("Punched out", { description: "The take stops at your punch-out marker." });
      },
    };
    loopStopRef.current = () => {
      const engine = getEngine();
      const audio = engine.isRecording;
      const inst = engine.isTrackRecording;
      if (!audio && !inst) return;
      if (audio) void finishRecording();
      if (inst) void finishTrackRecording();
      setTransportState((t) => ({ ...t, recording: false }));
      toast("Recording stopped at the loop end", { description: "Takes stay inside the bars you selected." });
    };
  }, [finishRecording, finishTrackRecording, updateTrack]);

  const splitClipAtImpl = useCallback(
    (trackId: string, frac: number) => {
      const t = tracksRef.current.find((x) => x.id === trackId);
      const clips = t?.clips ?? [];
      const active = clips.find((c) => c.id === t?.activeClipId) ?? clips[clips.length - 1];
      if (!t || !active) {
        toast("Nothing to split", { description: "That channel has no recorded clip. Record audio first." });
        return;
      }
      const f = Math.min(0.95, Math.max(0.05, frac));
      const cut = Math.max(1, Math.min(active.peaks.length - 1, Math.round(active.peaks.length * f)));
      const stamp = Date.now();
      const a: AudioClip = {
        ...active,
        id: `${active.id}-a${stamp}`,
        name: `${active.name} A`,
        peaks: active.peaks.slice(0, cut),
        duration: active.duration * f,
      };
      const b: AudioClip = {
        ...active,
        id: `${active.id}-b${stamp}`,
        name: `${active.name} B`,
        peaks: active.peaks.slice(cut),
        duration: active.duration * (1 - f),
      };
      updateTrack(trackId, {
        clips: clips.flatMap((c) => (c.id === active.id ? [a, b] : [c])),
        activeClipId: a.id,
      });
      toast.success("Clip split", { description: `${active.name} → ${a.name} + ${b.name}` });
    },
    [updateTrack],
  );

  /** Razor tool: slice every clip under the pointer at the exact clicked position. */
  const razorAtImpl = useCallback(
    (trackId: string, posSteps: number) => {
      const t = tracksRef.current.find((x) => x.id === trackId);
      const clips = t?.clips ?? [];
      if (!t || clips.length === 0) {
        toast("Nothing to slice", { description: "That channel has no clip. Record audio first." });
        return;
      }
      const stepDur = stepSeconds(transportRef.current.bpm);
      const stamp = Date.now();
      let sliced = 0;
      const next = clips.flatMap((c) => {
        const start = c.start ?? 0;
        const lenSteps = clipSeconds(c) / stepDur;
        const posIn = posSteps - start;
        if (posIn <= 0.05 || posIn >= lenSteps - 0.05) return [c];
        sliced += 1;
        const f = Math.min(0.95, Math.max(0.05, posIn / lenSteps));
        const cut = Math.max(1, Math.min(c.peaks.length - 1, Math.round(c.peaks.length * f)));
        const a: AudioClip = {
          ...c,
          id: `${c.id}-a${stamp}`,
          name: `${c.name} A`,
          peaks: c.peaks.slice(0, cut),
          duration: c.duration * f,
        };
        const b: AudioClip = {
          ...c,
          id: `${c.id}-b${stamp}`,
          name: `${c.name} B`,
          peaks: c.peaks.slice(cut),
          duration: c.duration * (1 - f),
        };
        return [a, b];
      });
      if (sliced === 0) {
        toast("Razor missed", { description: "Click inside a clip to slice it exactly there." });
        return;
      }
      const activeId = t.activeClipId;
      const activeSliced = sliced > 0 && activeId && clips.some((c) => c.id === activeId && posSteps - (c.start ?? 0) > 0.05 && posSteps - (c.start ?? 0) < clipSeconds(c) / stepDur - 0.05);
      updateTrack(trackId, {
        clips: next,
        activeClipId: activeSliced && activeId ? `${activeId}-a${stamp}` : activeId,
      });
      toast.success(`Sliced ${sliced} clip${sliced > 1 ? "s" : ""}`, { description: "The razor cut at the exact click position." });
    },
    [updateTrack],
  );

  const buildSnapshot = useCallback(
    (): CloudSession => ({
      version: 1,
      tracks: structuredClone(tracksRef.current),
      transport: { ...transportRef.current, playing: false, recording: false, paused: false, step: 0 },
      buses: structuredClone(buses),
      vcas: structuredClone(vcas),
      auxReturns: structuredClone(auxReturns),
      fxChains: structuredClone(fxChains),
      installedPlugins: structuredClone(installedPlugins),
      userPresets: structuredClone(userPresets),
      padBank: getPadBank(),
      sections: structuredClone(sectionsRef.current),
    }),
    [buses, vcas, auxReturns, fxChains, installedPlugins, userPresets],
  );

  const applySession = useCallback((session: CloudSession) => {
    getEngine().stopSamples();
    for (const track of tracksRef.current) getEngine().removeChannel(track.id);
    setTracks(structuredClone(session.tracks));
    setTransportState({ ...session.transport, playing: false, recording: false, paused: false, step: 0 });
    setBuses(structuredClone(session.buses));
    setVcas(structuredClone(session.vcas ?? {
      A: { volume: 1, muted: false }, B: { volume: 1, muted: false },
      C: { volume: 1, muted: false }, D: { volume: 1, muted: false },
    }));
    setAuxReturns(structuredClone(session.auxReturns ?? {
      reverb: { volume: 1, muted: false }, delay: { volume: 1, muted: false }, chorus: { volume: 1, muted: false },
    }));
    setFxChains(structuredClone(session.fxChains));
    setInstalledPlugins(structuredClone(session.installedPlugins));
    setUserPresets(structuredClone(session.userPresets));
    setPadBank(session.padBank ?? {});
    setSections(structuredClone(session.sections ?? []));
    setSelectedId(session.tracks[0]?.id ?? null);
    setSelectedIds(session.tracks[0] ? [session.tracks[0].id] : []);
    setPanel(null);
  }, []);

  // Record a history step and keep a local copy of the session, debounced so a
  // drag or a knob sweep counts as one edit.
  useEffect(() => {
    if (applyingRef.current) {
      applyingRef.current = false;
      lastSnapRef.current = buildSnapshot();
      return;
    }
    if (lastSnapRef.current === null) {
      lastSnapRef.current = buildSnapshot();
      return;
    }
    const id = window.setTimeout(() => {
      const prev = lastSnapRef.current;
      if (prev) {
        pastRef.current = [...pastRef.current, prev].slice(-60);
        futureRef.current = [];
      }
      const next = buildSnapshot();
      lastSnapRef.current = next;
      setHistoryTick((t) => t + 1);
      try {
        window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(next));
        setSavedAt(Date.now());
      } catch {
        /* storage full or unavailable — cloud save still works */
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [tracks, buses, vcas, auxReturns, fxChains, installedPlugins, userPresets, sections, buildSnapshot]);

  // Bring the last session back after a refresh or a crash.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as CloudSession;
      if (!s?.tracks?.length) return;
      let lostAudio = false;
      for (const t of s.tracks) {
        if (t.clips) {
          t.clips = t.clips.map((c) => {
            if (c.url?.startsWith("blob:")) {
              lostAudio = true;
              return { ...c, url: undefined };
            }
            return c;
          });
        }
        if (t.sampler?.url?.startsWith("blob:")) {
          lostAudio = true;
          t.sampler = { ...t.sampler, url: "" };
        }
      }
      toast("Recover previous session?", {
        description: `${s.tracks.length} track${s.tracks.length === 1 ? "" : "s"} from your last session were saved automatically.${
          lostAudio ? " Imported audio files will need loading again." : ""
        }`,
        duration: Infinity,
        action: {
          label: "Recover",
          onClick: () => {
            applyingRef.current = true;
            applySession(s);
            lastSnapRef.current = s;
          },
        },
        cancel: {
          label: "Discard",
          onClick: () => {
            try {
              window.localStorage.removeItem(AUTOSAVE_KEY);
            } catch {
              /* ignore */
            }
          },
        },
      });
    } catch {
      /* unreadable autosave — start fresh */
    }
  }, [applySession]);

  const api: StudioApi = useMemo(() => {
    const selected = tracks.find((t) => t.id === selectedId) ?? null;
    /** Writes a note into the armed recording track without sounding it. */
    const capture = (trackId: string, midi: number, velocity: number) => {
      const tp = transportRef.current;
      const t = tracksRef.current.find((x) => x.id === trackId);
      if (!t || !tp.recording) return;
      if (t.kind !== "instrument" && t.kind !== "midi" && t.kind !== "sampler") return;
      // stamp the true sub-step position from the audio clock so the take keeps
      // the player's timing — quantize then has something real to snap
      let stepPos = tp.step;
      const ls = lastStepRef.current;
      const eng = getEngine();
      if (tp.playing && ls && eng.ctx) {
        const frac = Math.min(0.999, Math.max(0, (eng.ctx.currentTime - ls.time) / ls.dur));
        stepPos = (ls.step + frac) % songSteps(tp.bars);
      }
      const note: MidiNote = { id: uid(), step: Math.max(0, stepPos), length: 1, pitch: midi, velocity };
      recordedNoteIdsRef.current.add(note.id);
      setTracks((ts) => ts.map((x) => (x.id === t.id ? { ...x, notes: [...(x.notes ?? []), note] } : x)));
    };
    const stepBack = (from: "past" | "future") => {
      const stack = from === "past" ? pastRef : futureRef;
      const other = from === "past" ? futureRef : pastRef;
      const entry = stack.current.pop();
      if (!entry) {
        toast(from === "past" ? "Nothing to undo" : "Nothing to redo");
        return;
      }
      if (lastSnapRef.current) other.current = [...other.current, lastSnapRef.current].slice(-60);
      applyingRef.current = true;
      applySession(entry);
      lastSnapRef.current = entry;
      setHistoryTick((t) => t + 1);
      toast(from === "past" ? "Undone" : "Redone");
    };
    return {
      tracks,
      transport,
      selectedId,
      selectedIds,
      editTool,
      panel,
      userPresets,
      buses,
      vcas,
      auxReturns,
      sections,
      snapshot: buildSnapshot,
      restore: (session) => {
        applyingRef.current = true;
        applySession(session);
        lastSnapRef.current = session;
      },
      undo: () => stepBack("past"),
      redo: () => stepBack("future"),
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
      savedAt,
      selected,
      setBus: (id, patch) => setBuses((b) => ({ ...b, [id]: { ...b[id], ...patch } })),
      setVca: (id, patch) => setVcas((v) => ({ ...v, [id]: { ...v[id], ...patch } })),
      setAuxReturn: (id, patch) => setAuxReturns((a) => ({ ...a, [id]: { ...a[id], ...patch } })),
      addSection: (name, start, length) => {
        setSections((list) => {
          const sorted = [...list].sort((a, b) => a.start - b.start);
          const last = sorted[sorted.length - 1];
          const at = start ?? (last ? last.start + last.length : transportRef.current.step ?? 0);
          const len = Math.max(4, length ?? 32);
          const next: SongSection = {
            id: uid(),
            name: (name ?? `PART ${sorted.length + 1}`).toUpperCase(),
            start: Math.max(0, Math.round(at)),
            length: Math.round(len),
            color: SECTION_COLORS[sorted.length % SECTION_COLORS.length] as string,
          };
          toast.success(`${next.name} added`, {
            description: `Bar ${Math.floor(next.start / stepsPerBar()) + 1} to ${Math.floor((next.start + next.length) / stepsPerBar()) + 1}`,
          });
          return [...sorted, next].sort((a, b) => a.start - b.start);
        });
      },
      updateSection: (id, patch) =>
        setSections((list) =>
          [...list]
            .map((sec) => (sec.id === id ? { ...sec, ...patch } : sec))
            .sort((a, b) => a.start - b.start),
        ),
      removeSection: (id) =>
        setSections((list) => {
          const gone = list.find((s2) => s2.id === id);
          if (gone) toast(`${gone.name} marker removed`, { description: "The audio on the timeline was left alone." });
          return list.filter((s2) => s2.id !== id);
        }),
      duplicateSection: (id) => {
        const list = sectionsRef.current;
        const sec = list.find((s2) => s2.id === id);
        if (!sec) return;
        const from = sec.start;
        const to = sec.start + sec.length;
        const len = sec.length;
        let copied = 0;
        setTracks((ts) =>
          ts.map((t) => {
            const next: Partial<Track> = {};
            if (t.clips?.length) {
              const clips: AudioClip[] = [];
              for (const c of t.clips) {
                const cs = c.start ?? 0;
                clips.push(cs >= to ? { ...c, start: cs + len } : c);
                if (cs >= from && cs < to) {
                  clips.push({ ...c, id: uid(), start: cs + len });
                  copied++;
                }
              }
              next.clips = clips;
            }
            if (t.notes?.length) {
              const notes: MidiNote[] = [];
              for (const n of t.notes) {
                notes.push(n.step >= to ? { ...n, step: n.step + len } : n);
                if (n.step >= from && n.step < to) {
                  notes.push({ ...n, id: uid(), step: n.step + len });
                  copied++;
                }
              }
              next.notes = notes;
            }
            if (t.automation?.length) {
              next.automation = t.automation.map((lane) => ({
                ...lane,
                points: [
                  ...lane.points.map((pt) => (pt.step >= to ? { ...pt, step: pt.step + len } : pt)),
                  ...lane.points.filter((pt) => pt.step >= from && pt.step < to).map((pt) => ({ ...pt, step: pt.step + len })),
                ].sort((a, b) => a.step - b.step),
              }));
            }
            return Object.keys(next).length ? { ...t, ...next } : t;
          }),
        );
        setSections((cur) => {
          const copy: SongSection = { ...sec, id: uid(), start: to };
          return [...cur.map((s2) => (s2.start >= to ? { ...s2, start: s2.start + len } : s2)), copy].sort(
            (a, b) => a.start - b.start,
          );
        });
        const neededBars = barsForSteps(to + len);
        if (neededBars > (transportRef.current.bars ?? 4)) setTransportState((t) => ({ ...t, bars: Math.min(512, neededBars) }));
        toast.success(`${sec.name} duplicated`, {
          description: copied > 0 ? `${copied} clips and notes copied along with it.` : "The marker was copied — that part of the song was empty.",
        });
      },
      gotoSection: (id) => {
        const sec = sectionsRef.current.find((s2) => s2.id === id);
        if (!sec) return;
        setTransportState((t) =>
          t.loop
            ? { ...t, step: sec.start, loopStart: sec.start, loopEnd: sec.start + sec.length }
            : { ...t, step: sec.start },
        );
      },
      autoSections: () => {
        const bars = Math.max(4, transportRef.current.bars ?? 8);
        const names = ["INTRO", "VERSE", "CHORUS", "VERSE 2", "BRIDGE", "CHORUS 2", "OUTRO"];
        const part = Math.max(1, Math.round(bars / names.length));
        const built: SongSection[] = [];
        let at = 0;
        for (let i = 0; i < names.length && at < bars * stepsPerBar(); i++) {
          const len = Math.min(part * stepsPerBar(), bars * stepsPerBar() - at);
          if (len < stepsPerBar()) break;
          built.push({
            id: uid(),
            name: names[i] as string,
            start: at,
            length: len,
            color: SECTION_COLORS[i % SECTION_COLORS.length] as string,
          });
          at += len;
        }
        setSections(built);
        toast.success("Song structure laid out", { description: `${built.length} parts across ${bars} bars — rename or drag any of them.` });
      },
      setPanel,
      select: (id) => {
        setSelectedId(id);
        setSelectedIds([id]);
      },
      setEditTool,
      selectAll: () => {
        const ids = tracksRef.current.map((t) => t.id);
        setSelectedIds(ids);
        if (ids.length > 0) setSelectedId(ids[ids.length - 1] ?? null);
        toast("All channels selected", { description: `${ids.length} channels — delete or cut applies to the selection.` });
      },
      toggleSelectId: (id) =>
        setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
      splitClipAt: splitClipAtImpl,
      razorAt: razorAtImpl,
      splitAtPlayhead: () => {
        const id = selectedIdRef.current;
        if (!id) {
          toast("Select a channel first", { description: "Click the channel whose clip or notes you want to split." });
          return;
        }
        const step = transportRef.current.step ?? 0;
        const frac = Math.min(0.98, Math.max(0.02, (step % 16) / 16));
        const t = tracksRef.current.find((x) => x.id === id);
        if (t && (t.kind === "instrument" || t.kind === "midi" || t.kind === "sampler")) {
          const cutStep = step % 16;
          const notes = t.notes ?? [];
          const crossing = notes.filter((n) => n.step % 16 < cutStep && (n.step % 16) + n.length > cutStep);
          if (crossing.length === 0) {
            toast("No note crosses the playhead", { description: "Move the playhead over a note, or split an audio clip." });
            return;
          }
          const next = notes.flatMap((n) => {
            const s = n.step % 16;
            if (s < cutStep && s + n.length > cutStep) {
              return [
                { ...n, length: cutStep - s },
                { ...n, id: uid(), step: n.step + (cutStep - s), length: s + n.length - cutStep },
              ];
            }
            return [n];
          });
          updateTrack(id, { notes: next });
          toast.success(`Split ${crossing.length} note${crossing.length > 1 ? "s" : ""} at the playhead`);
          return;
        }
        splitClipAtImpl(id, frac);
      },
      addTrack: (kind, name, preset) => {
        const id = uid();
        setTracks((ts) => {
          const t = { ...newTrack(kind, name ?? `TRACK ${ts.length + 1}`, ts.length, preset), id };
          setSelectedId(t.id);
          setPanel(kind === "drum" ? "drums" : kind === "ai-vocal" || kind === "audio" ? null : "synth");
          return [...ts, t];
        });
        return id;
      },
      updateTrack,
      removeTrack: (id) => {
        getEngine().removeChannel(id);
        setTracks((ts) => ts.filter((t) => t.id !== id));
        setSelectedId((s) => (s === id ? null : s));
        setSelectedIds((s) => s.filter((x) => x !== id));
      },
      duplicateTrack: (id) =>
        setTracks((ts) => {
          const i = ts.findIndex((t) => t.id === id);
          if (i < 0) return ts;
          const src = ts[i] as Track;
          const copy: Track = {
            ...(structuredClone(src) as Track),
            id: uid(),
            name: `${src.name} COPY`,
          };
          if (copy.pads) copy.pads = copy.pads.map((p) => ({ ...p, id: uid() }));
          if (copy.notes) copy.notes = copy.notes.map((n) => ({ ...n, id: uid() }));
          const next = [...ts];
          next.splice(i + 1, 0, copy);
          return next;
        }),
      moveTrack: (id, dir) =>
        setTracks((ts) => {
          const i = ts.findIndex((t) => t.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= ts.length) return ts;
          const next = [...ts];
          [next[i], next[j]] = [next[j] as Track, next[i] as Track];
          return next;
        }),
      clipboardName,
      copyTrack: (id) => {
        const src = tracksRef.current.find((t) => t.id === id);
        if (!src) return;
        clipboardRef.current = structuredClone(src) as Track;
        setClipboardName(src.name);
        toast("Copied", { description: `${src.name} is on the clipboard — press ⌘V / Ctrl+V to paste.` });
      },
      cutTrack: (id) => {
        const src = tracksRef.current.find((t) => t.id === id);
        if (!src) return;
        clipboardRef.current = structuredClone(src) as Track;
        setClipboardName(src.name);
        getEngine().removeChannel(id);
        setTracks((ts) => ts.filter((t) => t.id !== id));
        setSelectedId((s) => (s === id ? null : s));
        setSelectedIds((s) => s.filter((x) => x !== id));
        toast("Cut", { description: `${src.name} removed and placed on the clipboard.` });
      },
      pasteTrack: () => {
        const src = clipboardRef.current;
        if (!src) {
          toast("Clipboard is empty", { description: "Copy a track first with ⌘C / Ctrl+C." });
          return;
        }
        const copy: Track = { ...(structuredClone(src) as Track), id: uid(), name: `${src.name} COPY`, recording: false };
        if (copy.pads) copy.pads = copy.pads.map((p) => ({ ...p, id: uid() }));
        if (copy.notes) copy.notes = copy.notes.map((n) => ({ ...n, id: uid() }));
        if (copy.clips) copy.clips = copy.clips.map((c) => ({ ...c, id: uid() }));
        if (copy.plugins) copy.plugins = copy.plugins.map((p) => ({ ...p, id: uid() }));
        copy.activeClipId = copy.clips?.[0]?.id;
        setTracks((ts) => {
          const i = ts.findIndex((t) => t.id === selectedIdRef.current);
          const next = [...ts];
          next.splice(i < 0 ? ts.length : i + 1, 0, copy);
          return next;
        });
        setSelectedId(copy.id);
        toast.success("Pasted", { description: copy.name });
      },
      clipClipboardName,
      copyClip: (trackId, clipId) => {
        const clip = tracksRef.current.find((t) => t.id === trackId)?.clips?.find((c) => c.id === clipId);
        if (!clip) return;
        clipClipboardRef.current = structuredClone(clip) as AudioClip;
        setClipClipboardName(clip.name);
        toast("Clip copied", { description: `${clip.name} — press ⌘V / Ctrl+V to paste it at the playhead.` });
      },
      cutClip: (trackId, clipId) => {
        const track = tracksRef.current.find((t) => t.id === trackId);
        const clip = track?.clips?.find((c) => c.id === clipId);
        if (!track || !clip) return;
        clipClipboardRef.current = structuredClone(clip) as AudioClip;
        setClipClipboardName(clip.name);
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? { ...t, clips: (t.clips ?? []).filter((c) => c.id !== clipId), activeClipId: t.activeClipId === clipId ? undefined : t.activeClipId }
              : t,
          ),
        );
        toast("Clip cut", { description: `${clip.name} — paste it at the playhead with ⌘V / Ctrl+V.` });
      },
      pasteClip: (atEnd) => {
        const src = clipClipboardRef.current;
        if (!src) {
          toast("Clip clipboard is empty", { description: "Click a clip and press ⌘C / Ctrl+C first." });
          return;
        }
        const target = tracksRef.current.find((t) => t.id === selectedIdRef.current);
        if (!target) {
          toast("Select a track first", { description: "Click the track you want the clip on, then paste." });
          return;
        }
        // start is in steps but length is in seconds — convert so the paste
        // lands after the last clip instead of on top of it
        const pasteStepDur = stepSeconds(transportRef.current.bpm);
        const endOf = (t: Track) =>
          (t.clips ?? []).reduce((m, c) => Math.max(m, (c.start ?? 0) + clipSeconds(c) / pasteStepDur), 0);
        const at = atEnd ? Math.round(endOf(target)) : transportRef.current.step;
        const clip: AudioClip = { ...(structuredClone(src) as AudioClip), id: uid(), start: at };
        const isNotes = target.kind === "drum" || target.kind === "instrument" || target.kind === "midi";
        // Paste onto the selected track itself; note tracks switch to WAVE so the audio plays there.
        setTracks((ts) =>
          ts.map((t) => (t.id === target.id ? { ...t, clips: [...(t.clips ?? []), clip], activeClipId: clip.id, ...(isNotes ? { printedAudio: true } : {}) } : t)),
        );
        toast.success(`${clip.name} pasted on ${target.name}`, { description: `At step ${at} — drag it anywhere from there.` });
      },
      updatePatch: (id, patch) =>
        setTracks((ts) =>
          ts.map((t) => (t.id === id && t.patch ? { ...t, patch: { ...t.patch, ...patch } } : t)),
        ),
      updatePad: (trackId, padId, patch) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId && t.pads
              ? { ...t, pads: t.pads.map((p) => (p.id === padId ? { ...p, ...patch } : p)) }
              : t,
          ),
        ),
      toggleStep: (trackId, padId, step) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId && t.pads
              ? {
                  ...t,
                  pads: t.pads.map((p) =>
                    p.id === padId
                      ? { ...p, steps: p.steps.map((v, i) => (i === step ? (v > 0 ? 0 : 1) : v)) }
                      : p,
                  ),
                }
              : t,
          ),
        ),
      setStepCount: (trackId, steps) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  steps,
                  pads: (t.pads ?? []).map((p) => ({
                    ...p,
                    steps: Array.from({ length: steps }, (_, i) => p.steps[i] ?? 0),
                    probability: p.probability ? Array.from({ length: steps }, (_, i) => p.probability?.[i] ?? 1) : undefined,
                    stepPitch: p.stepPitch ? Array.from({ length: steps }, (_, i) => p.stepPitch?.[i] ?? 0) : undefined,
                    stepDecay: p.stepDecay ? Array.from({ length: steps }, (_, i) => p.stepDecay?.[i] ?? 1) : undefined,
                    flam: p.flam ? Array.from({ length: steps }, (_, i) => p.flam?.[i] ?? 0) : undefined,
                    retrig: p.retrig ? Array.from({ length: steps }, (_, i) => p.retrig?.[i] ?? 1) : undefined,
                    glitch: p.glitch ? Array.from({ length: steps }, (_, i) => p.glitch?.[i] ?? 0) : undefined,
                  })),
                }
              : t,
          ),
        ),
      addPad: (trackId) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId && t.pads
              ? {
                  ...t,
                  pads: [
                    ...t.pads,
                    {
                      id: uid(),
                      name: `PAD ${t.pads.length + 1}`,
                      kind: "perc",
                      volume: 0.8,
                      pan: 0,
                      pitch: 0,
                      decay: 0.5,
                      muted: false,
                      solo: false,
                      steps: Array.from({ length: t.steps }, () => 0),
                    },
                  ],
                }
              : t,
          ),
        ),
      setNotes: (trackId, notes) => updateTrack(trackId, { notes }),
      setTransport: (t) => setTransportState((s) => ({ ...s, ...t })),
      togglePlay: () => {
        getEngine().init();
        setTransportState((s) => ({ ...s, playing: !s.playing, paused: s.playing }));
      },
      pause: () => setTransportState((s) => ({ ...s, playing: false, paused: true })),
      toggleRecord: () => {
        const engine = getEngine();
        engine.init();
        const isNote = (t: Track) => t.kind === "instrument" || t.kind === "midi" || t.kind === "drum";
        const isAudio = (t: Track) => t.kind === "audio" || t.kind === "ai-vocal" || t.kind === "sampler";
        // Pressing REC during a count-in cancels it.
        if (countInTimerRef.current != null) {
          window.clearInterval(countInTimerRef.current);
          countInTimerRef.current = null;
          setTransportState((s) => ({ ...s, countInLeft: null }));
          return;
        }
        if (!transportRef.current.recording) {
          const begin = () => {
            const selectedTrack = tracksRef.current.find((t) => t.id === selectedIdRef.current);
            // Auto-arm the selected channel so pressing record always has a target.
            let armedAudio = tracksRef.current.find((t) => t.armed && isAudio(t));
            let armedNote = tracksRef.current.find((t) => t.armed && isNote(t));
            if (!armedAudio && !armedNote && selectedTrack) {
              if (isAudio(selectedTrack)) armedAudio = selectedTrack;
              else if (isNote(selectedTrack)) armedNote = selectedTrack;
              if (armedAudio || armedNote) updateTrack(selectedTrack.id, { armed: true });
            }
            if (armedAudio) {
              const target = armedAudio;
              recStartStepRef.current = transportRef.current.step ?? 0;
              void engine
                .startInputRecording(target.id, transportRef.current.monitor ?? false)
                .then(() => updateTrack(target.id, { recording: true }))
                .catch((err: unknown) =>
                  {
                    setTransportState((state) => ({ ...state, recording: false }));
                    toast.error("Microphone unavailable", {
                      description: err instanceof Error ? err.message : "The microphone could not be opened.",
                      duration: 9000,
                      action: { label: "Open in tab", onClick: openInOwnTab },
                    });
                  },
                );
            }
            if (armedNote) {
              recStartStepRef.current = transportRef.current.step ?? 0;
              // The printed take is captured after the channel fader, so a muted
              // channel would record silence (a flat line). Unmute it first.
              if (armedNote.muted) {
                updateTrack(armedNote.id, { muted: false });
                toast("Unmuted " + armedNote.name, { description: "A muted channel records silence, so it was unmuted for this take." });
              }
              const otherSolo = tracksRef.current.some((t) => t.solo && t.id !== armedNote!.id) && !armedNote.solo;
              if (otherSolo) {
                toast.warning("Another track is soloed", { description: `${armedNote.name} is silenced by solo and would record a flat line — un-solo the other track.` });
              }
              try {
                engine.startTrackRecording(armedNote.id);
              } catch (err) {
                toast.error("Could not record this channel", { description: err instanceof Error ? err.message : undefined });
                return;
              }
              updateTrack(armedNote.id, { recording: true });
              toast("Recording notes and audio", {
                description: `Playing ${armedNote.name} captures an editable pattern and waveform.`,
              });
            }
            if (!armedAudio && !armedNote) {
              toast("Select or arm a channel first", {
                description: "Click a track, or press ● ARM on it, then record.",
              });
            }
            setTransportState((s) => ({ ...s, recording: true, playing: true, paused: false }));
          };
          const tp0 = transportRef.current;
          const ciBars = tp0.countIn ? Math.max(1, tp0.countInBars ?? 1) : 0;
          if (ciBars > 0) {
            // countInLeft is measured in quarter-note beats (four per 4/4 bar),
            // so each countdown tick must last one full beat—not one sequencer
            // sixteenth step.
            const beatMs = (60 / tp0.bpm) * 1000;
            const bpb = getBeatsPerBar();
            let left = ciBars * bpb;
            // Hold the transport during the count-in, even if it was already rolling.
            setTransportState((s) => ({ ...s, playing: false, paused: true, countInLeft: left }));
            const click = (accent: boolean) => engine.playClick(accent);
            click(true);
            countInTimerRef.current = window.setInterval(() => {
              left -= 1;
              if (left <= 0) {
                window.clearInterval(countInTimerRef.current!);
                countInTimerRef.current = null;
                setTransportState((s) => ({ ...s, countInLeft: null }));
                begin();
              } else {
                click(left % bpb === 0);
                setTransportState((s) => ({ ...s, countInLeft: left }));
              }
            }, beatMs);
            return;
          }
          begin();
        } else {
          void finishRecording();
          void finishTrackRecording();
          setTracks((ts) => ts.map((t) => (t.recording ? { ...t, recording: false } : t)));
          setTransportState((s) => ({ ...s, recording: false }));
        }
      },
      stop: () => {
        if (countInTimerRef.current != null) {
          window.clearInterval(countInTimerRef.current);
          countInTimerRef.current = null;
        }
        if (transportRef.current.recording) void finishRecording();
        if (transportRef.current.recording) void finishTrackRecording();
        setTracks((ts) => ts.map((t) => (t.recording ? { ...t, recording: false } : t)));
        setTransportState((s) => ({ ...s, playing: false, recording: false, paused: false, step: 0, countInLeft: null }));
      },
      changeInstrument: (trackId, preset) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId ? { ...t, instrument: preset, patch: applyPreset(preset) } : t,
          ),
        ),
      addClip: (trackId, clip) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId ? { ...t, clips: [...(t.clips ?? []), clip], activeClipId: clip.id } : t,
          ),
        ),
      updateClip: (trackId, clipId, patch) => {
        const t = tracksRef.current.find((x) => x.id === trackId);
        if (!t) return;
        updateTrack(trackId, {
          clips: (t.clips ?? []).map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
        });
      },
      previewClip: (trackId, clipId) => {
        const t = tracksRef.current.find((x) => x.id === trackId);
        const c = (t?.clips ?? []).find((x) => x.id === clipId);
        if (!c?.url) {
          toast("Nothing to play", { description: "This clip has no audio file attached." });
          return;
        }
        const engine = getEngine();
        void engine.ensureBuffer(c.url).then((buf) => {
          if (!buf) {
            toast.error("Could not read that audio", { description: "The clip's audio file is no longer available." });
            return;
          }
          engine.stopSamples(trackId);
          engine.playClip(trackId, {
            url: c.url as string,
            offset: c.offset ?? 0,
            length: c.length ?? c.duration,
            gain: c.gain ?? 1,
            fadeIn: c.fadeIn ?? 0.004,
            fadeOut: c.fadeOut ?? 0.01,
            rate: clipRate(c),
            reverse: c.reverse ?? false,
          });
        });
      },
      setActiveClip: (trackId, clipId) => {
        updateTrack(trackId, { activeClipId: clipId });
        setSelectedId(trackId);
      },
      toggleAutomationLane: (trackId, param) => {
        const t = tracksRef.current.find((x) => x.id === trackId);
        const lanes = t?.automation ?? [];
        const exists = lanes.some((l) => l.param === param);
        updateTrack(trackId, {
          automation: exists
            ? lanes.filter((l) => l.param !== param)
            : [...lanes, { param, mode: "read" as const, points: [] }],
        });
      },
      setAutomationPoints: (trackId, param, points, label) => {
        const t = tracksRef.current.find((x) => x.id === trackId);
        const lanes = t?.automation ?? [];
        const lane = lanes.find((l) => l.param === param);
        if (lane?.locked) return;
        if (lane) {
          // Keep one history entry per gesture: repeated moves of the same kind
          // inside a short window collapse together.
          const key = `${trackId}:${param}`;
          const entry = automationHistoryRef.current.get(key) ?? { past: [], future: [] };
          const now = Date.now();
          const last = automationLastPushRef.current.get(key);
          const coalesce = !!label && last?.label === label && now - last.at < 700;
          if (!coalesce) {
            entry.past = [...entry.past, { points: structuredClone(lane.points), label: label ?? "Automation edit" }].slice(-80);
            entry.future = [];
            automationHistoryRef.current.set(key, entry);
            setAutomationHistoryTick((v) => v + 1);
          }
          automationLastPushRef.current.set(key, { label: label ?? "Automation edit", at: now });
        }
        updateTrack(trackId, {
          automation: lanes.map((l) =>
            l.param === param ? { ...l, points: [...points].sort((a, b) => a.step - b.step) } : l,
          ),
        });
      },
      undoAutomationEdit: (trackId, param) => {
        const key = `${trackId}:${param}`;
        const entry = automationHistoryRef.current.get(key);
        const t = tracksRef.current.find((x) => x.id === trackId);
        const lanes = t?.automation ?? [];
        const lane = lanes.find((l) => l.param === param);
        if (!lane) return;
        if (lane.locked) {
          toast("Lane is locked — click the lock to edit");
          return;
        }
        const step = entry?.past.pop();
        if (!step) {
          toast("Nothing to undo on this lane");
          return;
        }
        entry!.future = [...entry!.future, { points: structuredClone(lane.points), label: step.label }].slice(-80);
        automationLastPushRef.current.delete(key);
        updateTrack(trackId, { automation: lanes.map((l) => (l.param === param ? { ...l, points: step.points } : l)) });
        setAutomationHistoryTick((v) => v + 1);
        toast(`Undid ${step.label.toLowerCase()}`);
      },
      redoAutomationEdit: (trackId, param) => {
        const key = `${trackId}:${param}`;
        const entry = automationHistoryRef.current.get(key);
        const t = tracksRef.current.find((x) => x.id === trackId);
        const lanes = t?.automation ?? [];
        const lane = lanes.find((l) => l.param === param);
        if (!lane) return;
        if (lane.locked) {
          toast("Lane is locked — click the lock to edit");
          return;
        }
        const step = entry?.future.pop();
        if (!step) {
          toast("Nothing to redo on this lane");
          return;
        }
        entry!.past = [...entry!.past, { points: structuredClone(lane.points), label: step.label }].slice(-80);
        automationLastPushRef.current.delete(key);
        updateTrack(trackId, { automation: lanes.map((l) => (l.param === param ? { ...l, points: step.points } : l)) });
        setAutomationHistoryTick((v) => v + 1);
        toast(`Redid ${step.label.toLowerCase()}`);
      },
      automationHistory: (trackId, param) => {
        const entry = automationHistoryRef.current.get(`${trackId}:${param}`);
        const undo = entry?.past[entry.past.length - 1] ?? null;
        const redo = entry?.future[entry.future.length - 1] ?? null;
        return {
          canUndo: !!undo,
          canRedo: !!redo,
          undoLabel: undo?.label ?? null,
          redoLabel: redo?.label ?? null,
        };
      },
      setAutomationMode: (trackId, param, mode) => {
        const t = tracksRef.current.find((x) => x.id === trackId);
        const lanes = t?.automation ?? [];
        if (lanes.some((l) => l.param === param && l.locked)) return;
        updateTrack(trackId, { automation: lanes.map((l) => (l.param === param ? { ...l, mode } : l)) });
      },
      setAutomationLaneLock: (trackId, param, locked) => {
        const t = tracksRef.current.find((x) => x.id === trackId);
        const lanes = t?.automation ?? [];
        updateTrack(trackId, { automation: lanes.map((l) => (l.param === param ? { ...l, locked } : l)) });
      },
      // hear the value under the finger while an automation point or region is being dragged
      previewAutomation: (trackId, param, value) => {
        getEngine().automate(trackId, { [param]: value });
      },
      removeClip: (trackId, clipId) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  clips: (t.clips ?? []).filter((c) => c.id !== clipId),
                  activeClipId: t.activeClipId === clipId ? undefined : t.activeClipId,
                }
              : t,
          ),
        ),
      savePreset: (name) => {
        const t = tracks.find((x) => x.id === selectedId);
        if (t?.patch) setUserPresets((p) => [...p, { ...structuredClone(t.patch!), name }]);
      },
      loadPreset: (trackId, name) => {
        const user = userPresets.find((p) => p.name === name);
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId ? { ...t, patch: user ? structuredClone(user) : applyPreset(name) } : t,
          ),
        );
      },
      generateBeat: (trackId, genre, energy) =>
        setTracks((ts) =>
          ts.map((t) => {
            if (t.id !== trackId || !t.pads) return t;
            const n = t.steps;
            const hit = (chance: number) => (Math.random() < chance ? 1 : 0);
            const padsList = t.pads;
            return {
              ...t,
              pads: padsList.map((p) => {
                const steps = Array.from({ length: n }, (_, i) => {
                  const beat = i % 4 === 0;
                  const off = i % 2 === 1;
                  switch (p.kind) {
                    case "kick":
                      if (genre === "Detroit Techno" || genre === "House") return beat ? 1 : hit(0.04 * energy);
                      if (genre === "Trap" || genre === "Hip-Hop")
                        return i % 8 === 0 ? 1 : hit(0.12 * energy);
                      if (genre === "Breakbeat" || genre === "Detroit Electro")
                        return i % 8 === 0 || i % 8 === 6 ? 1 : hit(0.06 * energy);
                      return beat ? 1 : hit(0.05 * energy);
                    case "snare":
                      return i % 8 === 4 ? 1 : hit(0.05 * energy);
                    case "clap":
                      return i % 8 === 4 ? (genre === "House" ? 1 : hit(0.5)) : 0;
                    case "hat":
                      if (genre === "Trap") return hit(0.55 + 0.04 * energy);
                      return off ? 1 : hit(0.15 * energy);
                    case "openhat":
                      return i % 8 === 6 ? 1 : hit(0.05 * energy);
                    case "perc":
                      return hit(0.08 * energy);
                    case "rim":
                      return hit(0.06 * energy);
                    case "tom":
                      return hit(0.04 * energy);
                    default:
                      return 0;
                  }
                });
                return { ...p, steps };
              }),
            };
          }),
        ),
      previewNote: (trackId, midi) => {
        const t = tracksRef.current.find((x) => x.id === trackId);
        const engine = getEngine();
        engine.init();
        engine.syncMix(tracksRef.current);
        if (t) triggerNote(engine, t, midi, 0.35, 0.9);
        keyDown(midi);
        // Notes played on screen are captured while the transport records.
        if (t) capture(t.id, midi, 0.9);
      },
      captureNote: (trackId, midi, velocity = 0.9) => {
        capture(trackId, midi, velocity);
      },
      loadSample: async (trackId, file) => {
        const engine = getEngine();
        engine.init();
        try {
          const loaded = await engine.loadSampleFile(file, file.name.replace(/\.[^.]+$/, ""));
          const sampler: SamplerState = {
            name: loaded.name,
            url: loaded.url,
            duration: loaded.duration,
            peaks: loaded.peaks,
            start: 0,
            end: 1,
            gain: 1,
            pitch: 0,
            rootNote: 60,
            loop: false,
            reverse: false,
            oneShot: true,
            attack: 0.002,
            release: 0.06,
          };
          setTracks((ts) => ts.map((t) => (t.id === trackId ? { ...t, sampler } : t)));
          toast.success("Sample loaded", {
            description: `${loaded.name} · ${loaded.duration.toFixed(2)}s`,
          });
        } catch {
          toast.error("That file could not be read", {
            description: "Try a standard MP3, WAV, AIFF, M4A or OGG file.",
          });
        }
      },
      updateSampler: (trackId, patch) =>
        setTracks((ts) =>
          ts.map((t) => (t.id === trackId && t.sampler ? { ...t, sampler: { ...t.sampler, ...patch } } : t)),
        ),
      clearSample: (trackId) => {
        getEngine().stopSamples(trackId);
        setTracks((ts) => ts.map((t) => (t.id === trackId ? { ...t, sampler: undefined } : t)));
      },
      stopSamples: (trackId) => getEngine().stopSamples(trackId),
      installedPlugins,
      installPlugin: (d) => setInstalledPlugins((ps) => [...ps.filter((x) => x.id !== d.id), d]),
      uninstallPlugin: (defId) => setInstalledPlugins((ps) => ps.filter((x) => x.id !== defId)),
      addPlugin: (trackId, d) => {
        const inst = instantiate(d);
        setTracks((ts) => ts.map((t) => (t.id === trackId ? { ...t, plugins: [...(t.plugins ?? []), inst] } : t)));
        toast.success(`${d.name} inserted`, { description: `${d.vendor} · ${d.format}` });
      },
      removePlugin: (trackId, instanceId) =>
        setTracks((ts) =>
          ts.map((t) => (t.id === trackId ? { ...t, plugins: (t.plugins ?? []).filter((p) => p.id !== instanceId) } : t)),
        ),
      togglePluginBypass: (trackId, instanceId) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? { ...t, plugins: (t.plugins ?? []).map((p) => (p.id === instanceId ? { ...p, bypass: !p.bypass } : p)) }
              : t,
          ),
        ),
      movePlugin: (trackId, instanceId, dir) =>
        setTracks((ts) =>
          ts.map((t) => {
            if (t.id !== trackId) return t;
            const list = [...(t.plugins ?? [])];
            const i = list.findIndex((p) => p.id === instanceId);
            const j = i + dir;
            const a = list[i];
            const b = list[j];
            if (i < 0 || !a || !b) return t;
            list[i] = b;
            list[j] = a;
            return { ...t, plugins: list };
          }),
        ),
      setPluginParam: (trackId, instanceId, paramId, value) => {
        const automationParam = `plugin:${instanceId}:${paramId}` as AutomationParam;
        const gestureKey = `${trackId}:${automationParam}`;
        setTracks((ts) =>
          ts.map((t) => {
            if (t.id !== trackId) return t;
            const plugins = (t.plugins ?? []).map((p) =>
              p.id === instanceId
                ? {
                    ...p,
                    params: p.params.some((x: PluginParam) => x.id === paramId)
                      ? p.params.map((x: PluginParam) => (x.id === paramId ? { ...x, value } : x))
                      : [...p.params, { id: paramId, name: paramId, value, min: value, max: value, unit: "" }],
                  }
                : p,
            );
            const lane = (t.automation ?? []).find((item) => item.param === automationParam);
            if (!transportRef.current.playing || !lane || lane.locked || !["write", "touch", "latch"].includes(lane.mode)) return { ...t, plugins };
            automationGestureRef.current.set(gestureKey, {
              touchedUntil: performance.now() + 180,
              latched: lane.mode === "latch",
            });
            const source = plugins.find((plugin) => plugin.id === instanceId)?.params.find((param) => param.id === paramId);
            if (!source) return { ...t, plugins };
            const normalized = source.max > source.min ? (value - source.min) / (source.max - source.min) : 0;
            const step = transportRef.current.step;
            const points = [...lane.points.filter((point) => point.step !== step), { step, value: Math.min(1, Math.max(0, normalized)) }]
              .sort((a, b) => a.step - b.step);
            return {
              ...t,
              plugins,
              automation: (t.automation ?? []).map((item) => item.param === automationParam ? { ...item, points } : item),
            };
          }),
        );
      },
      midiInputs,
      midiInputId,
      midiLearning,
      midiMap,
      midiLearn,
      startMidiLearn: (t) => {
        setMidiLearn(t);
        toast("Move a knob or fader", { description: "The next control you touch takes over this one." });
      },
      cancelMidiLearn: () => setMidiLearn(null),
      clearMidiMapping: (t) =>
        setMidiMap((m) => {
          const next: Record<string, MidiTarget> = {};
          for (const [k, v] of Object.entries(m)) if (!(v.id === t.id && v.param === t.param)) next[k] = v;
          try {
            window.localStorage.setItem(MIDI_MAP_KEY, JSON.stringify(next));
          } catch {
            /* storage unavailable */
          }
          return next;
        }),
      enableMidi,
      setMidiInput: setMidiInputPersist,
      fxChains,
      addFxPlugin: (target, d) => {
        const inst = instantiate(d);
        setFxChains((c) => ({ ...c, [target]: [...(c[target] ?? []), inst] }));
        toast.success(`${d.name} inserted on ${target.split(":")[1]?.toUpperCase()}`, {
          description: `${d.vendor} · ${d.format}`,
        });
      },
      removeFxPlugin: (target, instanceId) =>
        setFxChains((c) => ({ ...c, [target]: (c[target] ?? []).filter((p) => p.id !== instanceId) })),
      toggleFxBypass: (target, instanceId) =>
        setFxChains((c) => ({
          ...c,
          [target]: (c[target] ?? []).map((p) => (p.id === instanceId ? { ...p, bypass: !p.bypass } : p)),
        })),
      setFxParam: (target, instanceId, paramId, value) =>
        setFxChains((c) => ({
          ...c,
          [target]: (c[target] ?? []).map((p) =>
            p.id === instanceId
              ? { ...p, params: p.params.map((x: PluginParam) => (x.id === paramId ? { ...x, value } : x)) }
              : p,
          ),
        })),
    };
  }, [tracks, transport, selectedId, selectedIds, editTool, panel, userPresets, buses, vcas, auxReturns, sections, installedPlugins, fxChains, midiInputs, midiInputId, midiLearning, midiMap, midiLearn, clipboardName, enableMidi, setMidiInputPersist, updateTrack, finishRecording, finishTrackRecording, splitClipAtImpl, razorAtImpl, buildSnapshot, applySession, historyTick, automationHistoryTick, savedAt]);


  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStudio = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudio must be used inside StudioProvider");
  return ctx;
};
