import { Maximize2 } from "lucide-react";
import { useStudio } from "@/lib/synclab/store";
import { openScopeWindow, scopeSourceFor, type ScopeSource, type ScopeView } from "@/lib/synclab/scope-window";
import { cn } from "@/lib/utils";

/** Small corner button on every scope that opens the big analyzer window on the same signal. */
export function ExpandScopeButton({ scopeId, source, view, className }: { scopeId?: string; source?: ScopeSource; view?: ScopeView; className?: string }) {
  const { tracks } = useStudio();
  return (
    <button
      type="button"
      className={cn("scope-expand-btn grid place-items-center", className)}
      title="Expand scope"
      aria-label="Expand scope"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        openScopeWindow(source ?? scopeSourceFor(scopeId ?? "master", tracks), view);
      }}
    >
      <Maximize2 className="size-3" aria-hidden="true" />
    </button>
  );
}
