/**
 * Device-only colour preferences (never project data): custom menu colours for every menu,
 * whether a track's menus take that track's colour, and the colour of the SYNCLAB logo
 * drawn behind the timeline. Applied as attributes/variables on <html> so every portalled
 * menu (which lives outside the studio tree) picks them up.
 */
import { useSyncExternalStore, type CSSProperties } from "react";

export interface ColorPrefs {
  /** Use menuBg/menuText/menuHighlight on every menu instead of the theme's menu colours. */
  menuCustom: boolean;
  menuBg: string;
  menuText: string;
  menuHighlight: string;
  /** Track menus (timeline channel menu, mixer channel menu, colour picker…) take the track colour. */
  menuTrackTint: boolean;
  /** "original" keeps the neon logo picture; "custom" paints it in logoColor. */
  logoMode: "original" | "custom";
  logoColor: string;
  /** How visible the timeline logo is, 0.02 – 0.6. */
  logoStrength: number;
}

export const COLOR_PREFS_DEFAULTS: ColorPrefs = {
  menuCustom: false,
  menuBg: "#1c2330",
  menuText: "#eef2f6",
  menuHighlight: "#45c8b5",
  menuTrackTint: true,
  logoMode: "original",
  logoColor: "#45c8b5",
  logoStrength: 0.06,
};

export const LOGO_STRENGTH_MIN = 0.02;
export const LOGO_STRENGTH_MAX = 0.6;

const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback);

/** Never trust stored values: bad colours fall back to defaults, strength is clamped. */
export function sanitizeColorPrefs(raw: unknown): ColorPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ColorPrefs, unknown>>;
  const d = COLOR_PREFS_DEFAULTS;
  const strength = typeof r.logoStrength === "number" && Number.isFinite(r.logoStrength) ? r.logoStrength : d.logoStrength;
  return {
    menuCustom: r.menuCustom === true,
    menuBg: hexOr(r.menuBg, d.menuBg),
    menuText: hexOr(r.menuText, d.menuText),
    menuHighlight: hexOr(r.menuHighlight, d.menuHighlight),
    menuTrackTint: r.menuTrackTint !== false,
    logoMode: r.logoMode === "custom" ? "custom" : "original",
    logoColor: hexOr(r.logoColor, d.logoColor),
    logoStrength: Math.min(LOGO_STRENGTH_MAX, Math.max(LOGO_STRENGTH_MIN, strength)),
  };
}

/** Black or white text, whichever reads better on the given #rrggbb colour. */
export function inkFor(hex: string): "#000000" | "#ffffff" {
  const n = parseInt(hexOr(hex, "#000000").slice(1), 16);
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? "#000000" : "#ffffff";
}

/** CSS variables the custom-menu stylesheet rules read. */
export function menuCssVars(p: ColorPrefs): Record<string, string> {
  return {
    "--menu-custom-bg": p.menuBg,
    "--menu-custom-fg": p.menuText,
    "--menu-custom-hl": p.menuHighlight,
    "--menu-custom-hl-ink": inkFor(p.menuHighlight),
  };
}

/** Inline style that lets a portalled track menu take its track's colour (see .track-tinted-menu). */
export const trackMenuStyle = (color: string) => ({ "--menu-track": color }) as CSSProperties;

const KEY = "synclab.color-prefs";
let cached: ColorPrefs | null = null;
const subs = new Set<() => void>();

export function colorPrefs(): ColorPrefs {
  if (cached) return cached;
  try { cached = sanitizeColorPrefs(JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch { cached = { ...COLOR_PREFS_DEFAULTS }; }
  return cached;
}

export function setColorPrefs(patch: Partial<ColorPrefs>) {
  cached = sanitizeColorPrefs({ ...colorPrefs(), ...patch });
  try { localStorage.setItem(KEY, JSON.stringify(cached)); } catch { /* storage blocked */ }
  for (const fn of subs) fn();
}

export function resetColorPrefs() { setColorPrefs({ ...COLOR_PREFS_DEFAULTS }); }

const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };

/** Server render and first paint use the defaults, then the saved colours. */
export function useColorPrefs(): ColorPrefs {
  return useSyncExternalStore(subscribe, colorPrefs, () => COLOR_PREFS_DEFAULTS);
}

function apply(root: HTMLElement) {
  const p = colorPrefs();
  if (p.menuCustom) root.setAttribute("data-menu-colors", "custom");
  else root.removeAttribute("data-menu-colors");
  root.setAttribute("data-track-menus", p.menuTrackTint ? "on" : "off");
  for (const [k, v] of Object.entries(menuCssVars(p))) root.style.setProperty(k, v);
}

/** Apply the saved colours to <html> now and whenever they change. Returns the cleanup. */
export function startColorPrefs(root: HTMLElement = document.documentElement) {
  apply(root);
  return subscribe(() => apply(root));
}
