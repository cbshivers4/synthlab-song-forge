import { useStudio, type PanelId } from "@/lib/synclab/store";
import { DRUM_KITS, KIND_LABEL, SYNTH_PRESETS, defaultPads } from "@/lib/synclab/presets";
import { instantiate } from "@/lib/synclab/plugins";
import { availableEffects, effectBrand } from "@/lib/synclab/effect-catalog";
import { effectPresets, effectPresetParams } from "@/lib/synclab/effect-presets";
import { KNOWLEDGE_BASE } from "@/lib/synclab/help-articles";
import type { LibraryEntry } from "@/lib/synclab/library-search";
import type { PluginDef, Track, TrackKind } from "@/lib/synclab/types";
import { openExport } from "@/components/studio/ExportDialog";
import { openHelpArticle } from "@/components/studio/HelpCenter";
import { toast } from "sonner";

export const LIBRARY_PANELS: { id: Exclude<PanelId, null>; label: string }[] = [
  { id: "mixer", label: "Mix Console" },
  { id: "synth", label: "Instrument Editor / Synth" },
  { id: "drums", label: "Drum Machine" },
  { id: "piano", label: "Piano Roll" },
  { id: "keys", label: "Keyboard" },
  { id: "sampler", label: "Sampler" },
  { id: "pads", label: "Pad Sampler" },
  { id: "plugins", label: "FX Rack" },
  { id: "browser", label: "Browser" },
  { id: "appearance", label: "Appearance & Themes" },
  { id: "settings", label: "Settings" },
  { id: "reference", label: "Reference Analyzer" },
  { id: "live", label: "Live View" },
  { id: "looper", label: "Live Looper" },
  { id: "humbeat", label: "Hum to Beat" },
  { id: "stems", label: "Separate Stems" },
  { id: "coproducer", label: "AI Co-Producer" },
  { id: "voice", label: "Convert Voice" },
  { id: "genstem", label: "Generate Stem" },
  { id: "bassgen", label: "Bass Generator" },
  { id: "drummer", label: "Live Drummer" },
  { id: "livekeys", label: "Live Keys (keyboard player)" },
  { id: "dj", label: "DJ Decks" },
  { id: "amprig", label: "Amps & Pedals (Amp Room)" },
  { id: "reel-recorder", label: "Tape & CD Recorder" },
];

const NEW_TRACKS: { kind: TrackKind; title: string; tags: string }[] = [
  { kind: "instrument", title: "New synth track", tags: "instrument synthesizer keys" },
  { kind: "drum", title: "New drum machine track", tags: "beat kit drums" },
  { kind: "sampler", title: "New sampler track", tags: "sample chop" },
  { kind: "audio", title: "New audio / microphone track", tags: "mic vocal guitar record" },
  { kind: "midi", title: "New external MIDI track", tags: "hardware controller" },
];

const SYNTH_KINDS: TrackKind[] = ["instrument", "midi"];

/** Every searchable item: synth sounds, kits, effects, effect presets, tracks, panels and help. */
export function buildLibraryCatalog(effects: PluginDef[], tracks: Track[]): LibraryEntry[] {
  const out: LibraryEntry[] = [];
  for (const t of NEW_TRACKS)
    out.push({
      id: `new:${t.kind}`,
      kind: "instrument",
      title: t.title,
      sub: KIND_LABEL[t.kind] ?? t.kind,
      tags: t.tags,
    });
  for (const p of SYNTH_PRESETS)
    out.push({ id: `preset:${p.name}`, kind: "preset", title: p.name, sub: p.category });
  for (const k of DRUM_KITS)
    out.push({ id: `kit:${k.id}`, kind: "kit", title: k.name, sub: k.category, tags: k.desc });
  for (const d of effects)
    out.push({
      id: `fx:${d.id}`,
      kind: "effect",
      title: effectBrand(d),
      sub: d.name,
      tags: d.kind,
    });
  for (const d of effects)
    for (const p of effectPresets(d))
      if (p.name !== "Default")
        out.push({
          id: `fxp:${d.id}:${p.id}`,
          kind: "effect-preset",
          title: p.name,
          sub: effectBrand(d),
          tags: `${d.name} ${d.kind}`,
        });
  for (const t of tracks)
    out.push({
      id: `track:${t.id}`,
      kind: "track",
      title: t.name,
      sub: KIND_LABEL[t.kind] ?? t.kind,
    });
  for (const p of LIBRARY_PANELS) out.push({ id: `panel:${p.id}`, kind: "panel", title: p.label });
  out.push({
    id: "panel:export",
    kind: "panel",
    title: "Export / Share",
    tags: "wav mp3 bounce render",
  });
  for (const a of KNOWLEDGE_BASE)
    out.push({ id: `help:${a.id}`, kind: "help", title: a.title, sub: a.category, tags: a.tags });
  return out;
}

/**
 * The one way a library item gets loaded, shared by the ⌘K search and the assistant tools.
 * `load` returns a short result sentence and throws when the item can't be loaded right now.
 */
export function useLibraryActions() {
  const {
    tracks,
    select,
    setPanel,
    changeInstrument,
    selected,
    addTrack,
    updateTrack,
    addPlugin,
    installedPlugins,
  } = useStudio();
  const synthTarget =
    selected && SYNTH_KINDS.includes(selected.kind) && selected.patch ? selected : null;
  const fxTarget = selected ?? tracks[0] ?? null;
  const effects = () => availableEffects(installedPlugins);
  const catalog = () => buildLibraryCatalog(effects(), tracks);

  const load = (id: string): string => {
    const [prefix, ...rest] = id.split(":");
    const value = rest.join(":");
    if (prefix === "new") {
      const kind = NEW_TRACKS.find((t) => t.kind === value)?.kind;
      if (!kind) throw new Error("Unknown track type.");
      addTrack(kind);
      return `Added a ${KIND_LABEL[kind] ?? kind} track.`;
    }
    if (prefix === "preset") {
      if (!SYNTH_PRESETS.some((p) => p.name === value)) throw new Error("Unknown synth sound.");
      if (!synthTarget)
        throw new Error(
          "Select a synth track first — synth sounds load onto the selected synth channel.",
        );
      changeInstrument(synthTarget.id, value);
      toast.success(`${value} loaded`, { description: synthTarget.name });
      setPanel("synth");
      return `Loaded "${value}" on ${synthTarget.name}.`;
    }
    if (prefix === "kit") {
      const def = DRUM_KITS.find((k) => k.id === value);
      if (!def) throw new Error("Unknown drum kit.");
      const trackId = addTrack("drum", def.name.toUpperCase());
      updateTrack(trackId, { pads: defaultPads(16, def.id) });
      toast.success(`${def.name} kit added`, { description: "New drum channel on the timeline." });
      return `Added a drum track with the ${def.name} kit.`;
    }
    if (prefix === "fx" || prefix === "fxp") {
      const [defId, ...presetParts] = value.split(":");
      const def = effects().find((d) => d.id === defId);
      if (!def) throw new Error("Unknown effect.");
      if (!fxTarget) throw new Error("Add a track first.");
      if (prefix === "fx") {
        addPlugin(fxTarget.id, def);
        return `Added ${effectBrand(def)} to ${fxTarget.name}.`;
      }
      const presetId = presetParts.join(":");
      const preset = effectPresets(def).find((p) => p.id === presetId);
      const params = preset ? effectPresetParams(instantiate(def), presetId) : null;
      if (!preset || !params) throw new Error("Unknown effect preset.");
      addPlugin(fxTarget.id, { ...def, params }, { quiet: true });
      toast.success(`${effectBrand(def)} · ${preset.name}`, {
        description: `Added to ${fxTarget.name}`,
      });
      return `Added ${effectBrand(def)} with the "${preset.name}" preset to ${fxTarget.name}.`;
    }
    if (prefix === "track") {
      const track = tracks.find((t) => t.id === value);
      if (!track) throw new Error("That track is not in this project.");
      select(value);
      return `Selected ${track.name}.`;
    }
    if (prefix === "panel") {
      if (value === "export") {
        openExport();
        return "Opened Export.";
      }
      const panel = LIBRARY_PANELS.find((p) => p.id === value);
      if (!panel) throw new Error("Unknown panel.");
      setPanel(panel.id);
      return `Opened ${panel.label}.`;
    }
    if (prefix === "help") {
      const article = KNOWLEDGE_BASE.find((a) => a.id === value);
      if (!article) throw new Error("Unknown help article.");
      openHelpArticle(value);
      return `Opened the help article "${article.title}".`;
    }
    throw new Error("Unknown library item.");
  };

  return { catalog, load, synthTarget, fxTarget, effects };
}
