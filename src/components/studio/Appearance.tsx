import { useRef, useState } from "react";
import { Check, ImagePlus, Palette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/synclab/app-state";
import {
  WALLPANEL_PANELS,
  imageToDataUrl,
  setSkin,
  startSkinSync,
  useSkin,
  type SkinKey,
} from "@/lib/synclab/skins";
import type { Theme, ThemeVars } from "@/lib/synclab/themes";
import { toast } from "sonner";

/** One picture, chosen once, shown behind the studio panels you tick. */
function WallpaperSection() {
  const shared = useSkin("shared");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const allKeys = WALLPANEL_PANELS.map((p) => p.key);
  const on = (key: SkinKey) => (shared.panels ?? allKeys).includes(key);

  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const image = await imageToDataUrl(f, 1600);
      setSkin("shared", { image, imageZoom: 1, imageX: 50, imageY: 50 });
      toast.success("Wallpaper chosen — pick where it shows");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: SkinKey) => {
    const cur = new Set(shared.panels ?? allKeys);
    if (cur.has(key)) cur.delete(key);
    else cur.add(key);
    setSkin("shared", { panels: [...cur] });
  };

  return (
    <section className="panel p-3" data-wallpaper-settings>
      <span className="label-xs flex items-center gap-1">
        <ImagePlus className="size-3.5" /> Wallpaper
      </span>
      <p className="mt-1 text-xs text-muted-foreground">
        Use your own JPEG, PNG or WEBP picture behind the studio panels. Choose one here and tick where it shows,
        or drag a picture straight onto any panel.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            void pick(f);
          }}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="size-4" /> {busy ? "Opening…" : "Choose picture"}
        </Button>
        {shared.image && (
          <div
            className="h-12 w-20 rounded border border-border bg-cover bg-center"
            style={{ backgroundImage: `url(${shared.image})` }}
            aria-label="Chosen wallpaper"
          />
        )}
        {shared.image && (
          <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Darken
            <input
              type="range"
              aria-label="Darken wallpaper"
              min={0}
              max={0.8}
              step={0.05}
              value={shared.dim ?? 0.35}
              onChange={(e) => setSkin("shared", { dim: Number(e.target.value) })}
              className="w-28"
            />
          </label>
        )}
        {shared.image && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSkin("shared", { image: undefined, panels: undefined, dim: undefined });
              toast.success("Wallpaper removed");
            }}
          >
            <Trash2 className="size-4" /> Remove
          </Button>
        )}
      </div>
      {shared.image && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {WALLPANEL_PANELS.map((p) => (
            <Button key={p.key} size="sm" variant={on(p.key) ? "secondary" : "ghost"} onClick={() => toggle(p.key)}>
              {p.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}

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
      <WallpaperSection />
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
