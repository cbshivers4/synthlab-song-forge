import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useStudio, type PanelId } from "@/lib/synclab/store";
import { DRUM_KITS, KIND_LABEL, SYNTH_PRESETS } from "@/lib/synclab/presets";
import { BUILT_IN_PLUGINS } from "@/lib/synclab/plugins";
import { openExport } from "@/components/studio/ExportDialog";
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

export function StudioSearch() {
  const [open, setOpen] = useState(false);
  const { tracks, select, setPanel, changeInstrument, selected } = useStudio();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (e.defaultPrevented || e.repeat || e.isComposing || target?.isContentEditable || target?.closest('input, textarea, select')) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-border bg-surface-2/60 px-3 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
      >
        <Search className="size-4" />
        <span>Search studio…</span>
        <kbd className="ml-auto rounded bg-background/60 px-1 text-[10px]">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search panels, tracks, presets, kits, effects…" />
        <CommandList>
          <CommandEmpty>Nothing matched that.</CommandEmpty>

          <CommandGroup heading="Panels">
            {PANELS.map((p) => (
              <CommandItem key={p.id} value={`panel ${p.label}`} onSelect={() => go(() => setPanel(p.id))}>
                {p.label}
              </CommandItem>
            ))}
            <CommandItem value="export share wav mp3" onSelect={() => go(() => openExport())}>
              Export / Share (WAV, MP3)
            </CommandItem>
          </CommandGroup>

          {tracks.length > 0 && (
            <CommandGroup heading="Tracks">
              {tracks.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`track ${t.name} ${KIND_LABEL[t.kind] ?? t.kind}`}
                  onSelect={() => go(() => select(t.id))}
                >
                  {t.name}
                  <span className="ml-2 text-[10px] text-muted-foreground">{KIND_LABEL[t.kind] ?? t.kind}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Synth presets">
            {SYNTH_PRESETS.map((p) => (
              <CommandItem
                key={p.name}
                value={`preset ${p.name} ${p.category ?? ""}`}
                onSelect={() =>
                  go(() => {
                    if (!selected?.patch) {
                      toast("Select an instrument track first", {
                        description: "Presets load onto the selected synth channel.",
                      });
                      setPanel("synth");
                      return;
                    }
                    changeInstrument(selected.id, p.name);
                    toast.success(`${p.name} loaded`, { description: selected.name });
                    setPanel("synth");
                  })
                }
              >
                {p.name}
                <span className="ml-2 text-[10px] text-muted-foreground">{p.category}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Drum kits">
            {DRUM_KITS.map((k) => (
              <CommandItem
                key={k.id}
                value={`kit ${k.name} ${k.category} ${k.desc}`}
                onSelect={() => go(() => setPanel("drums"))}
              >
                {k.name}
                <span className="ml-2 text-[10px] text-muted-foreground">{k.category}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Effects">
            {BUILT_IN_PLUGINS.map((p) => (
              <CommandItem key={p.name} value={`effect ${p.name}`} onSelect={() => go(() => setPanel("mixer"))}>
                {p.name}
                <span className="ml-2 text-[10px] text-muted-foreground">add from a channel menu</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
