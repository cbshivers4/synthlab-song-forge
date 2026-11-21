import { faderGain } from "./fader-taper";
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
import { editorPanelFor, isPadSamplerTrack } from "./track-editor";
import { markTakeFailed } from "./take-status";
import { setSongClock } from "./song-clock";
import { sendClockForStep, sendTransportStart, sendTransportStop } from "./midi-clock";
import { INPUT_CHANGED_EVENT, INPUT_FALLBACK_EVENT, INPUT_LOST_EVENT } from "./mic";
import {
  clipboardOrigin,
  copyPartSpan,
  drumCopySpan,
  livePasteStep,
  materialEnd,
  multiPasteSteps,
  noteCopy,
  pasteEndStep,
  pasteEndSteps,
  pasteTrackContent,
} from "./arrangement-edit";

/** Drum/sampler tracks can hold values the browser cannot deep-copy; fall back so copy never silently fails. */
function cloneTrack(t: Track): Track {
  try {
    return structuredClone(t);
  } catch {
    return JSON.parse(JSON.stringify(t)) as Track;
  }
}
import { createRecordingFinalizer } from "./recording-finalizer";
import {
  capturedNote,
  heardNoteSteps,
  isLoopWrap,
  loopKeepsRecording,
  loopRegion,
  nextPlayStep,
  snapRecordedStep,
} from "./recording-region";
import { liveNoteTarget } from "./live-note-target";
import { editDrumPads, type DrumBulkEdit } from "./drum-bulk";
import { appendDrumPad } from "./drum-banks";
import { learnedDrumPad } from "./drum-midi";
import { timelineUsesWaveform } from "./timeline-content";
import { ccAction } from "./midi-actions";
import { trimFromCc } from "./trim-gain";
import { previewTrack } from "./note-preview";
import { bendCents, playbackPreferences } from "./preferences";
import { toast } from "sonner";
import { getEngine } from "./audio-engine";
import {
  stepsPerBar,
  setBeatsPerBar,
  getBeatsPerBar,
  STEPS_PER_BEAT,
  songSteps,
  stepSeconds,
  barsForSteps,
} from "./timebase";
import { openInOwnTab } from "./mic";
import { TRACK_COLORS, applyPreset, defaultPads, defaultPatch, uid } from "./presets";
import {
  moveClipToNewIn,
  movePartBetweenTracks,
  moveTrackToIndexIn,
  moveTrackToNewIn,
} from "./track-move";
import {
  BUILT_IN_PLUGINS,
  instantiate,
  processMidiThroughPlugins,
  withDefaultParams,
} from "./plugins";
import { insertRigDevice } from "./guitar-rig";
import { isCustomBusId, newCustomBusId, templatePlugins, type BusTemplate } from "./bus-templates";
import { applyVcaLink, bakeLegacyVca, type LinkMemory } from "./vca-link";
import {
  claimControllerMidi,
  getMidiAccess,
  listInputs,
  listOutputs,
  midiInputEnabled,
  midiSupported,
  midiUnsupportedMessage,
  subscribe,
  type MidiPortInfo,
} from "./midi";
import { PAD_SOUND_RANGES, reconcileChopSounds } from "./mpc-pad";
import { getPadBank, setPadBank } from "./pad-session";
import { getLooper } from "./live-looper";
import { getReelRecorder } from "./reel-recorder";
import { manualSwitchPatch, switchEdge, switchStateAt, writeSwitchStep } from "./switch-automation";
import { scheduleStep as scheduleSongStep, triggerNote } from "./schedule-step";
import { shownPassIndex, splitLoopPasses } from "./loop-takes";
import { getPlayStep, setPlayStep } from "./playhead";
import { cutTrackMaterial, removeTakeAndMaterial } from "./workflow";
import {
  isLiveParam,
  laneReads,
  laneWrites,
  liveValue,
  movedLiveParams,
  valueAt,
  writePoint,
} from "./automation-write";
import { padNote } from "./drum-notes";
import { markLiveHit, isLiveHit, clearLiveHits, neighbourLiveHits } from "./live-take";
import { keyDown, keyUp } from "./active-keys";
import { arpLiveRelease, arpReleaseAll, stopLiveArps } from "./live-arp";
import {
  HELD_NOTE_SECONDS,
  holdApplies,
  latchPitch,
  onHoldRelease,
  releaseLatched,
} from "./synth-hold";
import {
  controllerAutoButton,
  controllerAutoMap,
  resolveController,
  shiftStripBank,
  stripTrackIndex,
  withKnownSurfaces,
  type RemoteButton,
  type StripParam,
} from "./controller-profiles";
import { joggedStep, jogTicks, mackieAction, stopPress } from "./mackie-control";
import { describeRaw, noteSurfaceEvent } from "./surface-monitor";
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
  CustomBus,
  CustomBusId,
  TrackBusId,
  DrumPad,
  MidiNote,
  PluginDef,
  PluginInstance,
  PluginParam,
  SamplerState,
  SongSection,
  SynthPatch,
  Track,
  TrackFolder,
  TrackKind,
  Transport,
} from "./types";
import { clipRate, clipSeconds, laneValueAt, SECTION_COLORS } from "./types";
import { wsolaStretch } from "./stretch";
import { encodeWav } from "./bounce";
import { alignedTake, getInputLatencyMs, outputDelay, preRollTake } from "./latency";
import { peaksSpanOf } from "./clip-peaks";
import { addCut, cutNotesAt, deleteRegion, regionAt, unrollNotes } from "./note-cuts";
import { GRANULAR_KNOBS } from "./granular";
import {
  externalNoteOff,
  externalNoteOn,
  isExternal,
  restoreExternalRoutes,
  sendExternalBend,
  sendExternalCc,
} from "./external-midi";

/** A persistent hardware CC destination. Namespaced parameters identify device controls. */
/** A recorded instrument/drum take normally plays back as printed audio, which
 *  can't follow a new preset. When the sound changes and the part still has its
 *  notes or drum hits, switch the track back to live notes so the change is heard
 *  immediately — even while the song is playing. */
function liveSound(t: Track): Track {
  if (!t.printedAudio || t.recording) return t;
  const hasNotes = (t.notes?.length ?? 0) > 0;
  const hasHits = t.pads?.some((p) => p.steps.some((v) => v > 0)) ?? false;
  if (!hasNotes && !hasHits) return t;
  // Fade out the printed take now so it doesn't double with the live notes that replace it.
  queueMicrotask(() => getEngine().stopSamples(t.id));
  return { ...t, printedAudio: false };
}

/**
 * Synth channels record their notes only; the waveform is rendered from those notes when the take
 * lands. Drums, samplers, outside hardware and Live Keys channels still print their live output.
 */
function synthTake(t: Track): boolean {
  return (
    (t.kind === "instrument" || t.kind === "midi") &&
    !!t.patch &&
    !t.keyboardist &&
    !isExternal(t.id)
  );
}

/** Seconds of song audio queued ahead on the audio clock (see the scheduler). */
const SCHEDULE_AHEAD = 0.3;
/** A step this late (s) is still played; later ones are skipped so a stall never bursts notes. */
const LATE_OK = 0.05;

/** How long a tapped on-screen / typing-key note sounds live (and records). */
const PREVIEW_NOTE_SECONDS = 0.35;
/** How long a MIDI-keyboard note sounds live on a built-in synth (and the shortest it records). */
const LIVE_MIDI_NOTE_SECONDS = 0.6;

export interface MidiTarget {
  id: string;
  param: string;
}

export const midiTargetKey = (t: MidiTarget) => `${t.id}:${t.param}`;
const MIDI_MAP_KEY = "synclab.midimap";
const MIDI_INPUT_KEY = "synclab.midi.input";
/** Port names of known mixer surfaces the user switched off, so plugging them back in respects that. */
const MIDI_OFF_KEY = "synclab.midi.switched-off";
const readSwitchedOff = (): string[] => {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(MIDI_OFF_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const writeSwitchedOff = (names: string[]) => {
  try {
    window.localStorage.setItem(MIDI_OFF_KEY, JSON.stringify(names));
  } catch {
    /* storage unavailable */
  }
};

export { coveredTakes, replaceTakeRegion, snapRecStart } from "./take-region";
import { coveredTakes, replaceTakeRegion, snapRecStart } from "./take-region";

const ccRange = (value: number, min: number, max: number, step = 0) => {
  const scaled = min + value * (max - min);
  return step ? Math.round(scaled / step) * step : scaled;
};

/** Use the same ranges as the visible controls; never map a CC to an unsupported audio parameter. */
const synthRanges: Record<string, [number, number, number?]> = {
  cutoff: [40, 16000, 10],
  resonance: [0, 28, 0.5],
  drive: [0, 1],
  glide: [0, 0.5, 0.01],
  noise: [0, 1],
  keyTracking: [0, 1],
  velocitySens: [0, 1],
  analog: [0, 1],
  "filter2.cutoff": [40, 16000, 10],
  "filter2.resonance": [0, 28, 0.5],
  "filterEnv.amount": [-6000, 6000, 50],
  "unison.voices": [1, 7, 1],
  "unison.detune": [0, 60, 1],
  "arp.octaves": [1, 4, 1],
  "arp.rate": [0.5, 4, 0.5],
};
const drumRanges: Record<string, [number, number, number?]> = {
  volume: [0, 1],
  pan: [-1, 1],
  pitch: [-12, 12, 1],
  decay: [0, 1],
  attack: [0, 1],
  sustain: [0, 1],
  release: [0, 1],
  start: [0, 1],
  end: [0, 1],
  tone: [0, 1],
  drive: [0, 1],
  compressor: [0, 1],
  snap: [0, 1],
  noise: [0, 1],
  width: [0, 1],
  crush: [0, 1],
  mutation: [0, 1],
  cutoff: [0, 1],
  resonance: [0, 1],
  filterEnv: [-1, 1],
  choke: [0, 4, 1],
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
  | "apps"
  | "humbeat"
  | "stems"
  | "coproducer"
  | "voice"
  | "audio-converter"
  | "genstem"
  | "bassgen"
  | "drummer"
  | "livekeys"
  | "dj"
  | "amprig"
  | "reel-recorder"
  | "video-sampler"
  | "studio-view"
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
  /** effect buses the producer added in the mixer (Vocal Chain, Drum Bus…) */
  customBuses: CustomBus[];
  /** every bus level by id (built-in + custom), for offline song renders */
  allBuses: Record<string, BusState>;
  vcas: Record<VcaId, BusState>;
  auxReturns: Record<AuxId, BusState>;
  sections: SongSection[];
  projectNotes: string;
  setProjectNotes: (notes: string) => void;
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
  setBus: (id: TrackBusId, patch: Partial<BusState>) => void;
  /** level/mute of any bus, built-in or custom */
  busStateOf: (id: TrackBusId) => BusState;
  /** display name of a bus ("vocals", or the custom bus's own name) */
  busName: (id: TrackBusId) => string;
  /** adds an effect bus loaded with a template's effects and routes the given channels to it */
  addCustomBus: (opts: {
    name: string;
    color: string;
    template?: BusTemplate;
    memberIds?: string[];
  }) => CustomBusId;
  updateCustomBus: (id: CustomBusId, patch: Partial<Pick<CustomBus, "name" | "color">>) => void;
  /** deletes a custom bus; its channels go straight to the master */
  removeCustomBus: (id: CustomBusId) => void;
  /** replaces a bus's effects with a template's chain */
  applyBusTemplate: (id: TrackBusId, template: BusTemplate) => void;
  /** routes exactly these channels to the bus; channels taken off it go to the master */
  setBusMembers: (id: TrackBusId, trackIds: string[]) => void;
  /** moving VCA level/pan/EQ moves every member channel's own fader/pan/EQ by the same amount */
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
  /** track folders shown as collapsible groups on the timeline */
  folders: TrackFolder[];
  addFolder: (name?: string) => string;
  renameFolder: (id: string, name: string) => void;
  /** removes the folder; its tracks stay, ungrouped */
  removeFolder: (id: string) => void;
  toggleFolderCollapsed: (id: string) => void;
  assignTrackFolder: (trackId: string, folderId: string | null) => void;
  setPanel: (p: PanelId) => void;
  select: (id: string) => void;
  setEditTool: (t: EditTool) => void;
  selectAll: () => void;
  toggleSelectId: (id: string) => void;
  /** Mouse box selection: select these channels and their boxed clips. */
  selectBoxed: (
    picks: { trackId: string; clipId?: string; span?: [number, number] }[],
    add: boolean,
  ) => void;
  /** Mouse drag down the channel names: highlight exactly these channels; the anchor stays the current channel. */
  paintSelectIds: (ids: string[], anchorId: string | null) => void;
  /** Click outside the timeline: drop highlighted clips/parts and extra checked channels (the current channel stays). */
  clearTimelineSelection: () => void;
  splitClipAt: (trackId: string, frac: number) => void;
  razorAt: (trackId: string, posSteps: number) => void;
  splitAtPlayhead: () => void;
  addTrack: (
    kind: TrackKind,
    name?: string,
    preset?: string,
    opts?: { keepPanel?: boolean },
  ) => string;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  duplicateTrack: (id: string) => void;
  moveTrack: (id: string, dir: -1 | 1) => void;
  moveTrackToIndex: (id: string, index: number) => void;
  /** Move one note block / beat part [a, b) onto another channel at step `to`; null when it can't go there. */
  movePartToTrack: (
    srcId: string,
    destId: string,
    a: number,
    b: number,
    to: number,
  ) => { unmatched: number } | null;
  moveTrackToNew: (id: string) => void;
  moveClipToNew: (trackId: string, clipId: string, sourceStart: number) => void;
  clipboardName: string | null;
  copyTrack: (id: string) => void;
  cutTrack: (id: string) => void;
  /** Copy / cut the material of several channels at once; paste puts each back on its own channel. */
  copyTracks: (ids: string[]) => void;
  cutTracks: (ids: string[]) => void;
  pasteTrack: (targetId?: string, destinationStep?: number, atEnd?: boolean) => void;
  clipClipboardName: string | null;
  copyClip: (trackId: string, clipId: string) => void;
  cutClip: (trackId: string, clipId: string) => void;
  pasteClip: (atEnd?: boolean, targetId?: string, destinationStep?: number) => void;
  updatePatch: (id: string, patch: Partial<SynthPatch>) => void;
  updatePad: (trackId: string, padId: string, patch: Partial<DrumPad>) => void;
  editAllDrums: (trackId: string, edit: DrumBulkEdit) => void;
  toggleStep: (trackId: string, padId: string, step: number) => void;
  setStepCount: (trackId: string, steps: number) => void;
  addPad: (trackId: string, sound?: Partial<DrumPad>) => void;
  setNotes: (trackId: string, notes: MidiNote[]) => void;
  setTransport: (t: Partial<Transport>) => void;
  togglePlay: () => void;
  toggleRecord: () => void;
  stop: () => Promise<void>;
  pause: () => void;
  changeInstrument: (trackId: string, preset: string) => void;
  setActiveClip: (trackId: string, clipId: string) => void;
  toggleAutomationLane: (trackId: string, param: AutomationParam) => void;
  setAutomationPoints: (
    trackId: string,
    param: AutomationParam,
    points: AutomationPoint[],
    label?: string,
  ) => void;
  undoAutomationEdit: (trackId: string, param: AutomationParam) => void;
  redoAutomationEdit: (trackId: string, param: AutomationParam) => void;
  automationHistory: (
    trackId: string,
    param: AutomationParam,
  ) => { canUndo: boolean; canRedo: boolean; undoLabel: string | null; redoLabel: string | null };
  setAutomationMode: (
    trackId: string,
    param: AutomationParam,
    mode: AutomationLane["mode"],
  ) => void;
  setAutomationLaneLock: (trackId: string, param: AutomationParam, locked: boolean) => void;
  previewAutomation: (trackId: string, param: AutomationParam, value: number) => void;
  removeClip: (trackId: string, clipId: string) => void;
  /** Remove every clip, note and drum hit from a track but keep the channel, instrument and settings. */
  clearTrackContent: (id: string) => void;
  /** Comping: swap this clip's region to an earlier take recorded over it. */
  swapTake: (trackId: string, clipId: string, altIndex: number) => void;
  /** Time-stretch an audio clip without changing pitch (factor > 1 = longer/slower). */
  stretchClip: (trackId: string, clipId: string, factor: number) => Promise<void>;
  addClip: (trackId: string, clip: AudioClip) => void;
  updateClip: (trackId: string, clipId: string, patch: Partial<AudioClip>) => void;
  previewClip: (trackId: string, clipId: string) => void;
  savePreset: (name: string) => void;
  loadPreset: (trackId: string, name: string) => void;
  generateBeat: (trackId: string, genre: string, energy: number) => void;
  previewNote: (
    trackId: string,
    midi: number,
    duration?: number,
    capture?: boolean,
    patch?: SynthPatch,
  ) => void;
  /** Writes a note into the live timeline recording without playing it (the caller already sounded it). */
  captureNote: (trackId: string, midi: number, velocity?: number) => void;
  /** Resolves true once the file is decoded onto the sampler; false (after an error toast) when it can't be read. */
  loadSample: (trackId: string, file: File) => Promise<boolean>;
  updateSampler: (trackId: string, patch: Partial<SamplerState>) => void;
  clearSample: (trackId: string) => void;
  stopSamples: (trackId?: string) => void;
  installedPlugins: PluginDef[];
  installPlugin: (def: PluginDef) => void;
  uninstallPlugin: (defId: string) => void;
  /** Inserts an effect and returns its instance id. `rig` places pedals before the first amp, like a guitar signal chain. */
  addPlugin: (trackId: string, def: PluginDef, opts?: { rig?: boolean; quiet?: boolean }) => string;
  removePlugin: (trackId: string, instanceId: string) => void;
  togglePluginBypass: (trackId: string, instanceId: string) => void;
  movePlugin: (trackId: string, instanceId: string, dir: -1 | 1) => void;
  setPluginParam: (trackId: string, instanceId: string, paramId: string, value: number) => void;
  midiInputs: MidiPortInfo[];
  midiOutputs: MidiPortInfo[];
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
  const [transport, rawSetTransportState] = useState<Transport>({
    playing: false,
    recording: false,
    bpm: 128,
    swing: 0,
    step: 0,
    metronome: false,
    countIn: true,
    countInBars: 1,
    countInClick: true,
    countInHaptics: false,
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

  /**
   * Every transport update goes through here. While playing, the moving step lives in the
   * playhead store (not React state), so updates first pick up the live step, and an
   * explicit step (seek, stop to start) moves the playhead too.
   */
  const setTransportState = useCallback((update: Transport | ((s: Transport) => Transport)) => {
    rawSetTransportState((s) => {
      const base = s.playing && s.step !== getPlayStep() ? { ...s, step: getPlayStep() } : s;
      return typeof update === "function" ? update(base) : update;
    });
  }, []);
  // An explicit step (seek, stop back to the start, loading a song) moves the playhead.
  // Declared before the playback clock so a seek-then-play starts from the new position.
  useEffect(() => {
    setPlayStep(transport.step);
  }, [transport.step]);

  // Tracks routed to external MIDI instruments on this device reconnect at start-up.
  useEffect(() => {
    restoreExternalRoutes();
  }, []);

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const transportRef = useRef(transport);
  /** True while a timeline or reel take is recording mute/solo presses. */
  const isTakingSwitches = () => {
    const tp = transportRef.current;
    return !!tp.playing && (!!tp.recording || getReelRecorder().getSnapshot().mode === "recording");
  };
  // While playing, the heard step comes from the playhead store; state holds it only between updates.
  transportRef.current = transport.playing ? { ...transport, step: getPlayStep() } : transport;
  setBeatsPerBar(transport.beatsPerBar);
  const countInTimerRef = useRef<number | null>(null);
  const pendingInputStartRef = useRef<Promise<void> | null>(null);
  const recordingGenerationRef = useRef(0);
  const finalizingRef = useRef(false);
  /** timeline step where the current take started, so the clip lands there */
  const recStartStepRef = useRef(0);
  const recAudioStartRef = useRef<number | null>(null);
  /** Step and audio-clock time the song actually started (set by the scheduler), for lining takes up. */
  const songStartRef = useRef<{ step: number; time: number } | null>(null);
  /** A jump while playing (controller jog wheel): the step clock restarts from here. */
  const seekStepRef = useRef<number | null>(null);
  const [seekTick, setSeekTick] = useState(0);
  /** Audio-clock time the next playback start must land on (the count-in's downbeat). */
  const startAtRef = useRef<number | null>(null);
  /** The mic / channel-print recorder was started before the song, so its lead-in is trimmed. */
  const micPreRollRef = useRef(false);
  const printPreRollRef = useRef(false);
  /** punch recording hooks, filled in once the record helpers exist */
  const apiRef = useRef<StudioApi | null>(null);
  const punchRef = useRef<{ start: (at: number) => void; stop: () => void } | null>(null);
  /** loop wraps during the current microphone take; each wrap starts another pass */
  const loopPassesRef = useRef(0);
  /** called when the loop start is heard; `ending` = the scheduler already held back the next pass */
  const loopStopRef = useRef<((ending?: boolean) => void) | null>(null);

  const [sections, setSections] = useState<SongSection[]>([]);
  const [projectNotes, setProjectNotes] = useState("");
  const projectNotesRef = useRef("");
  projectNotesRef.current = projectNotes;
  const sectionsRef = useRef<SongSection[]>([]);
  sectionsRef.current = sections;
  const [folders, setFolders] = useState<TrackFolder[]>([]);
  const foldersRef = useRef<TrackFolder[]>([]);
  foldersRef.current = folders;
  const [buses, setBuses] = useState<Record<BusId, BusState>>({
    drums: { volume: 1, muted: false },
    vocals: { volume: 1, muted: false },
    instruments: { volume: 1, muted: false },
    synths: { volume: 1, muted: false },
    fx: { volume: 1, muted: false },
    master: { volume: 1, muted: false },
  });
  const [customBuses, setCustomBuses] = useState<CustomBus[]>([]);
  const customBusesRef = useRef(customBuses);
  customBusesRef.current = customBuses;
  const [vcas, setVcas] = useState<Record<VcaId, BusState>>({
    A: { volume: 1, muted: false },
    B: { volume: 1, muted: false },
    C: { volume: 1, muted: false },
    D: { volume: 1, muted: false },
  });
  const [auxReturns, setAuxReturns] = useState<Record<AuxId, BusState>>({
    reverb: { volume: 1, muted: false },
    delay: { volume: 1, muted: false },
    chorus: { volume: 1, muted: false },
  });

  const [installedPlugins, setInstalledPlugins] = useState<PluginDef[]>(BUILT_IN_PLUGINS);
  const [fxChains, setFxChains] = useState<Record<string, PluginInstance[]>>({});
  const [midiInputs, setMidiInputs] = useState<MidiPortInfo[]>([]);
  const [midiOutputs, setMidiOutputs] = useState<MidiPortInfo[]>([]);
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
  const midiInputIdRef = useRef(midiInputId);
  midiInputIdRef.current = midiInputId;
  /** Inputs whose surface is in a Mackie Control DAW mode (seen sending fader pitch bend or button notes). */
  const mackiePortsRef = useRef(new Set<string>());
  const [midiLearning, setMidiLearning] = useState(false);
  // Hardware mixer control: CC number -> mixer target, remembered between sessions.
  const [midiMap, setMidiMap] = useState<Record<string, MidiTarget>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(MIDI_MAP_KEY) || "{}") as Record<
        string,
        MidiTarget
      >;
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
  /** The copied part's edges on the timeline, so a paste keeps every note's place in the bar. */
  const clipboardSpanRef = useRef<[number, number] | null>(null);
  /** Bars a selection box covered on each channel (steps), so Copy/Cut take exactly those blocks. */
  const boxSpansRef = useRef(new Map<string, [number, number]>());
  /** Several tracks copied together (2+), each pasted back onto its own channel. */
  const multiClipboardRef = useRef<
    { trackId: string; track: Track; span: [number, number] | null }[] | null
  >(null);
  const [clipClipboardName, setClipClipboardName] = useState<string | null>(null);
  const clipClipboardRef = useRef<AudioClip | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  /** Recorded live notes still sounding: keys held down, and notes latched by a synth's HOLD (`latched`). */
  const heldRef = useRef(
    new Map<
      string,
      {
        ids: string[];
        trackId: string;
        t0: number;
        startStep: number;
        pitch?: number;
        latched?: boolean;
        base?: number;
      }
    >(),
  );
  /** Gives a recorded live note the length it was actually held for (bounded by the loop being recorded). */
  const finishHeldNote = (held: {
    ids: string[];
    trackId: string;
    t0: number;
    startStep: number;
    base?: number;
  }) => {
    const tp = transportRef.current;
    const stepDur = stepSeconds(tp.bpm);
    const elapsed = Math.round(((performance.now() - held.t0) / 1000 / stepDur) * 4) / 4;
    // A held note may cross bar lines, but never the end of the loop region being recorded.
    const regionEnd =
      tp.loop && (tp.loopEnd ?? 0) > (tp.loopStart ?? 0)
        ? (tp.loopEnd ?? 0)
        : Number.POSITIVE_INFINITY;
    // never shorter than the note you heard, so the take keeps its ring-out
    const steps = Math.max(
      0.25,
      Math.min(
        heardNoteSteps(held.base ?? LIVE_MIDI_NOTE_SECONDS, stepDur, elapsed),
        regionEnd - held.startStep,
      ),
    );
    setTracks((ts) =>
      ts.map((t) =>
        t.id === held.trackId
          ? {
              ...t,
              notes: (t.notes ?? []).map((n) =>
                held.ids.includes(n.id) ? { ...n, length: steps } : n,
              ),
            }
          : t,
      ),
    );
  };
  /** Ends HOLD-latched recorded notes on a channel (only `pitch` when given). */
  const finishLatchedNotes = (trackId: string, pitch?: number) => {
    for (const [key, held] of heldRef.current) {
      if (
        !held.latched ||
        held.trackId !== trackId ||
        (pitch !== undefined && held.pitch !== pitch)
      )
        continue;
      heldRef.current.delete(key);
      finishHeldNote(held);
    }
  };
  /** Playing a key again while HOLD is on lets go of that key's latched note first, like a retrigger. */
  const retriggerHeld = (t: Track, pitch: number) => {
    const engine = getEngine();
    for (const p of processMidiThroughPlugins(pitch + (t.octave ?? 0) * 12, t.plugins)) {
      engine.releaseHeld(t.id, p);
      if (isExternal(t.id)) externalNoteOff(t.id, p);
    }
    finishLatchedNotes(t.id, pitch);
    latchPitch(t.id, pitch);
  };
  /** notes played live into the current take → audio-clock time they were heard */
  const recordedNoteIdsRef = useRef(new Map<string, number>());
  /** A synth take records notes only (no live print); the waveform is rendered from the notes when it lands. */
  const midiTakeRef = useRef<{ trackId: string; passes: number } | null>(null);
  /** set when a take ends at the loop end: the take runs to this step, not where the playhead jumped */
  const loopEndStepRef = useRef<number | null>(null);
  /** Overdub keeps a take going round the loop; everything else ends (and stops playback) at the loop end. */
  const takeInProgress = () => {
    const e = getEngine();
    return e.isRecording || e.isTrackRecording || !!midiTakeRef.current;
  };
  const recordingKeepsLooping = () => {
    const e = getEngine();
    return loopKeepsRecording(transportRef.current, {
      mic: e.isRecording,
      print: e.isTrackRecording,
      synth: !!midiTakeRef.current,
    });
  };
  /** Older notes inside the region being re-recorded (replace mode): silent while recording, removed when the take lands. */
  const replacedNoteIdsRef = useRef(new Set<string>());
  // last scheduled step + its audio-clock time, so note capture can stamp the
  // true sub-step position instead of the rounded playhead step
  const lastStepRef = useRef<{ step: number; time: number; dur: number } | null>(null);
  /** printed takes that land mid-pass: the scheduler starts them where the playhead is */
  const pickupClipIdsRef = useRef(new Set<string>());
  const takeTokenRef = useRef(0);
  /**
   * The step position you are hearing right now. The scheduler runs ahead of
   * the speakers, so the last scheduled step is in the future — work back from
   * its audio-clock time. A note played a hair before the take starts lands on
   * the take's first step instead of wrapping to the end of the loop.
   */
  const heardStepPos = (): number => {
    const tp = transportRef.current;
    const ls = lastStepRef.current;
    const eng = getEngine();
    if (!tp.playing || !ls || !eng.ctx) return tp.step;
    // players respond to what they hear, which leaves the speakers late
    const offset = (eng.ctx.currentTime - outputDelay(eng.ctx) - ls.time) / ls.dur;
    if (Math.abs(offset) > 8) return tp.step;
    const total = songSteps(tp.bars);
    let pos = ls.step + offset;
    if (tp.loop) {
      const lo = Math.max(0, Math.min(total - 1, tp.loopStart ?? 0));
      const hi = Math.min(total, Math.max(lo + 1, tp.loopEnd ?? total));
      if (pos < lo) pos = tp.recording ? lo : pos + (hi - lo);
      if (pos >= hi) pos -= hi - lo;
    } else if (pos < 0) pos = 0;
    if (tp.recording) {
      const start = recStartStepRef.current;
      if (pos < start && start - pos < 1.5) pos = start;
    }
    return Math.max(0, Math.min(total - 0.001, pos));
  };
  /** TOUCH releases shortly after a gesture; LATCH holds until playback stops. */
  const automationGestureRef = useRef(
    new Map<string, { touchedUntil: number; latched: boolean }>(),
  );
  // Per-lane edit history so a device automation lane can be stepped back on its
  // own without rewinding the rest of the project.
  const automationHistoryRef = useRef(
    new Map<
      string,
      {
        past: { points: AutomationPoint[]; label: string }[];
        future: { points: AutomationPoint[]; label: string }[];
      }
    >(),
  );
  const automationLastPushRef = useRef(new Map<string, { label: string; at: number }>());
  const [automationHistoryTick, setAutomationHistoryTick] = useState(0);

  // ---- Undo / redo history (projects save only via File → Save) ----------
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
          description: midiUnsupportedMessage(),
        });
      return;
    }
    void getMidiAccess().then((a) => {
      const list = listInputs(a);
      setMidiInputs(list);
      setMidiOutputs(listOutputs(a));
      if (!list.length) {
        if (!quiet)
          toast("No MIDI controller found", { description: "Plug one in, then press MIDI again." });
        return;
      }
      setMidiInputId((cur) => {
        // Detection must never collapse All devices or a saved multi-input choice.
        if (cur !== null) return cur;
        try {
          window.localStorage.setItem(MIDI_INPUT_KEY, "all");
        } catch {
          /* storage unavailable */
        }
        return "all";
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
          setMidiOutputs(listOutputs(a));
          // Preserve enabled ports, including temporarily disconnected devices.
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
    const perms = (
      navigator as unknown as {
        permissions?: { query(q: { name: string }): Promise<{ state: string }> };
      }
    ).permissions;
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
    // Remember surfaces the user switched off, so a hot-plug never turns them back on.
    const prev = midiInputIdRef.current;
    const off = new Set(readSwitchedOff());
    for (const p of midiInputsRef.current) {
      const was = midiInputEnabled(prev, p.id),
        now = midiInputEnabled(id, p.id);
      if (was && !now) off.add(p.name);
      else if (now) off.delete(p.name);
    }
    writeSwitchedOff([...off]);
    setMidiInputId(id);
    try {
      if (id) window.localStorage.setItem(MIDI_INPUT_KEY, id);
      else window.localStorage.removeItem(MIDI_INPUT_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // A known mixer surface (Korg nanoKONTROL…) plugged in after choosing only some devices is
  // turned on automatically, unless the user switched it off before.
  useEffect(() => {
    if (!midiInputs.length) return;
    const cur = midiInputIdRef.current;
    const next = withKnownSurfaces(cur, midiInputs, readSwitchedOff());
    if (next === cur) return;
    setMidiInputId(next);
    try {
      if (next) window.localStorage.setItem(MIDI_INPUT_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, [midiInputs]);

  // Live MIDI controller input: plays the armed/selected instrument and
  // records notes onto it while the transport is recording.
  useEffect(() => {
    if (!midiInputId) {
      setMidiLearning(false);
      return;
    }
    let off = () => {};
    let cancelled = false;
    let offSurface = () => {};
    let jogPending = 0;
    let jogTimer: number | null = null;
    const jogLast = new Map<string, number>();
    void getMidiAccess().then((a) => {
      if (cancelled) return;
      // Mixer-surface helpers shared by the CC (Assignable) layout and Mackie Control DAW modes.
      const runButton = (button: RemoteButton) => {
        const studio = apiRef.current;
        const tp = transportRef.current;
        const bar = stepsPerBar();
        if (button === "play") studio?.togglePlay();
        else if (button === "stop") {
          // Like Studio Pro: first press stops where you are, a second press goes back to the start.
          const press = stopPress({
            playing: !!tp.playing,
            recording: !!tp.recording || tp.countInLeft != null,
          });
          if (press === "end-take") void studio?.stop();
          else if (press === "stop-here") {
            stopLiveArps();
            releaseLatched();
            setTransportState((s) => ({ ...s, playing: false, paused: false }));
          } else setTransportState((s) => ({ ...s, paused: false, step: 0 }));
        } else if (button === "record") studio?.toggleRecord();
        else if (button === "loop") setTransportState((s) => ({ ...s, loop: !s.loop }));
        else if (button === "start") {
          if (!tp.playing && !tp.recording)
            setTransportState((s) => ({ ...s, step: s.loop ? (s.loopStart ?? 0) : 0 }));
        } else if (button === "rewind" || button === "forward") {
          if (!tp.playing && !tp.recording)
            setTransportState((s) => {
              const at = s.step ?? 0;
              const next =
                button === "rewind"
                  ? Math.ceil(at / bar - 1) * bar
                  : Math.floor(at / bar + 1) * bar;
              return { ...s, step: Math.max(0, Math.min(songSteps(s.bars) - 1, next)) };
            });
        } else {
          const bank = shiftStripBank(button === "bank-next" ? 1 : -1, tracksRef.current.length);
          toast(`Controller: tracks ${bank * 8 + 1}–${bank * 8 + 8}`);
        }
      };
      const runStrip = (strip: number, param: StripParam, v: number) => {
        const track = tracksRef.current[stripTrackIndex(strip)];
        if (!track) return;
        if (
          (param === "solo" || param === "mute" || param === "arm" || param === "select") &&
          v < 0.5
        )
          return; // toggle on press only
        if (param === "select") {
          setSelectedId(track.id);
          return;
        }
        setTracks((ts) =>
          ts.map((t) => {
            if (t.id !== track.id) return t;
            if (param === "volume") return { ...t, volume: faderGain(v) };
            if (param === "pan") return { ...t, pan: v * 2 - 1 };
            if (param === "solo")
              return { ...t, ...manualSwitchPatch({ solo: !t.solo }, isTakingSwitches()) };
            if (param === "mute")
              return { ...t, ...manualSwitchPatch({ muted: !t.muted }, isTakingSwitches()) };
            return { ...t, armed: !t.armed };
          }),
        );
      };
      // Jog wheel: clicks are gathered for a moment so a fast spin is one smooth move, not dozens of seeks.
      const jog = (ticks: number) => {
        if (!ticks || transportRef.current.recording) return;
        jogPending += ticks;
        // While playing, wait until the wheel rests, then restart playback once from the new beat.
        const playing = !!transportRef.current.playing;
        if (jogTimer != null) {
          if (!playing) return;
          window.clearTimeout(jogTimer);
        }
        jogTimer = window.setTimeout(
          () => {
            jogTimer = null;
            const n = jogPending;
            jogPending = 0;
            const tp = transportRef.current;
            if (tp.recording) return;
            const beat = Math.round(stepsPerBar() / Math.max(1, tp.beatsPerBar ?? 4));
            const target = joggedStep(tp.step ?? 0, n, beat, songSteps(tp.bars));
            if (tp.playing) {
              seekStepRef.current = target;
              setPlayStep(target);
              setSeekTick((x) => x + 1);
            }
            setTransportState((s) => ({ ...s, step: target }));
          },
          playing ? 180 : 40,
        );
      };
      const BUTTON_LABEL: Record<RemoteButton, string> = {
        play: "Play",
        stop: "Stop",
        record: "Record",
        start: "Go to start",
        rewind: "One bar back",
        forward: "One bar forward",
        loop: "Loop on/off",
        "bank-prev": "Tracks ◀",
        "bank-next": "Tracks ▶",
      };
      const stripLabel = (strip: number, param: string) => {
        const i = stripTrackIndex(strip);
        const t = tracksRef.current[i];
        return `Track ${i + 1}${t ? ` (${t.name})` : " (no track there)"} ${param}`;
      };
      // Known mixer surfaces: report every message in Settings, and decode Mackie Control DAW modes
      // (faders = pitch bend, buttons = notes) before notes could play an instrument.
      offSurface = claimControllerMidi((m) => {
        const profile = resolveController(m.portName);
        if (!profile?.map) {
          noteSurfaceEvent({
            port: m.portName || "MIDI input",
            raw: describeRaw(m.status, m.d1, m.d2),
            action:
              "No mixer layout for this device — notes play instruments, other controls need MIDI Learn",
          });
          return false;
        }
        const cmd = m.status & 0xf0;
        const ch = m.status & 0x0f;
        const raw = describeRaw(m.status, m.d1, m.d2);
        const port = m.portName || profile.model;
        if (
          profile.mackie &&
          profile.port.test(m.portName) &&
          (cmd === 0xe0 || cmd === 0x90 || cmd === 0x80) &&
          !mackiePortsRef.current.has(m.inputId)
        ) {
          mackiePortsRef.current.add(m.inputId);
          toast(`${profile.model}: DAW mode detected`, {
            description:
              "Using its Mackie Control layout — faders, knobs and buttons control tracks 1–8.",
          });
        }
        const mackie = mackiePortsRef.current.has(m.inputId);
        const mode = mackie ? "DAW mode (Mackie Control)" : "Assignable (CC)";
        const learnedKey =
          cmd === 0xb0 ? `${ch}:${m.d1}` : cmd === 0x90 || cmd === 0x80 ? `n:${ch}:${m.d1}` : null;
        if (midiLearnRef.current || (learnedKey && midiMapRef.current[learnedKey])) {
          noteSurfaceEvent({
            port,
            raw,
            mode,
            action: midiLearnRef.current ? "MIDI Learn" : "Your MIDI Learn assignment",
          });
          return false;
        }
        if (!mackie && cmd === 0xb0 && profile.jog === m.d1) {
          const ticks = jogTicks(m.d2, jogLast.get(m.inputId));
          jogLast.set(m.inputId, m.d2);
          jog(ticks);
          noteSurfaceEvent({
            port,
            raw,
            mode,
            action:
              ticks > 0 ? "Jog: playhead forward" : ticks < 0 ? "Jog: playhead back" : "Jog wheel",
          });
          return true;
        }
        if (!mackie) {
          let action = "Not used by the mixer layout";
          if (cmd === 0xb0) {
            const b = controllerAutoButton(m.portName, m.d1);
            const hit = controllerAutoMap(m.portName, m.d1);
            if (b) action = BUTTON_LABEL[b];
            else if (hit) action = stripLabel(hit.strip, hit.param);
          }
          noteSurfaceEvent({ port, raw, mode, action });
          return false;
        }
        const act = mackieAction(m.status, m.d1, m.d2);
        let action = "Not used";
        if (act?.kind === "volume") {
          runStrip(act.strip, "volume", act.value);
          action = stripLabel(act.strip, "volume");
        } else if (act?.kind === "pan") {
          const track = tracksRef.current[stripTrackIndex(act.strip)];
          if (track)
            setTracks((ts) =>
              ts.map((t) =>
                t.id === track.id
                  ? { ...t, pan: Math.max(-1, Math.min(1, (t.pan ?? 0) + act.delta)) }
                  : t,
              ),
            );
          action = stripLabel(act.strip, "pan");
        } else if (act?.kind === "switch") {
          runStrip(act.strip, act.param, 1);
          action = stripLabel(act.strip, act.param);
        } else if (act?.kind === "master") {
          setBuses((b) => ({ ...b, master: { ...b.master, volume: faderGain(act.value) } }));
          action = "Master volume";
        } else if (act?.kind === "button") {
          runButton(act.button);
          action = BUTTON_LABEL[act.button];
        } else if (act?.kind === "jog") {
          jog(act.ticks);
          action = act.ticks > 0 ? "Jog: playhead forward" : "Jog: playhead back";
        } else if (act?.kind === "ignore") action = "Button released / not used";
        noteSurfaceEvent({ port, raw, mode, action });
        return true; // a Mackie-mode surface never plays notes or bends synths
      });
      off = subscribe(a, midiInputId, (msg, inputId) => {
        const triggerLearnedDrum = (target: MidiTarget, velocity: number) => {
          const hit = learnedDrumPad(tracksRef.current, target);
          if (!hit) return;
          const engine = getEngine();
          engine.init();
          engine.syncMixIfChanged(tracksRef.current);
          engine.playDrum(hit.track.id, hit.pad, Math.max(0.15, velocity));
          const tp = transportRef.current;
          if (!tp.recording || !tp.playing || !hit.track.recording) return;
          const total = hit.pad.steps.length || hit.track.steps || 16;
          const at = tp.step % total;
          const stale = neighbourLiveHits(hit.track.id, hit.pad.id, at, total);
          markLiveHit(hit.track.id, hit.pad.id, at);
          setTracks((ts) =>
            ts.map((t) =>
              t.id === hit.track.id
                ? {
                    ...t,
                    pads: (t.pads ?? []).map((p) =>
                      p.id === hit.pad.id
                        ? {
                            ...p,
                            steps: p.steps.map((v, i) =>
                              i === at ? Math.max(0.15, velocity) : stale.includes(i) ? 0 : v,
                            ),
                          }
                        : p,
                    ),
                  }
                : t,
            ),
          );
        };
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
            toast.success(`CC ${msg.cc} mapped`, {
              description: `Controls ${learning.param} on this channel.`,
            });
            return;
          }
          const target = midiMapRef.current[key];
          if (!target) {
            // Korg 8-channel mixer: faders, knobs and S/M/R buttons follow track order automatically.
            const portName = midiInputsRef.current.find((p) => p.id === inputId)?.name;
            const button = controllerAutoButton(portName, msg.cc);
            if (button) {
              if (msg.value >= 0.5) runButton(button); // act on press only
              return;
            }
            const hit = controllerAutoMap(portName, msg.cc);
            if (!hit) {
              // Unmapped knobs, mod wheel and sustain pedal play the external instrument the keyboard is playing.
              const ch0 = msg.channel + 1;
              const ext =
                tracksRef.current.find((t) => isExternal(t.id) && t.midiChannel === ch0) ??
                tracksRef.current.find(
                  (t) =>
                    isExternal(t.id) && t.armed && (t.midiChannel == null || t.midiChannel === ch0),
                ) ??
                tracksRef.current.find((t) => isExternal(t.id) && t.id === selectedIdRef.current);
              if (ext) sendExternalCc(ext.id, msg.cc, msg.value);
              return;
            }
            runStrip(hit.strip, hit.param, msg.value);
            return;
          }
          const v = msg.value;
          const live = ccAction(target.id, target.param);
          if (live) {
            live(v);
            return;
          }
          if (target.id === "transport") {
            if (target.param === "bpm")
              setTransportState((s) => ({ ...s, bpm: ccRange(v, 60, 190, 1) }));
            else if (target.param === "swing")
              setTransportState((s) => ({ ...s, swing: ccRange(v, 0, 0.6, 0.01) }));
            return;
          }
          if (target.id.startsWith("looper:") && target.param === "volume") {
            const index = Number(target.id.slice(7));
            if (Number.isInteger(index) && index >= 0 && index < getLooper().slots.length)
              getLooper().setVolume(index, ccRange(v, 0, 1.2));
            return;
          }
          if (
            target.id.startsWith("bus:") ||
            target.id.startsWith("vca:") ||
            target.id.startsWith("aux:")
          ) {
            const [kind, id] = target.id.split(":");
            if (!id || !["volume", "mute"].includes(target.param)) return;
            const patch =
              target.param === "volume" ? { volume: faderGain(v) } : { muted: v >= 0.5 };
            if (kind === "bus" && ["drums", "synths", "vocals", "fx", "master"].includes(id))
              setBuses((b) => ({ ...b, [id]: { ...b[id as BusId], ...patch } }));
            if (kind === "bus" && isCustomBusId(id))
              setCustomBuses((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
            if (kind === "vca" && ["A", "B", "C", "D"].includes(id))
              setVcaLinkedRef.current(id as VcaId, patch);
            if (kind === "aux" && ["reverb", "delay", "chorus"].includes(id))
              setAuxReturns((b) => ({ ...b, [id]: { ...b[id as AuxId], ...patch } }));
            return;
          }
          if (target.id === "master") {
            if (target.param === "volume")
              setBuses((b) => ({ ...b, master: { ...b.master, volume: faderGain(v) } }));
            else if (target.param === "gain")
              setBuses((b) => ({ ...b, master: { ...b.master, gain: trimFromCc(v) } }));
            else if (target.param === "mute" && v >= 0.5)
              setBuses((b) => ({ ...b, master: { ...b.master, muted: !b.master.muted } }));
            return;
          }
          if (target.param.startsWith("synth:")) {
            const path = target.param.slice(6).split(":");
            const field = path[0];
            setTracks((ts) =>
              ts.map((t) => {
                if (t.id !== target.id || !t.patch || !field) return t;
                const patch = t.patch;
                if (path.length === 1 && synthRanges[field]) {
                  const [min, max, step] = synthRanges[field];
                  return liveSound({
                    ...t,
                    patch: { ...patch, [field]: ccRange(v, min, max, step) },
                  });
                }
                if (field === "granular" && path[1] && patch.granular) {
                  const knob = GRANULAR_KNOBS.find((k) => k.id === path[1]);
                  if (!knob) return t;
                  return liveSound({
                    ...t,
                    patch: {
                      ...patch,
                      granular: {
                        ...patch.granular,
                        [knob.id]: ccRange(v, knob.min, knob.max, knob.step),
                      },
                    },
                  });
                }
                if (field === "macro" && path[1] && /^[0-3]$/.test(path[1])) {
                  const macros = [...(patch.macros ?? [0, 0, 0, 0])];
                  macros[Number(path[1])] = v;
                  return liveSound({ ...t, patch: { ...patch, macros } });
                }
                if (
                  field === "fx" &&
                  path[1] &&
                  Object.hasOwn(patch.fx, path[1]) &&
                  typeof patch.fx[path[1] as keyof typeof patch.fx] === "number"
                )
                  return liveSound({
                    ...t,
                    patch: { ...patch, fx: { ...patch.fx, [path[1]]: v } },
                  });
                if (
                  ["amp", "filterEnv", "modEnv", "filter2", "unison", "arp"].includes(field) &&
                  path[1]
                ) {
                  const group =
                    patch[field as "amp" | "filterEnv" | "modEnv" | "filter2" | "unison" | "arp"];
                  if (
                    !group ||
                    typeof group !== "object" ||
                    typeof (group as Record<string, unknown>)[path[1]] !== "number"
                  )
                    return t;
                  const range = synthRanges[`${field}.${path[1]}`];
                  const max =
                    field === "amp" || field === "filterEnv" || field === "modEnv"
                      ? path[1] === "sustain"
                        ? 1
                        : 3
                      : 1;
                  const value = range ? ccRange(v, ...range) : ccRange(v, 0, max);
                  return liveSound({
                    ...t,
                    patch: { ...patch, [field]: { ...group, [path[1]]: value } },
                  });
                }
                if ((field === "osc" || field === "lfo") && path[1] && path[2]) {
                  const index = Number(path[1]);
                  const property = path[2];
                  const list = field === "osc" ? patch.oscillators : patch.lfos;
                  const item = list[index];
                  if (
                    !property ||
                    !item ||
                    typeof (item as unknown as Record<string, unknown>)[property] !== "number"
                  )
                    return t;
                  const range =
                    field === "osc"
                      ? (
                          {
                            octave: [-3, 3, 1],
                            semitone: [-12, 12, 1],
                            fine: [-50, 50, 1],
                            detune: [-50, 50, 1],
                            pulseWidth: [0.05, 0.95],
                            pan: [-1, 1],
                          } as Record<string, [number, number, number?]>
                        )[property]
                      : property === "rate"
                        ? ([0.05, 20, 0.05] as [number, number, number?])
                        : undefined;
                  const updated = list.map((item, i) =>
                    i === index ? { ...item, [property]: range ? ccRange(v, ...range) : v } : item,
                  );
                  return liveSound({
                    ...t,
                    patch: { ...patch, [field === "osc" ? "oscillators" : "lfos"]: updated },
                  });
                }
                return t;
              }),
            );
            return;
          }
          if (target.param.startsWith("drum-trigger:")) {
            if (v >= 0.5) triggerLearnedDrum(target, v);
            return;
          }
          if (target.param.startsWith("drum:")) {
            const [, padId, field] = target.param.split(":");
            const range = field ? drumRanges[field] : undefined;
            if (padId && field && range)
              setTracks((ts) =>
                ts.map((t) =>
                  t.id === target.id && t.pads
                    ? liveSound({
                        ...t,
                        pads: t.pads.map((pad) =>
                          pad.id === padId ? { ...pad, [field]: ccRange(v, ...range) } : pad,
                        ),
                      })
                    : t,
                ),
              );
            return;
          }
          if (target.param.startsWith("sampler:")) {
            const field = target.param.slice(8);
            const ranges: Record<string, [number, number, number?]> = {
              start: [0, 1, 0.001],
              end: [0, 1, 0.001],
              gain: [0, 2, 0.01],
              pitch: [-24, 24, 0.1],
              rootNote: [24, 96, 1],
              attack: [0, 2, 0.001],
              release: [0.005, 4, 0.005],
              decay: [0, 3, 0.005],
              sustain: [0, 1, 0.01],
              fadeIn: [0, 2, 0.005],
              fadeOut: [0, 2, 0.005],
              resonance: [0.1, 20, 0.1],
              sampleBpm: [60, 200, 1],
              fine: [-100, 100, 1],
              pan: [-1, 1, 0.01],
              filterEnv: [-4, 4, 0.05],
              filterDecay: [0.01, 3, 0.01],
              pitchEnv: [-24, 24, 0.5],
              pitchDecay: [0.01, 2, 0.01],
              velSens: [0, 1, 0.01],
              velFilter: [0, 4, 0.05],
            };
            const range = ranges[field];
            if (field === "cutoff" || range)
              setTracks((ts) =>
                ts.map((t) => {
                  if (t.id !== target.id || !t.sampler) return t;
                  const value =
                    field === "cutoff"
                      ? Math.round(Math.pow(10, ccRange(v, Math.log10(20), Math.log10(20000))))
                      : range
                        ? ccRange(v, ...range)
                        : 0;
                  const bounded =
                    field === "start"
                      ? Math.min(value, t.sampler.end - 0.002)
                      : field === "end"
                        ? Math.max(value, t.sampler.start + 0.002)
                        : value;
                  return { ...t, sampler: { ...t.sampler, [field]: bounded } };
                }),
              );
            return;
          }
          if (target.param.startsWith("plugin:")) {
            const [, instanceId, paramId] = target.param.split(":");
            if (instanceId && paramId)
              setTracks((ts) =>
                ts.map((t) =>
                  t.id === target.id
                    ? {
                        ...t,
                        plugins: (t.plugins ?? []).map((p) =>
                          p.id === instanceId
                            ? {
                                ...p,
                                params: p.params.map((param) =>
                                  param.id === paramId
                                    ? { ...param, value: ccRange(v, param.min, param.max) }
                                    : param,
                                ),
                              }
                            : p,
                        ),
                      }
                    : t,
                ),
              );
            return;
          }
          if (target.param.startsWith("fx:")) {
            const [, instanceId, paramId] = target.param.split(":");
            if (instanceId && paramId)
              setFxChains((chains) => ({
                ...chains,
                [target.id]: (chains[target.id] ?? []).map((p) =>
                  p.id === instanceId
                    ? {
                        ...p,
                        params: p.params.map((param) =>
                          param.id === paramId
                            ? { ...param, value: ccRange(v, param.min, param.max) }
                            : param,
                        ),
                      }
                    : p,
                ),
              }));
            return;
          }
          if (target.id.startsWith("sampler-pad:") && target.param.startsWith("pad:")) {
            const index = Number(target.id.slice("sampler-pad:".length));
            const field = target.param.slice(4);
            // Every MPC pad knob shares its range with the pad editor (mpc-pad.ts).
            const range = (PAD_SOUND_RANGES as Record<string, readonly [number, number, number]>)[
              field
            ];
            if (Number.isInteger(index) && (range || field === "cutoff")) {
              const pads = getPadBank();
              const pad = pads[index];
              const value =
                field === "cutoff"
                  ? Math.round(Math.pow(10, ccRange(v, Math.log10(20), Math.log10(20000))))
                  : range
                    ? ccRange(v, range[0], range[1], range[2])
                    : 0;
              if (pad) setPadBank({ ...pads, [index]: { ...pad, [field]: value } });
            }
            return;
          }
          setTracks((ts) =>
            ts.map((t) =>
              t.id === target.id && ["volume", "pan", "mute", "solo", "gain"].includes(target.param)
                ? target.param === "volume"
                  ? { ...t, volume: faderGain(v) }
                  : target.param === "gain"
                    ? { ...t, gain: trimFromCc(v) }
                    : target.param === "pan"
                      ? { ...t, pan: v * 2 - 1 }
                      : target.param === "mute"
                        ? // Buttons toggle on press; releasing the button (value 0) does nothing.
                          v >= 0.5
                          ? { ...t, ...manualSwitchPatch({ muted: !t.muted }, isTakingSwitches()) }
                          : t
                        : v >= 0.5
                          ? { ...t, ...manualSwitchPatch({ solo: !t.solo }, isTakingSwitches()) }
                          : t
                : t,
            ),
          );
          return;
        }
        // Controller buttons that send notes (many nano-series buttons do):
        // learn them like knobs; a mapped button toggles its target and never plays a sound.
        if (msg.type === "on" || msg.type === "off") {
          const nKey = `n:${msg.channel}:${msg.pitch}`;
          const learning = midiLearnRef.current;
          if (learning && msg.type === "on") {
            setMidiMap((m) => {
              // one control per button, and one button per control
              const next: Record<string, MidiTarget> = {};
              for (const [k, v] of Object.entries(m)) {
                if (k === nKey) continue;
                if (v.id === learning.id && v.param === learning.param) continue;
                next[k] = v;
              }
              next[nKey] = learning;
              try {
                window.localStorage.setItem(MIDI_MAP_KEY, JSON.stringify(next));
              } catch {
                /* storage unavailable */
              }
              return next;
            });
            setMidiLearn(null);
            toast.success(`Button mapped`, {
              description: `Controls ${learning.param} on this channel.`,
            });
            return;
          }
          const noteTarget = midiMapRef.current[nKey];
          if (noteTarget) {
            if (msg.type !== "on") return; // toggle on press only
            if (noteTarget.param.startsWith("drum-trigger:")) {
              triggerLearnedDrum(noteTarget, msg.velocity);
              return;
            }
            if (noteTarget.id === "master" && noteTarget.param === "mute") {
              setBuses((b) => ({ ...b, master: { ...b.master, muted: !b.master.muted } }));
              return;
            }
            setTracks((ts) =>
              ts.map((t) => {
                if (t.id !== noteTarget.id) return t;
                if (noteTarget.param === "mute")
                  return { ...t, ...manualSwitchPatch({ muted: !t.muted }, isTakingSwitches()) };
                if (noteTarget.param === "solo")
                  return { ...t, ...manualSwitchPatch({ solo: !t.solo }, isTakingSwitches()) };
                if (noteTarget.param === "arm") return { ...t, armed: !t.armed };
                return t;
              }),
            );
            return;
          }
        }
        if (msg.type === "pitchbend") {
          // live pitch wheel: ±2 semitones on the track the keyboard is playing
          const ch0 = msg.channel + 1;
          const pbTarget = liveNoteTarget(tracksRef.current, selectedIdRef.current, {
            playable: (t) => !!t.patch,
            channel: ch0,
            recording: transportRef.current.recording,
          });
          if (pbTarget && !sendExternalBend(pbTarget.id, msg.value))
            getEngine().setPitchBend(
              pbTarget.id,
              bendCents(msg.value, playbackPreferences().pitchBendRange),
            );
          return;
        }
        const { type, pitch, velocity } = msg;
        const heldKey = `${inputId ?? "midi"}:${msg.channel}:${pitch}`;
        // A track with a MIDI channel set only hears notes on that channel
        // (msg.channel is 0-based; Track.midiChannel is 1-16). Tracks set to
        // "All" hear everything, so a channel-routed instrument wins over them.
        const ch = msg.channel + 1;
        const hears = (t: Track) => t.midiChannel == null || t.midiChannel === ch;

        // A drum controller speaks General MIDI notes. When an armed drum track
        // owns the incoming note, that pad plays — and while recording, the note
        // is written onto the step that is sounding, exactly like tapping a pad.
        const drumTarget =
          tracksRef.current.find(
            (t) => t.kind === "drum" && t.pads?.length && t.midiChannel === ch,
          ) ??
          tracksRef.current.find(
            (t) => t.armed && t.kind === "drum" && t.pads?.length && hears(t),
          ) ??
          (tracksRef.current.find(
            (t) => t.id === selectedIdRef.current && t.kind === "drum" && t.pads?.length,
          ) as Track | undefined);
        if (drumTarget?.pads) {
          const hit = drumTarget.pads.find((p) => padNote(p, drumTarget.pads!) === pitch);
          if (hit) {
            if (type === "on") {
              keyDown(pitch, 30000);
              const engine = getEngine();
              engine.init();
              engine.syncMixIfChanged(tracksRef.current);
              engine.playDrum(drumTarget.id, hit, Math.max(0.15, velocity));
              const tp = transportRef.current;
              if (tp.recording && tp.playing && drumTarget.recording) {
                const total = hit.steps.length || drumTarget.steps || 16;
                const at = tp.step % total;
                const stale = neighbourLiveHits(drumTarget.id, hit.id, at, total);
                markLiveHit(drumTarget.id, hit.id, at);
                setTracks((ts) =>
                  ts.map((t) =>
                    t.id === drumTarget.id
                      ? {
                          ...t,
                          pads: (t.pads ?? []).map((p) =>
                            p.id === hit.id
                              ? {
                                  ...p,
                                  steps: p.steps.map((v, i) =>
                                    i === at ? Math.max(0.15, velocity) : stale.includes(i) ? 0 : v,
                                  ),
                                }
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

        const notable = (t: Track) =>
          t.kind === "instrument" || t.kind === "midi" || t.kind === "sampler";
        // The synth you are on plays (not another armed channel); while recording, the recording channel.
        const target = liveNoteTarget(tracksRef.current, selectedIdRef.current, {
          playable: notable,
          channel: ch,
          recording: transportRef.current.recording,
          anyFallback: true,
        });
        if (!target) return;
        const engine = getEngine();
        engine.init();
        const tp = transportRef.current;
        const stepDur = stepSeconds(tp.bpm);
        const holding = holdApplies(target);
        if (type === "on") {
          keyDown(pitch, holding ? HELD_NOTE_SECONDS * 1000 : 30000);
          setMidiLearning(true);
          engine.syncMixIfChanged(tracksRef.current);
          if (holding) retriggerHeld(target, pitch);
          if (isExternal(target.id) && !target.patch?.arp?.on) {
            // External instruments hold the note until the key is released, like a real keyboard.
            const anySolo = tracksRef.current.some((t) => t.solo);
            const audible = !target.muted && !target.deviceBypassed && (!anySolo || target.solo);
            if (audible)
              for (const p of processMidiThroughPlugins(
                pitch + (target.octave ?? 0) * 12,
                target.plugins,
              ))
                externalNoteOn(target.id, p, Math.max(0.15, velocity));
          } else
            triggerNote(
              engine,
              target,
              pitch,
              holding ? HELD_NOTE_SECONDS : LIVE_MIDI_NOTE_SECONDS,
              Math.max(0.15, velocity),
              undefined,
              holding ? HELD_NOTE_SECONDS : 30,
            );
          if (tp.recording && target.recording) {
            const pitches = processMidiThroughPlugins(pitch, target.plugins);
            const heard = heardStepPos();
            const at =
              tp.snapRecording === false
                ? heard
                : snapRecordedStep(
                    heard,
                    tp.quantize ?? 1,
                    tp.loop ? loopRegion(tp) : [0, songSteps(tp.bars)],
                    tp.loop,
                  );
            const notes: MidiNote[] = pitches.flatMap((recordedPitch) => {
              const note = capturedNote(
                {
                  id: uid(),
                  step: at,
                  length: heardNoteSteps(LIVE_MIDI_NOTE_SECONDS, stepDur),
                  pitch: recordedPitch,
                  velocity: Math.max(0.15, velocity),
                },
                tp.loop ? loopRegion(tp) : [0, songSteps(tp.bars)],
              );
              return note ? [note] : [];
            });
            notes.forEach((note) =>
              recordedNoteIdsRef.current.set(note.id, engine.ctx?.currentTime ?? 0),
            );
            heldRef.current.set(heldKey, {
              ids: notes.map((note) => note.id),
              trackId: target.id,
              t0: performance.now(),
              startStep: at,
              pitch,
            });
            setTracks((ts) =>
              ts.map((t) =>
                t.id === target.id ? { ...t, notes: [...(t.notes ?? []), ...notes] } : t,
              ),
            );
          }
        } else {
          setMidiLearning(false);
          const held = heldRef.current.get(heldKey);
          if (holding) {
            // HOLD keeps the note (and its key light) going after the key comes up; the recorded
            // note gets its length when HOLD lets go.
            if (held) {
              heldRef.current.delete(heldKey);
              heldRef.current.set(`latch:${held.trackId}:${held.ids[0] ?? uid()}`, {
                ...held,
                latched: true,
              });
            }
            return;
          }
          keyUp(pitch);
          for (const p of processMidiThroughPlugins(
            pitch + (target.octave ?? 0) * 12,
            target.plugins,
          )) {
            arpLiveRelease(target.id, p);
            externalNoteOff(target.id, p);
          }
          if (!held) return;
          heldRef.current.delete(heldKey);
          finishHeldNote(held);
        }
      });
    });
    return () => {
      cancelled = true;
      off();
      offSurface();
      if (jogTimer != null) window.clearTimeout(jogTimer);
    };
  }, [midiInputId, midiInputs]);

  // A synth's HOLD letting go (switched off, or Stop): release its latched voices, arp keys,
  // external hardware notes and key lights, and give recorded notes their held length.
  useEffect(
    () =>
      onHoldRelease((trackId, pitches) => {
        const engine = getEngine();
        engine.releaseHeld(trackId);
        arpReleaseAll(trackId);
        const t = tracksRef.current.find((x) => x.id === trackId);
        for (const pitch of pitches) {
          keyUp(pitch);
          if (t && isExternal(trackId))
            for (const p of processMidiThroughPlugins(pitch + (t.octave ?? 0) * 12, t.plugins))
              externalNoteOff(trackId, p);
        }
        finishLatchedNotes(trackId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }),
    [],
  );

  useEffect(() => {
    if (typeof window !== "undefined" && getEngine().ctx) {
      getEngine().syncMix(tracks);
      for (const t of tracks) getEngine().setInserts(t.id, t.plugins ?? []);
    }
  }, [tracks]);

  // A new recording pass starts with an empty "played live" list, so earlier
  // takes keep sounding while only this pass's live notes skip re-voicing.
  // Live notes/hits stay "already heard" until the take lands (finishTrackRecording
  // releases them), so stopping never leaves a moment where they play twice.
  useEffect(() => {
    if (transport.recording) {
      takeTokenRef.current += 1;
      recordedNoteIdsRef.current = new Map();
      clearLiveHits();
    }
  }, [transport.recording]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const [id, b] of Object.entries(buses))
      getEngine().setBus(id, b.volume, b.muted, b.gain ?? 1);
  }, [buses]);

  // Producer-made effect buses: level/mute into the engine; deleted ones are torn down.
  const engineCustomBusIds = useRef(new Set<string>());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const engine = getEngine();
    const live = new Set<string>();
    for (const b of customBuses) {
      live.add(b.id);
      engine.setBus(b.id, b.volume, b.muted, 1);
    }
    for (const id of engineCustomBusIds.current) if (!live.has(id)) engine.removeBus(id);
    engineCustomBusIds.current = live;
  }, [customBuses]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    getEngine().setVcaStates(vcas, tracksRef.current);
  }, [vcas]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    for (const [id, value] of Object.entries(auxReturns))
      getEngine().setAuxReturn(id, value.volume, value.muted);
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

    // Seconds of audio scheduled in advance. Generous on purpose: a busy page (dragging a knob,
    // adding a track, generating a part) can block the main thread for a few hundred ms, and
    // everything already handed to the audio clock keeps playing on time through that.
    const LOOKAHEAD = SCHEDULE_AHEAD;
    const TICK = 20; // ms between scheduler passes
    let step = seekStepRef.current ?? transportRef.current.step ?? 0;
    seekStepRef.current = null;
    // After a count-in the song starts exactly on its downbeat; otherwise as soon as possible.
    const wanted = startAtRef.current;
    startAtRef.current = null;
    let nextTime = ctx.currentTime + 0.06;
    if (wanted != null && wanted > nextTime && wanted - nextTime < 1) nextTime = wanted;
    songStartRef.current = { step, time: nextTime };
    // a stale clock from the last run must not place notes played before the downbeat
    lastStepRef.current = null;
    let cancelled = false;
    /** the take ends at the loop end: the next pass is never queued, so nothing recorded plays back */
    let heldAtLoopEnd = false;
    let lastScheduled: number | null = null;
    /** steps already handed to the audio clock, drained by the visual loop */
    const queue: { step: number; time: number }[] = [];

    /** Queue everything that makes sound for one step at an exact audio time. */
    const scheduleStep = (n: number, when: number) =>
      scheduleSongStep(engine, tracksRef.current, transportRef.current, n, when, {
        lastScheduled,
        includeSilenced: true,
        pickupClip: (id) => pickupClipIdsRef.current.delete(id),
        liveHit: isLiveHit,
        skipNote: (id, when) => {
          if (replacedNoteIdsRef.current.has(id)) return true;
          const heardAt = recordedNoteIdsRef.current.get(id);
          if (heardAt === undefined) return false;
          // Overdubbing a synth: what you played in an earlier pass plays again one loop later.
          if (!midiTakeRef.current) return true;
          const tpl = transportRef.current;
          const [lo, hi] = loopRegion(tpl);
          return when - heardAt < (hi - lo) * stepSeconds(tpl.bpm) * 0.5;
        },
      });

    /** Everything that should happen the moment a step is actually heard. */
    let prevAt = -1;
    // Mute/solo presses captured during the current take (timeline or reel recording), and the last replayed step.
    let switchTake: {
      start: number;
      prev: number;
      baseline: Map<string, { muted: boolean; solo: boolean }>;
    } | null = null;
    let switchPrev = -1;
    const reachStep = (n: number) => {
      const tp = transportRef.current;
      const list = tracksRef.current;
      const anySolo = list.some((t) => t.solo);
      const totalSteps = songSteps(tp.bars);
      const at = n % totalSteps;
      // a loop wrap ends the take: recording never runs past the selected bars
      if (tp.loop && prevAt >= 0 && at < prevAt) {
        const lo = Math.max(0, Math.min(totalSteps - 1, tp.loopStart ?? 0));
        if (at === lo) loopStopRef.current?.(heldAtLoopEnd);
      }
      prevAt = at;
      // punch in / out: the take starts and stops itself at the markers
      if (tp.punchIn != null && at === tp.punchIn) punchRef.current?.start(at);
      if (tp.punchOut != null && at === tp.punchOut) punchRef.current?.stop();
      // Mute/solo buttons: recorded with their timing during a take, replayed otherwise.
      {
        const taking =
          tp.playing && (tp.recording || getReelRecorder().getSnapshot().mode === "recording");
        const patches = new Map<string, Partial<Track>>();
        if (taking) {
          const take =
            switchTake ?? (switchTake = { start: at, prev: at - 1, baseline: new Map() });
          const from = at <= take.prev ? at - 1 : take.prev;
          for (const t of list) {
            const base = take.baseline.get(t.id) ?? { muted: !!t.muted, solo: !!t.solo };
            if (!take.baseline.has(t.id)) take.baseline.set(t.id, base);
            const muteEvents = writeSwitchStep(
              t.muteEvents,
              from,
              at,
              !!t.muted,
              base.muted,
              take.start,
            );
            const soloEvents = writeSwitchStep(
              t.soloEvents,
              from,
              at,
              !!t.solo,
              base.solo,
              take.start,
            );
            if (muteEvents || soloEvents)
              patches.set(t.id, {
                ...(muteEvents ? { muteEvents } : {}),
                ...(soloEvents ? { soloEvents } : {}),
              });
          }
          take.prev = at;
          switchPrev = at;
        } else {
          switchTake = null;
          // Replay at recorded presses (and when playback starts), so a manual press still works between them.
          for (const t of list) {
            const muted = switchEdge(t.muteEvents, switchPrev, at)
              ? switchStateAt(t.muteEvents, at)
              : undefined;
            const solo = switchEdge(t.soloEvents, switchPrev, at)
              ? switchStateAt(t.soloEvents, at)
              : undefined;
            const patch: Partial<Track> = {};
            if (muted !== undefined && muted !== !!t.muted) patch.muted = muted;
            if (solo !== undefined && solo !== !!t.solo) patch.solo = solo;
            if (Object.keys(patch).length) patches.set(t.id, patch);
          }
        }
        if (!taking) switchPrev = at;
        if (patches.size) {
          const next = list.map((t) => (patches.has(t.id) ? { ...t, ...patches.get(t.id) } : t));
          tracksRef.current = next;
          setTracks((current) =>
            current.map((t) => (patches.has(t.id) ? { ...t, ...patches.get(t.id) } : t)),
          );
          if (!taking) engine.syncMixIfChanged(next);
        }
      }
      for (const t of tracksRef.current) {
        if (t.muted || t.deviceBypassed || t.frozen || (anySolo && !t.solo)) continue;
        if (!t.automation?.length) continue;
        const ride: Record<string, number> = {};
        for (const lane of t.automation) {
          const gesture = automationGestureRef.current.get(`${t.id}:${lane.param}`);
          const touching = (gesture?.touchedUntil ?? 0) > performance.now();
          const latched = !!gesture?.latched;
          const writing = laneWrites(lane, touching, latched);
          if (writing && isLiveParam(lane.param)) {
            // Fader / pan / send moves are recorded at the step you hear them.
            const points = writePoint(lane.points, at, liveValue(t, lane.param));
            setTracks((current) =>
              current.map((track) =>
                track.id === t.id
                  ? {
                      ...track,
                      automation: (track.automation ?? []).map((item) =>
                        item.param === lane.param ? { ...item, points } : item,
                      ),
                    }
                  : track,
              ),
            );
            continue;
          }
          if (writing && lane.param.startsWith("plugin:")) {
            const [, pluginId = "", paramId = ""] = lane.param.split(":");
            const plugin = (t.plugins ?? []).find((item) => item.id === pluginId);
            const control = plugin?.params.find((item) => item.id === paramId);
            if (control) {
              const normalized =
                control.max > control.min
                  ? (control.value - control.min) / (control.max - control.min)
                  : 0;
              const points = [
                ...lane.points.filter((point) => point.step !== at),
                { step: at, value: normalized },
              ].sort((a, b) => a.step - b.step);
              setTracks((current) =>
                current.map((track) =>
                  track.id === t.id
                    ? {
                        ...track,
                        automation: (track.automation ?? []).map((item) =>
                          item.param === lane.param ? { ...item, points } : item,
                        ),
                      }
                    : track,
                ),
              );
            }
            continue;
          }
          if (laneReads(lane, touching, latched) && lane.points.length > 0)
            ride[lane.param] = valueAt(lane.points, at);
        }
        if (Object.keys(ride).length > 0) engine.automate(t.id, ride);
      }
      // The heard step moves the playhead only: no studio-wide re-render per step.
      transportRef.current = { ...transportRef.current, step: at };
      setPlayStep(at);
    };

    const pump = () => {
      if (cancelled || heldAtLoopEnd) return;
      const now = ctx.currentTime;
      // After a stall longer than the look-ahead, steps that are already too late are skipped
      // along the song grid (never rescheduled from the heard step, which would play the steps
      // already queued a second time). They still reach the playhead so punch/automation run.
      if (nextTime < now - LATE_OK) {
        let skipped = 0;
        while (nextTime < now - LATE_OK && skipped < 4096) {
          const tp = transportRef.current;
          const total = songSteps(tp.bars);
          queue.push({ step: step % total, time: nextTime });
          if (queue.length > 64) queue.shift();
          nextTime += stepSeconds(tp.bpm);
          step = nextPlayStep(step, tp);
          skipped += 1;
        }
        if (nextTime < now - LATE_OK) nextTime = now + 0.02;
        lastScheduled = null;
      }
      while (nextTime < now + LOOKAHEAD) {
        const tp = transportRef.current;
        const total = songSteps(tp.bars);
        const stepDur = stepSeconds(tp.bpm);
        if (
          tp.recording &&
          isLoopWrap(lastScheduled, step % total, tp) &&
          takeInProgress() &&
          !recordingKeepsLooping()
        ) {
          // Recording stops at the loop end: queue only the playhead's arrival at the loop start
          // (which ends the take and stops playback), never the sound of the next pass.
          queue.push({ step: step % total, time: nextTime });
          heldAtLoopEnd = true;
          break;
        }
        scheduleStep(step, nextTime);
        lastScheduled = step % total;
        queue.push({ step: step % total, time: nextTime });
        lastStepRef.current = { step: step % total, time: nextTime, dur: stepDur };
        setSongClock(lastStepRef.current);
        if (engine.ctx) sendClockForStep(engine.ctx, nextTime, stepDur);
        nextTime += stepDur;
        step = nextPlayStep(step, tp);
      }
    };

    const frame = () => {
      if (cancelled) return;
      const now = ctx.currentTime;
      // Every heard step runs, even after a stall, so punch markers, automation and recorded
      // mute presses between frames are never skipped.
      while (queue.length > 0 && queue[0]!.time <= now) reachStep(queue.shift()!.step);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport.playing, seekTick]);

  // MIDI clock out: Start/Continue when the song starts, Stop when it stops.
  const midiWasPlayingRef = useRef(false);
  useEffect(() => {
    if (transport.playing) sendTransportStart(transportRef.current.step);
    else if (midiWasPlayingRef.current) sendTransportStop();
    midiWasPlayingRef.current = transport.playing;
  }, [transport.playing]);

  /** Moving a fader, pan or send while playing "touches" its automation lane so Write/Touch/Latch record it. */
  const touchAutomation = useCallback((id: string, patch: Partial<Track>) => {
    if (!transportRef.current.playing) return;
    const prev = tracksRef.current.find((t) => t.id === id);
    if (!prev?.automation?.length) return;
    for (const param of movedLiveParams(prev, patch)) {
      const lane = prev.automation.find((l) => l.param === param);
      if (!lane || lane.locked || !["write", "touch", "latch"].includes(lane.mode)) continue;
      const key = `${id}:${param}`;
      const before = automationGestureRef.current.get(key);
      automationGestureRef.current.set(key, {
        touchedUntil: performance.now() + 180,
        latched: lane.mode === "latch" || !!before?.latched,
      });
    }
  }, []);

  const updateTrack = useCallback(
    (id: string, rawPatch: Partial<Track>) => {
      // A hand press of mute/solo outside a take replaces that button's recorded presses.
      const patch = manualSwitchPatch(rawPatch, isTakingSwitches());
      touchAutomation(id, patch);
      setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [touchAutomation],
  );

  // VCA groups move their members' own faders / pans / channel EQ (vca-link.ts), so the
  // channel controls visibly follow. Session-only memory keeps the balance when a VCA bottoms out.
  const vcaLinkMemoryRef = useRef(new Map<string, LinkMemory>());
  const vcasRef = useRef(vcas);
  vcasRef.current = vcas;
  const installedPluginsRef = useRef(installedPlugins);
  installedPluginsRef.current = installedPlugins;
  const setVcaLinked = useCallback(
    (id: VcaId, patch: Partial<BusState>) => {
      const prev = vcasRef.current[id];
      const next = { ...prev, ...patch };
      vcasRef.current = { ...vcasRef.current, [id]: next };
      setVcas((v) => ({ ...v, [id]: { ...v[id], ...patch } }));
      const eqDef =
        installedPluginsRef.current.find((d) => d.kind === "eq") ??
        BUILT_IN_PLUGINS.find((d) => d.kind === "eq");
      const makeEq = () => (eqDef ? instantiate(eqDef) : null);
      if (transportRef.current.playing) {
        const preview = applyVcaLink(tracksRef.current, id, prev, next, new Map(), makeEq);
        preview.forEach((t, i) => {
          const before = tracksRef.current[i];
          if (before && t !== before) touchAutomation(t.id, { volume: t.volume, pan: t.pan });
        });
      }
      setTracks((ts) => applyVcaLink(ts, id, prev, next, vcaLinkMemoryRef.current, makeEq));
    },
    [touchAutomation],
  );
  const setVcaLinkedRef = useRef(setVcaLinked);
  setVcaLinkedRef.current = setVcaLinked;

  const busStateOf = useCallback(
    (id: TrackBusId): BusState =>
      isCustomBusId(id)
        ? (customBusesRef.current.find((b) => b.id === id) ?? { volume: 1, muted: false })
        : buses[id],
    [buses],
  );
  const setAnyBus = useCallback((id: TrackBusId, patch: Partial<BusState>) => {
    if (isCustomBusId(id))
      setCustomBuses((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    else setBuses((b) => ({ ...b, [id]: { ...b[id], ...patch } }));
  }, []);
  const applyBusTemplate = useCallback((id: TrackBusId, template: BusTemplate) => {
    const plugins = templatePlugins(template, installedPluginsRef.current);
    setFxChains((c) => ({ ...c, [`bus:${id}`]: plugins }));
    if (isCustomBusId(id))
      setCustomBuses((list) =>
        list.map((b) => (b.id === id ? { ...b, template: template.name } : b)),
      );
  }, []);
  const setBusMembers = useCallback((id: TrackBusId, trackIds: string[]) => {
    const pick = new Set(trackIds);
    setTracks((ts) =>
      ts.map((t) =>
        pick.has(t.id)
          ? t.bus === id
            ? t
            : { ...t, bus: id }
          : t.bus === id && id !== "master"
            ? { ...t, bus: "master" }
            : t,
      ),
    );
  }, []);
  const addCustomBus = useCallback(
    (opts: { name: string; color: string; template?: BusTemplate; memberIds?: string[] }) => {
      const id = newCustomBusId();
      setCustomBuses((list) => [
        ...list,
        {
          id,
          name: opts.name.trim() || "Effect bus",
          color: opts.color,
          volume: 1,
          muted: false,
          template: opts.template?.name,
        },
      ]);
      if (opts.template) {
        const plugins = templatePlugins(opts.template, installedPluginsRef.current);
        setFxChains((c) => ({ ...c, [`bus:${id}`]: plugins }));
      }
      if (opts.memberIds?.length) setBusMembers(id, opts.memberIds);
      return id;
    },
    [setBusMembers],
  );
  const removeCustomBus = useCallback((id: CustomBusId) => {
    setTracks((ts) => ts.map((t) => (t.bus === id ? { ...t, bus: "master" } : t)));
    setFxChains((c) => {
      const { [`bus:${id}`]: _gone, ...rest } = c;
      return rest;
    });
    setCustomBuses((list) => list.filter((b) => b.id !== id));
  }, []);

  // Arming an audio channel opens the microphone so its meter moves and, when
  // monitoring is on, you hear yourself. Recording is a separate step.
  const armedInputId =
    tracks.find(
      (t) => t.armed && (t.kind === "audio" || t.kind === "ai-vocal" || t.kind === "sampler"),
    )?.id ?? null;
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

  // Recording input changes and losses: switch an armed channel to the newly chosen input,
  // and if the interface is unplugged mid-take, stop and keep what was recorded.
  const armedInputRef = useRef(armedInputId);
  armedInputRef.current = armedInputId;
  const monitorOnRef = useRef(monitorOn);
  monitorOnRef.current = monitorOn;
  const endRecordingRef = useRef<((rewind?: boolean | number) => Promise<void>) | null>(null);
  useEffect(() => {
    const reopen = () => {
      const engine = getEngine();
      const id = armedInputRef.current;
      if (!id || engine.isRecording) return;
      engine.stopInputMonitoring();
      void engine.startInputMonitoring(id, monitorOnRef.current).catch((err: unknown) =>
        toast.error("Microphone unavailable", {
          description: err instanceof Error ? err.message : undefined,
        }),
      );
    };
    const onChanged = () => {
      if (getEngine().isRecording)
        toast("New input applies after this take", {
          description: "The take in progress keeps recording from the current input.",
        });
      else reopen();
    };
    const onLost = (e: Event) => {
      const { owner, label } = (e as CustomEvent<{ owner?: string; label?: string }>).detail ?? {};
      if (owner !== "timeline") return;
      const engine = getEngine();
      if (engine.isRecording) {
        toast.error("Audio input disconnected — recording stopped", {
          description: `${label || "The input"} went away. The take up to that point was kept. Reconnect it and press record again.`,
          duration: 10000,
        });
        void endRecordingRef.current?.(false).finally(reopen);
      } else {
        toast.warning("Audio input disconnected", {
          description: `${label || "The input"} went away. Reconnect it, or choose another input in Settings → Audio.`,
        });
        reopen();
      }
    };
    const onFallback = (e: Event) => {
      const { label } = (e as CustomEvent<{ label?: string }>).detail ?? {};
      toast.warning("Your chosen input isn't connected", {
        description: `Using ${label || "the default input"} instead. Pick another in Settings → Audio.`,
      });
    };
    window.addEventListener(INPUT_CHANGED_EVENT, onChanged);
    window.addEventListener(INPUT_LOST_EVENT, onLost);
    window.addEventListener(INPUT_FALLBACK_EVENT, onFallback);
    return () => {
      window.removeEventListener(INPUT_CHANGED_EVENT, onChanged);
      window.removeEventListener(INPUT_LOST_EVENT, onLost);
      window.removeEventListener(INPUT_FALLBACK_EVENT, onFallback);
    };
  }, []);

  const finishRecording = useCallback(async () => {
    const engine = getEngine();
    if (!engine.isRecording) return;
    const target = tracksRef.current.find(
      (t) => t.recording && (t.kind === "audio" || t.kind === "ai-vocal" || t.kind === "sampler"),
    );
    let result: Awaited<ReturnType<typeof engine.stopInputRecording>> = null;
    const recStartedAt = engine.recStartedAt;
    const preRoll = micPreRollRef.current;
    micPreRollRef.current = false;
    try {
      result = await engine.stopInputRecording();
    } catch (err) {
      markTakeFailed();
      toast.error("Take couldn't be kept", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
    if (!target) return;
    if (!result) {
      updateTrack(target.id, { recording: false });
      return;
    }
    const takeNo = (target.clips?.length ?? 0) + 1;
    // place the take where the recorder truly began (heard position), minus mic input delay
    const measured = recAudioStartRef.current;
    recAudioStartRef.current = null;
    const song = songStartRef.current;
    if (preRoll && measured == null && !song) {
      // Stopped during the count-in: the song never started, so there is no take.
      updateTrack(target.id, { recording: false });
      return;
    }
    // The recorder ran before the song started (count-in / opened before playback):
    // skip the lead-in so what was sung on beat 1 sits on beat 1.
    const aligned =
      preRoll && measured == null && song && song.time >= recStartedAt
        ? preRollTake(
            song.step,
            song.time + outputDelay(engine.ctx),
            recStartedAt,
            result.duration,
            getInputLatencyMs() / 1000,
          )
        : alignedTake(
            measured ?? snapRecStart(recStartStepRef.current, transportRef.current.snap),
            result.duration,
            getInputLatencyMs() / 1000,
          );
    const clip: AudioClip = {
      id: uid(),
      name: `TAKE ${takeNo}`,
      peaks: result.peaks,
      duration: result.duration,
      url: result.url,
      start: aligned.start,
      offset: aligned.offset,
      length: Math.min(
        aligned.length,
        Math.max(0, loopRegion(transportRef.current)[1] - aligned.start) *
          stepSeconds(transportRef.current.bpm),
      ),
      gain: 1,
    };
    const replace = !!transportRef.current.replace;
    const stepDur = 60 / (transportRef.current.bpm || 120) / 4;
    const passes = loopPassesRef.current;
    loopPassesRef.current = 0;
    if (passes > 0 && transportRef.current.loop) {
      // One continuous recording across loop passes: cut it into one take per pass.
      const [lo, hi] = loopRegion(transportRef.current);
      const windows = splitLoopPasses({
        start: aligned.start,
        offset: aligned.offset,
        duration: result.duration,
        lo,
        hi,
        stepDur,
      });
      if (windows.length > 1) {
        const shown = shownPassIndex(windows, lo, hi, stepDur);
        const takes = windows.map((w, k) => ({
          ...clip,
          id: uid(),
          name: `TAKE ${takeNo} · PASS ${k + 1}`,
          start: w.start,
          offset: w.offset,
          length: w.length,
        }));
        const top = { ...takes[shown]! };
        const others = takes.filter((_, k) => k !== shown).reverse();
        const end = (top.start ?? 0) + (hi - (top.start ?? 0));
        const oldClips = target.clips ?? [];
        const kept = replace ? replaceTakeRegion(oldClips, lo, end, stepDur) : oldClips;
        top.alts = [...others, ...(replace ? coveredTakes(oldClips, lo, end, stepDur) : [])].slice(
          0,
          12,
        );
        setTracks((ts) =>
          ts.map((t) =>
            t.id === target.id
              ? { ...t, recording: false, clips: [...kept, top], activeClipId: top.id }
              : t,
          ),
        );
        toast.success(`${windows.length} takes recorded on ${target.name}`, {
          description: `Showing pass ${shown + 1}. Pick another pass from the clip's takes — Undo brings back what was there before.`,
        });
        return;
      }
    }
    const newEnd = (clip.start ?? 0) + (clip.length ?? clip.duration) / stepDur;
    const oldClips = target.clips ?? [];
    const kept = replace ? replaceTakeRegion(oldClips, clip.start ?? 0, newEnd, stepDur) : oldClips;
    if (replace) {
      const alts = coveredTakes(oldClips, clip.start ?? 0, newEnd, stepDur);
      if (alts.length) clip.alts = alts;
    }
    const replaced = oldClips.filter(
      (c) =>
        (c.start ?? 0) < newEnd &&
        (c.start ?? 0) + (c.length ?? c.duration) / clipRate(c) / stepDur > (clip.start ?? 0),
    ).length;
    setTracks((ts) =>
      ts.map((t) =>
        t.id === target.id
          ? { ...t, recording: false, clips: [...kept, clip], activeClipId: clip.id }
          : t,
      ),
    );
    toast.success(`${clip.name} recorded on ${target.name}`, {
      description: replace
        ? `${result.duration.toFixed(1)}s captured — replaced ${replaced} overlapping take${replaced === 1 ? "" : "s"} in the recorded region. Undo brings them back.`
        : `${result.duration.toFixed(1)}s captured — pick your best take on the track.`,
    });
  }, [updateTrack]);

  /**
   * Lands a synth take: the notes you played are the take. Its waveform is rendered offline from
   * those notes (every overdub pass included) through a flat copy of the channel, so playing the
   * block back through the real channel sounds like the notes once — no doubled effects or fader.
   */
  const landMidiTake = useCallback(
    async (take: { trackId: string; passes: number }, heardEnd: number) => {
      // state updates from note-offs/held notes must reach tracksRef before reading it
      await new Promise((r) => window.setTimeout(r, 0));
      const target = tracksRef.current.find((t) => t.id === take.trackId);
      if (!target) return;
      const tp = transportRef.current;
      const stepDur = stepSeconds(tp.bpm);
      const [lo, hi] = loopRegion(tp);
      const captured = recordedNoteIdsRef.current;
      const replacedIds = replacedNoteIdsRef.current;
      const start =
        take.passes > 0 ? lo : Math.max(lo, Math.min(hi - 1, Math.floor(recStartStepRef.current)));
      const rawEnd = take.passes > 0 ? hi : Math.max(start + 1, Math.ceil(heardEnd));
      const end = Math.min(hi, Math.ceil(rawEnd / STEPS_PER_BEAT) * STEPS_PER_BEAT);
      const barSteps = stepsPerBar();
      const notes = (target.notes ?? [])
        .filter((n) => !replacedIds.has(n.id))
        .map((n) =>
          captured.has(n.id)
            ? {
                ...n,
                recordedEnd: end,
                length: Math.max(0.25, Math.min(n.length, end - n.step)),
              }
            : n,
        );
      const lastCaptured = notes.reduce(
        (m, n) => (captured.has(n.id) ? Math.max(m, Math.floor(n.step) + 1) : m),
        0,
      );
      const steps =
        lastCaptured > target.steps ? Math.ceil(end / barSteps) * barSteps : target.steps;
      const played = notes.some((n) => captured.has(n.id));
      const inRegion = notes.some((n) => n.step < end && n.step + n.length > start);
      const landNotesOnly = (printedAudio: boolean) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === take.trackId ? { ...t, notes, steps, recording: false, printedAudio } : t,
          ),
        );
      if (!played && !replacedIds.size) {
        landNotesOnly(!!target.printedAudio);
        toast("No notes were played", { description: `Nothing was recorded on ${target.name}.` });
        return;
      }
      if (!inRegion || isExternal(target.id)) {
        // nothing left to draw (or the sound comes from outside hardware): the notes are the take
        landNotesOnly(false);
        toast.success(`${target.name} notes recorded`);
        return;
      }
      const flat: Track = {
        ...target,
        notes,
        steps,
        volume: 1,
        gain: 1,
        pan: 0,
        plugins: [],
        sends: { reverb: 0, delay: 0, chorus: 0 },
        automation: [],
        muted: false,
        solo: false,
        deviceBypassed: false,
        frozen: false,
        printedAudio: false,
        clips: [],
        recording: false,
        bus: "master",
        vca: undefined,
        muteEvents: undefined,
        soloEvents: undefined,
      };
      const engine = getEngine();
      const ctx = engine.init();
      const { renderSong } = await import("./song-render");
      const cap = await renderSong({
        tracks: [flat],
        transport: tp,
        buses: {},
        vcas: {},
        auxReturns: {},
        fxChains: {},
        startStep: start,
        lengthSteps: end - start,
        tail: 0,
        sampleRate: ctx.sampleRate,
      });
      if (!cap) {
        landNotesOnly(false);
        toast.success(`${target.name} notes recorded`, {
          description: "This browser can't draw the waveform; the notes play the part.",
        });
        return;
      }
      const url = URL.createObjectURL(encodeWav(cap));
      await engine.ensureBuffer(url);
      const frames = cap.left.length;
      const duration = frames / cap.sampleRate;
      const buckets = Math.min(1600, Math.max(160, Math.ceil(duration * 80)));
      const peaks = Array.from({ length: buckets }, (_, b) => {
        const from = Math.floor((b * frames) / buckets);
        const to = Math.floor(((b + 1) * frames) / buckets);
        let peak = 0;
        for (let i = from; i < to; i++)
          peak = Math.max(peak, Math.abs(cap.left[i] ?? 0), Math.abs(cap.right[i] ?? 0));
        return peak;
      });
      const latest = tracksRef.current.find((t) => t.id === take.trackId) ?? target;
      const clip: AudioClip = {
        id: uid(),
        name: `${target.name} TAKE ${(latest.clips?.length ?? 0) + 1}`,
        peaks,
        duration,
        url,
        start,
        offset: 0,
        length: Math.min(duration, (end - start) * stepDur),
        gain: 1,
      };
      // The rendered take already holds every note in its bars, so older takes there step aside
      // (kept as alternatives on the new block) instead of stacking and doubling.
      const alts = coveredTakes(latest.clips ?? [], start, end, stepDur);
      pickupClipIdsRef.current.add(clip.id);
      setTracks((ts) =>
        ts.map((t) =>
          t.id === take.trackId
            ? {
                ...t,
                notes,
                steps,
                recording: false,
                clips: [
                  ...replaceTakeRegion(t.clips ?? [], start, end, stepDur),
                  alts.length ? { ...clip, alts } : clip,
                ],
                activeClipId: clip.id,
                printedAudio: true,
              }
            : t,
        ),
      );
      toast.success(`${clip.name} recorded`, {
        description:
          take.passes > 0
            ? `${take.passes + 1} passes layered into one take. Delete the block to remove its notes too.`
            : "Double-click the waveform to edit it; switch to Notes to edit the pattern.",
      });
    },
    [],
  );

  const finishTrackRecording = useCallback(async () => {
    const engine = getEngine();
    /** Nothing more is pending for this pass: let notes and hits play normally again. */
    const releaseTake = () => {
      // clear after the landed take has rendered, so no scheduler pass sees the
      // notes un-skipped while the printed audio is not in place yet
      const token = ++takeTokenRef.current;
      window.setTimeout(() => {
        if (token !== takeTokenRef.current) return;
        recordedNoteIdsRef.current = new Map();
        replacedNoteIdsRef.current = new Set();
        clearLiveHits();
      }, 80);
      setTracks((ts) =>
        ts.map((t) =>
          t.recording && (t.kind === "instrument" || t.kind === "midi" || t.kind === "drum")
            ? { ...t, recording: false }
            : t,
        ),
      );
    };
    const midiTake = midiTakeRef.current;
    if (!engine.isTrackRecording && !midiTake) {
      releaseTake();
      return;
    }
    // Held MIDI notes cannot extend past the end of the recorded region:
    // the loop end when looping, otherwise where the transport stopped.
    const tp = transportRef.current;
    const endStep = loopEndStepRef.current ?? tp.step;
    const regionEnd =
      tp.loop && (tp.loopEnd ?? 0) > (tp.loopStart ?? 0) ? (tp.loopEnd ?? 0) : endStep;
    for (const [pitch, held] of heldRef.current) {
      heldRef.current.delete(pitch);
      const end = regionEnd >= held.startStep ? regionEnd : regionEnd + songSteps(tp.bars);
      const length = Math.max(0.25, end - held.startStep);
      setTracks((ts) =>
        ts.map((t) =>
          t.id === held.trackId
            ? {
                ...t,
                notes: (t.notes ?? []).map((n) => (held.ids.includes(n.id) ? { ...n, length } : n)),
              }
            : t,
        ),
      );
    }
    if (midiTake) {
      try {
        await landMidiTake(
          midiTake,
          loopEndStepRef.current ?? (tp.playing ? getPlayStep() : endStep),
        );
      } catch (err) {
        markTakeFailed();
        toast.error("Take couldn't be kept", {
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        midiTakeRef.current = null;
        releaseTake();
      }
      return;
    }
    let landed = false;
    const printStartedAt = engine.trackRecStartedAt;
    const printPreRoll = printPreRollRef.current;
    printPreRollRef.current = false;
    try {
      const result = await engine.stopTrackRecording();
      if (!result) return;
      const target = tracksRef.current.find((t) => t.id === result.trackId);
      if (!target) return;
      const stepDur = stepSeconds(transportRef.current.bpm);
      const takeEnd = Math.min(
        loopRegion(transportRef.current)[1],
        recStartStepRef.current + Math.max(1, Math.ceil(result.duration / stepDur)),
      );
      const capturedIds = recordedNoteIdsRef.current;
      // Replace mode: older notes under the new take are removed, so the part
      // is exactly what was just played (overdub keeps them).
      const replacedIds = replacedNoteIdsRef.current;
      // The print started just before the song: trim that lead-in so the waveform lines up with the notes.
      const song = songStartRef.current;
      const pre =
        printPreRoll && song && song.time >= printStartedAt
          ? preRollTake(song.step, song.time, printStartedAt, result.duration, 0)
          : null;
      const s0 = pre ? pre.start : snapRecStart(recStartStepRef.current, transportRef.current.snap);
      const lead = pre ? pre.offset : 0;
      const clip: AudioClip = {
        id: uid(),
        name: `${target.name} TAKE ${(target.clips?.length ?? 0) + 1}`,
        peaks: result.peaks,
        duration: result.duration,
        url: result.url,
        start: s0,
        offset: lead,
        // a looped take never runs past the loop end (its tail would overlap the next pass)
        length: (() => {
          const tpl = transportRef.current;
          const playable = Math.max(0, result.duration - lead);
          if (!tpl.loop || (tpl.loopEnd ?? 0) <= s0) return playable;
          return Math.min(playable, ((tpl.loopEnd ?? 0) - s0) * stepDur);
        })(),
        gain: 1,
      };
      // Keep the editable notes/steps intact. The printed audio takes their place
      // during playback until the user explicitly switches back to the pattern.
      // Only the explicit overdub mode should stack printed takes at the same position.
      const replace = !!transportRef.current.replace || !transportRef.current.overdub;
      const newEnd = (clip.start ?? 0) + (clip.length ?? clip.duration) / stepDur;
      const barSteps = stepsPerBar();
      // the printed take starts mid-pass: the scheduler picks it up where the playhead is
      pickupClipIdsRef.current.add(clip.id);
      setTracks((ts) =>
        ts.map((t) => {
          if (t.id !== result.trackId) return t;
          const notes = (t.notes ?? [])
            .filter((n) => !replacedIds.has(n.id))
            .map((n) =>
              capturedIds.has(n.id)
                ? {
                    ...n,
                    recordedEnd: takeEnd,
                    length: Math.max(0.25, Math.min(n.length, takeEnd - n.step)),
                  }
                : n,
            );
          // A take longer than the pattern would otherwise wrap and replay its
          // own notes every pattern length — grow the pattern to hold the take.
          const lastCaptured = notes.reduce(
            (m, n) => (capturedIds.has(n.id) ? Math.max(m, Math.floor(n.step) + 1) : m),
            0,
          );
          const steps =
            t.kind !== "drum" && lastCaptured > t.steps
              ? Math.ceil(takeEnd / barSteps) * barSteps
              : t.steps;
          const alts = replace ? coveredTakes(t.clips ?? [], clip.start ?? 0, newEnd, stepDur) : [];
          return {
            ...t,
            notes,
            steps,
            recording: false,
            clips: [
              ...(replace
                ? replaceTakeRegion(t.clips ?? [], clip.start ?? 0, newEnd, stepDur)
                : (t.clips ?? [])),
              alts.length ? { ...clip, alts } : clip,
            ],
            // When notes were played, the editable notes stay what you hear (piano roll
            // edits change the sound); the audio take is kept under WAVE.
            activeClipId: clip.id,
            printedAudio: true,
          };
        }),
      );
      landed = true;
      toast.success(`${clip.name} recorded`, {
        description: "Double-click the waveform to edit it; switch to Notes to edit the pattern.",
      });
    } catch (err) {
      markTakeFailed();
      toast.error("Take couldn't be kept", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      releaseTake();
      if (!landed) pickupClipIdsRef.current.clear();
    }
  }, [landMidiTake]);

  const finalizeRecording = useMemo(
    () =>
      createRecordingFinalizer(
        () => pendingInputStartRef.current,
        async () => {
          await Promise.all([finishRecording(), finishTrackRecording()]);
        },
      ),
    [finishRecording, finishTrackRecording],
  );

  /** `rewind`: true stops and returns to the start; a step number stops and parks the playhead there. */
  const endRecording = useCallback(
    async (rewind: boolean | number = false) => {
      const stopping = rewind !== false;
      recordingGenerationRef.current += 1;
      finalizingRef.current = true;
      if (countInTimerRef.current != null) window.clearInterval(countInTimerRef.current);
      countInTimerRef.current = null;
      transportRef.current = {
        ...transportRef.current,
        playing: stopping ? false : transportRef.current.playing,
        recording: false,
        countInLeft: null,
      };
      setTransportState(transportRef.current);
      try {
        await finalizeRecording();
      } finally {
        finalizingRef.current = false;
        loopEndStepRef.current = null;
        setTracks((ts) => ts.map((t) => (t.recording ? { ...t, recording: false } : t)));
        if (stopping)
          setTransportState((s) => ({
            ...s,
            playing: false,
            paused: false,
            step: typeof rewind === "number" ? rewind : 0,
          }));
      }
    },
    [finalizeRecording],
  );
  endRecordingRef.current = endRecording;

  // keep the punch hooks pointing at the current record helpers
  useEffect(() => {
    punchRef.current = {
      start: (at: number) => {
        const engine = getEngine();
        if (engine.isRecording || engine.isTrackRecording || midiTakeRef.current) return;
        const target = tracksRef.current.find(
          (t) => t.armed && (t.kind === "audio" || t.kind === "ai-vocal"),
        );
        if (!target) {
          // Instrument, drum and sampler channels punch in too: notes and their printed take start at the marker.
          const note = tracksRef.current.find(
            (t) =>
              t.armed &&
              (t.kind === "instrument" ||
                t.kind === "midi" ||
                t.kind === "drum" ||
                t.kind === "sampler"),
          );
          if (!note) return;
          recStartStepRef.current = at;
          const tpr = transportRef.current;
          const to =
            tpr.punchOut != null && tpr.punchOut > at ? tpr.punchOut : Number.POSITIVE_INFINITY;
          replacedNoteIdsRef.current =
            tpr.overdub && !tpr.replace
              ? new Set()
              : new Set(
                  (note.notes ?? []).filter((n) => n.step >= at && n.step < to).map((n) => n.id),
                );
          printPreRollRef.current = false;
          if (synthTake(note)) midiTakeRef.current = { trackId: note.id, passes: 0 };
          else
            try {
              engine.startTrackRecording(note.id);
            } catch (err) {
              toast.error("Could not record this channel", {
                description: err instanceof Error ? err.message : undefined,
              });
              return;
            }
          updateTrack(note.id, { recording: true });
          setTransportState((s) => ({ ...s, recording: true }));
          return;
        }
        recStartStepRef.current = at;
        loopPassesRef.current = 0;
        micPreRollRef.current = false;
        const generation = recordingGenerationRef.current;
        updateTrack(target.id, { recording: true });
        pendingInputStartRef.current = engine
          .startInputRecording(target.id, transportRef.current.monitor ?? false)
          .then(() => {
            if (generation !== recordingGenerationRef.current) return;
            recAudioStartRef.current = transportRef.current.playing ? heardStepPos() : null;
            setTransportState((t) => ({ ...t, recording: true }));
          })
          .catch((err: unknown) => {
            updateTrack(target.id, { recording: false });
            toast.error("Microphone unavailable", {
              description: err instanceof Error ? err.message : undefined,
            });
          });
      },
      stop: () => {
        void endRecording();
      },
    };
    loopStopRef.current = (ending = false) => {
      const engine = getEngine();
      const audio = engine.isRecording;
      const inst = engine.isTrackRecording;
      const midi = midiTakeRef.current;
      const tpl = transportRef.current;
      if (!audio && !inst && !midi) {
        // the next pass was already held back: never leave the song "playing" in silence
        if (ending) void endRecording(loopRegion(tpl)[0]);
        return;
      }
      if (!ending && recordingKeepsLooping()) {
        // Overdub keeps going round the loop: a synth layers each pass on top of what you played,
        // a microphone take keeps recording and each pass becomes its own take.
        if (midi) {
          midi.passes += 1;
          if (midi.passes === 1 && !audio)
            toast("Overdubbing the next pass", {
              description:
                "What you just played keeps playing — add more on top. Press Stop when you're done.",
            });
        }
        if (audio) {
          loopPassesRef.current += 1;
          if (loopPassesRef.current === 1)
            toast("Recording the next pass", {
              description:
                "Each time round the loop is kept as its own take. Press Stop when you're done.",
            });
        }
        return;
      }
      // Replace (and printed drum/instrument takes): the take ends at the loop end and playback
      // stops with it, so what you just recorded never starts playing back on its own.
      const [lo, hi] = loopRegion(tpl);
      loopEndStepRef.current = hi;
      stopLiveArps();
      releaseLatched();
      void endRecording(lo);
      toast("Recording stopped at the loop end", {
        description: "Playback stopped too. Press Play to hear your take.",
      });
    };
  }, [finishRecording, finishTrackRecording, updateTrack, endRecording]);

  /** Copy what the timeline shows on one channel: the full drum beat / every synth repeat in view. */
  const copyEntry = (src: Track) => {
    const tp = transportRef.current;
    const boxed = boxSpansRef.current.get(src.id);
    if (boxed) {
      const part = copyPartSpan(cloneTrack(src), boxed, stepSeconds(tp.bpm));
      return { trackId: src.id, track: part.track, span: part.span as [number, number] | null };
    }
    const track = cloneTrack(src);
    let span: [number, number] | null = null;
    const shown: [number, number] = tp.loop ? loopRegion(tp) : [0, songSteps(tp.bars)];
    if (
      src.kind === "drum" &&
      !src.printedAudio &&
      src.pads?.some((p) => p.steps.some((v) => v > 0))
    ) {
      track.patternRegion = drumCopySpan(src, shown);
    } else if (!src.printedAudio && src.notes?.length) {
      const copy = noteCopy(src, shown);
      if (copy) {
        track.notes = copy.notes;
        span = copy.span;
      }
    }
    return { trackId: src.id, track, span };
  };
  const fillClipboard = (
    entries: { trackId: string; track: Track; span: [number, number] | null }[],
  ) => {
    const first = entries[0]!;
    clipboardRef.current = first.track;
    clipboardSpanRef.current = first.span;
    multiClipboardRef.current = entries.length > 1 ? entries : null;
    clipClipboardRef.current = null;
    setClipClipboardName(null);
    const name = entries.length > 1 ? `${entries.length} tracks` : first.track.name;
    setClipboardName(name);
    return name;
  };
  /** Channels in timeline order, so a multi-track paste keeps them top to bottom. */
  const pickTracks = (ids: string[]) => tracksRef.current.filter((t) => ids.includes(t.id));
  const copyTracksImpl = (ids: string[]) => {
    const picked = pickTracks(ids);
    if (!picked.length) return;
    const name = fillClipboard(picked.map(copyEntry));
    toast("Copied", {
      description: `${name} on the clipboard — move the playhead and press ⌘V / Ctrl+V to paste.`,
    });
  };
  const cutTracksImpl = (ids: string[]) => {
    const picked = pickTracks(ids);
    if (!picked.length) return;
    // Cut takes the material, never the channel: the instrument stays so you can keep playing it.
    const tp = transportRef.current;
    const patches = new Map<string, Partial<Track>>();
    const entries = picked.map((src) => {
      const { clipboard, patch, span } = cutTrackMaterial(
        src,
        tp.bpm,
        tp.bars,
        tp.loop ? loopRegion(tp) : undefined,
        boxSpansRef.current.get(src.id),
      );
      patches.set(src.id, patch);
      const noteSpan =
        span && clipboard.notes?.length && !clipboard.pads?.some((p) => p.steps.some((v) => v > 0))
          ? span
          : null;
      return { trackId: src.id, track: clipboard, span: noteSpan };
    });
    const name = fillClipboard(entries);
    for (const src of picked) boxSpansRef.current.delete(src.id);
    setTracks((ts) => ts.map((t) => (patches.has(t.id) ? { ...t, ...patches.get(t.id) } : t)));
    toast("Cut", {
      description: `${name} — the channels stay; the cut parts are on the clipboard.`,
    });
  };
  /** Paste every copied track back onto its own channel, all lined up at one spot. */
  const pasteManyImpl = (destinationStep?: number, atEnd = false) => {
    const entries = multiClipboardRef.current;
    if (!entries?.length) return;
    const tp = transportRef.current;
    const at = livePasteStep(tp.playing ? getPlayStep() : tp.step, !!tp.playing, destinationStep);
    const origins = entries.map((e) => clipboardOrigin(e.track, e.span));
    const stepDur = stepSeconds(tp.bpm);
    // At end: the copies stay lined up as copied, right after the channels' last parts, so the loops stay in time.
    const steps = atEnd
      ? pasteEndSteps(
          origins,
          entries.map((entry) => {
            const target = tracksRef.current.find((t) => t.id === entry.trackId);
            return target ? pasteEndStep(target, stepDur, songSteps(tp.bars)) : at;
          }),
        )
      : multiPasteSteps(origins, at);
    const pasted = new Map<string, Track>();
    const added: Track[] = [];
    entries.forEach((entry, i) => {
      const target = tracksRef.current.find((t) => t.id === entry.trackId);
      if (target) {
        pasted.set(
          target.id,
          pasteTrackContent(target, entry.track, steps[i] ?? at, stepDur, {
            shownEnd: songSteps(tp.bars),
            ...(entry.span ? { origin: entry.span[0], length: entry.span[1] - entry.span[0] } : {}),
          }),
        );
        return;
      }
      // The original channel was deleted: bring it back as a copy.
      const copy: Track = {
        ...cloneTrack(entry.track),
        id: uid(),
        name: `${entry.track.name} COPY`,
        recording: false,
      };
      if (copy.pads) copy.pads = copy.pads.map((p) => ({ ...p, id: uid() }));
      if (copy.notes) copy.notes = copy.notes.map((n) => ({ ...n, id: uid() }));
      if (copy.clips) copy.clips = copy.clips.map((c) => ({ ...c, id: uid() }));
      if (copy.plugins) copy.plugins = copy.plugins.map((p) => ({ ...p, id: uid() }));
      copy.activeClipId = copy.clips?.[0]?.id;
      added.push(copy);
    });
    setTracks((ts) => [...ts.map((t) => pasted.get(t.id) ?? t), ...added]);
    const end = Math.max(0, ...[...pasted.values()].map((t) => materialEnd(t, stepDur)));
    setTransportState((s) => ({ ...s, bars: Math.max(s.bars, barsForSteps(end)) }));
    toast.success(`Pasted ${entries.length} tracks`, {
      description: atEnd
        ? `Right after the last part, lined up at bar ${Math.floor(Math.min(...steps) / stepsPerBar()) + 1}.`
        : `At bar ${Math.floor(at / stepsPerBar()) + 1}, each on its own channel.`,
    });
  };

  /** Cut clips under a timeline position (steps). Each half keeps the right audio via offset/length and its own start. */
  const razorAtImpl = useCallback(
    (trackId: string, posSteps: number, quiet = false) => {
      const t = tracksRef.current.find((x) => x.id === trackId);
      const clips = t?.clips ?? [];
      const trackNotes = t?.notes ?? [];
      if (!t) return false;

      // Note channels (synth, MIDI, sampler notes) are cut into separate regions like a DAW part.
      if (!timelineUsesWaveform(t) && trackNotes.length > 0) {
        const total = songSteps(transportRef.current.bars);
        const len = Math.max(1, t.steps || stepsPerBar());
        const unrolled = len < total;
        const base = unrolled ? unrollNotes(trackNotes, len, total) : trackNotes;
        const { notes: nextNotes, cut: cutNotes } = cutNotesAt(base, posSteps);
        const cuts = addCut(t.cuts, posSteps, total);
        updateTrack(trackId, {
          notes: nextNotes,
          cuts,
          activeRegion: posSteps,
          ...(unrolled ? { steps: total } : {}),
        });
        const dropRegion = (side: "left" | "right") => {
          const cur = tracksRef.current.find((x) => x.id === trackId);
          if (!cur) return;
          const region = regionAt(
            cur.cuts,
            total,
            side === "right" ? posSteps : Math.max(0, posSteps - 0.01),
          );
          updateTrack(trackId, {
            notes: deleteRegion(cur.notes ?? [], region),
            activeRegion: undefined,
          });
          toast.success(`Deleted the ${side} part`);
        };
        if (!quiet)
          toast.success(cutNotes ? `Cut ${cutNotes} note${cutNotes > 1 ? "s" : ""}` : "Part cut", {
            description:
              "The right part is outlined in white. Tap its bin icon or press Delete to remove it.",
            duration: 10000,
            action: { label: "Delete right", onClick: () => dropRegion("right") },
            cancel: { label: "Delete left", onClick: () => dropRegion("left") },
          });
        return true;
      }

      // Drum channels: write the looping beat out across the song, then cut it into separate parts.
      const pads = t.pads ?? [];
      if (
        !timelineUsesWaveform(t) &&
        t.kind === "drum" &&
        pads.some((p) => p.steps.some((v) => v > 0))
      ) {
        const total = songSteps(transportRef.current.bars);
        const len = Math.max(1, pads[0]?.steps.length ?? 16);
        const unrolled = pads.map((p) =>
          len >= total
            ? p
            : { ...p, steps: Array.from({ length: total }, (_, i) => p.steps[i % len] ?? 0) },
        );
        const at = Math.round(posSteps);
        const cuts = addCut(t.cuts, at, total);
        updateTrack(trackId, {
          pads: unrolled,
          steps: Math.max(len, total),
          cuts,
          activeRegion: at,
        });
        const dropRegion = (side: "left" | "right") => {
          const cur = tracksRef.current.find((x) => x.id === trackId);
          if (!cur) return;
          const [a, b] = regionAt(cur.cuts, total, side === "right" ? at : Math.max(0, at - 0.01));
          updateTrack(trackId, {
            pads: (cur.pads ?? []).map((p) => ({
              ...p,
              steps: p.steps.map((v, i) => (i >= a && i < b ? 0 : v)),
            })),
            activeRegion: undefined,
          });
          toast.success(`Deleted the ${side} part`);
        };
        if (!quiet)
          toast.success("Beat cut", {
            description:
              "The right part is outlined in white. Tap its bin icon or press Delete to remove it.",
            duration: 10000,
            action: { label: "Delete right", onClick: () => dropRegion("right") },
            cancel: { label: "Delete left", onClick: () => dropRegion("left") },
          });
        return true;
      }

      if (clips.length === 0) {
        toast("Nothing to cut", {
          description:
            "That channel has no audio or notes yet. Record, import or write something first.",
        });
        return false;
      }
      const stepDur = stepSeconds(transportRef.current.bpm);
      const stamp = Date.now();
      let sliced = 0;
      let newActive = t.activeClipId;
      const leftIds: string[] = [];
      const rightIds: string[] = [];
      const next = clips.flatMap((c) => {
        const start = c.start ?? 0;
        const lenSteps = clipSeconds(c) / stepDur;
        const posIn = posSteps - start;
        if (posIn <= 0.05 || posIn >= lenSteps - 0.05) return [c];
        sliced += 1;
        const rate = clipRate(c);
        const offset = c.offset ?? 0;
        const fileLen = c.length ?? Math.max(0, c.duration - offset);
        const cutFile = Math.min(fileLen, posIn * stepDur * rate);
        // Both pieces keep the source peaks; the timeline draws each piece's own offset/length window.
        const peaksSpan = peaksSpanOf(c);
        const first = {
          ...c,
          id: `${c.id}-a${stamp}`,
          name: `${c.name} A`,
          peaksSpan,
          length: cutFile,
          fadeOut: 0,
        } as AudioClip;
        const second = {
          ...c,
          id: `${c.id}-b${stamp}`,
          name: `${c.name} B`,
          peaksSpan,
          start: start + posIn,
          offset: offset + cutFile,
          length: fileLen - cutFile,
          fadeIn: 0,
        } as AudioClip;
        const [a, b2] = c.reverse
          ? [
              { ...first, offset: offset + (fileLen - cutFile) },
              { ...second, offset },
            ]
          : [first, second];
        leftIds.push(a.id);
        rightIds.push(b2.id);
        newActive = b2.id;
        return [a, b2];
      });
      if (sliced === 0) {
        if (!quiet)
          toast("Missed the clip", { description: "Tap inside a clip to cut it exactly there." });
        return false;
      }
      updateTrack(trackId, { clips: next, activeClipId: newActive });
      const dropClips = (ids: string[], keep: string[], label: string) => {
        const cur = tracksRef.current.find((x) => x.id === trackId);
        if (!cur) return;
        updateTrack(trackId, {
          clips: (cur.clips ?? []).filter((c) => !ids.includes(c.id)),
          activeClipId: keep[0],
        });
        toast.success(`Deleted the ${label} piece`);
      };
      toast.success(`Cut ${sliced} clip${sliced > 1 ? "s" : ""}`, {
        description: "The right piece is outlined in white. Delete either piece, or keep both.",
        duration: 10000,
        action: { label: "Delete right", onClick: () => dropClips(rightIds, leftIds, "right") },
        cancel: { label: "Delete left", onClick: () => dropClips(leftIds, rightIds, "left") },
      });
      return true;
    },
    [updateTrack],
  );

  /** Split tool: frac is the position across the whole song lane. */
  const splitClipAtImpl = useCallback(
    (trackId: string, frac: number) => {
      razorAtImpl(trackId, frac * songSteps(transportRef.current.bars));
    },
    [razorAtImpl],
  );

  const buildSnapshot = useCallback(
    (): CloudSession => ({
      version: 1,
      tracks: structuredClone(tracksRef.current),
      transport: {
        ...transportRef.current,
        playing: false,
        recording: false,
        paused: false,
        step: 0,
      },
      buses: structuredClone(buses),
      customBuses: structuredClone(customBuses),
      vcas: structuredClone(vcas),
      auxReturns: structuredClone(auxReturns),
      fxChains: structuredClone(fxChains),
      installedPlugins: structuredClone(installedPlugins),
      userPresets: structuredClone(userPresets),
      padBank: getPadBank(),
      sections: structuredClone(sectionsRef.current),
      folders: structuredClone(foldersRef.current),
      projectNotes: projectNotesRef.current,
    }),
    [buses, customBuses, vcas, auxReturns, fxChains, installedPlugins, userPresets],
  );

  const applySession = useCallback((session: CloudSession) => {
    getEngine().stopSamples();
    for (const track of tracksRef.current) getEngine().removeChannel(track.id);
    // VCAs now move their channels' faders; older saves stored a hidden VCA scale instead.
    const legacy = bakeLegacyVca(
      structuredClone(session.tracks),
      structuredClone(
        session.vcas ?? {
          A: { volume: 1, muted: false },
          B: { volume: 1, muted: false },
          C: { volume: 1, muted: false },
          D: { volume: 1, muted: false },
        },
      ),
    );
    vcaLinkMemoryRef.current.clear();
    setTracks(legacy.tracks);
    setCustomBuses(structuredClone(session.customBuses ?? []));
    setTransportState({
      ...session.transport,
      playing: false,
      recording: false,
      paused: false,
      step: 0,
    });
    setBuses(structuredClone(session.buses));
    setVcas(legacy.vcas);
    setAuxReturns(
      structuredClone(
        session.auxReturns ?? {
          reverb: { volume: 1, muted: false },
          delay: { volume: 1, muted: false },
          chorus: { volume: 1, muted: false },
        },
      ),
    );
    setFxChains(structuredClone(session.fxChains));
    setInstalledPlugins(structuredClone(session.installedPlugins));
    setUserPresets(structuredClone(session.userPresets));
    setPadBank(session.padBank ?? {});
    setSections(structuredClone(session.sections ?? []));
    setFolders(structuredClone(session.folders ?? []));
    setProjectNotes(session.projectNotes ?? "");
    setSelectedId(session.tracks[0]?.id ?? null);
    setSelectedIds(session.tracks[0] ? [session.tracks[0].id] : []);
    setPanel(null);
  }, []);

  const pendingHistoryRef = useRef<(() => void) | null>(null);
  // Record a history step, debounced so a drag or a knob sweep counts as one edit.
  // No automatic saving: the project is saved only when the user chooses File → Save.
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
    const commit = () => {
      pendingHistoryRef.current = null;
      const prev = lastSnapRef.current;
      if (prev) {
        pastRef.current = [...pastRef.current, prev].slice(-60);
        futureRef.current = [];
      }
      lastSnapRef.current = buildSnapshot();
      setHistoryTick((t) => t + 1);
    };
    const id = window.setTimeout(commit, 600);
    // Undo pressed straight after an edit commits that edit first, so it is the one undone.
    pendingHistoryRef.current = () => {
      window.clearTimeout(id);
      commit();
    };
    return () => {
      window.clearTimeout(id);
      if (pendingHistoryRef.current) pendingHistoryRef.current = null;
    };
  }, [
    tracks,
    buses,
    customBuses,
    vcas,
    auxReturns,
    fxChains,
    installedPlugins,
    userPresets,
    sections,
    folders,
    projectNotes,
    buildSnapshot,
  ]);

  // The Saved timestamp in the status bar only moves on a manual save
  // (File → Save / Save As dispatch "synclab:project-saved" on success).
  useEffect(() => {
    const onSaved = () => setSavedAt(Date.now());
    document.addEventListener("synclab:project-saved", onSaved);
    return () => document.removeEventListener("synclab:project-saved", onSaved);
  }, []);

  const api: StudioApi = useMemo(() => {
    const selected = tracks.find((t) => t.id === selectedId) ?? null;
    /** Writes a note into the armed recording track without sounding it. */
    const capture = (
      trackId: string,
      midi: number,
      velocity: number,
      seconds = PREVIEW_NOTE_SECONDS,
    ): MidiNote | null => {
      const tp = transportRef.current;
      const t = tracksRef.current.find((x) => x.id === trackId);
      if (!t || !tp.recording || !t.recording) return null;
      if (t.kind !== "instrument" && t.kind !== "midi" && t.kind !== "sampler") return null;
      // stamp the true sub-step position you heard, so the take keeps the
      // player's timing — quantize then has something real to snap
      const heard = heardStepPos();
      // Snap rec (on by default) puts the note on the nearest grid line, so the take
      // and its waveform start on the beat instead of just before or after it.
      const stepPos =
        tp.snapRecording === false
          ? heard
          : snapRecordedStep(
              heard,
              tp.quantize ?? 1,
              tp.loop ? loopRegion(tp) : [0, songSteps(tp.bars)],
              tp.loop,
            );
      // the note keeps the length it sounded live, so playback isn't chopped short (gated)
      const length = heardNoteSteps(seconds, stepSeconds(tp.bpm));
      const note = capturedNote(
        { id: uid(), step: Math.max(0, stepPos), length, pitch: midi, velocity },
        tp.loop ? loopRegion(tp) : [0, songSteps(tp.bars)],
      );
      if (!note) return null;
      recordedNoteIdsRef.current.set(note.id, getEngine().ctx?.currentTime ?? 0);
      setTracks((ts) =>
        ts.map((x) => (x.id === t.id ? { ...x, notes: [...(x.notes ?? []), note] } : x)),
      );
      return note;
    };
    const stepBack = (from: "past" | "future") => {
      if (from === "past") pendingHistoryRef.current?.();
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
      customBuses,
      allBuses: {
        ...buses,
        ...Object.fromEntries(customBuses.map((b) => [b.id, b])),
      },
      vcas,
      auxReturns,
      sections,
      projectNotes,
      setProjectNotes,
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
      setBus: setAnyBus,
      busStateOf,
      busName: (id) =>
        isCustomBusId(id) ? (customBuses.find((b) => b.id === id)?.name ?? "Effect bus") : id,
      addCustomBus,
      updateCustomBus: (id, patch) =>
        setCustomBuses((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b))),
      removeCustomBus,
      applyBusTemplate,
      setBusMembers,
      setVca: setVcaLinked,
      setAuxReturn: (id, patch) => setAuxReturns((a) => ({ ...a, [id]: { ...a[id], ...patch } })),
      addSection: (name, start, length) => {
        setSections((list) => {
          const sorted = [...list].sort((a, b) => a.start - b.start);
          const last = sorted[sorted.length - 1];
          const at = start ?? (last ? last.start + last.length : (transportRef.current.step ?? 0));
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
          if (gone)
            toast(`${gone.name} marker removed`, {
              description: "The audio on the timeline was left alone.",
            });
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
                  ...lane.points
                    .filter((pt) => pt.step >= from && pt.step < to)
                    .map((pt) => ({ ...pt, step: pt.step + len })),
                ].sort((a, b) => a.step - b.step),
              }));
            }
            return Object.keys(next).length ? { ...t, ...next } : t;
          }),
        );
        setSections((cur) => {
          const copy: SongSection = { ...sec, id: uid(), start: to };
          return [
            ...cur.map((s2) => (s2.start >= to ? { ...s2, start: s2.start + len } : s2)),
            copy,
          ].sort((a, b) => a.start - b.start);
        });
        const neededBars = barsForSteps(to + len);
        if (neededBars > (transportRef.current.bars ?? 4))
          setTransportState((t) => ({ ...t, bars: Math.min(512, neededBars) }));
        toast.success(`${sec.name} duplicated`, {
          description:
            copied > 0
              ? `${copied} clips and notes copied along with it.`
              : "The marker was copied — that part of the song was empty.",
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
        toast.success("Song structure laid out", {
          description: `${built.length} parts across ${bars} bars — rename or drag any of them.`,
        });
      },
      folders,
      addFolder: (name) => {
        const id = uid();
        setFolders((list) => [
          ...list,
          {
            id,
            name: (name ?? `FOLDER ${list.length + 1}`).toUpperCase().slice(0, 18),
            color: SECTION_COLORS[list.length % SECTION_COLORS.length] as string,
            collapsed: false,
          },
        ]);
        return id;
      },
      renameFolder: (id, name) =>
        setFolders((list) =>
          list.map((f) =>
            f.id === id ? { ...f, name: name.toUpperCase().slice(0, 18) || f.name } : f,
          ),
        ),
      removeFolder: (id) => {
        setFolders((list) => list.filter((f) => f.id !== id));
        setTracks((ts) => ts.map((t) => (t.folderId === id ? { ...t, folderId: undefined } : t)));
      },
      toggleFolderCollapsed: (id) =>
        setFolders((list) =>
          list.map((f) => (f.id === id ? { ...f, collapsed: !f.collapsed } : f)),
        ),
      assignTrackFolder: (trackId, folderId) =>
        setTracks((ts) =>
          ts.map((t) => (t.id === trackId ? { ...t, folderId: folderId ?? undefined } : t)),
        ),
      setPanel,
      select: (id) => {
        // Picking one channel (clicking a block, lane or name) replaces any earlier box selection,
        // so Copy/Cut act on what was just clicked instead of the old boxed bars.
        boxSpansRef.current.clear();
        setSelectedId(id);
        setSelectedIds([id]);
      },
      setEditTool,
      selectAll: () => {
        const ids = tracksRef.current.map((t) => t.id);
        setSelectedIds(ids);
        if (ids.length > 0) setSelectedId(ids[ids.length - 1] ?? null);
        toast("All channels selected", {
          description: `${ids.length} channels — delete or cut applies to the selection.`,
        });
      },
      selectBoxed: (picks, add) => {
        if (!picks.length) return;
        const ids = picks.map((p) => p.trackId);
        if (!add) boxSpansRef.current.clear();
        for (const p of picks) {
          if (!p.span) {
            boxSpansRef.current.delete(p.trackId);
            continue;
          }
          const was = add ? boxSpansRef.current.get(p.trackId) : undefined;
          boxSpansRef.current.set(
            p.trackId,
            was ? [Math.min(was[0], p.span[0]), Math.max(was[1], p.span[1])] : p.span,
          );
        }
        setSelectedIds((s) => (add ? [...new Set([...s, ...ids])] : ids));
        setSelectedId(ids[ids.length - 1] ?? null);
        const clipFor = new Map(picks.filter((p) => p.clipId).map((p) => [p.trackId, p.clipId]));
        if (clipFor.size)
          setTracks((ts) =>
            ts.map((t) => (clipFor.has(t.id) ? { ...t, activeClipId: clipFor.get(t.id) } : t)),
          );
      },
      paintSelectIds: (ids, anchorId) => {
        if (!ids.length) return;
        boxSpansRef.current.clear();
        setSelectedIds(ids);
        const keep = anchorId && ids.includes(anchorId) ? anchorId : ids[ids.length - 1];
        if (keep) setSelectedId(keep);
      },
      clearTimelineSelection: () => {
        boxSpansRef.current.clear();
        const keep = selectedIdRef.current;
        setSelectedIds((ids) =>
          ids.length === (keep ? 1 : 0) && (!keep || ids[0] === keep) ? ids : keep ? [keep] : [],
        );
        if (!tracksRef.current.some((t) => t.activeClipId != null || t.activeRegion != null))
          return;
        // Deselecting is not an edit: land any pending edit in history first, then skip this one.
        pendingHistoryRef.current?.();
        applyingRef.current = true;
        setTracks((ts) =>
          ts.map((t) =>
            t.activeClipId != null || t.activeRegion != null
              ? { ...t, activeClipId: undefined, activeRegion: undefined }
              : t,
          ),
        );
      },
      toggleSelectId: (id) =>
        setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
      splitClipAt: splitClipAtImpl,
      razorAt: razorAtImpl,
      splitAtPlayhead: () => {
        const id = selectedIdRef.current;
        if (!id) {
          toast("Select a channel first", {
            description: "Click the channel whose clip or notes you want to split.",
          });
          return;
        }
        razorAtImpl(id, transportRef.current.step ?? 0);
      },
      addTrack: (kind, name, preset, opts) => {
        const id = uid();
        setTracks((ts) => {
          // A track the user adds is armed right away (others disarm so one take goes to one place).
          // keepPanel callers (pad sampler, tape/sample exports) create channels for content, not recording.
          const autoArm = !opts?.keepPanel;
          const base = newTrack(kind, name ?? `TRACK ${ts.length + 1}`, ts.length, preset);
          const t = {
            ...base,
            id,
            ...(autoArm ? { armed: true } : {}),
            ...(isPadSamplerTrack(base) ? { padSampler: true } : {}),
          };
          setSelectedId(t.id);
          // keepPanel: the pad sampler and phone beat maker create their channel while the
          // user is playing — never navigate them away from what they are doing.
          if (!opts?.keepPanel) setPanel(editorPanelFor(t));
          return [...(autoArm ? ts.map((x) => (x.armed ? { ...x, armed: false } : x)) : ts), t];
        });
        return id;
      },
      updateTrack,
      swapTake: (trackId, clipId, altIndex) => {
        const stepDur = 60 / (transportRef.current.bpm || 120) / 4;
        setTracks((ts) =>
          ts.map((t) => {
            if (t.id !== trackId) return t;
            return {
              ...t,
              clips: (t.clips ?? []).map((c) => {
                if (c.id !== clipId || !c.alts?.[altIndex]) return c;
                const alt = c.alts[altIndex]!;
                const start = c.start ?? 0;
                const regionSec = (c.length ?? c.duration) / clipRate(c);
                const altRate = clipRate(alt);
                const into = Math.max(0, (start - (alt.start ?? 0)) * stepDur * altRate);
                const offset = (alt.offset ?? 0) + into;
                const length = Math.max(0.02, Math.min(regionSec * altRate, alt.duration - offset));
                const rest = c.alts.filter((_, i) => i !== altIndex);
                return {
                  ...alt,
                  id: c.id,
                  start,
                  offset,
                  length,
                  fadeIn: Math.min(0.01, length / 4),
                  fadeOut: Math.min(0.01, length / 4),
                  alts: [{ ...c, alts: undefined }, ...rest],
                };
              }),
            };
          }),
        );
        toast.success("Take swapped", {
          description: "This section now plays the earlier take. Pick again to switch back.",
        });
      },
      stretchClip: async (trackId, clipId, factor) => {
        if (!Number.isFinite(factor) || factor <= 0) return;
        const t = tracksRef.current.find((x) => x.id === trackId);
        const c = t?.clips?.find((x) => x.id === clipId);
        if (!t || !c?.url) return;
        const engine = getEngine();
        const buf = await engine.ensureBuffer(c.url);
        if (!buf) {
          toast.error("Couldn't read this clip's audio");
          return;
        }
        const id = toast.loading(`Stretching ${c.name}…`);
        await new Promise((r) => setTimeout(r, 30));
        const sr = buf.sampleRate;
        const from = Math.floor((c.offset ?? 0) * sr);
        const to = Math.min(buf.length, from + Math.floor((c.length ?? c.duration) * sr));
        const chan = (i: number) =>
          wsolaStretch(
            buf.getChannelData(Math.min(i, buf.numberOfChannels - 1)).slice(from, to),
            clipRate(c) / factor,
          );
        const left = chan(0);
        const right = buf.numberOfChannels > 1 ? chan(1) : left;
        const url = URL.createObjectURL(encodeWav({ left, right, sampleRate: sr }));
        const peaks: number[] = [];
        const size = Math.max(1, Math.floor(left.length / 160));
        for (let b = 0; b < 160; b++) {
          let p = 0;
          for (let i = b * size; i < Math.min(left.length, (b + 1) * size); i++)
            p = Math.max(p, Math.abs(left[i] ?? 0));
          peaks.push(p);
        }
        const duration = left.length / sr;
        setTracks((ts) =>
          ts.map((x) =>
            x.id !== trackId
              ? x
              : {
                  ...x,
                  clips: (x.clips ?? []).map((k) =>
                    k.id !== clipId
                      ? k
                      : {
                          ...k,
                          url,
                          cloudPath: undefined,
                          peaks,
                          duration,
                          offset: 0,
                          length: duration,
                          speed: 1,
                          pitch: 0,
                          fadeIn: Math.min(k.fadeIn ?? 0, duration / 2),
                          fadeOut: Math.min(k.fadeOut ?? 0, duration / 2),
                        },
                  ),
                },
          ),
        );
        setTransportState((tp) => ({
          ...tp,
          bars: Math.max(tp.bars, barsForSteps((c.start ?? 0) + duration / stepSeconds(tp.bpm))),
        }));
        toast.success(`Stretched to ${Math.round(factor * 100)}%`, {
          id,
          description: `${duration.toFixed(2)}s, pitch unchanged. Undo restores the original.`,
        });
      },
      clearTrackContent: (id) => {
        const src = tracksRef.current.find((t) => t.id === id);
        if (!src) return;
        setTracks((ts) =>
          ts.map((t) =>
            t.id !== id
              ? t
              : {
                  ...t,
                  clips: [],
                  notes: t.notes ? [] : t.notes,
                  pads: t.pads?.map((p) => ({ ...p, steps: p.steps.map(() => 0) })),
                  drumPatterns: t.drumPatterns?.map((pat) =>
                    pat.map((p) => ({ ...p, steps: p.steps.map(() => 0) })),
                  ),
                  activeClipId: undefined,
                  cuts: undefined,
                  activeRegion: undefined,
                  printedAudio: false,
                  recording: false,
                },
          ),
        );
        toast.success("Track cleared", {
          description: `${src.name} kept its channel — clips, notes and drum hits removed.`,
        });
      },
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
      moveTrackToIndex: (id, index) => setTracks((ts) => moveTrackToIndexIn(ts, id, index)),
      movePartToTrack: (srcId, destId, a, b, to) => {
        const r = movePartBetweenTracks(
          tracksRef.current,
          srcId,
          destId,
          a,
          b,
          to,
          songSteps(transportRef.current.bars),
        );
        if (!r) return null;
        tracksRef.current = r.tracks;
        setTracks(r.tracks);
        setSelectedId(destId);
        setSelectedIds([destId]);
        return { unmatched: r.unmatched };
      },
      moveClipToNew: (trackId, clipId, sourceStart) => {
        setTracks((ts) => {
          const result = moveClipToNewIn(
            ts,
            trackId,
            clipId,
            sourceStart,
            stepSeconds(transportRef.current.bpm),
          );
          if (result.movedId) {
            setSelectedId(result.movedId);
            setSelectedIds([result.movedId]);
          }
          return result.tracks;
        });
      },
      moveTrackToNew: (id) =>
        setTracks((ts) => {
          const { tracks: next, movedId } = moveTrackToNewIn(ts, id);
          if (movedId) setSelectedId(movedId);
          return next;
        }),
      clipboardName,
      copyTrack: (id) => copyTracksImpl([id]),
      cutTrack: (id) => cutTracksImpl([id]),
      copyTracks: (ids) => copyTracksImpl(ids),
      cutTracks: (ids) => cutTracksImpl(ids),
      pasteTrack: (targetId, destinationStep, atEnd) => {
        const src = clipboardRef.current;
        if (!src) {
          toast("Clipboard is empty", { description: "Copy a track first with ⌘C / Ctrl+C." });
          return;
        }
        if (multiClipboardRef.current && multiClipboardRef.current.length > 1) {
          pasteManyImpl(destinationStep, atEnd);
          return;
        }
        const wantedId = targetId ?? selectedIdRef.current;
        const target = tracksRef.current.find((t) => t.id === wantedId);
        // Pasting drums onto a synth (or vice versa) makes a new matching channel instead of failing.
        const mismatched =
          !!target &&
          (src.notes?.length || src.pads?.some((p) => p.steps.some((v) => v > 0))) &&
          src.kind !== target.kind;
        if (target && !mismatched) {
          const tp = transportRef.current;
          const span = clipboardSpanRef.current;
          const stepDur = stepSeconds(tp.bpm);
          const at = atEnd
            ? pasteEndStep(target, stepDur, songSteps(tp.bars))
            : livePasteStep(tp.playing ? getPlayStep() : tp.step, !!tp.playing, destinationStep);
          const pasted = pasteTrackContent(target, src, at, stepDur, {
            shownEnd: songSteps(tp.bars),
            ...(span ? { origin: span[0], length: span[1] - span[0] } : {}),
          });
          setTracks((ts) => ts.map((t) => (t.id === target.id ? pasted : t)));
          setTransportState((tp) => ({
            ...tp,
            bars: Math.max(tp.bars, barsForSteps(materialEnd(pasted, stepSeconds(tp.bpm)))),
          }));
          return;
        }
        const copy: Track = {
          ...cloneTrack(src),
          id: uid(),
          name: `${src.name} COPY`,
          recording: false,
        };
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
        const clip = tracksRef.current
          .find((t) => t.id === trackId)
          ?.clips?.find((c) => c.id === clipId);
        if (!clip) return;
        clipClipboardRef.current = structuredClone(clip) as AudioClip;
        clipboardRef.current = null;
        multiClipboardRef.current = null;
        setClipboardName(null);
        setClipClipboardName(clip.name);
        toast("Clip copied", {
          description: `${clip.name} — press ⌘V / Ctrl+V to paste it at the playhead.`,
        });
      },
      cutClip: (trackId, clipId) => {
        const track = tracksRef.current.find((t) => t.id === trackId);
        const clip = track?.clips?.find((c) => c.id === clipId);
        if (!track || !clip) return;
        clipClipboardRef.current = structuredClone(clip) as AudioClip;
        setClipClipboardName(clip.name);
        clipboardRef.current = null;
        multiClipboardRef.current = null;
        setClipboardName(null);
        // a recorded take takes its notes/hits with it, exactly like Delete, so no MIDI is left behind
        const tp = transportRef.current;
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId ? { ...t, ...removeTakeAndMaterial(t, clipId, tp.bpm, tp.bars) } : t,
          ),
        );
        toast("Clip cut", {
          description: `${clip.name} — paste it at the playhead with ⌘V / Ctrl+V.`,
        });
      },
      pasteClip: (atEnd, targetId, destinationStep) => {
        const src = clipClipboardRef.current;
        if (!src) {
          toast("Clip clipboard is empty", {
            description: "Click a clip and press ⌘C / Ctrl+C first.",
          });
          return;
        }
        const target = tracksRef.current.find((t) => t.id === (targetId ?? selectedIdRef.current));
        if (!target) {
          toast("Select a track first", {
            description: "Click the track you want the clip on, then paste.",
          });
          return;
        }
        // start is in steps but length is in seconds — convert so the paste
        // lands after the last clip instead of on top of it
        const pasteStepDur = stepSeconds(transportRef.current.bpm);
        const endOf = (t: Track) =>
          (t.clips ?? []).reduce(
            (m, c) => Math.max(m, (c.start ?? 0) + clipSeconds(c) / pasteStepDur),
            0,
          );
        const tpNow = transportRef.current;
        const at = atEnd
          ? Math.max(0, Math.ceil(endOf(target) - 0.02))
          : livePasteStep(
              tpNow.playing ? getPlayStep() : tpNow.step,
              !!tpNow.playing,
              destinationStep,
            );
        const clip: AudioClip = { ...(structuredClone(src) as AudioClip), id: uid(), start: at };
        const isNotes =
          target.kind === "drum" || target.kind === "instrument" || target.kind === "midi";
        // Paste onto the selected track itself; note tracks switch to WAVE so the audio plays there.
        setTracks((ts) =>
          ts.map((t) =>
            t.id === target.id
              ? {
                  ...t,
                  clips: [...(t.clips ?? []), clip],
                  activeClipId: clip.id,
                  ...(isNotes ? { printedAudio: true } : {}),
                }
              : t,
          ),
        );
        setTransportState((tp) => ({
          ...tp,
          bars: Math.max(tp.bars, barsForSteps(at + clipSeconds(clip) / pasteStepDur)),
        }));
        toast.success(`${clip.name} pasted on ${target.name}`, {
          description: `At step ${at} — drag it anywhere from there.`,
        });
      },
      updatePatch: (id, patch) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === id && t.patch ? liveSound({ ...t, patch: { ...t.patch, ...patch } }) : t,
          ),
        ),
      editAllDrums: (trackId, edit) =>
        setTracks((ts) =>
          ts.map((t) => {
            if (t.id !== trackId || !t.pads) return t;
            const region = transportRef.current.loop ? loopRegion(transportRef.current) : undefined;
            const pads = editDrumPads(t.pads, edit, region);
            const patterns = [...(t.drumPatterns ?? [])];
            patterns[t.activeDrumPattern ?? 0] = structuredClone(pads);
            return liveSound({
              ...t,
              pads,
              drumPatterns: patterns,
              ...(edit.scope !== "sounds" ? { patternRegion: region } : {}),
            });
          }),
        ),
      updatePad: (trackId, padId, patch) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId && t.pads
              ? liveSound({
                  ...t,
                  ...(patch.steps
                    ? {
                        patternRegion: transportRef.current.loop
                          ? loopRegion(transportRef.current)
                          : undefined,
                      }
                    : {}),
                  pads: t.pads.map((p) => (p.id === padId ? { ...p, ...patch } : p)),
                })
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
                    probability: p.probability
                      ? Array.from({ length: steps }, (_, i) => p.probability?.[i] ?? 1)
                      : undefined,
                    stepPitch: p.stepPitch
                      ? Array.from({ length: steps }, (_, i) => p.stepPitch?.[i] ?? 0)
                      : undefined,
                    stepDecay: p.stepDecay
                      ? Array.from({ length: steps }, (_, i) => p.stepDecay?.[i] ?? 1)
                      : undefined,
                    flam: p.flam
                      ? Array.from({ length: steps }, (_, i) => p.flam?.[i] ?? 0)
                      : undefined,
                    retrig: p.retrig
                      ? Array.from({ length: steps }, (_, i) => p.retrig?.[i] ?? 1)
                      : undefined,
                    glitch: p.glitch
                      ? Array.from({ length: steps }, (_, i) => p.glitch?.[i] ?? 0)
                      : undefined,
                  })),
                }
              : t,
          ),
        ),
      addPad: (trackId, sound) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId && t.pads
              ? {
                  ...t,
                  pads: appendDrumPad(t, uid(), sound),
                }
              : t,
          ),
        ),
      setNotes: (trackId, notes) => updateTrack(trackId, { notes, printedAudio: false }),
      setTransport: (t) => setTransportState((s) => ({ ...s, ...t })),
      togglePlay: () => {
        getEngine().init();
        setTransportState((s) => ({ ...s, playing: !s.playing, paused: s.playing }));
      },
      pause: () => setTransportState((s) => ({ ...s, playing: false, paused: true })),
      toggleRecord: () => {
        if (finalizingRef.current) return;
        const engine = getEngine();
        engine.init();
        // Sampler pads play internal audio, so they record like instruments
        // (channel print + editable notes), not like a microphone input.
        const isNote = (t: Track) =>
          t.kind === "instrument" || t.kind === "midi" || t.kind === "drum" || t.kind === "sampler";
        const isAudio = (t: Track) => t.kind === "audio" || t.kind === "ai-vocal";
        // Pressing REC during a count-in cancels it (and throws away the mic lead-in).
        if (countInTimerRef.current != null) {
          window.clearInterval(countInTimerRef.current);
          countInTimerRef.current = null;
          recordingGenerationRef.current += 1;
          setTransportState((s) => ({ ...s, countInLeft: null }));
          if (micPreRollRef.current) {
            micPreRollRef.current = false;
            const drop = () => {
              if (transportRef.current.recording || countInTimerRef.current != null) return;
              engine.cancelInputRecording();
            };
            drop();
            void Promise.resolve(pendingInputStartRef.current).then(drop);
            setTracks((ts) => ts.map((t) => (t.recording ? { ...t, recording: false } : t)));
          }
          return;
        }
        if (!transportRef.current.recording) {
          songStartRef.current = null;
          startAtRef.current = null;
          micPreRollRef.current = false;
          printPreRollRef.current = false;
          const selectedTrack = tracksRef.current.find((t) => t.id === selectedIdRef.current);
          // Auto-arm the selected channel so pressing record always has a target.
          let armedAudio = tracksRef.current.find((t) => t.armed && isAudio(t));
          let armedNote = tracksRef.current.find((t) => t.armed && isNote(t));
          if (!armedAudio && !armedNote && selectedTrack) {
            if (isAudio(selectedTrack)) armedAudio = selectedTrack;
            else if (isNote(selectedTrack)) armedNote = selectedTrack;
            if (armedAudio || armedNote) updateTrack(selectedTrack.id, { armed: true });
          }
          const generation = recordingGenerationRef.current;
          // The microphone recorder starts now — before the count-in or the song — so the
          // first beat is never lost while the input opens; its lead-in is trimmed off later.
          let micReady: Promise<boolean> = Promise.resolve(true);
          if (armedAudio) {
            const target = armedAudio;
            loopPassesRef.current = 0;
            recAudioStartRef.current = null;
            micPreRollRef.current = !transportRef.current.playing;
            updateTrack(target.id, { recording: true });
            micReady = engine
              .startInputRecording(target.id, transportRef.current.monitor ?? false)
              .then(
                () => {
                  if (generation !== recordingGenerationRef.current) return false;
                  // Only when the song was already rolling (recording on the fly): place it where it was heard.
                  recAudioStartRef.current = transportRef.current.playing ? heardStepPos() : null;
                  updateTrack(target.id, { recording: true });
                  return true;
                },
                (err: unknown) => {
                  micPreRollRef.current = false;
                  updateTrack(target.id, { recording: false });
                  setTransportState((state) => ({ ...state, recording: false }));
                  toast.error("Microphone unavailable", {
                    description: err instanceof Error ? err.message : undefined,
                  });
                  return false;
                },
              );
            pendingInputStartRef.current = micReady.then(() => undefined);
          }
          const begin = () => {
            const tp = transportRef.current;
            const [lo, hi] = loopRegion(tp);
            const step = tp.step < lo || tp.step >= hi ? lo : tp.step;
            transportRef.current = { ...tp, loop: true, step };
            setTransportState((s) => ({ ...s, loop: true, step }));
            recStartStepRef.current = step;
            if (armedNote) {
              {
                const tpr = transportRef.current;
                const from = tpr.loop ? (tpr.loopStart ?? 0) : recStartStepRef.current;
                const to =
                  tpr.loop && (tpr.loopEnd ?? 0) > from
                    ? (tpr.loopEnd ?? 0)
                    : Number.POSITIVE_INFINITY;
                replacedNoteIdsRef.current =
                  tpr.overdub && !tpr.replace
                    ? new Set()
                    : new Set(
                        (armedNote.notes ?? [])
                          .filter((n) => n.step >= from && n.step < to)
                          .map((n) => n.id),
                      );
              }
              // The printed take is captured after the channel fader, so a muted
              // channel would record silence (a flat line). Unmute it first.
              if (armedNote.muted) {
                updateTrack(armedNote.id, { muted: false });
                toast("Unmuted " + armedNote.name, {
                  description: "A muted channel records silence, so it was unmuted for this take.",
                });
              }
              const otherSolo =
                tracksRef.current.some((t) => t.solo && t.id !== armedNote!.id) && !armedNote.solo;
              if (otherSolo) {
                toast.warning("Another track is soloed", {
                  description: `${armedNote.name} is silenced by solo and would record a flat line — un-solo the other track.`,
                });
              }
              // Printing starts just before the song does; that lead-in is trimmed when the take lands.
              printPreRollRef.current = !transportRef.current.playing;
              const notesOnly = synthTake(armedNote);
              if (notesOnly) {
                printPreRollRef.current = false;
                midiTakeRef.current = { trackId: armedNote.id, passes: 0 };
              } else
                try {
                  engine.startTrackRecording(armedNote.id);
                } catch (err) {
                  printPreRollRef.current = false;
                  toast.error("Could not record this channel", {
                    description: err instanceof Error ? err.message : undefined,
                  });
                  return;
                }
              updateTrack(armedNote.id, {
                recording: true,
                ...(armedNote.kind === "drum"
                  ? {
                      patternRegion: transportRef.current.loop
                        ? loopRegion(transportRef.current)
                        : undefined,
                    }
                  : {}),
              });
              toast(notesOnly ? "Recording notes" : "Recording notes and audio", {
                description: notesOnly
                  ? `Play ${armedNote.name}. Its waveform is drawn from your notes when you stop${transportRef.current.overdub && !transportRef.current.replace ? "; Overdub keeps looping so you can layer passes" : ""}.`
                  : `Playing ${armedNote.name} captures an editable pattern and waveform.`,
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
            transportRef.current = { ...transportRef.current, playing: false };
            if (armedAudio) micPreRollRef.current = true;
            // Clicks are timed on the audio clock (scheduled just ahead, so cancelling stops them),
            // keeping the count-in steady when the page is busy; countdown and haptics follow.
            const ctx = engine.init();
            const beatSec = beatMs / 1000;
            const t0 = ctx.currentTime + 0.05;
            const total = left;
            let nextClick = 0;
            const scheduleClicks = (horizon = 0.12) => {
              while (nextClick < total && t0 + nextClick * beatSec < ctx.currentTime + horizon) {
                if (transportRef.current.countInClick !== false)
                  engine.playClick(nextClick % bpb === 0, t0 + nextClick * beatSec);
                nextClick += 1;
              }
            };
            scheduleClicks();
            const buzz = (accent: boolean) => {
              if (
                transportRef.current.countInHaptics &&
                typeof navigator !== "undefined" &&
                typeof navigator.vibrate === "function"
              ) {
                try {
                  navigator.vibrate(accent ? 70 : 30);
                } catch {
                  /* Device may block vibration; visual countdown continues. */
                }
              }
            };
            buzz(true);
            const startAt = t0 + total * beatSec;
            // Start the song a moment early so it is set up in time to land exactly on the downbeat.
            const START_EARLY = 0.3;
            const tick = () => {
              scheduleClicks();
              const ahead = startAt - ctx.currentTime;
              if (ahead <= START_EARLY) {
                if (countInTimerRef.current != null) window.clearInterval(countInTimerRef.current);
                countInTimerRef.current = null;
                scheduleClicks(START_EARLY + 0.1);
                startAtRef.current = startAt;
                const gen = recordingGenerationRef.current;
                begin();
                // the last count number stays up until the downbeat itself
                window.setTimeout(
                  () => {
                    if (gen === recordingGenerationRef.current)
                      setTransportState((s) =>
                        s.countInLeft != null ? { ...s, countInLeft: null } : s,
                      );
                  },
                  Math.max(0, ahead * 1000),
                );
                return;
              }
              const remaining = Math.ceil(ahead / beatSec - 1e-6);
              if (remaining !== left) {
                left = remaining;
                buzz(left % bpb === 0);
                setTransportState((s) => ({ ...s, countInLeft: left }));
              }
            };
            countInTimerRef.current = window.setInterval(tick, 10);
            return;
          }
          // No count-in: wait for the microphone to be listening before the song starts.
          if (armedAudio && !transportRef.current.playing) {
            void micReady.then((ok) => {
              if (generation !== recordingGenerationRef.current) return;
              if (ok || armedNote) begin();
            });
            return;
          }
          begin();
        } else {
          void endRecording();
        }
      },
      stop: () => {
        stopLiveArps();
        releaseLatched();
        return endRecording(true);
      },
      changeInstrument: (trackId, preset) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? liveSound({ ...t, instrument: preset, patch: applyPreset(preset) })
              : t,
          ),
        ),
      addClip: (trackId, clip) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? { ...t, clips: [...(t.clips ?? []), clip], activeClipId: clip.id }
              : t,
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
            toast.error("Could not read that audio", {
              description: "The clip's audio file is no longer available.",
            });
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
        setSelectedIds([trackId]);
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
            entry.past = [
              ...entry.past,
              { points: structuredClone(lane.points), label: label ?? "Automation edit" },
            ].slice(-80);
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
        entry!.future = [
          ...entry!.future,
          { points: structuredClone(lane.points), label: step.label },
        ].slice(-80);
        automationLastPushRef.current.delete(key);
        updateTrack(trackId, {
          automation: lanes.map((l) => (l.param === param ? { ...l, points: step.points } : l)),
        });
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
        entry!.past = [
          ...entry!.past,
          { points: structuredClone(lane.points), label: step.label },
        ].slice(-80);
        automationLastPushRef.current.delete(key);
        updateTrack(trackId, {
          automation: lanes.map((l) => (l.param === param ? { ...l, points: step.points } : l)),
        });
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
        updateTrack(trackId, {
          automation: lanes.map((l) => (l.param === param ? { ...l, mode } : l)),
        });
      },
      setAutomationLaneLock: (trackId, param, locked) => {
        const t = tracksRef.current.find((x) => x.id === trackId);
        const lanes = t?.automation ?? [];
        updateTrack(trackId, {
          automation: lanes.map((l) => (l.param === param ? { ...l, locked } : l)),
        });
      },
      // hear the value under the finger while an automation point or region is being dragged
      previewAutomation: (trackId, param, value) => {
        getEngine().automate(trackId, { [param]: value });
      },
      removeClip: (trackId, clipId) => {
        const tp = transportRef.current;
        // a recorded take takes its notes/hits with it, so no hidden MIDI is left under a deleted block
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId ? { ...t, ...removeTakeAndMaterial(t, clipId, tp.bpm, tp.bars) } : t,
          ),
        );
      },
      savePreset: (name) => {
        const t = tracks.find((x) => x.id === selectedId);
        if (t?.patch) setUserPresets((p) => [...p, { ...structuredClone(t.patch!), name }]);
      },
      loadPreset: (trackId, name) => {
        const user = userPresets.find((p) => p.name === name);
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? liveSound({ ...t, patch: user ? structuredClone(user) : applyPreset(name) })
              : t,
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
                      if (genre === "Detroit Techno" || genre === "House")
                        return beat ? 1 : hit(0.04 * energy);
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
      previewNote: (
        trackId,
        midi,
        duration = PREVIEW_NOTE_SECONDS,
        shouldCapture = true,
        patch,
      ) => {
        const t = tracksRef.current.find((x) => x.id === trackId);
        const engine = getEngine();
        engine.init();
        engine.syncMixIfChanged(tracksRef.current);
        // HOLD latches played notes (never preset auditions, which pass capture off or their own patch).
        const holding = !!t && shouldCapture && !patch && holdApplies(t);
        if (t && holding) retriggerHeld(t, midi);
        if (t)
          triggerNote(
            engine,
            previewTrack(t, patch),
            midi,
            holding ? HELD_NOTE_SECONDS : duration,
            0.9,
            undefined,
            holding ? HELD_NOTE_SECONDS : undefined,
          );
        keyDown(midi, holding ? HELD_NOTE_SECONDS * 1000 : undefined);
        // Notes played on screen are captured while the transport records.
        const note = t && shouldCapture ? capture(t.id, midi, 0.9, duration) : null;
        if (t && note && holding)
          heldRef.current.set(`latch:${t.id}:${note.id}`, {
            ids: [note.id],
            trackId: t.id,
            t0: performance.now(),
            startStep: note.step,
            pitch: midi,
            latched: true,
            base: duration,
          });
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
          return true;
        } catch {
          toast.error("That file could not be read", {
            description: "Try a standard MP3, WAV, AIFF, M4A or OGG file.",
          });
          return false;
        }
      },
      updateSampler: (trackId, patch) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId && t.sampler
              ? {
                  ...t,
                  sampler: {
                    ...t.sampler,
                    ...patch,
                    // Re-chopping keeps each surviving chop's own tune/level/pan/mute.
                    ...("slices" in patch && !("chopSounds" in patch)
                      ? {
                          chopSounds: reconcileChopSounds(
                            t.sampler.slices,
                            patch.slices,
                            t.sampler.chopSounds,
                          ),
                        }
                      : {}),
                  },
                }
              : t,
          ),
        ),
      clearSample: (trackId) => {
        getEngine().stopSamples(trackId);
        setTracks((ts) => ts.map((t) => (t.id === trackId ? { ...t, sampler: undefined } : t)));
      },
      stopSamples: (trackId) => getEngine().stopSamples(trackId),
      installedPlugins,
      installPlugin: (d) => setInstalledPlugins((ps) => [...ps.filter((x) => x.id !== d.id), d]),
      uninstallPlugin: (defId) => setInstalledPlugins((ps) => ps.filter((x) => x.id !== defId)),
      addPlugin: (trackId, d, opts) => {
        const inst = instantiate(d);
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  plugins: opts?.rig
                    ? insertRigDevice(t.plugins ?? [], inst)
                    : [...(t.plugins ?? []), inst],
                }
              : t,
          ),
        );
        if (!opts?.quiet)
          toast.success(`${d.name} inserted`, { description: `${d.vendor} · ${d.format}` });
        return inst.id;
      },
      removePlugin: (trackId, instanceId) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? { ...t, plugins: (t.plugins ?? []).filter((p) => p.id !== instanceId) }
              : t,
          ),
        ),
      togglePluginBypass: (trackId, instanceId) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  plugins: (t.plugins ?? []).map((p) =>
                    p.id === instanceId ? { ...p, bypass: !p.bypass } : p,
                  ),
                }
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
                    params: (() => {
                      const all = withDefaultParams(p);
                      return all.some((x: PluginParam) => x.id === paramId)
                        ? all.map((x: PluginParam) => (x.id === paramId ? { ...x, value } : x))
                        : [
                            ...all,
                            { id: paramId, name: paramId, value, min: value, max: value, unit: "" },
                          ];
                    })(),
                  }
                : p,
            );
            const lane = (t.automation ?? []).find((item) => item.param === automationParam);
            if (
              !transportRef.current.playing ||
              !lane ||
              lane.locked ||
              !["write", "touch", "latch"].includes(lane.mode)
            )
              return { ...t, plugins };
            automationGestureRef.current.set(gestureKey, {
              touchedUntil: performance.now() + 180,
              latched: lane.mode === "latch",
            });
            const source = plugins
              .find((plugin) => plugin.id === instanceId)
              ?.params.find((param) => param.id === paramId);
            if (!source) return { ...t, plugins };
            const normalized =
              source.max > source.min ? (value - source.min) / (source.max - source.min) : 0;
            const step = transportRef.current.step;
            const points = [
              ...lane.points.filter((point) => point.step !== step),
              { step, value: Math.min(1, Math.max(0, normalized)) },
            ].sort((a, b) => a.step - b.step);
            return {
              ...t,
              plugins,
              automation: (t.automation ?? []).map((item) =>
                item.param === automationParam ? { ...item, points } : item,
              ),
            };
          }),
        );
      },
      midiInputs,
      midiOutputs,
      midiInputId,
      midiLearning,
      midiMap,
      midiLearn,
      startMidiLearn: (t) => {
        setMidiLearn(t);
        toast("Move a knob or fader", {
          description: "The next control you touch takes over this one.",
        });
      },
      cancelMidiLearn: () => setMidiLearn(null),
      clearMidiMapping: (t) =>
        setMidiMap((m) => {
          const next: Record<string, MidiTarget> = {};
          for (const [k, v] of Object.entries(m))
            if (!(v.id === t.id && v.param === t.param)) next[k] = v;
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
        setFxChains((c) => ({
          ...c,
          [target]: (c[target] ?? []).filter((p) => p.id !== instanceId),
        })),
      toggleFxBypass: (target, instanceId) =>
        setFxChains((c) => ({
          ...c,
          [target]: (c[target] ?? []).map((p) =>
            p.id === instanceId ? { ...p, bypass: !p.bypass } : p,
          ),
        })),
      setFxParam: (target, instanceId, paramId, value) =>
        setFxChains((c) => ({
          ...c,
          [target]: (c[target] ?? []).map((p) =>
            p.id === instanceId
              ? {
                  ...p,
                  params: withDefaultParams(p).map((x: PluginParam) =>
                    x.id === paramId ? { ...x, value } : x,
                  ),
                }
              : p,
          ),
        })),
    };
  }, [
    tracks,
    transport,
    selectedId,
    selectedIds,
    editTool,
    panel,
    userPresets,
    buses,
    customBuses,
    busStateOf,
    setAnyBus,
    addCustomBus,
    removeCustomBus,
    applyBusTemplate,
    setBusMembers,
    setVcaLinked,
    vcas,
    auxReturns,
    sections,
    projectNotes,
    folders,
    installedPlugins,
    fxChains,
    midiInputs,
    midiOutputs,
    midiInputId,
    midiLearning,
    midiMap,
    midiLearn,
    clipboardName,
    clipClipboardName,
    enableMidi,
    setMidiInputPersist,
    updateTrack,
    finishRecording,
    finishTrackRecording,
    endRecording,
    splitClipAtImpl,
    razorAtImpl,
    buildSnapshot,
    applySession,
    historyTick,
    automationHistoryTick,
    savedAt,
  ]);

  apiRef.current = api; // hardware transport buttons call the newest actions
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStudio = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudio must be used inside StudioProvider");
  return ctx;
};
