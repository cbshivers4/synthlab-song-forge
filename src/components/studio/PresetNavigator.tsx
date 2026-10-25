import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adjacentPreset } from "./preset-navigation";

export function PresetNavigator({ options, current, onSelect, label, children }: {
  options: readonly string[];
  current?: string | undefined;
  onSelect: (value: string) => void;
  label: string;
  children: ReactNode;
}) {
  // Remember the last arrow choice: some editors derive `current` from sound values,
  // which can map to an earlier preset (or none) and restart the cycle after a few steps.
  const last = useRef<{ chosen: string; seen?: string | undefined; pending: boolean } | null>(null);
  useEffect(() => {
    const l = last.current;
    if (!l) return;
    if (l.pending) { l.pending = false; l.seen = current; }
    else if (current !== l.seen && current !== l.chosen) last.current = null; // changed elsewhere (menu, knobs)
  }, [current]);
  const step = (direction: -1 | 1) => {
    const l = last.current;
    const base = l && (l.pending || current === l.seen || current === l.chosen) && options.includes(l.chosen) ? l.chosen : current;
    const next = adjacentPreset(options, base, direction);
    if (next === undefined) return;
    last.current = { chosen: next, pending: true };
    onSelect(next);
  };
  return <div className="flex min-w-0 max-w-full items-center gap-1 [&>[role=combobox]]:min-w-0 [&>[role=combobox]]:flex-1">
    <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" title={`Previous ${label}`} aria-label={`Previous ${label}`} disabled={options.length === 0} onClick={() => step(-1)}><ChevronLeft /></Button>
    {children}
    <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" title={`Next ${label}`} aria-label={`Next ${label}`} disabled={options.length === 0} onClick={() => step(1)}><ChevronRight /></Button>
  </div>;
}