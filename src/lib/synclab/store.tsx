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
import { TRACK_COLORS, applyPreset, defaultPads, defaultPatch, uid } from "./presets";
import { BUILT_IN_PLUGINS, instantiate } from "./plugins";
import { getMidiAccess, listInputs, midiSupported, subscribe, type MidiPortInfo } from "./midi";
import type {
  AudioClip,
  BusId,
  BusState,
  DrumPad,
  MidiNote,
  PluginDef,
  PluginInstance,

  PluginParam,
  SynthPatch,
  Track,
  TrackKind,
  Transport,
} from "./types";

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
  | "synth"
  | "drums"
  | "piano"
  | "vocal"
  | "settings"
  | "keys"
  | "browser"
  | "plugins"
  | "appearance"
  | null;

interface StudioState {
  tracks: Track[];
  transport: Transport;
  selectedId: string | null;
  panel: PanelId;
  userPresets: SynthPatch[];
  buses: Record<BusId, BusState>;
}

interface StudioApi extends StudioState {
  selected: Track | null;
  setBus: (id: BusId, patch: Partial<BusState>) => void;
  setPanel: (p: PanelId) => void;
  select: (id: string) => void;
  addTrack: (kind: TrackKind, name?: string, preset?: string) => string;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  duplicateTrack: (id: string) => void;
  moveTrack: (id: string, dir: -1 | 1) => void;
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
  removeClip: (trackId: string, clipId: string) => void;
  addClip: (trackId: string, clip: AudioClip) => void;
  savePreset: (name: string) => void;
  loadPreset: (trackId: string, name: string) => void;
  generateBeat: (trackId: string, genre: string, energy: number) => void;
  previewNote: (trackId: string, midi: number) => void;
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
  const [panel, setPanel] = useState<PanelId>(null);
  const [userPresets, setUserPresets] = useState<SynthPatch[]>([]);
  const [transport, setTransportState] = useState<Transport>({
    playing: false,
    recording: false,
    bpm: 128,
    swing: 0,
    step: 0,
    metronome: false,
    countIn: false,
    loop: true,
    loopStart: 0,
    loopEnd: 16,
    bars: 1,
    paused: false,
    overdub: false,
    punchIn: null,
    punchOut: null,
    monitor: true,
  });

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const transportRef = useRef(transport);
  transportRef.current = transport;

  const [buses, setBuses] = useState<Record<BusId, BusState>>({
    drums: { volume: 1, muted: false },
    vocals: { volume: 1, muted: false },
    instruments: { volume: 1, muted: false },
    synths: { volume: 1, muted: false },
    fx: { volume: 1, muted: false },
    master: { volume: 1, muted: false },
  });

  const [installedPlugins, setInstalledPlugins] = useState<PluginDef[]>(BUILT_IN_PLUGINS);
  const [fxChains, setFxChains] = useState<Record<string, PluginInstance[]>>({});
  const [midiInputs, setMidiInputs] = useState<MidiPortInfo[]>([]);
  const [midiInputId, setMidiInputId] = useState<string | null>(null);
  const [midiLearning, setMidiLearning] = useState(false);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const heldRef = useRef(new Map<number, { id: string; trackId: string; t0: number }>());

  const enableMidi = useCallback(() => {
    if (!midiSupported()) {
      toast.error("MIDI not available", {
        description: "This browser can't see MIDI controllers. Chrome or Edge support them.",
      });
      return;
    }
    void getMidiAccess().then((a) => {
      const list = listInputs(a);
      setMidiInputs(list);
      if (!list.length) {
        toast("No MIDI controller found", { description: "Plug one in, then press MIDI again." });
        return;
      }
      setMidiInputId((cur) => cur ?? list[0]?.id ?? null);
      toast.success(`${list.length} MIDI input${list.length > 1 ? "s" : ""} connected`, {
        description: list.map((i) => i.name).join(", "),
      });
      if (a) a.onstatechange = () => setMidiInputs(listInputs(a));
    });
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
      off = subscribe(a, midiInputId, ({ type, pitch, velocity }) => {
        const notable = (t: Track) => t.kind === "instrument" || t.kind === "midi" || t.kind === "sampler";
        const target =
          tracksRef.current.find((t) => t.armed && notable(t)) ??
          tracksRef.current.find((t) => t.id === selectedIdRef.current && notable(t)) ??
          tracksRef.current.find(notable);
        if (!target) return;
        const engine = getEngine();
        engine.init();
        const tp = transportRef.current;
        const stepDur = 60 / tp.bpm / 4;
        if (type === "on") {
          setMidiLearning(true);
          engine.syncMix(tracksRef.current);
          if (target.patch) engine.playNote(target.id, target.patch, pitch, 0.6, Math.max(0.15, velocity));
          if (tp.recording) {
            const id = uid();
            heldRef.current.set(pitch, { id, trackId: target.id, t0: performance.now() });
            const note: MidiNote = {
              id,
              step: tp.step,
              length: 1,
              pitch,
              velocity: Math.max(0.15, velocity),
            };
            setTracks((ts) =>
              ts.map((t) => (t.id === target.id ? { ...t, notes: [...(t.notes ?? []), note] } : t)),
            );
          }
        } else {
          setMidiLearning(false);
          const held = heldRef.current.get(pitch);
          if (!held) return;
          heldRef.current.delete(pitch);
          const steps = Math.max(0.25, Math.round(((performance.now() - held.t0) / 1000 / stepDur) * 4) / 4);
          setTracks((ts) =>
            ts.map((t) =>
              t.id === held.trackId
                ? { ...t, notes: (t.notes ?? []).map((n) => (n.id === held.id ? { ...n, length: steps } : n)) }
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

  useEffect(() => {
    if (typeof window === "undefined" || !getEngine().ctx) return;
    for (const [id, b] of Object.entries(buses)) getEngine().setBus(id, b.volume, b.muted);
  }, [buses]);

  useEffect(() => {
    if (typeof window === "undefined" || !getEngine().ctx) return;
    for (const [target, list] of Object.entries(fxChains)) getEngine().setFxInserts(target, list);
  }, [fxChains]);


  // step clock
  useEffect(() => {
    if (!transport.playing) return;
    const engine = getEngine();
    engine.init();
    engine.syncMix(tracksRef.current);
    let step = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const tp = transportRef.current;
      const stepDur = 60 / tp.bpm / 4;
      const list = tracksRef.current;
      const anySolo = list.some((t) => t.solo);
      for (const t of list) {
        if (t.muted || t.frozen || (anySolo && !t.solo)) continue;
        const len = t.steps;
        const s = step % len;
        if (t.kind === "drum" && t.pads) {
          const padSolo = t.pads.some((p) => p.solo);
          for (const pad of t.pads) {
            if (pad.muted || (padSolo && !pad.solo)) continue;
            const v = pad.steps[s] ?? 0;
            if (v > 0) engine.playDrum(t.id, pad, v);
          }
        } else if (t.patch && t.notes) {
          for (const n of t.notes) {
            if (n.step % len === s) {
              const dur = (n.length * stepDur) / (t.patch.arp.on ? 2 : 1);
              if (t.patch.arp.on) {
                const oct = t.patch.arp.octaves;
                for (let i = 0; i < n.length; i++) {
                  const shift = (i % Math.max(1, oct)) * 12;
                  const dir = t.patch.arp.direction === "down" ? -shift : shift;
                  engine.playNote(
                    t.id,
                    t.patch,
                    n.pitch + dir,
                    stepDur * t.patch.arp.gate,
                    n.velocity,
                    engine.ctx!.currentTime + i * stepDur,
                  );
                }
              } else {
                engine.playNote(t.id, t.patch, n.pitch, dur, n.velocity);
              }
            }
          }
        }
      }
      if (tp.metronome) {
        engine.playDrum(
          "metronome",
          {
            id: "m",
            name: "click",
            kind: step % 4 === 0 ? "rim" : "hat",
            volume: 0.35,
            pan: 0,
            pitch: step % 4 === 0 ? 5 : 0,
            decay: 0,
            muted: false,
            solo: false,
            steps: [],
          },
          1,
        );
      }
      setTransportState((t) => ({ ...t, step: step % 16 }));
      step += 1;
      if (tp.loop) {
        const lo = tp.loopStart ?? 0;
        const hi = Math.max(lo + 1, tp.loopEnd ?? 16);
        if (step >= hi) step = lo;
      }
    };

    tick();
    const interval = window.setInterval(tick, (60 / transport.bpm / 4) * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [transport.playing, transport.bpm]);

  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const finishRecording = useCallback(async () => {
    const engine = getEngine();
    if (!engine.isRecording) return;
    const target = tracksRef.current.find((t) => t.recording);
    const result = await engine.stopInputRecording();
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
    };
    setTracks((ts) =>
      ts.map((t) =>
        t.id === target.id
          ? { ...t, recording: false, clips: [...(t.clips ?? []), clip], activeClipId: clip.id }
          : t,
      ),
    );
    toast.success(`${clip.name} recorded on ${target.name}`, {
      description: `${result.duration.toFixed(1)}s captured — pick your best take on the track.`,
    });
  }, [updateTrack]);

  const api: StudioApi = useMemo(() => {
    const selected = tracks.find((t) => t.id === selectedId) ?? null;
    return {
      tracks,
      transport,
      selectedId,
      panel,
      userPresets,
      buses,
      selected,
      setBus: (id, patch) => setBuses((b) => ({ ...b, [id]: { ...b[id], ...patch } })),
      setPanel,
      select: (id) => setSelectedId(id),
      addTrack: (kind, name, preset) => {
        const id = uid();
        setTracks((ts) => {
          const t = { ...newTrack(kind, name ?? `TRACK ${ts.length + 1}`, ts.length, preset), id };
          setSelectedId(t.id);
          setPanel(kind === "drum" ? "drums" : kind === "ai-vocal" ? "vocal" : kind === "audio" ? null : "synth");
          return [...ts, t];
        });
        return id;
      },
      updateTrack,
      removeTrack: (id) => {
        getEngine().removeChannel(id);
        setTracks((ts) => ts.filter((t) => t.id !== id));
        setSelectedId((s) => (s === id ? null : s));
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
        if (!transportRef.current.recording) {
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
            void engine
              .startInputRecording(target.id, transportRef.current.monitor ?? true)
              .then(() => updateTrack(target.id, { recording: true }))
              .catch(() =>
                toast.error("Microphone unavailable", {
                  description: "Allow microphone access in your browser to record this channel.",
                }),
              );
          } else if (armedNote) {
            toast("Recording notes", {
              description: `Play your controller or the on-screen keyboard — notes land on ${armedNote.name}.`,
            });
          } else {
            toast("Select or arm a channel first", {
              description: "Click a track, or press ● REC on it, then record.",
            });
          }
          setTransportState((s) => ({ ...s, recording: true, playing: true, paused: false }));
        } else {
          void finishRecording();
          setTransportState((s) => ({ ...s, recording: false }));
        }
      },
      stop: () => {
        if (transportRef.current.recording) void finishRecording();
        setTransportState((s) => ({ ...s, playing: false, recording: false, paused: false, step: 0 }));
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
      setActiveClip: (trackId, clipId) => updateTrack(trackId, { activeClipId: clipId }),
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
        if (t?.patch) engine.playNote(t.id, t.patch, midi, 0.35, 0.9);
      },
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
      setPluginParam: (trackId, instanceId, paramId, value) =>
        setTracks((ts) =>
          ts.map((t) =>
            t.id === trackId
              ? {
                  ...t,
                  plugins: (t.plugins ?? []).map((p) =>
                    p.id === instanceId
                      ? { ...p, params: p.params.map((x: PluginParam) => (x.id === paramId ? { ...x, value } : x)) }
                      : p,
                  ),
                }
              : t,
          ),
        ),
      midiInputs,
      midiInputId,
      midiLearning,
      enableMidi,
      setMidiInput: setMidiInputId,
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
  }, [tracks, transport, selectedId, panel, userPresets, buses, installedPlugins, fxChains, midiInputs, midiInputId, midiLearning, enableMidi, updateTrack, finishRecording]);


  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useStudio = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudio must be used inside StudioProvider");
  return ctx;
};
