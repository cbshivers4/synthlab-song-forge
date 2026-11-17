import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { refreshPreferences, PREFS_EVENT } from "./preferences";
import { applyThemeVars, THEMES, themeById, type Theme, type ThemeVars } from "./themes";
import { startColorPrefs } from "./color-prefs";

export type Stage = "welcome" | "start" | "studio";
export type UiMode = "simple" | "advanced";

export interface ProjectMeta {
  id?: string;
  name: string;
  bpm: number;
  key: string;
  timeSig: string;
  template: string;
  openedAt: number;
}

interface AppApi {
  stage: Stage;
  setStage: (s: Stage) => void;
  mode: UiMode;
  setMode: (m: UiMode) => void;
  toggleMode: () => void;
  themeId: string;
  setThemeId: (id: string) => void;
  customThemes: Theme[];
  saveCustomTheme: (t: Theme) => void;
  deleteCustomTheme: (id: string) => void;
  allThemes: Theme[];
  activeTheme: Theme;
  project: ProjectMeta | null;
  setProject: (p: ProjectMeta) => void;
  removeRecent: (p: ProjectMeta) => void;
  renameRecent: (p: ProjectMeta, name: string) => void;
  recents: ProjectMeta[];
  signedIn: boolean;
  setSignedIn: (v: boolean) => void;
}

const g = globalThis as typeof globalThis & { __synclabApp?: React.Context<AppApi | null> };
const Ctx = (g.__synclabApp ??= createContext<AppApi | null>(null));

const KEY = "synclab.app.v1";

interface Persisted {
  themeId?: string;
  mode?: UiMode;
  customThemes?: Theme[];
  recents?: ProjectMeta[];
  signedIn?: boolean;
}

function read(): Persisted {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Persisted;
  } catch {
    return {};
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [stage, setStageState] = useState<Stage>("welcome");
  const setStage = useCallback((next: Stage) => {
    if (stage === "studio" && next !== "studio") {
      const event = new CustomEvent("synclab:before-project-close", {
        cancelable: true,
        detail: { next, proceed: () => setStageState(next) },
      });
      if (!document.dispatchEvent(event)) return;
    }
    setStageState(next);
  }, [stage]);
  const [mode, setMode] = useState<UiMode>("simple");
  const [themeId, setThemeId] = useState("synclab-dark");
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [recents, setRecents] = useState<ProjectMeta[]>([]);
  const [project, setProjectState] = useState<ProjectMeta | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  // Custom menu colours, track-coloured menus and the timeline logo colour (device-only).
  useEffect(() => startColorPrefs(), []);

  // hydrate after mount so SSR markup matches
  useEffect(() => {
    refreshPreferences();
    window.addEventListener(PREFS_EVENT, refreshPreferences);
    window.addEventListener("storage", refreshPreferences);
    const p = read();
    if (p.themeId) setThemeId(p.themeId);
    if (p.mode) setMode(p.mode);
    if (p.customThemes) setCustomThemes(p.customThemes);
    if (p.recents) setRecents(p.recents);
    if (p.signedIn) setSignedIn(true);
    return () => {
      window.removeEventListener(PREFS_EVENT, refreshPreferences);
      window.removeEventListener("storage", refreshPreferences);
    };
  }, []);

  const allThemes = useMemo(() => [...THEMES, ...customThemes], [customThemes]);
  const activeTheme = useMemo(
    () => allThemes.find((x) => x.id === themeId) ?? themeById("synclab-dark") ?? (THEMES[0] as Theme),
    [allThemes, themeId],
  );

  useEffect(() => {
    applyThemeVars(activeTheme.vars);
  }, [activeTheme]);

  // Entry screens and portalled controls share the phone studio palette.
  useEffect(() => {
    document.documentElement.classList.toggle("phone-theme-active", isMobile);
    return () => document.documentElement.classList.remove("phone-theme-active");
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const data: Persisted = { themeId, mode, customThemes, recents, signedIn };
    window.localStorage.setItem(KEY, JSON.stringify(data));
  }, [themeId, mode, customThemes, recents, signedIn]);

  const setProject = useCallback((p: ProjectMeta) => {
    setProjectState(p);
    setRecents((r) => [p, ...r.filter((x) => x.name !== p.name)].slice(0, 12));
  }, []);

  const removeRecent = useCallback((p: ProjectMeta) => {
    setRecents((r) => r.filter((x) => !(x.name === p.name && x.openedAt === p.openedAt)));
  }, []);

  const renameRecent = useCallback((p: ProjectMeta, name: string) => {
    setRecents((r) => r.map((x) => (x.name === p.name && x.openedAt === p.openedAt ? { ...x, name } : x)));
    setProjectState((cur) => (cur && cur.name === p.name && cur.openedAt === p.openedAt ? { ...cur, name } : cur));
  }, []);

  const api: AppApi = useMemo(
    () => ({
      stage,
      setStage,
      mode,
      setMode,
      toggleMode: () => setMode((m) => (m === "simple" ? "advanced" : "simple")),
      themeId,
      setThemeId,
      customThemes,
      saveCustomTheme: (t) => setCustomThemes((c) => [...c.filter((x) => x.id !== t.id), t]),
      deleteCustomTheme: (id) => setCustomThemes((c) => c.filter((x) => x.id !== id)),
      allThemes,
      activeTheme,
      project,
      setProject,
      removeRecent,
      renameRecent,
      recents,
      signedIn,
      setSignedIn,
    }),
    [stage, setStage, mode, themeId, customThemes, allThemes, activeTheme, project, setProject, removeRecent, renameRecent, recents, signedIn],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

export type { Theme, ThemeVars };

/** Returns the app state when a provider is above, otherwise null. */
export function useMaybeApp(): AppApi | null {
  return useContext(Ctx);
}
