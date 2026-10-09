import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useStudio } from "@/lib/synclab/store";

/** Phone timeline search: type a track name, pick a match to select it and scroll it into view. */
export function TrackSearch() {
  const { tracks, select } = useStudio();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return tracks.filter((t) => t.name.toLowerCase().includes(s) || t.kind.toLowerCase().includes(s)).slice(0, 8);
  }, [q, tracks]);

  const pick = (id: string) => {
    select(id);
    setOpen(false);
    setQ("");
    requestAnimationFrame(() => {
      const el = Array.from(document.querySelectorAll<HTMLElement>("[data-track-row], [data-lane-track]")).find(
        (n) => n.dataset["trackRow"] === id || n.dataset["laneTrack"] === id
      );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        aria-label="Search tracks"
        placeholder="Search tracks"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) pick(matches[0].id); }}
        className="h-12 w-full min-w-0 rounded-md border border-border bg-background/70 pl-9 pr-3 font-display text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {open && q.trim() && (
        <div role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No tracks match</div>
          ) : matches.map((t) => (
            <button key={t.id} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(t.id)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
              <span className="truncate">{t.name}</span>
              <span className="ml-auto font-mono text-[10px] uppercase text-muted-foreground">{t.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
