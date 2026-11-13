import { useEffect, useMemo, useState } from "react";
import { Play, Search } from "lucide-react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import { DRUM_KITS, KIND_LABEL, SYNTH_PRESETS, applyPreset, defaultPads } from "@/lib/synclab/presets";
import { instantiate } from "@/lib/synclab/plugins";
import { availableEffects, effectBrand } from "@/lib/synclab/effect-catalog";
import { effectPresets, effectPresetParams } from "@/lib/synclab/effect-presets";
import { KNOWLEDGE_BASE } from "@/lib/synclab/help-articles";
import { LIBRARY_KINDS, countByKind, searchLibrary, type LibraryEntry, type LibraryKind } from "@/lib/synclab/library-search";
import type { TrackKind } from "@/lib/synclab/types";
import { openExport } from "@/components/studio/ExportDialog";
import { openHelpArticle } from "@/components/studio/HelpCenter";
import { toast } from "sonner";

const PANELS: { id: Exclude<PanelId, null>; label: string }[] = [
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
];

const NEW_TRACKS: { kind: TrackKind; title: string; tags: string }[] = [
  { kind: "instrument", title: "New synth track", tags: "instrument synthesizer keys" },
  { kind: "drum", title: "New drum machine track", tags: "beat kit drums" },
  { kind: "sampler", title: "New sampler track", tags: "sample chop" },
  { kind: "audio", title: "New audio / microphone track", tags: "mic vocal guitar record" },
  { kind: "midi", title: "New external MIDI track", tags: "hardware controller" },
];

const SYNTH_KINDS: TrackKind[] = ["instrument", "midi"];

/** Logic-style library: type to find anything, pick a category, Enter loads it. */
export function StudioSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LibraryKind | "all">("all");
  const { tracks, select, setPanel, changeInstrument, selected, addTrack, updateTrack, addPlugin, previewNote, installedPlugins } = useStudio();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (e.defaultPrevented || e.repeat || e.isComposing || target?.isContentEditable || target?.closest("input, textarea, select")) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => { if (!o) { setQuery(""); setKind("all"); } return !o; });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const effects = useMemo(() => (open ? availableEffects(installedPlugins) : []), [open, installedPlugins]);

  // The catalog (every preset, kit, effect and effect preset) is only built while the library is open;
  // building it on every edit slowed the whole studio down during playback.
  const entries = useMemo<LibraryEntry[]>(() => {
    if (!open) return [];
    const out: LibraryEntry[] = [];
    for (const t of NEW_TRACKS) out.push({ id: `new:${t.kind}`, kind: "instrument", title: t.title, sub: KIND_LABEL[t.kind] ?? t.kind, tags: t.tags });
    for (const p of SYNTH_PRESETS) out.push({ id: `preset:${p.name}`, kind: "preset", title: p.name, sub: p.category });
    for (const k of DRUM_KITS) out.push({ id: `kit:${k.id}`, kind: "kit", title: k.name, sub: k.category, tags: k.desc });
    for (const d of effects) out.push({ id: `fx:${d.id}`, kind: "effect", title: effectBrand(d), sub: d.name, tags: d.kind });
    for (const d of effects) for (const p of effectPresets(d)) if (p.name !== "Default")
      out.push({ id: `fxp:${d.id}:${p.id}`, kind: "effect-preset", title: p.name, sub: effectBrand(d), tags: `${d.name} ${d.kind}` });
    for (const t of tracks) out.push({ id: `track:${t.id}`, kind: "track", title: t.name, sub: KIND_LABEL[t.kind] ?? t.kind });
    for (const p of PANELS) out.push({ id: `panel:${p.id}`, kind: "panel", title: p.label });
    out.push({ id: "panel:export", kind: "panel", title: "Export / Share", tags: "wav mp3 bounce render" });
    for (const a of KNOWLEDGE_BASE) out.push({ id: `help:${a.id}`, kind: "help", title: a.title, sub: a.category, tags: a.tags });
    return out;
  }, [open, effects, tracks]);

  const results = useMemo(() => searchLibrary(entries, query, kind), [entries, query, kind]);
  const counts = useMemo(() => countByKind(entries, query), [entries, query]);
  const synthTarget = selected && SYNTH_KINDS.includes(selected.kind) && selected.patch ? selected : null;
  const fxTarget = selected ?? tracks[0] ?? null;

  const close = () => setOpen(false);

  const hint = (e: LibraryEntry) => {
    switch (e.kind) {
      case "preset": return synthTarget ? `load on ${synthTarget.name}` : "select a synth track";
      case "effect": case "effect-preset": return fxTarget ? `add to ${fxTarget.name}` : "add a track first";
      case "kit": return "new drum track";
      case "instrument": return "add";
      case "track": return "select";
      case "panel": return "open";
      case "help": return "read";
    }
  };

  const run = (e: LibraryEntry) => {
    const [prefix, ...rest] = e.id.split(":");
    const value = rest.join(":");
    if (prefix === "new") { addTrack(value as TrackKind); close(); return; }
    if (prefix === "preset") {
      if (!synthTarget) { toast("Select a synth track first", { description: "Synth sounds load onto the selected synth channel." }); return; }
      changeInstrument(synthTarget.id, value);
      toast.success(`${value} loaded`, { description: synthTarget.name });
      setPanel("synth"); close(); return;
    }
    if (prefix === "kit") {
      const def = DRUM_KITS.find((k) => k.id === value);
      if (!def) return;
      const id = addTrack("drum", def.name.toUpperCase());
      updateTrack(id, { pads: defaultPads(16, def.id) });
      toast.success(`${def.name} kit added`, { description: "New drum channel on the timeline." });
      close(); return;
    }
    if (prefix === "fx" || prefix === "fxp") {
      if (!fxTarget) { toast("Add a track first"); return; }
      const [defId, ...presetParts] = value.split(":");
      const def = effects.find((d) => d.id === defId);
      if (!def) return;
      if (prefix === "fx") addPlugin(fxTarget.id, def);
      else {
        const params = effectPresetParams(instantiate(def), presetParts.join(":"));
        addPlugin(fxTarget.id, params ? { ...def, params } : def, { quiet: true });
        toast.success(`${effectBrand(def)} · ${e.title}`, { description: `Added to ${fxTarget.name}` });
      }
      close(); return;
    }
    if (prefix === "track") { select(value); close(); return; }
    if (prefix === "panel") { if (value === "export") openExport(); else setPanel(value as Exclude<PanelId, null>); close(); return; }
    if (prefix === "help") { openHelpArticle(value); close(); }
  };

  const audition = (e: LibraryEntry) => {
    if (!synthTarget) { toast("Select a synth track to hear sounds"); return; }
    previewNote(synthTarget.id, 60, 0.9, false, applyPreset(e.id.slice("preset:".length)));
  };

  const kindLabel = (k: LibraryKind) => LIBRARY_KINDS.find((x) => x.id === k)?.label ?? k;

  return (
    <>
      <button
        type="button"
        onClick={() => { setQuery(""); setKind("all"); setOpen(true); }}
        className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-border bg-surface-2/60 px-3 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
      >
        <Search className="size-4" />
        <span>Search sounds, effects, tools…</span>
        <kbd className="ml-auto rounded bg-background/60 px-1 text-[10px]">⌘K</kbd>
      </button>

      {open && <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="library-search max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">Library search</DialogTitle>
          <Command shouldFilter={false} className="flex max-h-[min(640px,80vh)] flex-col">
            <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder="Type to find a sound, kit, effect, preset, tool or help topic…" />
            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <nav aria-label="Library categories" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2 sm:w-44 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r">
                {([["all", "Everything"], ...LIBRARY_KINDS.map((k) => [k.id, k.label])] as [LibraryKind | "all", string][]).map(([id, label]) => {
                  const n = id === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[id];
                  return (
                    <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)}
                      className={`flex shrink-0 items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition ${kind === id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"} ${n === 0 ? "opacity-50" : ""}`}>
                      <span className="truncate">{label}</span>
                      <span className="font-mono text-[10px] tabular-nums">{n}</span>
                    </button>
                  );
                })}
              </nav>
              <CommandList className="max-h-none min-h-0 flex-1 overflow-y-auto">
                <CommandEmpty>Nothing matched “{query}”.</CommandEmpty>
                {results.map((e) => (
                  <CommandItem key={e.id} value={e.id} onSelect={() => run(e)} className="group gap-2">
                    <span className="w-20 shrink-0 truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground group-data-[selected=true]:text-accent-foreground">{kindLabel(e.kind)}</span>
                    <span className="min-w-0 flex-1 truncate">{e.title}{e.sub && <span className="ml-2 text-[10px] text-muted-foreground group-data-[selected=true]:text-accent-foreground">{e.sub}</span>}</span>
                    {e.kind === "preset" && (
                      <button type="button" aria-label={`Hear ${e.title}`} title={synthTarget ? `Hear on ${synthTarget.name}` : "Select a synth track to hear it"}
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={(ev) => { ev.stopPropagation(); audition(e); }}
                        className="rounded border border-border p-1 hover:border-primary hover:text-primary">
                        <Play className="size-3" />
                      </button>
                    )}
                    <span className="hidden shrink-0 text-[10px] text-muted-foreground group-data-[selected=true]:text-accent-foreground sm:inline">{hint(e)}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </div>
            <p className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              ↑↓ to move · Enter to load · {synthTarget ? `Synth sounds load on ${synthTarget.name}` : "Select a synth track to load synth sounds"} · {fxTarget ? `Effects go on ${fxTarget.name}` : "Add a track to use effects"}
            </p>
          </Command>
        </DialogContent>
      </Dialog>}
    </>
  );
}
