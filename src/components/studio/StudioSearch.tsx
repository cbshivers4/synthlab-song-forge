import { useEffect, useMemo, useState } from "react";
import { Play, Search } from "lucide-react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useStudio } from "@/lib/synclab/store";
import { applyPreset } from "@/lib/synclab/presets";
import { LIBRARY_KINDS, countByKind, searchLibrary, type LibraryEntry, type LibraryKind } from "@/lib/synclab/library-search";
import { buildLibraryCatalog, useLibraryActions } from "@/components/studio/library-actions";
import { availableEffects } from "@/lib/synclab/effect-catalog";
import { toast } from "sonner";

/** Logic-style library: type to find anything, pick a category, Enter loads it. */
export function StudioSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LibraryKind | "all">("all");
  const { tracks, previewNote, installedPlugins } = useStudio();
  const { load, synthTarget, fxTarget } = useLibraryActions();

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

  // The catalog (every preset, kit, effect and effect preset) is only built while the library is open;
  // building it on every edit slowed the whole studio down during playback.
  const entries = useMemo<LibraryEntry[]>(() => (open ? buildLibraryCatalog(availableEffects(installedPlugins), tracks) : []), [open, installedPlugins, tracks]);

  const results = useMemo(() => searchLibrary(entries, query, kind), [entries, query, kind]);
  const counts = useMemo(() => countByKind(entries, query), [entries, query]);

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
    try { load(e.id); close(); }
    catch (err) { toast(err instanceof Error ? err.message : "Could not load that item."); }
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
