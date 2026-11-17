import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Download, ImagePlus, Palette, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/synclab/app-state";
import {
  WALLPANEL_PANELS,
  defaultSharedPanels,
  imageToDataUrl,
  readSkins,
  replaceSkins,
  setSkin,
  startSkinSync,
  useSkin,
  type SkinKey,
} from "@/lib/synclab/skins";
import type { Theme, ThemeVars } from "@/lib/synclab/themes";
import { buildLookPack, parseLookPack } from "@/lib/synclab/look-pack";
import { REEL_DESIGNS, readReelDesign, setReelDesign } from "@/lib/synclab/reel-designs";
import { CONSOLE_STYLES } from "@/components/studio/mixer/shared";
import {
  COLOR_PREFS_DEFAULTS,
  inkFor,
  LOGO_STRENGTH_MAX,
  LOGO_STRENGTH_MIN,
  resetColorPrefs,
  setColorPrefs,
  useColorPrefs,
  type ColorPrefs,
} from "@/lib/synclab/color-prefs";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";
import { toast } from "sonner";

/** One picture, chosen once, shown behind the studio panels you tick. */
function WallpaperSection() {
  const shared = useSkin("shared");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => startSkinSync(), []);
  const allKeys = defaultSharedPanels();
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

/** Save the whole look to a file or load someone else's — like a REAPER theme. Looks only, never code. */
function LookPackSection({ activeTheme, onTheme }: { activeTheme: Theme; onTheme: (t: Theme) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("My look");
  const exportPack = () => {
    let style = "studiopro", solid: string | undefined;
    try { style = localStorage.getItem("synclab.mixer.style") ?? style; solid = localStorage.getItem("synclab.mixer.solid") ?? undefined; } catch { /* storage blocked */ }
    const pack = buildLookPack(name, { name: activeTheme.name, vars: activeTheme.vars }, readSkins(), { style, ...(solid ? { solid } : {}) }, { design: readReelDesign() });
    const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 1)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${slug(pack.name) || "look"}.synclab-look.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success("Look pack saved", { description: "Share the file — anyone can load it in Appearance." });
  };
  const importPack = async (file: File) => {
    const pack = parseLookPack(await file.text(), [...WALLPANEL_PANELS.map((p) => p.key), "shared", "sampler-keyboard", "synth-keyboard", "pads-keyboard", "video-keyboard", "keyboard"], CONSOLE_STYLES.map((c) => c.id), REEL_DESIGNS.map((d) => d.id));
    if ("error" in pack) { toast.error(pack.error); return; }
    if (pack.theme) onTheme({ id: `custom-${slug(pack.theme.name) || "imported"}`, name: pack.theme.name, vars: pack.theme.vars });
    try {
      if (pack.skins) replaceSkins(pack.skins);
      if (pack.reel) setReelDesign(pack.reel.design);
      if (pack.mixer) { localStorage.setItem("synclab.mixer.style", pack.mixer.style); if (pack.mixer.solid) localStorage.setItem("synclab.mixer.solid", pack.mixer.solid); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save this look on this device."); return; }
    toast.success(`${pack.name} loaded`, { description: pack.mixer ? "The mixer desk finish changes the next time the mixer opens." : undefined });
  };
  return <section className="panel p-3">
    <span className="label-xs flex items-center gap-1"><Palette className="size-3.5" /> Look packs</span>
    <p className="mt-1 text-xs text-muted-foreground">Save your whole look — colours, panel pictures and key colours, mixer desk finish, reel-to-reel machine — to one file you can share, or load a look someone else made. Look packs only change how things look; they can't add new devices.</p>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="w-52" aria-label="Look pack name" />
      <Button size="sm" variant="secondary" onClick={exportPack}><Download className="size-3.5" />SAVE LOOK TO FILE</Button>
      <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}><Upload className="size-3.5" />LOAD LOOK PACK</Button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" aria-label="Look pack file"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importPack(f); }} />
    </div>
  </section>;
}


/** Quick colour presets for menus: background, text, highlight. */
const MENU_PRESETS: { name: string; bg: string; fg: string; hl: string }[] = [
  { name: "Graphite", bg: "#1c2330", fg: "#eef2f6", hl: "#45c8b5" },
  { name: "Midnight", bg: "#0f1226", fg: "#e8ecff", hl: "#7c8cff" },
  { name: "Motor City", bg: "#1a1414", fg: "#f6eee8", hl: "#e0503a" },
  { name: "Neon", bg: "#120a1c", fg: "#f3e8ff", hl: "#d046ff" },
  { name: "Forest", bg: "#0f1d16", fg: "#e6f4ec", hl: "#4fd17f" },
  { name: "Gold", bg: "#1d1810", fg: "#fbf3e2", hl: "#e8b33a" },
  { name: "Silver", bg: "#d9dde2", fg: "#1a1d22", hl: "#2f6fd6" },
  { name: "Paper", bg: "#f6f3ec", fg: "#22201c", hl: "#c2552d" },
];

const LOGO_PRESETS = ["#45c8b5", "#ffffff", "#e0503a", "#e8b33a", "#d046ff", "#4fa3ff", "#4fd17f", "#ff6fae"];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
      <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" />
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </label>
  );
}

/** Menu colours for every device, instrument and timeline menu, track-coloured menus, and the timeline logo colour. */
export function MenuColorsSection() {
  const prefs = useColorPrefs();
  const set = (patch: Partial<ColorPrefs>) => setColorPrefs(patch);
  const logo = synclabLogoAsset.url;
  return (
    <section className="panel p-3" data-menu-color-settings>
      <span className="label-xs flex items-center gap-1"><Palette className="size-3.5" /> Menu &amp; timeline colours</span>
      <p className="mt-1 text-xs text-muted-foreground">
        Pick the colours of every menu — on all devices, instruments, the mixer and the timeline. These colours are saved on
        this device only, not in your songs.
      </p>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={prefs.menuCustom ? "ghost" : "secondary"} onClick={() => set({ menuCustom: false })}>THEME MENU COLOURS</Button>
          <Button size="sm" variant={prefs.menuCustom ? "secondary" : "ghost"} onClick={() => set({ menuCustom: true })}>MY OWN MENU COLOURS</Button>
        </div>
        {prefs.menuCustom && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {MENU_PRESETS.map((m) => (
                <button key={m.name} type="button" onClick={() => set({ menuBg: m.bg, menuText: m.fg, menuHighlight: m.hl })}
                  aria-label={`${m.name} menu colours`}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-widest"
                  style={{ background: m.bg, color: m.fg, borderColor: m.hl }}>
                  <span className="size-2.5 rounded-full" style={{ background: m.hl }} />{m.name}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <ColorField label="Menu background" value={prefs.menuBg} onChange={(v) => set({ menuBg: v })} />
              <ColorField label="Menu text" value={prefs.menuText} onChange={(v) => set({ menuText: v })} />
              <ColorField label="Menu highlight" value={prefs.menuHighlight} onChange={(v) => set({ menuHighlight: v })} />
            </div>
            {/* Live sample drawn with the chosen colours. */}
            <div aria-label="Menu preview" className="w-56 rounded-md border p-1 text-sm shadow-md"
              style={{ background: prefs.menuBg, color: prefs.menuText, borderColor: `color-mix(in oklab, ${prefs.menuText} 22%, ${prefs.menuBg})` }}>
              <div className="px-2 py-1.5 text-xs font-semibold">PREVIEW</div>
              <div className="rounded-sm px-2 py-1.5" style={{ background: prefs.menuHighlight, color: inkFor(prefs.menuHighlight) }}>Highlighted item</div>
              <div className="px-2 py-1.5">Menu item</div>
              <div className="px-2 py-1.5" style={{ color: `color-mix(in oklab, ${prefs.menuText} 65%, ${prefs.menuBg})` }}>Secondary text</div>
            </div>
          </>
        )}
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="size-4 accent-primary" checked={prefs.menuTrackTint}
            onChange={(e) => set({ menuTrackTint: e.target.checked })} aria-label="Track menus use the track colour" />
          Track menus use the track&apos;s colour (timeline and mixer channel menus, colour picker)
        </label>
      </div>

      <div className="mt-4 space-y-2 border-t border-border pt-3">
        <span className="label-xs">SYNCLAB logo in the timeline</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={prefs.logoMode === "original" ? "secondary" : "ghost"} onClick={() => set({ logoMode: "original" })}>ORIGINAL</Button>
          <Button size="sm" variant={prefs.logoMode === "custom" ? "secondary" : "ghost"} onClick={() => set({ logoMode: "custom" })}>MY COLOUR</Button>
          {prefs.logoMode === "custom" && (
            <>
              {LOGO_PRESETS.map((c) => (
                <button key={c} type="button" aria-label={`Logo colour ${c}`} onClick={() => set({ logoColor: c })}
                  className={`size-6 rounded-full border ${prefs.logoColor === c ? "border-foreground ring-2 ring-foreground/40" : "border-border"}`}
                  style={{ background: c }} />
              ))}
              <ColorField label="Logo colour" value={prefs.logoColor} onChange={(v) => set({ logoColor: v })} />
            </>
          )}
        </div>
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Logo brightness
          <input type="range" aria-label="Timeline logo brightness" min={LOGO_STRENGTH_MIN} max={LOGO_STRENGTH_MAX} step={0.01}
            value={prefs.logoStrength} onChange={(e) => set({ logoStrength: Number(e.target.value) })} className="w-40" />
          {Math.round(prefs.logoStrength * 100)}%
        </label>
        {/* Preview at full brightness so the colour is easy to judge. */}
        <div className="flex h-28 w-28 items-center justify-center rounded-md border border-border bg-background">
          {prefs.logoMode === "custom" ? (
            <div aria-label="Logo preview" className="size-24" style={{
              background: prefs.logoColor,
              maskImage: `url(${logo})`, WebkitMaskImage: `url(${logo})`,
              maskMode: "luminance", WebkitMaskSourceType: "luminance",
              maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
            } as CSSProperties} />
          ) : (
            <img src={logo} alt="Logo preview" className="size-24 rounded" />
          )}
        </div>
      </div>

      <div className="mt-3">
        <Button size="sm" variant="ghost" disabled={JSON.stringify(prefs) === JSON.stringify(COLOR_PREFS_DEFAULTS)}
          onClick={() => { resetColorPrefs(); toast.success("Menu and logo colours reset"); }}>RESET COLOURS</Button>
      </div>
    </section>
  );
}

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
      <MenuColorsSection />
      <WallpaperSection />
      <LookPackSection activeTheme={activeTheme} onTheme={(t) => { saveCustomTheme(t); setThemeId(t.id); }} />
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
