/**
 * Look packs: the whole visual setup (colour theme, panel wallpapers/key colours, mixer desk finish)
 * in one shareable file, like a REAPER theme. Parsing is strict so a downloaded file can only
 * change looks — never run code or point images at outside addresses.
 */
import type { Skin, Skins, SkinKey } from "./skins";
import type { ThemeVars } from "./themes";

export const LOOK_FORMAT = "synclab-look";
export interface LookPack {
  format: typeof LOOK_FORMAT;
  version: 1;
  name: string;
  theme?: { name: string; vars: ThemeVars } | undefined;
  skins?: Skins | undefined;
  mixer?: { style: string; solid?: string | undefined } | undefined;
  /** reel-to-reel machine design id (reel-designs.ts) */
  reel?: { design: string } | undefined;
}

const THEME_KEYS: (keyof ThemeVars)[] = ["background", "surface", "surface2", "foreground", "muted", "border", "primary", "primaryFg", "accent", "clipAudio", "clipMidi", "clipDrum", "meter", "selection"];
const SKIN_COLOR_KEYS = ["naturalKeyColor", "sharpKeyColor", "activeKeyColor", "color", "padColor"] as const;
const SKIN_NUMBER_KEYS = ["imageZoom", "imageX", "imageY", "dim"] as const;

/** a plain CSS colour: hex, rgb/hsl/oklch/oklab/color-mix() functions or a named colour; no urls, no declarations */
export function safeColor(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s || s.length > 120 || /url\(|[;{}<>\\]|expression|@import/i.test(s)) return undefined;
  if (/^#[0-9a-f]{3,8}$/i.test(s) || /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|color-mix|var)\([^()]*(\([^()]*\)[^()]*)*\)$/i.test(s) || /^[a-z]{3,20}$/i.test(s)) return s;
  return undefined;
}
const safeImage = (v: unknown) => (typeof v === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(v) && v.length < 6_000_000 ? v : undefined);
const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);

export function buildLookPack(name: string, theme: { name: string; vars: ThemeVars }, skins: Skins, mixer: { style: string; solid?: string }, reel?: { design: string }): LookPack {
  return { format: LOOK_FORMAT, version: 1, name: name.trim() || "My look", theme, skins, mixer, ...(reel ? { reel } : {}) };
}

/** Returns a cleaned pack, or an error message a person can read. */
export function parseLookPack(text: string, validSkinKeys: readonly SkinKey[], validMixerStyles: readonly string[], validReelDesigns: readonly string[] = []): LookPack | { error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { error: "That file isn't a SYNCLAB look pack." }; }
  const o = raw as Record<string, unknown>;
  if (!o || typeof o !== "object" || o["format"] !== LOOK_FORMAT) return { error: "That file isn't a SYNCLAB look pack." };
  if (o["version"] !== 1) return { error: "This look pack was made by a newer version of SYNCLAB." };
  const pack: LookPack = { format: LOOK_FORMAT, version: 1, name: typeof o["name"] === "string" ? o["name"].slice(0, 60) : "Imported look" };
  const t = o["theme"] as Record<string, unknown> | undefined;
  if (t && typeof t === "object" && t["vars"] && typeof t["vars"] === "object") {
    const vars = t["vars"] as Record<string, unknown>;
    const clean = Object.fromEntries(THEME_KEYS.map((k) => [k, safeColor(vars[k])]));
    if (THEME_KEYS.every((k) => clean[k])) pack.theme = { name: typeof t["name"] === "string" ? t["name"].slice(0, 60) : pack.name, vars: clean as unknown as ThemeVars };
    else return { error: "The colours in this look pack aren't valid." };
  }
  const s = o["skins"] as Record<string, unknown> | undefined;
  if (s && typeof s === "object") {
    const skins: Skins = {};
    for (const key of validSkinKeys) {
      const v = s[key] as Record<string, unknown> | undefined;
      if (!v || typeof v !== "object") continue;
      const skin: Skin = {};
      for (const k of SKIN_COLOR_KEYS) { const c = safeColor(v[k]); if (c) skin[k] = c; }
      const img = safeImage(v["image"]); if (img) skin.image = img;
      for (const k of SKIN_NUMBER_KEYS) { const n = num(v[k], 0, k === "imageZoom" ? 4 : 100); if (n !== undefined) skin[k] = n; }
      if (Array.isArray(v["panels"])) skin.panels = v["panels"].filter((p): p is string => typeof p === "string" && (validSkinKeys as readonly string[]).includes(p));
      skins[key] = skin;
    }
    pack.skins = skins;
  }
  const m = o["mixer"] as Record<string, unknown> | undefined;
  if (m && typeof m === "object" && typeof m["style"] === "string" && validMixerStyles.includes(m["style"])) {
    const solid = safeColor(m["solid"]);
    pack.mixer = { style: m["style"], ...(solid ? { solid } : {}) };
  }
  const r = o["reel"] as Record<string, unknown> | undefined;
  if (r && typeof r === "object" && typeof r["design"] === "string" && validReelDesigns.includes(r["design"])) pack.reel = { design: r["design"] };
  return pack;
}
