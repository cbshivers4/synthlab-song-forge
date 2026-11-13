import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PresetBrowserIndex } from "@/lib/synclab/preset-categories";

type Pick = { kind: "all" } | { kind: "type" | "style" | "mine"; label: string };

/**
 * Synth preset window: a two-column browser like a hardware synth's patch browser. Left: sound types
 * (Bass, Lead, Pad…), styles (Detroit Techno, Rave…) and My Presets with counts. Right: that list's presets.
 * Clicking a preset loads and auditions it through the same callback as the arrows and favorite keys,
 * and the browser stays open so several sounds can be tried in a row.
 */
export function PresetBrowser({ index, current, onSelect, styleHeading = "Style" }: { index: PresetBrowserIndex; current: string; onSelect: (name: string) => void; styleHeading?: string }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Pick>({ kind: "all" });
  const [query, setQuery] = useState("");

  const typeOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of index.types) for (const n of g.items) m.set(n, g.label);
    for (const n of index.mine) m.set(n, "My Presets");
    return m;
  }, [index]);

  const openBrowser = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setQuery("");
    // Open on the current preset's own list so its neighbours are right there.
    const mine = index.mine.includes(current);
    const type = typeOf.get(current);
    setPick(mine ? { kind: "mine", label: "My Presets" } : type ? { kind: "type", label: type } : { kind: "all" });
  };

  const q = query.trim().toLowerCase();
  const list: { name: string; tag?: string }[] = q
    ? index.order.filter((n) => n.toLowerCase().includes(q) || (typeOf.get(n) ?? "").toLowerCase().includes(q)).map((name) => ({ name, tag: typeOf.get(name) }))
    : pick.kind === "all" ? index.order.map((name) => ({ name, tag: typeOf.get(name) }))
    : pick.kind === "mine" ? index.mine.map((name) => ({ name }))
    : ((pick.kind === "type" ? index.types : index.styles).find((g) => g.label === pick.label)?.items ?? []).map((name) => ({ name, tag: pick.kind === "style" ? typeOf.get(name) : undefined }));
  const title = q ? `Matches for “${query.trim()}”` : pick.kind === "all" ? "All presets" : pick.label;
  const isPicked = (kind: Pick["kind"], label?: string) => !q && pick.kind === kind && (kind === "all" || (pick as { label: string }).label === label);

  const Cat = ({ kind, label, count }: { kind: Pick["kind"]; label: string; count: number }) => (
    <button type="button" aria-pressed={isPicked(kind, label)}
      onClick={() => { setQuery(""); setPick(kind === "all" ? { kind } : { kind, label }); }}
      className={cn("preset-browser-cat flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs",
        isPicked(kind, label) ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent")}>
      <span className="truncate">{label}</span>
      <span className={cn("shrink-0 font-mono text-[10px]", isPicked(kind, label) ? "text-primary-foreground" : "text-muted-foreground")}>{count}</span>
    </button>
  );
  const Heading = ({ children }: { children: string }) => <div className="px-2 pb-1 pt-2 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{children}</div>;

  return (
    <Popover open={open} onOpenChange={openBrowser}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Preset window" aria-haspopup="dialog" className="synth-preset-window flex h-11 w-72 min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm sm:h-9">
          <span className="synth-preset-tag" aria-hidden>PRESET</span>
          <span className="min-w-0 flex-1 truncate">{current || "Browse presets"}</span>
          {typeOf.get(current) && <span className="hidden shrink-0 font-mono text-[9px] uppercase text-muted-foreground sm:inline">{typeOf.get(current)}</span>}
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="preset-browser flex max-h-[min(480px,75dvh)] w-[min(620px,calc(100vw-1rem))] flex-col overflow-hidden p-0" aria-label="Preset browser">
        <div className="flex items-center gap-2 border-b border-border px-2 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find preset" placeholder="Find a preset or type (bass, pad, choir…)"
            onKeyDown={(e) => { if (e.key === "Enter" && list[0]) onSelect(list[0].name); }}
            className="h-9 min-w-0 flex-1 rounded-sm border border-input bg-background px-2 text-sm text-foreground" />
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{index.order.length} sounds</span>
        </div>
        <div className="flex min-h-0 flex-1">
          <nav aria-label="Preset categories" className="w-40 shrink-0 overflow-y-auto border-r border-border p-1 sm:w-44">
            <Cat kind="all" label="All" count={index.order.length} />
            {index.mine.length > 0 && <Cat kind="mine" label="My Presets" count={index.mine.length} />}
            <Heading>Sound type</Heading>
            {index.types.map((g) => <Cat key={g.label} kind="type" label={g.label} count={g.items.length} />)}
            {index.styles.length > 0 && <><Heading>{styleHeading}</Heading>{index.styles.map((g) => <Cat key={g.label} kind="style" label={g.label} count={g.items.length} />)}</>}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
              <span className="truncate font-display text-xs font-semibold uppercase tracking-widest text-primary">{title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{list.length}</span>
            </div>
            <div role="listbox" aria-label="Presets" className="min-h-0 flex-1 overflow-y-auto p-1">
              {list.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No preset matches “{query.trim()}”.</p>}
              {list.map(({ name, tag }) => (
                <button key={name} type="button" role="option" aria-selected={name === current} onClick={() => onSelect(name)}
                  className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs", name === current ? "bg-accent text-foreground" : "text-foreground hover:bg-accent")}>
                  <Check className={cn("size-3.5 shrink-0 text-primary", name === current ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {tag && <span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground">{tag}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border px-3 py-1.5">
          <p className="min-w-0 flex-1 text-[10px] text-muted-foreground">Click a sound to load and hear it — the browser stays open so you can try the next one.</p>
          <Button type="button" size="sm" variant="secondary" className="preset-browser-done h-7 shrink-0 px-3 text-xs" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
