import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CreativeTool = "vocal" | "stems" | "voice" | "coproducer" | "hum";
type ThemeName = "electric" | "rose" | "amber" | "emerald" | "mono";

const OPTIONS: { value: ThemeName; label: string }[] = [
  { value: "electric", label: "Electric Blue" },
  { value: "rose", label: "Vocal Rose" },
  { value: "amber", label: "Motor Gold" },
  { value: "emerald", label: "Signal Green" },
  { value: "mono", label: "Studio Mono" },
];

const DEFAULTS: Record<CreativeTool, ThemeName> = {
  vocal: "rose",
  stems: "electric",
  voice: "amber",
  coproducer: "emerald",
  hum: "amber",
};

const keyFor = (tool: CreativeTool) => `synclab.creative-theme.${tool}`;

export function useCreativeToolTheme(tool: CreativeTool) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULTS[tool]);
  useEffect(() => {
    const saved = window.localStorage.getItem(keyFor(tool)) as ThemeName | null;
    if (saved && OPTIONS.some((option) => option.value === saved)) setThemeState(saved);
  }, [tool]);
  const setTheme = (next: ThemeName) => {
    setThemeState(next);
    window.localStorage.setItem(keyFor(tool), next);
  };
  return { theme, setTheme };
}

export function CreativeToolThemePicker({ tool, theme, onChange }: { tool: CreativeTool; theme: ThemeName; onChange: (theme: ThemeName) => void }) {
  return (
    <div className="creative-theme-picker flex items-center gap-2">
      <Palette className="size-4 text-primary" />
      <Select value={theme} onValueChange={(value) => onChange(value as ThemeName)}>
        <SelectTrigger className="h-9 w-40" aria-label={`${tool} color theme`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}