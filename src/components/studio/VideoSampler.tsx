import { SkinControls, skinBackground, useImageDrop } from "@/components/studio/SkinControls";
import { useSkin } from "@/lib/synclab/skins";
import { getPlayStep, usePlayStep } from "@/lib/synclab/playhead";
import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { SampleExportButtons } from "./SampleExportButtons";
import { BypassButton } from "./HardwareBypass";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Grid3x3, Piano, Plus, Save, Scissors, Square, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getEngine } from "@/lib/synclab/audio-engine";
import { detectSampleChops } from "@/lib/synclab/sample-chops";
import { encodeWav } from "@/lib/synclab/bounce";
import { useStudio } from "@/lib/synclab/store";
import { uid } from "@/lib/synclab/presets";
import { wsolaStretch } from "@/lib/synclab/stretch";
import {
  retainMediaInBackground,
  takeLibraryVideo,
  type VideoKit,
} from "@/lib/synclab/media-library";
import { saveToLibrary } from "@/lib/synclab/library";
import { loadVideoSession, saveVideoSession } from "@/lib/synclab/autosave-media";
import {
  KEY_RELEASE_VERSION,
  loadedVideoChopSounds,
  stopsOnRelease,
} from "@/lib/synclab/sampler-gate";
import { moveVideoChop, snapVideoTime } from "@/lib/synclab/video-chops";
import {
  VIDEO_PAD_KEYS,
  videoPadForNote,
  assignVideoPadNote,
  type VideoPadMidiNote,
} from "@/lib/synclab/video-pad-map";
import { claimMidiNotes, midiSupported } from "@/lib/synclab/midi";

import { WaveformView } from "./WaveformView";
import { Keyboard } from "./Keyboard";
import { MultiPitchModeSwitch, MultiPitchPads } from "./MultiPitchPads";
import {
  DEFAULT_MULTI_PITCH,
  multiPitchVoiceKeys,
  notePitches,
  padPitches,
  type MultiPitchSettings,
} from "@/lib/synclab/multi-pitch";
import { NoteRepeatBar } from "./NoteRepeatBar";
import { PadSoundEditor } from "./PadSoundEditor";
import {
  DEFAULT_NOTE_REPEAT,
  DEFAULT_PAD_SOUND,
  createNoteRepeater,
  padTune,
  type NoteRepeatSettings,
  type PadSound,
} from "@/lib/synclab/mpc-pad";
import { isVideoSamplerTrack } from "@/lib/synclab/track-editor";

const PAD_KEYS = VIDEO_PAD_KEYS;
/** Multi pitch stays set while the app is open, so switching panels never turns it off. */
let videoMultiPitch: MultiPitchSettings = DEFAULT_MULTI_PITCH;
let videoNoteRepeat: NoteRepeatSettings = DEFAULT_NOTE_REPEAT;

type ChopSounds = (Partial<PadSound> | null)[];
const clampRate = (r: number) => Math.max(0.0625, Math.min(16, r));

/** Video sampler: load or film a clip, chop its audio at real attacks, trigger chops as pads (video + sound), and print chops to the timeline. */
export function VideoSampler() {
  const skin = useSkin("video");
  const skinDrop = useImageDrop("video");
  const skinned = !!(skin.image || skin.color);
  const {
    tracks,
    addTrack,
    addClip,
    transport,
    loadSample,
    updateSampler,
    select,
    setPanel,
    midiInputId,
    midiInputs,
    enableMidi,
    setMidiInput,
  } = useStudio();
  const [midiNotes, setMidiNotes] = useState<VideoPadMidiNote[]>([]);
  const [learnPad, setLearnPad] = useState<number | null>(null);
  const consumedNotes = useRef(new Set<string>());
  const blobRef = useRef<{ blob: Blob; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [bypassed, setBypassed] = useState(false);
  const [videoHeight, setVideoHeight] = useState(220);
  useEffect(() => {
    const v = Number(localStorage.getItem("synclab.videoHeight"));
    if (v >= 120 && v <= 720) setVideoHeight(v);
  }, []);
  const setVideoSize = (h: number) => {
    setVideoHeight(h);
    localStorage.setItem("synclab.videoHeight", String(h));
  };
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopTimer = useRef<number>(0);
  const [url, setUrl] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [chops, setChops] = useState<number[]>([]);
  /** Each chop's own sound (MPC pad edit), kept in the same order as the chops. */
  const [chopSounds, setChopSounds] = useState<ChopSounds>([]);
  const [editIdx, setEditIdx] = useState(0);
  const [sensitivity, setSensitivity] = useState(0.5);
  const [filming, setFilming] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [position, setPosition] = useState(0);
  const [manualSlice, setManualSlice] = useState(false);
  const [noteGrid, setNoteGrid] = useState(0);
  const [chopCount, setChopCount] = useState(4);
  const waveform = useRef<HTMLDivElement>(null);
  const dragChop = useRef<{ index: number; pointer: number } | null>(null);
  const [stretchOn, setStretchOn] = useState(false);
  const [sourceBpm, setSourceBpm] = useState(120);
  const [targetBpm, setTargetBpm] = useState(() => Math.round(getEngine().tempo || 120));
  const [showKeyboard, setShowKeyboard] = useState(true);
  /** Playback speed for pads and printed chops; video seconds stay the reference for seeks and cuts. */
  const speed = stretchOn ? Math.max(0.5, Math.min(2, targetBpm / sourceBpm)) : 1;
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.preservesPitch = true;
    v.playbackRate = speed;
  }, [speed, url]);
  const peaks = useMemo(() => {
    if (!buffer) return [];
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i),
    );
    const bins = Math.min(1024, buffer.length);
    return Array.from({ length: bins }, (_, i) => {
      let peak = 0;
      const start = Math.floor((i * buffer.length) / bins);
      const end = Math.floor(((i + 1) * buffer.length) / bins);
      for (const channel of channels)
        for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(channel[j] ?? 0));
      return peak;
    });
  }, [buffer]);
  const padPeaks = useMemo(() => {
    if (!buffer) return [];
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i),
    );
    return chops.map((time, i) => {
      const start = Math.floor(time * buffer.sampleRate);
      const end = Math.floor((chops[i + 1] ?? buffer.duration) * buffer.sampleRate);
      return Array.from({ length: 96 }, (_, bin) => {
        let peak = 0;
        const a = start + Math.floor((bin * (end - start)) / 96);
        const b = start + Math.floor(((bin + 1) * (end - start)) / 96);
        for (const channel of channels)
          for (let j = a; j < b; j++) peak = Math.max(peak, Math.abs(channel[j] ?? 0));
        return peak;
      });
    });
  }, [buffer, chops]);
  const gridLines = useMemo(() => {
    if (!buffer || !noteGrid) return [];
    const interval = 240 / sourceBpm / noteGrid;
    // Bound drawing density for long videos while keeping the real snapping interval.
    const stride = Math.max(1, Math.ceil(buffer.duration / interval / 128));
    return Array.from(
      { length: Math.ceil(buffer.duration / interval / stride) },
      (_, i) => i * stride * interval,
    );
  }, [buffer, sourceBpm, noteGrid]);
  const waveformTime = (clientX: number, clientY: number) => {
    const waveEl = waveform.current;
    if (!waveEl || !buffer) return 0;
    const bounds = canvasRect(waveEl);
    return Math.max(
      0,
      Math.min(
        buffer.duration - 0.01,
        snapVideoTime(
          ((canvasPoint(clientX, clientY).x - bounds.left) / bounds.width) * buffer.duration,
          sourceBpm,
          noteGrid,
        ),
      ),
    );
  };
  const editChop = (i: number, time: number) => {
    if (!buffer) return;
    seek(time);
    setChops((current) => moveVideoChop(current, i, time, buffer.duration));
  };
  const addChop = (time: number) => {
    if (!buffer) return;
    const at = Math.max(
      0,
      Math.min(buffer.duration - 0.01, snapVideoTime(time, sourceBpm, noteGrid)),
    );
    if (chops.some((c) => Math.abs(c - at) < 0.01)) return;
    if (chops.length >= 16) {
      toast.info("All 16 chop pads are filled");
      return;
    }
    const atIndex = chops.filter((c) => c < at).length;
    setChops((current) => [...current, at].sort((a, b) => a - b));
    setChopSounds((current) => {
      const next = [...current];
      while (next.length < atIndex) next.push(null);
      next.splice(atIndex, 0, null);
      return next;
    });
  };
  const seek = (time: number) => {
    window.clearTimeout(stopTimer.current);
    video.current?.pause();
    if (video.current) video.current.currentTime = time;
    setActive(null);
    setPosition(time);
  };

  const release = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(
    () => () => {
      release();
      window.clearTimeout(stopTimer.current);
    },
    [],
  );

  const chopAll = (buf: AudioBuffer, sens: number) => {
    const fractions = detectSampleChops([buf.getChannelData(0)], buf.sampleRate, 0, 1, sens);
    setChops(fractions.map((f) => f * buf.duration));
    setChopSounds([]);
  };

  const loadBlob = async (
    blob: Blob,
    name = blob instanceof File ? blob.name : "Video",
    kit?: VideoKit,
  ) => {
    if (blob instanceof File) retainMediaInBackground(blob, blob.name);
    blobRef.current = { blob, name };
    setError(null);
    window.clearTimeout(stopTimer.current);
    video.current?.pause();
    setBuffer(null);
    setChops([]);
    setChopSounds([]);
    setPosition(0);
    setActive(null);
    const next = URL.createObjectURL(blob);
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return next;
    });
    try {
      const ctx = getEngine().init();
      const buf = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
      setBuffer(buf);
      if (kit) {
        setChops(
          kit.chops
            .filter((c) => Number.isFinite(c) && c >= 0 && c < buf.duration)
            .sort((a, b) => a - b)
            .slice(0, 16),
        );
        setSourceBpm(kit.sourceBpm);
        setTargetBpm(kit.targetBpm);
        setStretchOn(kit.stretchOn);
        setNoteGrid(kit.noteGrid ?? 0);
        setChopCount(kit.chopCount ?? 4);
        setSensitivity(kit.sensitivity ?? 0.5);
        setManualSlice(kit.manualSlice ?? false);
        setMidiNotes(kit.midiNotes ?? []);
        // Kits saved before Gate was the default keep their chops One-shot.
        setChopSounds(
          loadedVideoChopSounds(kit.chopSounds, kit.chops.length, kit.keyRelease) as ChopSounds,
        );
        setLearnPad(null);
      } else {
        setNoteGrid(0);
        setMidiNotes([]);
        setLearnPad(null);
        chopAll(buf, sensitivity);
      }
    } catch {
      setBuffer(null);
      setChops([]);
      setError("This video has no audio this browser can decode. Try an MP4 or WebM with sound.");
    }
  };

  useEffect(() => {
    const saved = takeLibraryVideo();
    if (saved) {
      void loadBlob(saved.blob, saved.name, saved.kit);
      return;
    }
    void loadVideoSession().then((v) => {
      if (v && !blobRef.current) {
        void loadBlob(v.blob, v.name, v);
        toast.info(`Restored ${v.name} and its chops`);
      }
    });
  }, []);
  // Auto save the open video and chops so an accidental close keeps them.
  useEffect(() => {
    const cur = blobRef.current;
    if (!cur || !buffer) return;
    const persist = () =>
      void saveVideoSession({
        ...cur,
        chops,
        sourceBpm,
        targetBpm,
        stretchOn,
        noteGrid,
        chopCount,
        sensitivity,
        manualSlice,
        midiNotes,
        chopSounds,
        keyRelease: KEY_RELEASE_VERSION,
      });
    const id = window.setTimeout(persist, 500);
    const onHide = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearTimeout(id);
      persist();
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [
    buffer,
    chops,
    sourceBpm,
    targetBpm,
    stretchOn,
    noteGrid,
    chopCount,
    sensitivity,
    manualSlice,
    midiNotes,
    chopSounds,
  ]);

  const kitName = () => (blobRef.current?.name ?? "Video").replace(/\.[^.]+$/, "");
  const saveKit = async () => {
    const cur = blobRef.current;
    if (!cur) return;
    setSaving(true);
    try {
      await saveToLibrary({
        kind: "sample",
        location: "cloud",
        folder: "Video kits",
        name: `${kitName()} · ${chops.length} chops`,
        audio: cur.blob,
        data: {
          mediaType: "video",
          mimeType: cur.blob.type || "video/mp4",
          filename: cur.name,
          videoKit: {
            chops,
            sourceBpm,
            targetBpm,
            stretchOn,
            noteGrid,
            chopCount,
            sensitivity,
            manualSlice,
            midiNotes,
            chopSounds,
            keyRelease: KEY_RELEASE_VERSION,
          },
        },
      });
      toast.success("Video and chops saved to your library", {
        description: "My Library › Video kits — opens on phone and desktop",
      });
    } catch (e) {
      toast.error("Could not save the video", {
        description: e instanceof Error ? e.message : "Sign in and try again.",
      });
    } finally {
      setSaving(false);
    }
  };
  /** Hands the video's audio and chops to a Sampler track so every sampler control (trim, ADSR, filter, banks, choke, keyboard, stretch) applies. */
  const openInSampler = async () => {
    if (!buffer) return;
    const cap = slice(0, buffer.duration);
    if (!cap) return;
    const name = kitName().toUpperCase().slice(0, 16) || "VIDEO";
    const id = addTrack("sampler", name, undefined, { keepPanel: true });
    await loadSample(id, new File([encodeWav(cap)], `${name}.wav`, { type: "audio/wav" }));
    // Each chop's tune, fine, level, pan, reverse and mute go along as Sampler chop edits.
    const chopEdits = Object.fromEntries(
      chopSounds.flatMap((c, i) =>
        c
          ? [
              [
                i,
                {
                  pitch: c.pitch,
                  fine: c.fine,
                  gain: c.gain,
                  pan: c.pan,
                  reverse: c.reverse,
                  mute: c.mute,
                },
              ],
            ]
          : [],
      ),
    );
    updateSampler(id, {
      slices: chops.map((c) => c / buffer.duration),
      sampleBpm: stretchOn ? targetBpm : sourceBpm,
      chopSounds: chopEdits,
    });
    select(id);
    setPanel("sampler");
  };
  const evenChops = (n: number) => {
    if (buffer) {
      seek(0);
      setChopCount(n);
      setChops(Array.from({ length: n }, (_, i) => (i * buffer.duration) / n));
      setChopSounds([]);
    }
  };
  const removeChop = (i: number) => {
    seek(position);
    setChops((c) => c.filter((_, j) => j !== i));
    setChopSounds((c) => c.filter((_, j) => j !== i));
    setMidiNotes((notes) => notes.filter((_, j) => j !== i));
    setLearnPad(null);
  };

  const film = async () => {
    if (filming) {
      recorder.current?.stop();
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        video.current.muted = true;
        void video.current.play();
      }
      const rec = new MediaRecorder(s);
      const parts: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) parts.push(e.data);
      };
      rec.onstop = () => {
        setFilming(false);
        release();
        if (video.current) {
          video.current.srcObject = null;
        }
        void loadBlob(new Blob(parts, { type: rec.mimeType || "video/webm" }));
      };
      recorder.current = rec;
      rec.start();
      setFilming(true);
    } catch {
      setError("Camera or microphone access was blocked.");
      release();
    }
  };

  const range = (i: number) => [chops[i] ?? 0, chops[i + 1] ?? buffer?.duration ?? 0] as const;

  /* ── Sound: the video's audio plays through its own mixer channel like a loaded sample ── */
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!buffer) {
      setAudioUrl(null);
      return;
    }
    const engine = getEngine();
    const registered = engine.registerBuffer(buffer, "video");
    setAudioUrl(registered);
    return () => engine.releaseBuffer(registered);
  }, [buffer]);
  /** Pitch-kept time stretch is rendered once (in a worker) and the pads play the result. */
  const [stretched, setStretched] = useState<{ url: string; speed: number } | null>(null);
  const [stretching, setStretching] = useState(false);
  useEffect(() => {
    if (!buffer || !stretchOn || speed === 1) {
      setStretched(null);
      setStretching(false);
      return;
    }
    let worker: Worker | null = null;
    let registered: string | null = null;
    let cancelled = false;
    setStretching(true);
    const timer = window.setTimeout(() => {
      const left = buffer.getChannelData(0).slice();
      const right = buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1)).slice();
      worker = new Worker(new URL("../../lib/synclab/pad-stretch.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (
        e: MessageEvent<{ left?: Float32Array; right?: Float32Array; error?: string }>,
      ) => {
        worker?.terminate();
        worker = null;
        if (cancelled) return;
        setStretching(false);
        if (e.data.error || !e.data.left || !e.data.right) {
          toast.error("Couldn't time stretch the video sound", { description: e.data.error });
          return;
        }
        const ctx = getEngine().init();
        const out = ctx.createBuffer(2, e.data.left.length, buffer.sampleRate);
        out.copyToChannel(e.data.left as Float32Array<ArrayBuffer>, 0);
        out.copyToChannel(e.data.right as Float32Array<ArrayBuffer>, 1);
        registered = getEngine().registerBuffer(out, "video-stretch");
        setStretched({ url: registered, speed });
      };
      worker.onerror = () => {
        if (!cancelled) setStretching(false);
      };
      worker.postMessage({ left, right, speed }, [left.buffer, right.buffer]);
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      worker?.terminate();
      if (registered) getEngine().releaseBuffer(registered);
    };
  }, [buffer, stretchOn, speed]);
  const playUrl =
    stretchOn && speed !== 1 ? (stretched?.speed === speed ? stretched.url : null) : audioUrl;

  /** The mixer channel every video pad plays through (made on first hit, never armed). */
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const madeTrack = useRef<{ id: string; at: number } | null>(null);
  const ensureTrack = () => {
    const existing = tracksRef.current.find((t) => isVideoSamplerTrack(t));
    if (existing) return existing.id;
    const made = madeTrack.current;
    if (made && Date.now() - made.at < 1500) return made.id;
    const id = addTrack("sampler", "VIDEO SAMPLER", undefined, { keepPanel: true });
    madeTrack.current = { id, at: Date.now() };
    return id;
  };
  const chopSound = (i: number): PadSound => ({ ...DEFAULT_PAD_SOUND, ...(chopSounds[i] ?? {}) });
  const polyKeys = useRef(new Map<string, string[]>());
  const polyCount = useRef(0);
  const voiceKey = (base: string, sound: PadSound) => {
    if (sound.choke) return `vchoke${sound.choke}`;
    if (!sound.poly) return base;
    const key = `${base}~${polyCount.current++}`;
    polyKeys.current.set(base, [...(polyKeys.current.get(base) ?? []), key].slice(-32));
    return key;
  };
  /** Stops a chop's voices; `fade` (key release) lets them fade through the sound's release. */
  const stopVoices = (base: string, sound: PadSound, fade = false) => {
    const id = tracksRef.current.find((t) => isVideoSamplerTrack(t))?.id ?? madeTrack.current?.id;
    if (!id) return;
    const engine = getEngine();
    const stop = (key: string) =>
      fade ? engine.releaseVoiceKey(id, key) : engine.stopVoiceKey(id, key);
    stop(base);
    for (const key of polyKeys.current.get(base) ?? []) stop(key);
    polyKeys.current.delete(base);
    if (sound.choke) stop(`vchoke${sound.choke}`);
  };

  /** The picture follows the hit: it jumps to the chop and plays at the hit's speed. */
  const padDriven = useRef(false);
  const showPicture = (
    i: number | null,
    a: number,
    b: number,
    rate: number,
    delay: number,
    loop: boolean,
  ) => {
    window.setTimeout(() => {
      const v = video.current;
      if (!v) return;
      window.clearTimeout(stopTimer.current);
      padDriven.current = true;
      v.muted = true;
      v.playbackRate = clampRate(rate);
      v.currentTime = a;
      void v.play().catch(() => undefined);
      setActive(i);
      const span = Math.max(0.05, (b - a) / clampRate(rate));
      const end = () => {
        if (loop) {
          v.currentTime = a;
          stopTimer.current = window.setTimeout(end, span * 1000);
          return;
        }
        v.pause();
        setActive(null);
      };
      stopTimer.current = window.setTimeout(end, span * 1000);
    }, delay);
  };
  const stopPicture = () => {
    window.clearTimeout(stopTimer.current);
    video.current?.pause();
    setActive(null);
  };

  /** One hit of chop i (at `when` on the audio clock, or now). */
  const trigger = (i: number, velocity = 1, when?: number) => {
    if (!buffer || !url || filming || i < 0 || i >= chops.length) return;
    const sound = chopSound(i);
    if (sound.mute) return;
    const [a, b] = range(i);
    if (b - a <= 0.005) return;
    const engine = getEngine();
    const now = engine.init().currentTime;
    const delay = Math.max(0, ((when ?? now) - now) * 1000);
    const source = playUrl ?? audioUrl;
    if (!bypassed && source) {
      engine.playSample(
        ensureTrack(),
        {
          ...sound,
          url: source,
          start: a / buffer.duration,
          end: b / buffer.duration,
          rootNote: 60,
          sampleBpm: undefined,
          syncToBpm: false,
        },
        60,
        undefined,
        velocity,
        when,
        voiceKey(`vchop${i}`, sound),
      );
    }
    showPicture(i, a, b, speed * Math.pow(2, padTune(sound) / 12), delay, sound.loop);
  };
  const releaseChop = (i: number) => {
    repeater.current?.release(`chop:${i}`);
    const sound = chopSound(i);
    if (!stopsOnRelease(sound)) return;
    stopVoices(`vchop${i}`, sound, true);
    if (active === i) stopPicture();
  };

  const [multi, setMultiState] = useState<MultiPitchSettings>(() => videoMultiPitch);
  const multiOn = multi.mode !== "off";
  const setMulti = (next: MultiPitchSettings) => {
    videoMultiPitch = next;
    setMultiState(next);
    const id = tracksRef.current.find((t) => isVideoSamplerTrack(t))?.id;
    if (id) getEngine().stopSamples(id);
  };
  /**
   * Multi pitch plays the chosen chop (with its own sound) at each pitch through the same
   * channel; the picture follows the first note. Pitch and speed move together, like an MPC.
   */
  const playMulti = (voice: string, pitches: number[], velocity = 1, when?: number) => {
    if (!buffer || !url || filming || !pitches.length) return;
    const src = multi.source;
    if (src >= chops.length) return;
    const [a, b] = src < 0 ? ([0, buffer.duration] as const) : range(src);
    if (b - a <= 0.005) return;
    const sound = src >= 0 ? chopSound(src) : DEFAULT_PAD_SOUND;
    if (sound.mute) return;
    const engine = getEngine();
    const now = engine.init().currentTime;
    const delay = Math.max(0, ((when ?? now) - now) * 1000);
    const source = playUrl ?? audioUrl;
    const keys = multiPitchVoiceKeys(voice);
    if (!bypassed && source) {
      const id = ensureTrack();
      pitches.forEach((p, k) =>
        engine.playSample(
          id,
          {
            ...sound,
            url: source,
            start: a / buffer.duration,
            end: b / buffer.duration,
            rootNote: 60,
            sampleBpm: undefined,
            syncToBpm: false,
          },
          60 + p,
          undefined,
          velocity,
          when,
          keys[k],
        ),
      );
    }
    showPicture(
      src >= 0 ? src : null,
      a,
      b,
      speed * Math.pow(2, (padTune(sound) + (pitches[0] ?? 0)) / 12),
      delay,
      sound.loop,
    );
  };
  const releaseMulti = (pad: number) => {
    repeater.current?.release(`mp:${pad}`);
    releaseMultiVoice(`mp${pad}`);
  };
  /** Gate: letting go fades out the multi pitch notes started under this voice name. */
  const releaseMultiVoice = (voice: string) => {
    const sound = multi.source >= 0 ? chopSound(multi.source) : DEFAULT_PAD_SOUND;
    if (!stopsOnRelease(sound)) return;
    const id = tracksRef.current.find((t) => isVideoSamplerTrack(t))?.id;
    if (id) for (const key of multiPitchVoiceKeys(voice)) getEngine().releaseVoiceKey(id, key);
    stopPicture();
  };

  /* Note Repeat: holding a chop pad keeps hitting it at the chosen rate and swing. */
  const [repeat, setRepeatState] = useState<NoteRepeatSettings>(() => videoNoteRepeat);
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  const setRepeat = (next: NoteRepeatSettings) => {
    videoNoteRepeat = next;
    setRepeatState(next);
    if (!next.on) repeater.current?.releaseAll();
  };
  const fireRef = useRef<(key: string, when: number, velocity: number) => void>(() => {});
  fireRef.current = (key, when, velocity) => {
    const [kind, n] = key.split(":");
    const i = Number(n);
    if (kind === "mp") playMulti(`mp${i}`, padPitches(i, multi), velocity, when);
    else trigger(i, velocity, when);
  };
  const repeater = useRef<ReturnType<typeof createNoteRepeater> | null>(null);
  if (!repeater.current)
    repeater.current = createNoteRepeater({
      now: () => getEngine().init().currentTime,
      bpm: () => getEngine().tempo || 120,
      settings: () => repeatRef.current,
      fire: (key, when, velocity) => fireRef.current(key, when, velocity),
    });
  useEffect(() => () => repeater.current?.releaseAll(), []);
  const pressChop = (i: number, velocity = 1) => {
    setEditIdx(i);
    if (repeatRef.current.on) repeater.current?.press(`chop:${i}`, velocity);
    else trigger(i, velocity);
  };
  const pressMulti = (pad: number, velocity = 1) => {
    if (repeatRef.current.on) repeater.current?.press(`mp:${pad}`, velocity);
    else playMulti(`mp${pad}`, padPitches(pad, multi), velocity);
  };

  const heldMidi = useRef(new Map<string, { index: number; multi: boolean }>());
  const learnNote = (index: number, pitch: number, channel: number) => {
    setMidiNotes((notes) => assignVideoPadNote(notes, index, { pitch, channel }));
    setLearnPad(null);
    toast.success(`Pad ${index + 1} · MIDI note ${pitch}, channel ${channel + 1}`);
  };
  useEffect(() =>
    claimMidiNotes((msg) => {
      if (msg.type !== "on" && msg.type !== "off") return false;
      const key = `${msg.channel}:${msg.pitch}`;
      if (msg.type === "off") {
        const held = heldMidi.current.get(key);
        heldMidi.current.delete(key);
        if (held !== undefined) {
          if (held.multi) releaseMulti(held.index);
          else releaseChop(held.index);
        }
        return consumedNotes.current.delete(key);
      }
      if (filming || !chops.length) return false;
      if (learnPad !== null && learnPad < chops.length) {
        consumedNotes.current.add(key);
        learnNote(learnPad, msg.pitch, msg.channel);
        return true;
      }
      const index = midiNotes.findIndex(
        (note, i) => i < chops.length && note?.pitch === msg.pitch && note.channel === msg.channel,
      );
      if (index < 0) return false;
      consumedNotes.current.add(key);
      heldMidi.current.set(key, { index, multi: multiOn });
      const velocity = Math.max(0.05, Math.min(1, msg.velocity / 127));
      if (multiOn) pressMulti(index, velocity);
      else pressChop(index, velocity);
      return true;
    }),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (e.target as HTMLElement)?.isContentEditable ||
        (e.target as HTMLElement)?.closest("input,textarea,select")
      )
        return;
      const i = PAD_KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && multiOn && i < 16 && !filming) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) pressMulti(i);
        return;
      }
      if (i >= 0 && i < chops.length && !filming) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) pressChop(i);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const i = PAD_KEYS.indexOf(e.key.toLowerCase());
      if (i < 0) return;
      if (multiOn && i < 16) releaseMulti(i);
      else if (i < chops.length) releaseChop(i);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  });

  const slice = (from: number, to: number) => {
    if (!buffer) return null;
    const s = Math.floor(from * buffer.sampleRate),
      e = Math.floor(to * buffer.sampleRate);
    let left: Float32Array = buffer.getChannelData(0).slice(s, e);
    let right: Float32Array = (
      buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)
    ).slice(s, e);
    if (speed !== 1 && left.length > 4096) {
      left = wsolaStretch(left, speed);
      right = wsolaStretch(right, speed);
    }
    return { left, right, sampleRate: buffer.sampleRate };
  };
  const toProject = async (i?: number) => {
    if (!buffer) return;
    const [a, b] = i == null ? [0, buffer.duration] : range(i);
    const cap = slice(a, b);
    if (!cap) return;
    const base = i == null ? "Video audio" : `Video chop ${i + 1}`;
    const name = speed !== 1 ? `${base} ${targetBpm} BPM` : base;
    const audio = await getEngine().loadSampleFile(encodeWav(cap), name);
    const id = addTrack("audio", name, undefined, { keepPanel: true });
    addClip(id, {
      ...audio,
      id: uid(),
      name,
      start: getPlayStep(),
      offset: 0,
      length: audio.duration,
    });
    toast.success(`${name} added at the playhead`);
  };

  return (
    <section
      className={`space-y-3${skinned ? " studio-wallpaper rounded-md p-3" : ""}`}
      aria-label="Video sampler"
      data-skin-panel="video"
      style={skinBackground(skin)}
      {...skinDrop}
    >
      <SkinControls skinKey="video" image />
      <div className="flex items-center justify-between gap-2">
        <span className="label-xs">SYNCLAB · VIDEO SAMPLER</span>
        <BypassButton
          name="Video Sampler"
          bypassed={bypassed}
          onToggle={() => setBypassed((value) => !value)}
        />
      </div>
      <div className="overflow-hidden rounded border border-border bg-background">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Video size">
          <span className="font-mono text-[10px] text-muted-foreground">VIDEO SIZE</span>
          {(
            [
              ["S", 160],
              ["M", 260],
              ["L", 380],
              ["XL", 520],
            ] as const
          ).map(([l, h]) => (
            <Button
              key={l}
              size="sm"
              variant={videoHeight === h ? "default" : "outline"}
              className="h-9 min-w-10"
              aria-label={`Video size ${l}`}
              onClick={() => setVideoSize(h)}
            >
              {l}
            </Button>
          ))}
          <input
            type="range"
            min={120}
            max={720}
            step={10}
            value={videoHeight}
            onChange={(e) => setVideoSize(Number(e.target.value))}
            aria-label="Video height"
            className="min-w-24 flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() =>
              void video.current
                ?.requestFullscreen?.()
                .catch(() => toast.error("Full screen isn't available here"))
            }
          >
            Full screen
          </Button>
        </div>
        <video
          ref={video}
          src={url ?? undefined}
          muted={bypassed || filming}
          playsInline
          style={{ height: `${videoHeight}px` }}
          className="w-full bg-background object-contain"
          controls={!filming && !!url}
          aria-label="Video sample"
          onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
          onSeeked={(e) => setPosition(e.currentTarget.currentTime)}
          onEnded={() => setActive(null)}
          onPlay={(e) => {
            // Pads play their sound through the mixer, so the picture stays silent for them;
            // playing the video yourself with its controls brings its own sound back.
            if (!padDriven.current) e.currentTarget.muted = bypassed || filming;
          }}
          onPause={() => {
            padDriven.current = false;
          }}
        />
      </div>
      {buffer && (
        <div
          className="space-y-1 border-b border-border bg-background py-2"
          aria-label="Video audio waveform editor"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              Video audio · {position.toFixed(2)} / {buffer.duration.toFixed(2)}s
            </span>
            <Button
              variant={manualSlice ? "default" : "outline"}
              className="h-9"
              aria-pressed={manualSlice}
              onClick={() => setManualSlice((value) => !value)}
            >
              <Scissors />
              Manual slice
            </Button>
          </div>
          <div
            ref={waveform}
            className="relative h-36 min-h-36 w-full overflow-hidden rounded border border-border bg-surface-2 touch-pan-y"
            aria-label="Video chop waveform"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              const time = waveformTime(e.clientX, e.clientY);
              seek(time);
              if (manualSlice) addChop(time);
            }}
          >
            <WaveformView peaks={peaks} label="Video audio waveform" />
            {gridLines.map((time) => (
              <div
                key={time}
                className="pointer-events-none absolute inset-y-0 border-l border-border"
                style={{ left: `${(time / buffer.duration) * 100}%` }}
                aria-hidden="true"
              />
            ))}
            {chops.map((time, i) => (
              <Button
                key={i}
                variant="ghost"
                className="absolute inset-y-0 z-10 h-full w-9 -translate-x-1/2 touch-none rounded-none p-0 text-destructive hover:bg-transparent"
                style={{ left: `${(time / buffer.duration) * 100}%` }}
                aria-label={`Edit video chop ${i + 1}`}
                title={`Chop ${i + 1} · ${time.toFixed(2)}s`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  dragChop.current = { index: i, pointer: e.pointerId };
                  e.currentTarget.setPointerCapture(e.pointerId);
                  seek(time);
                }}
                onPointerMove={(e) => {
                  if (dragChop.current?.pointer === e.pointerId && dragChop.current.index === i)
                    editChop(i, waveformTime(e.clientX, e.clientY));
                }}
                onPointerUp={() => {
                  dragChop.current = null;
                }}
                onPointerCancel={() => {
                  dragChop.current = null;
                }}
                onLostPointerCapture={() => {
                  dragChop.current = null;
                }}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  const delta = noteGrid ? 240 / sourceBpm / noteGrid : 0.01;
                  editChop(i, time + (e.key === "ArrowLeft" ? -delta : delta));
                }}
                onClick={() => seek(time)}
              >
                <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 bg-destructive" />
                <span className="pointer-events-none absolute top-0 bg-destructive px-1 font-mono text-xs text-destructive-foreground">
                  {i + 1}
                </span>
              </Button>
            ))}
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-foreground"
              style={{ left: `${Math.min(100, (position / buffer.duration) * 100)}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
              <span key={fraction}>{(buffer.duration * fraction).toFixed(2)}s</span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 py-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Note grid
              <select
                aria-label="Video note grid"
                value={noteGrid}
                className="h-10 rounded border border-border bg-surface-2 px-2 text-foreground"
                onChange={(e) => setNoteGrid(Number(e.target.value))}
              >
                <option value={0}>Off</option>
                {[1, 2, 4, 8, 16, 32, 64].map((n) => (
                  <option key={n} value={n}>
                    1/{n}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-muted-foreground">Chops</span>
            <div className="flex gap-1" role="group" aria-label="Video chop counts">
              {[4, 8, 12, 16].map((n) => (
                <Button
                  key={n}
                  variant={chopCount === n ? "secondary" : "outline"}
                  className="h-10 min-w-10 px-2 font-mono"
                  aria-label={`Make ${n} video chops`}
                  onClick={() => evenChops(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1"
            aria-label="Video time stretch"
          >
            <Button
              variant={stretchOn ? "default" : "outline"}
              className="h-9"
              aria-pressed={stretchOn}
              onClick={() => setStretchOn((v) => !v)}
            >
              Time stretch {stretchOn ? "on" : "off"}
            </Button>
            <label className="flex items-center gap-1">
              Video BPM
              <input
                type="number"
                min={40}
                max={240}
                value={sourceBpm}
                aria-label="Video source BPM"
                className="h-9 w-16 rounded border border-border bg-surface-2 px-1 font-mono text-foreground"
                onChange={(e) =>
                  setSourceBpm(Math.max(40, Math.min(240, Number(e.target.value) || 120)))
                }
              />
            </label>
            <label className="flex items-center gap-1">
              Target
              <input
                type="number"
                min={40}
                max={240}
                value={targetBpm}
                aria-label="Video target BPM"
                className="h-9 w-16 rounded border border-border bg-surface-2 px-1 font-mono text-foreground"
                onChange={(e) =>
                  setTargetBpm(Math.max(40, Math.min(240, Number(e.target.value) || 120)))
                }
              />
            </label>
            <Button
              variant="ghost"
              className="h-9 px-2"
              onClick={() => setTargetBpm(Math.round(getEngine().tempo || 120))}
            >
              Song tempo
            </Button>
            <span className="font-mono">
              {Math.round(speed * 100)}% · {(buffer.duration / speed).toFixed(2)}s, pitch kept
            </span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="h-11"
          disabled={filming}
          onClick={() => file.current?.click()}
        >
          <Upload />
          Load video
        </Button>
        <input
          ref={file}
          hidden
          type="file"
          accept="video/*"
          aria-label="Load video sample"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadBlob(f);
            e.target.value = "";
          }}
        />
        <Button
          variant={filming ? "destructive" : "outline"}
          className="h-11"
          onClick={() => void film()}
        >
          {filming ? <Square /> : <Circle className="text-destructive" />}
          {filming ? "Stop filming" : "Record video"}
        </Button>
        <Button
          variant="outline"
          className="h-11"
          disabled={!buffer}
          onClick={() => void toProject()}
        >
          <Plus />
          Add to timeline
        </Button>
        <SampleExportButtons
          timeline={false}
          className="h-11 gap-1.5"
          name={kitName()}
          getCapture={() => (buffer ? slice(0, buffer.duration) : null)}
        />
        <Button
          variant="outline"
          className="h-11"
          disabled={!buffer || saving}
          onClick={() => void saveKit()}
        >
          <Save />
          {saving ? "Saving…" : "Save video & chops"}
        </Button>
        <Button
          variant="secondary"
          className="h-11"
          disabled={!buffer}
          onClick={() => void openInSampler()}
          title="Opens the audio and chops in the full Sampler: trim, envelope, filter, chop banks, choke, keyboard and stretch"
        >
          Open in Sampler
        </Button>
      </div>
      {buffer && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            Chop sensitivity
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={sensitivity}
              className="accent-primary"
              onChange={(e) => setSensitivity(Number(e.target.value))}
            />
          </label>
          <Button variant="secondary" className="h-9" onClick={() => chopAll(buffer, sensitivity)}>
            <Scissors />
            Auto-chop
          </Button>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => addChop(video.current?.currentTime ?? 0)}
          >
            Chop at video position
          </Button>
          <label className="flex items-center gap-1">
            <Grid3x3 className="size-4" />
            <select
              aria-label="Even chops"
              className="h-9 rounded border border-border bg-background px-2 text-foreground"
              value=""
              onChange={(e) => {
                if (e.target.value) evenChops(Number(e.target.value));
              }}
            >
              <option value="">Even chops</option>
              {[2, 4, 8, 12, 16].map((n) => (
                <option key={n} value={n}>
                  {n} equal
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="ghost"
            className="h-9"
            disabled={!chops.length}
            onClick={() => {
              setChops([]);
              setChopSounds([]);
            }}
          >
            Clear chops
          </Button>
          <span>
            {chops.length} chops · {buffer.duration.toFixed(1)}s
          </span>
        </div>
      )}
      {buffer && (
        <MultiPitchModeSwitch
          settings={multi}
          disabled={filming}
          onChange={(next) =>
            setMulti({ ...next, source: next.source < chops.length ? next.source : -1 })
          }
        />
      )}
      {buffer && <NoteRepeatBar settings={repeat} onChange={setRepeat} disabled={filming} />}
      {buffer && stretching && (
        <p className="font-mono text-[11px] text-muted-foreground" role="status">
          Rendering the time stretch for the pads… they play at the original tempo until it's ready.
        </p>
      )}
      {buffer && multiOn && (
        <MultiPitchPads
          settings={multi}
          onChange={setMulti}
          sources={[
            { value: -1, label: "Whole video sound" },
            ...chops.map((t, i) => ({ value: i, label: `Chop ${i + 1} · ${t.toFixed(2)}s` })),
          ]}
          onPress={(pad) => pressMulti(pad)}
          onRelease={(pad) => releaseMulti(pad)}
          padKeys={PAD_KEYS}
          disabled={filming}
        />
      )}
      {chops.length > 0 && !multiOn && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Video chop pads">
          {chops.map((t, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-1">
              <Button
                variant="secondary"
                data-active={active === i}
                data-pad-color={i % 4}
                aria-pressed={active === i}
                disabled={filming}
                className={`video-chop-pad h-36 min-w-0 touch-none flex-col gap-2 border px-3 py-2 text-xs ${editIdx === i ? "ring-2 ring-primary" : ""} ${chopSounds[i]?.mute ? "opacity-50" : ""}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    /* pointer capture is unavailable in a few mobile webviews */
                  }
                  pressChop(i);
                }}
                onPointerUp={() => releaseChop(i)}
                onPointerCancel={() => releaseChop(i)}
                onLostPointerCapture={() => releaseChop(i)}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                    e.preventDefault();
                    pressChop(i);
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === " " || e.key === "Enter") releaseChop(i);
                }}
                aria-label={`Play video chop ${i + 1}`}
              >
                <span className="flex w-full justify-between font-mono text-sm">
                  <span>{i + 1}</span>
                  <span>
                    {PAD_KEYS[i]?.toUpperCase()} ·{" "}
                    {
                      [
                        "C",
                        "C♯",
                        "D",
                        "D♯",
                        "E",
                        "F",
                        "F♯",
                        "G",
                        "G♯",
                        "A",
                        "A♯",
                        "B",
                        "C",
                        "C♯",
                        "D",
                        "D♯",
                      ][i]
                    }
                    {i < 12 ? "4" : "5"}
                  </span>
                </span>
                <span className="pointer-events-none block h-16 w-full overflow-hidden">
                  <WaveformView
                    color="var(--display-wave)"
                    grid={false}
                    className="!h-full !w-full"
                    peaks={padPeaks[i] ?? []}
                    label={`Video chop ${i + 1} waveform`}
                  />
                </span>
                <span className="font-mono text-[10px]">
                  {chopSounds[i]?.mute ? "MUTED · " : ""}
                  {t.toFixed(2)}–{(chops[i + 1] ?? buffer?.duration ?? 0).toFixed(2)}s
                </span>
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant={learnPad === i ? "default" : "outline"}
                  className="h-10 min-w-0 flex-1 px-1 text-xs"
                  aria-label={`MIDI Learn video pad ${i + 1}`}
                  aria-pressed={learnPad === i}
                  disabled={filming}
                  onClick={() => {
                    if (learnPad === i) {
                      setLearnPad(null);
                      return;
                    }
                    setLearnPad(i);
                    if (!midiInputId) enableMidi();
                  }}
                >
                  {learnPad === i
                    ? "Press a key…"
                    : midiNotes[i]
                      ? `MIDI ${midiNotes[i]?.pitch} · CH ${(midiNotes[i]?.channel ?? 0) + 1}`
                      : "MIDI Learn"}
                </Button>
                {midiNotes[i] && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10"
                    aria-label={`Clear video pad ${i + 1} MIDI mapping`}
                    onClick={() =>
                      setMidiNotes((notes) => notes.map((note, j) => (j === i ? null : note)))
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
              <label className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
                Start
                <input
                  type="number"
                  min={chops[i - 1] == null ? 0 : (chops[i - 1] ?? 0) + 0.01}
                  max={(chops[i + 1] ?? buffer?.duration ?? 0) - 0.01}
                  step={0.01}
                  value={Number(t.toFixed(3))}
                  aria-label={`Video chop ${i + 1} start seconds`}
                  className="h-9 w-20 rounded border border-border bg-surface-2 px-1 font-mono text-foreground"
                  onChange={(e) => {
                    const value = e.currentTarget.valueAsNumber;
                    if (Number.isFinite(value))
                      editChop(i, snapVideoTime(value, sourceBpm, noteGrid));
                  }}
                />
              </label>
              <div className="flex">
                <Button
                  variant="ghost"
                  className="h-10 flex-1 px-1 text-xs"
                  onClick={() => void toProject(i)}
                >
                  <Plus className="size-3" />
                  To track
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 w-10 p-0"
                  aria-label={`Delete video chop ${i + 1}`}
                  onClick={() => removeChop(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {chops.length > 0 && !multiOn && (
        <section
          className="space-y-2 rounded-md border border-border bg-surface-2/40 p-2"
          aria-label="Video chop edit"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-xs">CHOP {Math.min(editIdx, chops.length - 1) + 1} EDIT</span>
            <span className="text-[11px] text-muted-foreground">Tap a chop pad to edit it.</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-8 text-[11px]"
              onClick={() => {
                const i = Math.min(editIdx, chops.length - 1);
                const sound = chopSounds[i] ?? null;
                setChopSounds(chops.map(() => (sound ? { ...sound } : null)));
                toast.success(`Chop ${i + 1}'s sound copied to all ${chops.length} chops`);
              }}
            >
              Copy to all chops
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[11px]"
              onClick={() => {
                const i = Math.min(editIdx, chops.length - 1);
                setChopSounds((c) => c.map((x, j) => (j === i ? null : x)));
              }}
            >
              Reset chop
            </Button>
          </div>
          <PadSoundEditor
            key={`video-chop-${Math.min(editIdx, chops.length - 1)}`}
            name={`Video chop ${Math.min(editIdx, chops.length - 1) + 1}`}
            sound={chopSounds[Math.min(editIdx, chops.length - 1)] ?? {}}
            sections={["tune", "amp", "filter", "pitchEnv", "playback"]}
            onChange={(next) => {
              const i = Math.min(editIdx, chops.length - 1);
              if ("choke" in next || "poly" in next || "mute" in next || "loop" in next)
                stopVoices(`vchop${i}`, chopSound(i));
              setChopSounds((c) => {
                const out = [...c];
                while (out.length <= i) out.push(null);
                out[i] = { ...(out[i] ?? {}), ...next };
                return out;
              });
            }}
          />
        </section>
      )}
      {chops.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10" onClick={() => enableMidi()}>
            Connect MIDI keyboard
          </Button>
          <select
            aria-label="Video MIDI input"
            className="h-10 max-w-full rounded border border-border bg-surface px-2 text-xs text-foreground"
            value={midiInputId ?? ""}
            onChange={(e) => setMidiInput(e.target.value || null)}
          >
            <option value="">None</option>
            <option value="all">All devices</option>
            {midiInputs.map((input) => (
              <option key={input.id} value={input.id}>
                {input.name}
              </option>
            ))}
          </select>
          {!midiSupported() && (
            <span className="text-xs text-muted-foreground">
              Hardware MIDI needs a supported browser, such as Chrome or Edge.
            </span>
          )}
        </div>
      )}
      {(chops.length > 0 || (buffer && multiOn)) && (
        <Button
          variant={showKeyboard ? "secondary" : "outline"}
          aria-pressed={showKeyboard}
          onClick={() => setShowKeyboard((value) => !value)}
        >
          <Piano className="size-4" />
          {showKeyboard ? "Hide keyboard" : "Show keyboard"}
        </Button>
      )}
      {(chops.length > 0 || (buffer && multiOn)) && showKeyboard && (
        <section
          aria-label="Video sampler keyboard"
          className="min-w-0 border-t border-border pt-3"
        >
          <Keyboard
            skinKey="video-keyboard"
            disabled={filming}
            {...(multiOn ? {} : { mappedPads: { count: chops.length, active, keys: PAD_KEYS } })}
            onPlay={(note) => {
              if (learnPad !== null) {
                learnNote(learnPad, note, 0);
                return;
              }
              if (multiOn) {
                playMulti(`key${note}`, notePitches(note - 60, multi));
                return;
              }
              const index = videoPadForNote(note, chops.length);
              if (index !== null) {
                setEditIdx(index);
                trigger(index);
              }
            }}
            onRelease={(note) => {
              if (multiOn) {
                releaseMultiVoice(`key${note}`);
                return;
              }
              const index = videoPadForNote(note, chops.length);
              if (index !== null) releaseChop(index);
            }}
          />
        </section>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Chop pads play the video's sound through its own VIDEO SAMPLER mixer channel, so faders,
        sends and effects apply. The picture plays forward at the hit's speed (reverse and envelopes
        are sound-only). Video itself is not exported with the song. Audio decoding depends on
        browser codec support. Account saving requires sign-in.
      </p>
    </section>
  );
}
