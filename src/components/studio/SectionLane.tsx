import { canvasPoint, canvasRect } from "@/lib/synclab/canvas-point";
import { useRef, useState } from "react";
import { songSteps, stepsPerBar } from "@/lib/synclab/timebase";
import { Copy, LayoutList, Plus, Trash2 } from "lucide-react";
import { useStudio } from "@/lib/synclab/store";
import { SECTION_COLORS, SECTION_NAMES } from "@/lib/synclab/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Arrangement section lane — the named parts of the song (intro, verse, drop…)
 * shown above the tracks. Drag to move, drag the right edge to resize,
 * double-click to rename, and duplicate to copy the part with its audio.
 */
export function SectionLane() {
  const {
    sections,
    transport,
    addSection,
    updateSection,
    removeSection,
    duplicateSection,
    gotoSection,
    autoSections,
  } = useStudio();
  const gridRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const total = songSteps(transport.bars);
  const snap = 4; // sections snap to bars

  const stepFromX = (clientX: number, clientY: number) => {
    const el = gridRef.current;
    if (!el) return 0;
    const r = canvasRect(el);
    const raw = ((canvasPoint(clientX, clientY).x - r.left) / r.width) * total;
    return Math.min(total, Math.max(0, Math.round(raw / snap) * snap));
  };

  const drag = (id: string, mode: "move" | "resize") => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const sec = sections.find((s) => s.id === id);
    if (!sec) return;
    const from = stepFromX(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => {
      const now = stepFromX(ev.clientX, ev.clientY);
      const shift = now - from;
      if (mode === "move") {
        updateSection(id, { start: Math.max(0, Math.min(total - sec.length, sec.start + shift)) });
      } else {
        updateSection(id, {
          length: Math.max(snap, Math.min(total - sec.start, sec.length + shift)),
        });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex border-b border-border bg-surface-2/40">
      <div
        className="song-lane-controls relative z-20 flex w-[var(--timeline-header-width)] shrink-0 items-center gap-1 border-r border-border bg-surface-2 px-2 py-1 sm:px-3"
        style={{ transform: "translateX(var(--timeline-scroll-x, 0px))" }}
      >
        <LayoutList className="size-3 text-muted-foreground" />
        <span className="font-display text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          SONG
        </span>
        <button
          type="button"
          title="Add a song part at the end of the arrangement"
          onClick={() => addSection()}
          className="ml-auto flex items-center gap-0.5 rounded-[3px] border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3" /> Part
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Insert a named part"
              className="rounded-[3px] border border-border bg-background/70 px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground hover:text-foreground"
            >
              ▾
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-auto">
            <DropdownMenuLabel className="font-mono text-[10px] uppercase">
              Add a part
            </DropdownMenuLabel>
            {SECTION_NAMES.map((n) => (
              <DropdownMenuItem
                key={n}
                className="font-mono text-[11px]"
                onSelect={() => addSection(n)}
              >
                {n}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="font-mono text-[11px]" onSelect={() => autoSections()}>
              Lay out a full song
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={gridRef} className="relative h-7 flex-1 select-none">
        {sections.length === 0 && (
          <button
            type="button"
            onClick={() => addSection("INTRO", 0, 32)}
            className="absolute inset-0 flex items-center justify-center px-2 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70 hover:text-foreground"
          >
            <span className="truncate">
              no song parts yet — click to add INTRO
              <span className="hidden sm:inline">, then drag it to size</span>
            </span>
          </button>
        )}
        {sections.map((sec) => {
          const left = (sec.start / total) * 100;
          const width = (Math.min(sec.length, total - sec.start) / total) * 100;
          return (
            <div
              key={sec.id}
              onPointerDown={drag(sec.id, "move")}
              onClick={() => gotoSection(sec.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenaming(sec.id);
                setDraft(sec.name);
              }}
              title={`${sec.name} — bar ${Math.floor(sec.start / stepsPerBar()) + 1} to ${Math.floor((sec.start + sec.length) / stepsPerBar()) + 1}. Drag to move, double-click to rename.`}
              className="group absolute inset-y-[3px] flex cursor-grab items-center gap-1 overflow-hidden rounded-[3px] border px-1.5 active:cursor-grabbing"
              style={{
                left: `${left}%`,
                width: `max(28px, ${width}%)`,
                borderColor: sec.color,
                background: `color-mix(in oklab, ${sec.color} 22%, transparent)`,
              }}
            >
              {renaming === sec.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={() => {
                    updateSection(sec.id, { name: draft.toUpperCase().slice(0, 18) || sec.name });
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="w-full bg-transparent font-mono text-[10px] uppercase text-foreground outline-none"
                />
              ) : (
                <span
                  className="truncate font-display text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: sec.color }}
                >
                  {sec.name}
                </span>
              )}
              <span className="ml-auto hidden items-center gap-1 group-hover:flex">
                <button
                  type="button"
                  title="Change colour"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    const i = SECTION_COLORS.indexOf(sec.color);
                    updateSection(sec.id, {
                      color: SECTION_COLORS[(i + 1) % SECTION_COLORS.length] as string,
                    });
                  }}
                  className="size-3 rounded-full border border-background/60"
                  style={{ background: sec.color }}
                />
                <button
                  type="button"
                  title="Duplicate this part with its clips and notes"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateSection(sec.id);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="size-3" />
                </button>
                <button
                  type="button"
                  title="Remove this marker (the audio stays)"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSection(sec.id);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
              <span
                onPointerDown={drag(sec.id, "resize")}
                title="Drag to change how long this part is"
                className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-foreground/0 hover:bg-foreground/20"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
