import type { ReactNode } from "react";
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
  const step = (direction: -1 | 1) => {
    const next = adjacentPreset(options, current, direction);
    if (next !== undefined) onSelect(next);
  };
  return <div className="flex min-w-0 max-w-full items-center gap-1 [&>[role=combobox]]:min-w-0 [&>[role=combobox]]:flex-1">
    <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" title={`Previous ${label}`} aria-label={`Previous ${label}`} disabled={options.length === 0} onClick={() => step(-1)}><ChevronLeft /></Button>
    {children}
    <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" title={`Next ${label}`} aria-label={`Next ${label}`} disabled={options.length === 0} onClick={() => step(1)}><ChevronRight /></Button>
  </div>;
}