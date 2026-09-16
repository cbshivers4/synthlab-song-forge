// SYNCLAB themes — every theme re-paints the whole app by overriding the
// semantic design tokens on :root. No component hardcodes a color.

export interface ThemeVars {
  background: string;
  surface: string;
  surface2: string;
  foreground: string;
  muted: string;
  border: string;
  primary: string;
  primaryFg: string;
  accent: string;
  clipAudio: string;
  clipMidi: string;
  clipDrum: string;
}

export interface Theme {
  id: string;
  name: string;
  vars: ThemeVars;
}

const t = (
  name: string,
  id: string,
  v: Partial<ThemeVars> & Pick<ThemeVars, "background" | "primary">,
): Theme => ({
  id,
  name,
  vars: {
    surface: "oklch(0.185 0.01 255)",
    surface2: "oklch(0.235 0.012 258)",
    foreground: "oklch(0.93 0.008 230)",
    muted: "oklch(0.68 0.02 250)",
    border: "oklch(0.275 0.012 255)",
    primaryFg: "oklch(0.16 0.02 255)",
    accent: "oklch(0.72 0.19 330)",
    clipAudio: "oklch(0.73 0.17 155)",
    clipMidi: "oklch(0.7 0.15 275)",
    clipDrum: "oklch(0.79 0.15 78)",
    ...v,
  },
});

export const THEMES: Theme[] = [
  t("SYNCLAB Dark", "synclab-dark", { background: "oklch(0.145 0.008 255)", primary: "oklch(0.8 0.15 195)" }),
  t("Detroit Night", "detroit-night", {
    background: "oklch(0.13 0.015 285)",
    surface: "oklch(0.175 0.02 285)",
    surface2: "oklch(0.225 0.025 285)",
    border: "oklch(0.28 0.03 285)",
    primary: "oklch(0.78 0.18 30)",
    accent: "oklch(0.7 0.19 330)",
    clipAudio: "oklch(0.78 0.16 60)",
  }),
  t("Cyber", "cyber", {
    background: "oklch(0.12 0.02 200)",
    surface: "oklch(0.17 0.03 200)",
    surface2: "oklch(0.22 0.035 200)",
    border: "oklch(0.3 0.05 195)",
    primary: "oklch(0.86 0.18 180)",
    accent: "oklch(0.75 0.2 320)",
  }),
  t("Neon", "neon", {
    background: "oklch(0.12 0.02 300)",
    surface: "oklch(0.17 0.03 300)",
    surface2: "oklch(0.22 0.04 300)",
    border: "oklch(0.32 0.06 300)",
    primary: "oklch(0.82 0.2 320)",
    accent: "oklch(0.85 0.18 150)",
    clipMidi: "oklch(0.78 0.18 320)",
  }),
  t("Midnight", "midnight", {
    background: "oklch(0.11 0.02 260)",
    surface: "oklch(0.16 0.025 260)",
    surface2: "oklch(0.21 0.03 260)",
    border: "oklch(0.28 0.04 260)",
    primary: "oklch(0.72 0.16 265)",
    accent: "oklch(0.78 0.14 210)",
  }),
  t("Graphite", "graphite", {
    background: "oklch(0.155 0 0)",
    surface: "oklch(0.2 0 0)",
    surface2: "oklch(0.25 0 0)",
    border: "oklch(0.31 0 0)",
    primary: "oklch(0.82 0.16 140)",
    accent: "oklch(0.8 0.14 85)",
  }),
  t("Ice", "ice", {
    background: "oklch(0.17 0.015 230)",
    surface: "oklch(0.22 0.02 230)",
    surface2: "oklch(0.28 0.025 230)",
    border: "oklch(0.35 0.03 230)",
    primary: "oklch(0.88 0.09 220)",
    accent: "oklch(0.8 0.1 200)",
  }),
  t("Platinum", "platinum", {
    background: "oklch(0.2 0.004 250)",
    surface: "oklch(0.26 0.005 250)",
    surface2: "oklch(0.32 0.006 250)",
    border: "oklch(0.4 0.008 250)",
    primary: "oklch(0.9 0.02 250)",
    primaryFg: "oklch(0.2 0.01 250)",
    accent: "oklch(0.78 0.12 250)",
  }),
  t("Ocean", "ocean", {
    background: "oklch(0.15 0.03 230)",
    surface: "oklch(0.2 0.04 230)",
    surface2: "oklch(0.25 0.045 230)",
    border: "oklch(0.32 0.05 230)",
    primary: "oklch(0.8 0.13 200)",
    accent: "oklch(0.78 0.15 165)",
  }),
  t("Purple", "purple", {
    background: "oklch(0.14 0.03 300)",
    surface: "oklch(0.19 0.04 300)",
    surface2: "oklch(0.24 0.05 300)",
    border: "oklch(0.31 0.055 300)",
    primary: "oklch(0.76 0.18 300)",
    accent: "oklch(0.82 0.14 200)",
  }),
  t("Sunset", "sunset", {
    background: "oklch(0.15 0.025 40)",
    surface: "oklch(0.2 0.035 40)",
    surface2: "oklch(0.25 0.04 40)",
    border: "oklch(0.32 0.05 40)",
    primary: "oklch(0.8 0.17 55)",
    accent: "oklch(0.72 0.2 20)",
    clipAudio: "oklch(0.8 0.15 95)",
  }),
  t("Classic", "classic", {
    background: "oklch(0.18 0.006 90)",
    surface: "oklch(0.23 0.008 90)",
    surface2: "oklch(0.28 0.01 90)",
    border: "oklch(0.36 0.012 90)",
    primary: "oklch(0.8 0.13 95)",
    accent: "oklch(0.72 0.14 40)",
  }),
  t("Light Studio", "light-studio", {
    background: "oklch(0.96 0.004 250)",
    surface: "oklch(0.99 0.002 250)",
    surface2: "oklch(0.93 0.005 250)",
    foreground: "oklch(0.22 0.01 255)",
    muted: "oklch(0.48 0.015 255)",
    border: "oklch(0.86 0.008 250)",
    primary: "oklch(0.58 0.15 230)",
    primaryFg: "oklch(0.99 0 0)",
    accent: "oklch(0.6 0.18 330)",
    clipAudio: "oklch(0.62 0.16 155)",
    clipMidi: "oklch(0.58 0.15 275)",
    clipDrum: "oklch(0.66 0.15 70)",
  }),
  t("High Contrast", "high-contrast", {
    background: "oklch(0.06 0 0)",
    surface: "oklch(0.12 0 0)",
    surface2: "oklch(0.18 0 0)",
    foreground: "oklch(1 0 0)",
    muted: "oklch(0.82 0 0)",
    border: "oklch(0.55 0 0)",
    primary: "oklch(0.92 0.2 105)",
    primaryFg: "oklch(0.06 0 0)",
    accent: "oklch(0.85 0.2 200)",
  }),
];

export function themeById(id: string): Theme | undefined {
  return THEMES.find((x) => x.id === id);
}

/** Paint a theme onto the document by overriding the root design tokens. */
export function applyThemeVars(v: ThemeVars) {
  if (typeof document === "undefined") return;
  const s = document.documentElement.style;
  const set = (k: string, val: string) => s.setProperty(k, val);
  set("--background", v.background);
  set("--surface", v.surface);
  set("--surface-2", v.surface2);
  set("--card", v.surface);
  set("--popover", v.surface2);
  set("--foreground", v.foreground);
  set("--card-foreground", v.foreground);
  set("--popover-foreground", v.foreground);
  set("--muted-foreground", v.muted);
  set("--muted", v.surface2);
  set("--secondary", v.surface2);
  set("--secondary-foreground", v.foreground);
  set("--border", v.border);
  set("--input", v.border);
  set("--sidebar", v.surface);
  set("--sidebar-foreground", v.foreground);
  set("--sidebar-border", v.border);
  set("--sidebar-accent", v.surface2);
  set("--sidebar-accent-foreground", v.foreground);
  set("--primary", v.primary);
  set("--primary-foreground", v.primaryFg);
  set("--sidebar-primary", v.primary);
  set("--sidebar-primary-foreground", v.primaryFg);
  set("--ring", v.primary);
  set("--neon", v.primary);
  set("--accent", v.accent);
  set("--magenta", v.accent);
  set("--clip-audio", v.clipAudio);
  set("--clip-midi", v.clipMidi);
  set("--clip-drum", v.clipDrum);
}
