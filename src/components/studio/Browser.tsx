import { getPlayStep, usePlayStep } from "@/lib/synclab/playhead";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  ChevronDown,
  ChevronRight,
  Drum,
  FolderOpen,
  Folder,
  Music2,
  Play,
  Plus,
  Save,
  Search,
  Square,
  Sparkles,
  Star,
  Waves,
  X,
  Library,
} from "lucide-react";
import { useStudio } from "@/lib/synclab/store";
import { useApp } from "@/lib/synclab/app-state";
import { DRUM_KITS, SYNTH_PRESETS, defaultPads, uid } from "@/lib/synclab/presets";
import { getEngine } from "@/lib/synclab/audio-engine";
import { listCloudProjects, loadCloudProject, type CloudProject } from "@/lib/synclab/cloud";
import { listUserTemplates, type UserTemplate } from "@/lib/synclab/user-templates";
import { TEMPLATES, templateById } from "@/lib/synclab/templates";
import type { DrumKitId, DrumPad } from "@/lib/synclab/types";
import { toast } from "sonner";
import {
  clipFromLocalFile,
  pickFolder,
  playPreview,
  stopPreview,
  onPreviewChange,
  getLocalFile,
  getPreviewAnalyser,
  getLocalFolders,
  addLocalFolder,
  removeLocalFolder,
  onFoldersChange,
} from "@/lib/synclab/local-files";
import { LibraryPanel } from "./LibraryPanel";
import { availableEffects, effectBrand, groupByCategory } from "@/lib/synclab/effect-catalog";

/** Bottom-of-browser player: shows the file being previewed with a live waveform scope. */
function PreviewPlayer({ playingFile }: { playingFile: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const file = playingFile ? getLocalFile(playingFile) : undefined;

  useEffect(() => {
    if (!playingFile) return;
    let raf = 0;
    let last = 0;
    const data = new Float32Array(2048);
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 50) return; // 20 fps, off the audio path
      last = t;
      const canvas = canvasRef.current;
      const an = getPreviewAnalyser();
      if (!canvas || !an) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = (canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1));
      const h = (canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1));
      an.getFloatTimeDomainData(data);
      ctx.clearRect(0, 0, w, h);
      const color = getComputedStyle(canvas).color || "#7ef0c8";
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, h / 24);
      ctx.beginPath();
      const n = data.length;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = h / 2 - data[i]! * (h / 2) * 0.9;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playingFile]);

  if (!playingFile) return null;
  return (
    <div className="sticky bottom-0 z-10 mt-2 flex items-center gap-2 border border-primary/40 bg-surface-1/95 p-2 backdrop-blur">
      <button
        type="button"
        aria-label={`Stop playing ${file?.name ?? "file"}`}
        onClick={() => stopPreview()}
        className="grid size-7 shrink-0 place-items-center rounded-[3px] border border-border text-primary hover:border-primary"
      >
        <Square className="size-3 fill-current" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[10px] text-primary">{file?.name ?? "Preview"}</p>
        <canvas
          ref={canvasRef}
          className="h-8 w-full text-primary"
          aria-label="Waveform scope of the playing file"
        />
      </div>
    </div>
  );
}

const SAMPLE_PACKS: { pack: string; samples: { name: string; kind: string }[] }[] = [
  {
    pack: "DETROIT TECHNO KIT",
    samples: [
      { name: "303 ACID LOOP", kind: "LOOP" },
      { name: "WAREHOUSE KICK", kind: "KICK" },
      { name: "METRO SNARE", kind: "SNARE" },
      { name: "HI-NRG HAT", kind: "HAT" },
      { name: "INDUSTRIAL CLANG", kind: "FX" },
    ],
  },
  {
    pack: "ELECTRO 808",
    samples: [
      { name: "808 BOOM", kind: "KICK" },
      { name: "808 SNAP", kind: "SNARE" },
      { name: "CYBOTRON TOM", kind: "TOM" },
      { name: "ELECTRO CLAP", kind: "CLAP" },
    ],
  },
  {
    pack: "GHETTO PERCUSSION",
    samples: [
      { name: "JIT PERC LOOP", kind: "LOOP" },
      { name: "RIM SHOT", kind: "RIM" },
      { name: "SHAKER 16", kind: "SHAKER" },
      { name: "CONGA HIT", kind: "PERC" },
    ],
  },
  {
    pack: "HOUSE CHORDS & STABS",
    samples: [
      { name: "DEEP CHORD STAB", kind: "STAB" },
      { name: "ORGAN RIFF", kind: "LOOP" },
      { name: "PIANO HOUSE LOOP", kind: "LOOP" },
      { name: "BRASS HIT", kind: "STAB" },
    ],
  },
  {
    pack: "VOCALS & FX",
    samples: [
      { name: "ROBOT VOX PHRASE", kind: "VOX" },
      { name: "VOCODER CHANT", kind: "VOX" },
      { name: "RISER SWEEP", kind: "FX" },
      { name: "DOWNLIFTER", kind: "FX" },
      { name: "VINYL CRACKLE", kind: "FX" },
    ],
  },
];

const EFFECT_PLUGINS: { name: string; desc: string; fx: string }[] = [
  { name: "Tube Saturation", desc: "Warm analog drive", fx: "saturation" },
  { name: "Distortion Unit", desc: "Hard clipping aggression", fx: "distortion" },
  { name: "Dimension Chorus", desc: "Wide ensemble movement", fx: "chorus" },
  { name: "Jet Flanger", desc: "Sweeping comb jet", fx: "flanger" },
  { name: "Phase Shifter", desc: "Slow rotary phase", fx: "phaser" },
  { name: "Tape Delay", desc: "Echo with feedback", fx: "delay" },
  { name: "Hall Reverb", desc: "Large space ambience", fx: "reverb" },
  { name: "Bit Crusher", desc: "Lo-fi sample reduction", fx: "bitcrush" },
];

const peaksFromName = (name: string) => {
  let seed = 0;
  for (const c of name) seed = (seed * 31 + c.charCodeAt(0)) % 9973;
  return Array.from({ length: 96 }, (_, i) => {
    seed = (seed * 16807) % 2147483647;
    return 0.25 + ((seed % 1000) / 1000) * 0.7 * Math.max(0.25, Math.sin(i / 9));
  });
};

/** Map a sample's label to the closest real drum voice for the preview. */
const PREVIEW_KIND: Record<string, DrumPad["kind"]> = {
  KICK: "kick",
  SNARE: "snare",
  CLAP: "clap",
  HAT: "hat",
  SHAKER: "hat",
  TOM: "tom",
  RIM: "rim",
  PERC: "perc",
  LOOP: "perc",
  STAB: "perc",
  VOX: "fx",
  FX: "fx",
};

/** A favorite is a re-runnable action, stored so stars survive reloads. */
type Fav =
  | { key: string; type: "sample"; label: string; sub: string; sample: string; pack: string }
  | { key: string; type: "plugin"; label: string; sub: string; fx: string }
  | { key: string; type: "preset"; label: string; sub: string; preset: string }
  | { key: string; type: "instrument"; label: string; sub: string; preset: string }
  | { key: string; type: "kit"; label: string; sub: string; kit: DrumKitId };

const FAVS_KEY = "synclab.browser.favs";

const loadFavs = (): Fav[] => {
  try {
    return JSON.parse(window.localStorage.getItem(FAVS_KEY) ?? "[]") as Fav[];
  } catch {
    return [];
  }
};

export function Browser() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ computer: true, library: true });
  const [favs, setFavs] = useState<Fav[]>(loadFavs);
  const [cloud, setCloud] = useState<CloudProject[]>([]);
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [busyProject, setBusyProject] = useState<string | null>(null);
  const [folders, setFolders] = useState(getLocalFolders);
  useEffect(() => onFoldersChange(() => setFolders(getLocalFolders())), []);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  useEffect(() => onPreviewChange(setPlayingFile), []);
  useEffect(() => () => stopPreview(), []);
  const addLocalFile = async (id: string, name: string) => {
    try {
      const clip = await clipFromLocalFile(id, getPlayStep());
      const target = selected?.kind === "audio" ? selected.id : addTrack("audio", clip.name);
      if (!target) return;
      addClip(target, clip);
      toast.success(`${name} on the timeline`, { description: "Placed at the playhead" });
    } catch (err) {
      toast.error("Could not read that audio file", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };
  const openComputerFolder = async () => {
    try {
      const f = await pickFolder();
      if (!f) return;
      if (f.files.length === 0) {
        toast("No audio files in that folder", {
          description: "Looking for WAV, MP3, AIFF, FLAC, OGG and M4A.",
        });
        return;
      }
      addLocalFolder(f);
      setOpen((o) => ({ ...o, computer: true, [`cf:${f.id}`]: true }));
      toast.success(`${f.name}: ${f.files.length} audio file${f.files.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error("Couldn't open that folder", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };
  const {
    tracks,
    selected,
    select,
    addTrack,
    addClip,
    loadPreset,
    updatePatch,
    updateTrack,
    setPanel,
    restore,
    removeTrack,
    setTransport,
    transport,
    addPlugin,
    installedPlugins,
  } = useStudio();
  const { setProject } = useApp();

  useEffect(() => {
    void listCloudProjects()
      .then(setCloud)
      .catch(() => setCloud([]));
    setUserTemplates(listUserTemplates());
  }, []);

  const query = q.trim().toLowerCase();
  const match = (...fields: (string | undefined)[]) =>
    !query || fields.some((f) => f?.toLowerCase().includes(query));
  const searching = query.length > 0;

  const isOpen = (id: string, hasMatch: boolean) => (searching ? hasMatch : (open[id] ?? false));
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const toggleFav = (fav: Fav) => {
    setFavs((cur) => {
      const next = cur.some((f) => f.key === fav.key)
        ? cur.filter((f) => f.key !== fav.key)
        : [...cur, fav];
      try {
        window.localStorage.setItem(FAVS_KEY, JSON.stringify(next));
      } catch {
        /* storage full */
      }
      return next;
    });
  };
  const isFav = (key: string) => favs.some((f) => f.key === key);

  /* ---------- actions ---------- */

  const addSampleToTimeline = (sample: string, pack: string) => {
    const target =
      selected && (selected.kind === "audio" || selected.kind === "sampler")
        ? selected
        : tracks.find((t) => t.kind === "audio");
    const clip = {
      id: uid(),
      name: `${sample} (${pack})`,
      peaks: peaksFromName(sample),
      duration: 2,
    };
    if (target) {
      addClip(target.id, clip);
      select(target.id);
      toast.success(`Sample added to ${target.name}`, { description: clip.name });
    } else {
      const id = addTrack("audio", "SAMPLES");
      if (id) {
        addClip(id, clip);
        toast.success("Sample track created", { description: clip.name });
      }
    }
    setPanel(null);
  };

  /** Real on-device preview: synthesizes the closest drum voice through the master. */
  const previewSample = (sample: string) => {
    const kind = PREVIEW_KIND[sample] ?? "perc";
    const pad: DrumPad = {
      id: "browser-preview",
      name: sample,
      kit: "909",
      kind,
      volume: 0.9,
      pan: 0,
      pitch: 0,
      decay: 0.25,
      muted: false,
      solo: false,
      steps: [],
    };
    getEngine().playDrum("browser-preview", pad, 1);
  };

  const previewKit = (kit: DrumKitId) => {
    const def = DRUM_KITS.find((k) => k.id === kit);
    const engine = getEngine();
    const mk = (kind: DrumPad["kind"]): DrumPad => ({
      id: "browser-preview",
      name: kind,
      kit,
      kind,
      volume: 0.9,
      pan: 0,
      pitch: 0,
      decay: def?.decay ?? 0.25,
      muted: false,
      solo: false,
      steps: [],
    });
    engine.playDrum("browser-preview", mk("kick"), 1);
    window.setTimeout(() => engine.playDrum("browser-preview", mk("snare"), 0.9), 250);
    window.setTimeout(() => engine.playDrum("browser-preview", mk("hat"), 0.8), 375);
  };

  const addKitTrack = (kit: DrumKitId) => {
    const def = DRUM_KITS.find((k) => k.id === kit);
    const id = addTrack("drum", (def?.name ?? kit).toUpperCase());
    if (!id) return;
    // replace the default pads with this kit's voices
    updateTrack(id, { pads: defaultPads(16, kit) });
    toast.success(`${def?.name ?? kit} kit added`, {
      description: "New drum channel on the timeline.",
    });
    setPanel("drums");
  };

  const loadPresetOnto = (preset: string) => {
    const target = selected?.patch ? selected : tracks.find((t) => t.patch);
    if (target) {
      loadPreset(target.id, preset);
      select(target.id);
      toast.success(`Preset loaded on ${target.name}`, { description: preset });
      setPanel("synth");
    } else {
      addTrack("instrument", preset.toUpperCase(), preset);
      toast.success("Instrument added", { description: preset });
      setPanel(null);
    }
  };

  const insertEffect = (name: string, fx: string) => {
    const target = selected?.patch ? selected : tracks.find((t) => t.patch);
    if (!target?.patch) {
      toast("Select an instrument track first", {
        description: "Effects insert on the selected instrument channel.",
      });
      return;
    }
    const cur = target.patch.fx as Record<string, number | undefined>;
    const current = cur[fx] ?? 0;
    const next = current > 0 ? 0 : 0.45;
    const patchFx: Record<string, number> = { ...target.patch.fx, [fx]: next };
    if (fx === "delay" && next > 0) patchFx["delayFeedback"] = 0.35;
    updatePatch(target.id, { fx: { ...target.patch.fx, ...patchFx } });
    toast.success(next > 0 ? `${name} inserted` : `${name} bypassed`, {
      description: `on ${target.name}`,
    });
    setPanel("synth");
  };

  const openUserTemplate = (tpl: UserTemplate) => {
    restore(tpl.session);
    setProject({
      name: `${tpl.name} copy`,
      bpm: tpl.bpm,
      key: "A Minor",
      timeSig: "4/4",
      template: tpl.id,
      openedAt: Date.now(),
    });
    toast.success(`Started from “${tpl.name}”`);
    setPanel(null);
  };

  const openCloud = async (item: CloudProject) => {
    setBusyProject(item.id);
    try {
      const loaded = await loadCloudProject(item.id);
      if (!loaded.session) throw new Error("This project has no saved session.");
      restore(loaded.session);
      setProject({
        id: loaded.id,
        name: loaded.name,
        bpm: loaded.bpm,
        key: loaded.key,
        timeSig: loaded.timeSig,
        template: loaded.template,
        openedAt: Date.now(),
      });
      toast.success(`${loaded.name} opened from your cloud`);
      setPanel(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open cloud project");
    } finally {
      setBusyProject(null);
    }
  };

  const startFromTemplate = (templateId: string) => {
    const tpl = templateById(templateId);
    if (!tpl) return;
    for (const t of tracks) removeTrack(t.id);
    for (const t of tpl.tracks) addTrack(t.kind, t.name, t.preset);
    setTransport({ bpm: tpl.bpm, playing: false, recording: false, step: 0 });
    setProject({
      name: tpl.id === "empty" ? "Untitled Project" : tpl.name,
      bpm: tpl.bpm,
      key: tpl.key,
      timeSig: "4/4",
      template: tpl.id,
      openedAt: Date.now(),
    });
    toast.success(`${tpl.name} is open`, {
      description: `${tpl.bpm} BPM · ${tpl.key} · ${tpl.tracks.length} tracks`,
    });
    setPanel(null);
  };

  const runFav = (f: Fav) => {
    if (f.type === "sample") addSampleToTimeline(f.sample, f.pack);
    else if (f.type === "plugin") insertEffect(f.label, f.fx);
    else if (f.type === "preset") loadPresetOnto(f.preset);
    else if (f.type === "instrument") addTrack("instrument", f.preset.toUpperCase(), f.preset);
    else if (f.type === "kit") addKitTrack(f.kit);
  };

  /* ---------- row building blocks ---------- */

  const StarButton = ({ fav }: { fav: Fav }) => (
    <button
      type="button"
      aria-label={
        isFav(fav.key) ? `Remove ${fav.label} from favorites` : `Add ${fav.label} to favorites`
      }
      aria-pressed={isFav(fav.key)}
      onClick={(e) => {
        e.stopPropagation();
        toggleFav(fav);
      }}
      className={`shrink-0 ${isFav(fav.key) ? "text-amber-400" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-400"}`}
    >
      <Star className="size-3" fill={isFav(fav.key) ? "currentColor" : "none"} />
    </button>
  );

  const FolderHeader = ({
    id,
    icon,
    label,
    count,
    hasMatch,
    nested,
  }: {
    id: string;
    icon: React.ReactNode;
    label: string;
    count: number;
    hasMatch: boolean;
    nested?: boolean;
  }) => {
    const expanded = isOpen(id, hasMatch);
    return (
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-expanded={expanded}
        data-folder={id}
        className={`flex w-full items-center gap-1.5 border border-border bg-surface-2/60 px-2 py-1.5 text-left hover:border-primary/40 ${nested ? "ml-3 border-l-2" : ""}`}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-primary" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
        {expanded ? (
          <FolderOpen className="size-3.5 text-primary" />
        ) : (
          <Folder className="size-3.5 text-muted-foreground" />
        )}
        {icon}
        <span className="font-display text-[10px] font-semibold tracking-[0.15em]">{label}</span>
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">{count}</span>
      </button>
    );
  };

  /* ---------- filtered data ---------- */

  const filteredPacks = useMemo(
    () =>
      SAMPLE_PACKS.map((p) => ({
        ...p,
        samples: p.samples.filter((s) => match(s.name, s.kind, p.pack)),
      })).filter((p) => p.samples.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query],
  );
  const filteredPlugins = EFFECT_PLUGINS.filter((e) => match(e.name, e.desc, e.fx));
  const effects = availableEffects(installedPlugins);
  const filteredRack = effects.filter((d) => match(d.name, effectBrand(d), d.kind));
  const filteredPresets = SYNTH_PRESETS.filter((p) => match(p.name, p.category));
  const filteredKits = DRUM_KITS.filter((k) => match(k.name, k.desc, k.category));
  const filteredTemplates = TEMPLATES.filter((t) => match(t.name, t.key));
  const filteredCloud = cloud.filter((c) => match(c.name));
  const filteredUserTemplates = userTemplates.filter((t) => match(t.name));
  const filteredFavs = favs.filter((f) => match(f.label, f.sub));

  const samplesCount = SAMPLE_PACKS.reduce((n, p) => n + p.samples.length, 0);

  return (
    <div className="space-y-2">
      {/* search across every folder */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search files, samples, drums, instruments, plugins, presets, projects…"
          aria-label="Search the browser"
          className="h-8 w-full rounded-[3px] border border-border bg-background/70 pl-7 pr-7 font-mono text-[11px] outline-none placeholder:text-muted-foreground/60 focus:border-primary/60"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <p className="label-xs">
        Folders stay closed until you open them. Click a row to use it; press ▶ to hear it first.
      </p>

      {/* HOME — quick cards that open a folder */}
      {!searching && (
        <div className="grid grid-cols-2 gap-1.5">
          {[
            {
              id: "library",
              label: "My Library",
              sub: "Saved & uploaded files",
              icon: <Save className="size-4" />,
            },
            {
              id: "instruments",
              label: "Instruments",
              sub: "Synths and sounds",
              icon: <Music2 className="size-4" />,
            },
            {
              id: "plugins",
              label: "Effects",
              sub: "Built-in effects",
              icon: <Waves className="size-4" />,
            },
            {
              id: "samples",
              label: "Loops & samples",
              sub: "Sample packs",
              icon: <AudioLines className="size-4" />,
            },
            {
              id: "drums",
              label: "Drum kits",
              sub: "Kits for the drum machine",
              icon: <Drum className="size-4" />,
            },
            {
              id: "computer",
              label: "Files",
              sub: "Folders on your computer",
              icon: <FolderOpen className="size-4" />,
            },
            {
              id: "pool",
              label: "Pool",
              sub: "Audio used in this song",
              icon: <Library className="size-4" />,
            },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setOpen((o) => ({ ...o, [c.id]: true }));
                requestAnimationFrame(() =>
                  document
                    .querySelector(`[data-folder="${c.id}"]`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                );
              }}
              className="flex items-center gap-2 rounded-[3px] border border-border bg-surface-2/60 p-2 text-left hover:border-primary/50"
            >
              <span className="text-primary">{c.icon}</span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold">{c.label}</span>
                <span className="block truncate font-mono text-[9px] text-muted-foreground">
                  {c.sub}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* MY LIBRARY — saved samples, synth sounds, drum kits and notes in custom folders */}
      <div>
        <FolderHeader
          id="library"
          icon={<Save className="size-3 text-primary" />}
          label="MY LIBRARY"
          count={0}
          hasMatch={false}
        />
        {isOpen("library", false) && (
          <div className="ml-3 border-l-2 border-border">
            <LibraryPanel />
          </div>
        )}
      </div>
      {/* POOL — every audio clip in this session */}
      {(() => {
        const pool = tracks
          .flatMap((t) => (t.clips ?? []).map((c) => ({ t, c })))
          .filter(({ c }) => match(c.name));
        return (
          <div>
            <FolderHeader
              id="pool"
              icon={<Library className="size-3 text-primary" />}
              label="POOL"
              count={pool.length}
              hasMatch={pool.length > 0}
            />
            {isOpen("pool", pool.length > 0) && (
              <div className="ml-3 border-l border-border pl-1">
                {pool.length === 0 && (
                  <p className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                    No audio in this song yet.
                  </p>
                )}
                {pool.map(({ t, c }) => (
                  <button
                    key={`${t.id}:${c.id}`}
                    type="button"
                    onClick={() => {
                      select(t.id);
                      setTransport({ step: Math.floor(c.start ?? 0) });
                    }}
                    title="Select this track and move the playhead to the clip"
                    className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-surface-2"
                  >
                    <AudioLines className="size-3 shrink-0" style={{ color: t.color }} />
                    <span className="truncate font-mono text-[10px]">{c.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">
                      {t.name} · {c.duration.toFixed(1)}s
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* FAVORITES */}
      {(filteredFavs.length > 0 || (!searching && favs.length > 0)) && (
        <div>
          <FolderHeader
            id="favs"
            icon={<Star className="size-3 text-amber-400" />}
            label="FAVORITES"
            count={favs.length}
            hasMatch={filteredFavs.length > 0}
          />
          {isOpen("favs", filteredFavs.length > 0) && (
            <div className="ml-3 border-l-2 border-border">
              {filteredFavs.map((f) => (
                <button
                  key={f.key}
                  onClick={() => runFav(f)}
                  className="group flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-primary/10"
                >
                  <span className="w-16 shrink-0 font-mono text-[9px] uppercase tracking-wider text-primary">
                    {f.type}
                  </span>
                  <span className="flex-1 truncate font-mono text-[11px]">{f.label}</span>
                  <span className="truncate text-[9px] text-muted-foreground">{f.sub}</span>
                  <StarButton fav={f} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COMPUTER — real audio files from a folder the user picks */}
      <div>
        <FolderHeader
          id="computer"
          icon={<FolderOpen className="size-3 text-primary" />}
          label="COMPUTER"
          count={folders.reduce((n, f) => n + f.files.length, 0)}
          hasMatch={folders.some((f) => f.files.some((x) => match(x.name)))}
        />
        {isOpen(
          "computer",
          folders.some((f) => f.files.some((x) => match(x.name))),
        ) && (
          <div className="ml-3 border-l-2 border-border">
            <button
              type="button"
              onClick={() => void openComputerFolder()}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left font-mono text-[11px] text-primary hover:bg-primary/10"
            >
              <Plus className="size-3" /> Open a folder on this computer…
            </button>
            {folders.length === 0 && (
              <p className="px-2 pb-1.5 text-[9px] text-muted-foreground">
                Files are read on your device only and stay open until you reload.
              </p>
            )}
            {folders.map((f) => {
              const files = f.files.filter((x) => match(x.name, x.path));
              const key = `cf:${f.id}`;
              return (
                <div key={f.id}>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="flex flex-1 items-center gap-1.5 px-2 py-1 text-left font-mono text-[11px] hover:bg-primary/10"
                      aria-expanded={isOpen(key, files.length > 0)}
                    >
                      {isOpen(key, files.length > 0) ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronRight className="size-3" />
                      )}
                      <FolderOpen className="size-3 text-amber-400" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-[9px] text-muted-foreground">{f.files.length}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Close folder ${f.name}`}
                      onClick={() => removeLocalFolder(f.id)}
                      className="px-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                  {isOpen(key, files.length > 0) && (
                    <div className="ml-3 border-l border-border/70">
                      {files.map((x) => {
                        const playing = playingFile === x.id;
                        return (
                          <div
                            key={x.id}
                            draggable
                            onDragStart={(e) => {
                              const payload = JSON.stringify({
                                type: "localfile",
                                id: x.id,
                                name: x.name,
                              });
                              e.dataTransfer.setData("application/synclab", payload);
                              e.dataTransfer.setData("text/plain", payload);
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            title={`${x.path} — drag onto the timeline`}
                            className={`group flex cursor-grab items-center gap-2 px-2 py-1 active:cursor-grabbing ${playing ? "bg-primary/15" : "hover:bg-primary/10"}`}
                          >
                            <button
                              type="button"
                              aria-label={playing ? `Stop ${x.name}` : `Play ${x.name}`}
                              onClick={() =>
                                playing
                                  ? stopPreview()
                                  : void playPreview(x.id).catch(() =>
                                      toast.error(`Can't play ${x.name}`, {
                                        description: "This browser can't decode that file type.",
                                      }),
                                    )
                              }
                              className="grid size-5 shrink-0 place-items-center rounded-sm border border-border text-primary hover:border-primary"
                            >
                              {playing ? (
                                <Square className="size-2.5 fill-current" />
                              ) : (
                                <Play className="size-2.5 fill-current" />
                              )}
                            </button>
                            <span className="flex-1 truncate font-mono text-[11px]">{x.path}</span>
                            <span className="text-[9px] text-muted-foreground">
                              {(x.size / 1048576).toFixed(1)} MB
                            </span>
                            <button
                              type="button"
                              aria-label={`Add ${x.name} to the timeline`}
                              title="Add at the playhead"
                              onClick={() => void addLocalFile(x.id, x.name)}
                              className="grid size-5 shrink-0 place-items-center text-muted-foreground hover:text-primary"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                        );
                      })}
                      {files.length === 0 && (
                        <p className="px-2 py-1 text-[10px] text-muted-foreground">No matches.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MY FILES */}
      <div>
        <FolderHeader
          id="myfiles"
          icon={<Save className="size-3 text-primary" />}
          label="MY FILES"
          count={userTemplates.length}
          hasMatch={filteredUserTemplates.length > 0}
        />
        {isOpen("myfiles", filteredUserTemplates.length > 0) && (
          <div className="ml-3 border-l-2 border-border">
            {filteredUserTemplates.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-muted-foreground">
                {searching
                  ? "No matches."
                  : "Nothing saved yet — use File → Save as template to keep a session here."}
              </p>
            )}
            {filteredUserTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => openUserTemplate(t)}
                className="group flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-primary/10"
              >
                <span className="w-16 shrink-0 font-mono text-[9px] uppercase tracking-wider text-primary">
                  SESSION
                </span>
                <span className="flex-1 truncate font-mono text-[11px]">{t.name}</span>
                <Plus className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SAMPLES */}
      <div>
        <FolderHeader
          id="samples"
          icon={<AudioLines className="size-3 text-primary" />}
          label="SAMPLES"
          count={samplesCount}
          hasMatch={filteredPacks.length > 0}
        />
        {isOpen("samples", filteredPacks.length > 0) && (
          <div className="space-y-1 pt-1">
            {filteredPacks.map((p) => (
              <div key={p.pack}>
                <FolderHeader
                  id={`pack:${p.pack}`}
                  icon={<AudioLines className="size-3 text-primary" />}
                  label={p.pack}
                  count={p.samples.length}
                  hasMatch
                  nested
                />
                {isOpen(`pack:${p.pack}`, true) && (
                  <div className="ml-6 border-l-2 border-border">
                    {p.samples.map((s) => {
                      const fav: Fav = {
                        key: `sample:${p.pack}:${s.name}`,
                        type: "sample",
                        label: s.name,
                        sub: p.pack,
                        sample: s.name,
                        pack: p.pack,
                      };
                      return (
                        <div
                          key={s.name}
                          className="group flex w-full items-center gap-2 px-2 py-1 hover:bg-primary/10"
                        >
                          <button
                            type="button"
                            aria-label={`Preview ${s.name}`}
                            title="Hear it (synthesized on your device)"
                            onClick={() => previewSample(s.kind)}
                            className="shrink-0 text-muted-foreground hover:text-primary"
                          >
                            <Play className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => addSampleToTimeline(s.name, p.pack)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="w-12 shrink-0 font-mono text-[9px] tracking-wider text-primary">
                              {s.kind}
                            </span>
                            <span className="flex-1 truncate font-mono text-[11px]">{s.name}</span>
                            <Plus className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                          <StarButton fav={fav} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {filteredPacks.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-muted-foreground">No samples match.</p>
            )}
          </div>
        )}
      </div>

      {/* DRUMS */}
      <div>
        <FolderHeader
          id="drums"
          icon={<Drum className="size-3 text-primary" />}
          label="DRUMS"
          count={DRUM_KITS.length}
          hasMatch={filteredKits.length > 0}
        />
        {isOpen("drums", filteredKits.length > 0) && (
          <div className="ml-3 border-l-2 border-border">
            {filteredKits.map((k) => {
              const fav: Fav = {
                key: `kit:${k.id}`,
                type: "kit",
                label: k.name,
                sub: k.category,
                kit: k.id,
              };
              return (
                <div
                  key={k.id}
                  className="group flex w-full items-center gap-2 px-2 py-1 hover:bg-primary/10"
                >
                  <button
                    type="button"
                    aria-label={`Preview ${k.name} kit`}
                    title="Hear kick, snare and hat from this kit"
                    onClick={() => previewKit(k.id)}
                    className="shrink-0 text-muted-foreground hover:text-primary"
                  >
                    <Play className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => addKitTrack(k.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="flex-1 truncate font-mono text-[11px]">{k.name}</span>
                    <span className="truncate text-[9px] text-muted-foreground">{k.category}</span>
                    <Plus className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                  <StarButton fav={fav} />
                </div>
              );
            })}
            {filteredKits.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-muted-foreground">No kits match.</p>
            )}
          </div>
        )}
      </div>

      {/* INSTRUMENTS */}
      <div>
        <FolderHeader
          id="instruments"
          icon={<Music2 className="size-3 text-primary" />}
          label="INSTRUMENTS"
          count={SYNTH_PRESETS.length}
          hasMatch={filteredPresets.length > 0}
        />
        {isOpen("instruments", filteredPresets.length > 0) && (
          <div className="ml-3 border-l-2 border-border">
            <p className="px-2 py-1 text-[9px] text-muted-foreground">
              Drag onto the timeline or click to add a channel.
            </p>
            {filteredPresets.map((p) => {
              const fav: Fav = {
                key: `instrument:${p.name}`,
                type: "instrument",
                label: p.name,
                sub: p.category,
                preset: p.name,
              };
              return (
                <div
                  key={p.name}
                  draggable
                  onDragStart={(e) => {
                    const payload = JSON.stringify({
                      type: "instrument",
                      name: p.name,
                      preset: p.name,
                    });
                    e.dataTransfer.setData("application/synclab", payload);
                    e.dataTransfer.setData("text/plain", payload);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="group flex w-full cursor-grab items-center gap-2 px-2 py-1 hover:bg-primary/10 active:cursor-grabbing"
                >
                  <button
                    type="button"
                    onClick={() => addTrack("instrument", p.name.toUpperCase(), p.name)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="flex-1 truncate font-mono text-[11px]">{p.name}</span>
                    <span className="truncate text-[9px] text-muted-foreground">{p.category}</span>
                    <Plus className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                  <StarButton fav={fav} />
                </div>
              );
            })}
            {filteredPresets.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-muted-foreground">No instruments match.</p>
            )}
          </div>
        )}
      </div>

      {/* RACK EFFECTS — drag onto a timeline track */}
      <div>
        <FolderHeader
          id="effects"
          icon={<Waves className="size-3 text-primary" />}
          label="EFFECTS"
          count={effects.length}
          hasMatch={filteredRack.length > 0}
        />
        {isOpen("effects", filteredRack.length > 0) && (
          <div className="ml-3 border-l-2 border-border">
            <p className="px-2 py-1 text-[9px] text-muted-foreground">
              Drag onto a timeline track, or click to add to the selected channel.
            </p>
            {groupByCategory(filteredRack).map(([category, defs]) => (
              <div key={category} role="group" aria-label={category}>
                <p className="px-2 pt-1.5 font-mono text-[8px] tracking-widest text-muted-foreground">
                  {category.toUpperCase()}
                </p>
                {defs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    draggable
                    title={`${effectBrand(d)} — drag onto a timeline track`}
                    onDragStart={(e) => {
                      const payload = JSON.stringify({ type: "plugin", defId: d.id });
                      e.dataTransfer.setData("application/synclab", payload);
                      e.dataTransfer.setData("text/plain", payload);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => {
                      const target = selected ?? tracks[0];
                      if (!target) {
                        toast("Add a track first");
                        return;
                      }
                      addPlugin(target.id, d);
                    }}
                    className="flex w-full cursor-grab items-center gap-2 px-2 py-1 text-left hover:bg-primary/10 active:cursor-grabbing"
                  >
                    <span className="flex-1 truncate font-mono text-[11px]">{effectBrand(d)}</span>
                    <span className="truncate text-[9px] text-muted-foreground">
                      {d.format === "Built-in" ? d.name : d.format}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PLUGINS */}
      <div>
        <FolderHeader
          id="plugins"
          icon={<Waves className="size-3 text-primary" />}
          label="SYNTH FX"
          count={EFFECT_PLUGINS.length}
          hasMatch={filteredPlugins.length > 0}
        />
        {isOpen("plugins", filteredPlugins.length > 0) && (
          <div className="ml-3 border-l-2 border-border">
            <p className="px-2 py-1 text-[9px] text-muted-foreground">
              Click to insert on the selected instrument channel.
            </p>
            {filteredPlugins.map((e) => {
              const fav: Fav = {
                key: `plugin:${e.fx}`,
                type: "plugin",
                label: e.name,
                sub: e.desc,
                fx: e.fx,
              };
              return (
                <div
                  key={e.name}
                  className="group flex w-full items-center gap-2 px-2 py-1 hover:bg-primary/10"
                >
                  <button
                    type="button"
                    onClick={() => insertEffect(e.name, e.fx)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="flex-1 truncate font-mono text-[11px]">{e.name}</span>
                    <span className="truncate text-[9px] text-muted-foreground">{e.desc}</span>
                  </button>
                  <StarButton fav={fav} />
                </div>
              );
            })}
            {filteredPlugins.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-muted-foreground">No plugins match.</p>
            )}
          </div>
        )}
      </div>

      {/* PRESETS */}
      <div>
        <FolderHeader
          id="presets"
          icon={<Sparkles className="size-3 text-primary" />}
          label="PRESETS"
          count={SYNTH_PRESETS.length}
          hasMatch={filteredPresets.length > 0}
        />
        {isOpen("presets", filteredPresets.length > 0) && (
          <div className="ml-3 border-l-2 border-border">
            <p className="px-2 py-1 text-[9px] text-muted-foreground">
              Click to load on the selected instrument.
            </p>
            {filteredPresets.map((p) => {
              const fav: Fav = {
                key: `preset:${p.name}`,
                type: "preset",
                label: p.name,
                sub: p.category,
                preset: p.name,
              };
              return (
                <div
                  key={p.name}
                  className="group flex w-full items-center gap-2 px-2 py-1 hover:bg-primary/10"
                >
                  <button
                    type="button"
                    onClick={() => loadPresetOnto(p.name)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="flex-1 truncate font-mono text-[11px]">{p.name}</span>
                    <span className="truncate text-[9px] text-muted-foreground">{p.category}</span>
                  </button>
                  <StarButton fav={fav} />
                </div>
              );
            })}
            {filteredPresets.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-muted-foreground">No presets match.</p>
            )}
          </div>
        )}
      </div>

      {/* PROJECTS */}
      <div>
        <FolderHeader
          id="projects"
          icon={<FolderOpen className="size-3 text-primary" />}
          label="PROJECTS"
          count={cloud.length + TEMPLATES.length}
          hasMatch={filteredCloud.length + filteredTemplates.length > 0}
        />
        {isOpen("projects", filteredCloud.length + filteredTemplates.length > 0) && (
          <div className="ml-3 border-l-2 border-border">
            {filteredCloud.length > 0 && (
              <p className="px-2 py-1 text-[9px] text-muted-foreground">YOUR CLOUD PROJECTS</p>
            )}
            {filteredCloud.map((c) => (
              <button
                key={c.id}
                onClick={() => void openCloud(c)}
                disabled={busyProject === c.id}
                className="group flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-primary/10 disabled:opacity-50"
              >
                <span className="w-16 shrink-0 font-mono text-[9px] uppercase tracking-wider text-primary">
                  CLOUD
                </span>
                <span className="flex-1 truncate font-mono text-[11px]">{c.name}</span>
                <span className="truncate text-[9px] text-muted-foreground">
                  {busyProject === c.id ? "opening…" : `${c.bpm} BPM`}
                </span>
              </button>
            ))}
            <p className="px-2 py-1 text-[9px] text-muted-foreground">
              STARTER TEMPLATES — replaces the current song
            </p>
            {filteredTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => startFromTemplate(t.id)}
                className="group flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-primary/10"
              >
                <span className="w-16 shrink-0 font-mono text-[9px] uppercase tracking-wider text-primary">
                  TEMPLATE
                </span>
                <span className="flex-1 truncate font-mono text-[11px]">{t.name}</span>
                <span className="truncate text-[9px] text-muted-foreground">
                  {t.bpm} BPM · {t.key}
                </span>
              </button>
            ))}
            {filteredCloud.length + filteredTemplates.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-muted-foreground">No projects match.</p>
            )}
          </div>
        )}
      </div>

      {/* file player with live scope — pinned to the bottom of the browser */}
      <PreviewPlayer playingFile={playingFile} />
    </div>
  );
}
