import { cn } from "@/lib/utils";
import { CONSOLE_STYLES, SOLID_PRESETS, type ConsoleStyleId } from "./shared";

/** Console desk colour list, shared by the desktop "desk" menu and the phone mixer menu. */
export function DeskPicker({
  styleId,
  setStyleId,
  solid,
  setSolid,
  large = false,
}: {
  styleId: ConsoleStyleId;
  setStyleId: (id: ConsoleStyleId) => void;
  solid: string;
  setSolid: (hex: string) => void;
  large?: boolean;
}) {
  return (
    <>
      <div className={cn(large ? "grid grid-cols-2 gap-2" : "")}>
        {CONSOLE_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyleId(s.id)}
            aria-pressed={s.id === styleId}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-surface-2",
              s.id === styleId && "bg-surface-2",
              large && "min-h-12 rounded-md border border-border",
              large && s.id === styleId && "border-primary ring-1 ring-primary",
            )}
          >
            <span
              className={cn(
                "shrink-0 rounded-[2px] border border-black/60",
                large ? "h-9 w-7" : "h-7 w-5",
              )}
              style={{
                background:
                  s.id === "solid" ? solid : `linear-gradient(180deg, ${s.a}, ${s.b} 45%, ${s.c})`,
                boxShadow: `inset 0 2px 0 0 ${s.accent}`,
              }}
            />
            <span className="min-w-0">
              <span
                className={cn(
                  "block font-mono uppercase tracking-wider text-foreground",
                  large ? "text-xs font-bold" : "text-[10px]",
                )}
              >
                {s.name}
              </span>
              <span
                className={cn(
                  "block truncate text-muted-foreground",
                  large ? "text-[11px]" : "text-[10px]",
                )}
              >
                {s.desc}
              </span>
            </span>
          </button>
        ))}
      </div>
      {styleId === "solid" && (
        <div className="mt-1 border-t border-border px-2 pb-2 pt-2">
          <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
            Solid colour
          </div>
          <div className={cn("mt-1.5 grid grid-cols-8 gap-1", large && "gap-2")}>
            {SOLID_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                title={p.name}
                aria-label={`${p.name} solid colour`}
                onClick={() => setSolid(p.hex)}
                className={cn(
                  "w-full rounded-[3px] border transition-transform hover:scale-105",
                  large ? "h-10" : "h-6",
                  solid.toLowerCase() === p.hex
                    ? "border-primary ring-1 ring-primary"
                    : "border-black/60",
                )}
                style={{ background: p.hex }}
              />
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Custom
            </span>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(solid) ? solid : "#1a1b1e"}
              onChange={(e) => setSolid(e.target.value)}
              title="Pick any solid colour"
              aria-label="Custom mixer colour"
              className={cn(
                "w-full cursor-pointer rounded-[3px] border border-border bg-surface p-0.5",
                large ? "h-10" : "h-7",
              )}
            />
          </label>
        </div>
      )}
    </>
  );
}
