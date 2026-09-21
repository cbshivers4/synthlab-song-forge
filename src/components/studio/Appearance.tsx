import { useState } from "react";
import { Check, Palette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/synclab/app-state";
import type { Theme, ThemeVars } from "@/lib/synclab/themes";
import { toast } from "sonner";

const FIELDS: { key: keyof ThemeVars; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Panel" },
  { key: "surface2", label: "Panel raised" },
  { key: "foreground", label: "Text" },
  { key: "muted", label: "Secondary text" },
  { key: "border", label: "Border" },
  { key: "primary", label: "Primary accent" },
  { key: "accent", label: "Secondary accent" },
  { key: "clipAudio", label: "Audio clips" },
  { key: "clipMidi", label: "MIDI clips" },
  { key: "clipDrum", label: "Drum clips" },
  { key: "meter", label: "Meters" },
  { key: "selection", label: "Selection" },
];


const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom";

export function Appearance() {
  const { allThemes, themeId, setThemeId, activeTheme, saveCustomTheme, deleteCustomTheme, customThemes, mode, setMode } =
    useApp();
  const [draft, setDraft] = useState<ThemeVars>(activeTheme.vars);
  const [name, setName] = useState("My Theme");

  const save = () => {
    const t: Theme = { id: `custom-${slug(name)}`, name, vars: draft };
    saveCustomTheme(t);
    setThemeId(t.id);
    toast.success(`${name} saved and applied`);
  };

  return (
    <div className="space-y-4">
      <section>
        <span className="label-xs">Interface mode</span>
        <div className="mt-2 flex gap-2">
          {(["simple", "advanced"] as const).map((m) => (
            <Button key={m} size="sm" variant={mode === m ? "secondary" : "ghost"} onClick={() => setMode(m)}>
              {m === "simple" ? "SIMPLE" : "ADVANCED"}
            </Button>
          ))}
          <span className="self-center text-xs text-muted-foreground">
            Simple hides deep routing and modulation until you need it.
          </span>
        </div>
      </section>

      <section>
        <span className="label-xs">Themes</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {allThemes.map((t) => (
            <div key={t.id} className="panel relative p-2">
              <button className="w-full text-left" onClick={() => setThemeId(t.id)}>
                <div className="flex gap-1">
                  {[t.vars.background, t.vars.surface2, t.vars.primary, t.vars.accent].map((c, i) => (
                    <span key={i} className="h-6 flex-1 rounded-[2px] border border-border" style={{ background: c }} />
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-medium">
                  {themeId === t.id && <Check className="size-3 text-primary" />}
                  {t.name}
                </div>
              </button>
              {customThemes.some((c) => c.id === t.id) && (
                <button
                  aria-label={`Delete ${t.name}`}
                  className="absolute top-1 right-1 rounded p-1 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    deleteCustomTheme(t.id);
                    if (themeId === t.id) setThemeId("synclab-dark");
                  }}
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-3">
        <span className="label-xs flex items-center gap-1">
          <Palette className="size-3.5" /> Custom theme
        </span>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="grid gap-1">
              <Label className="label-xs">{f.label}</Label>
              <Input
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                className="font-mono text-[11px]"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-52" />
          <Button size="sm" className="glow" onClick={save}>
            SAVE THEME
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft(activeTheme.vars)}>
            RESET TO CURRENT
          </Button>
          <span className="text-xs text-muted-foreground">Colors accept any CSS color, e.g. oklch(0.8 0.15 195) or #22d3ee.</span>
        </div>
      </section>
    </div>
  );
}
