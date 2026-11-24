import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { aiUsesLeftFn } from "@/utils/stem-split.functions";
import { usePlan } from "@/lib/synclab/plan";
import { Button } from "@/components/ui/button";

/** Tells the AI tools to refresh the counter after a use. */
export const announceAiUse = () => window.dispatchEvent(new Event("synclab:ai-used"));

/** Shows how many of today's AI uses are left (counted on the server, shared by every AI tool). */
export function AiUsesLeft() {
  const { canUseAi, openUpgrade } = usePlan();
  const fetchLeft = useServerFn(aiUsesLeftFn);
  const [left, setLeft] = useState<{ left: number; limit: number } | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => {
      fetchLeft()
        .then((r) => {
          if (live && r.ok) setLeft({ left: r.left, limit: r.limit });
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("synclab:ai-used", load);
    return () => {
      live = false;
      window.removeEventListener("synclab:ai-used", load);
    };
  }, [fetchLeft]);
  if (!canUseAi)
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-sm border border-primary/50 bg-primary/10 px-2 py-1.5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          AI tools are part of SYNCLAB Premium
        </p>
        <Button size="sm" variant="secondary" onClick={() => openUpgrade("AI tools")}>
          See Premium
        </Button>
      </div>
    );
  if (!left) return null;
  return (
    <p
      className={`font-mono text-[10px] uppercase tracking-widest ${left.left === 0 ? "text-destructive" : "text-muted-foreground"}`}
      aria-live="polite"
    >
      {left.left} of {left.limit} AI uses left today · shared by all AI tools
    </p>
  );
}
