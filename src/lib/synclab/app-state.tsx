import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyThemeVars, THEMES, themeById, type Theme, type ThemeVars } from "./themes";

export type Stage = "welcome" | "start" | "studio";
export type UiMode = "simple" | "advanced";

export interface ProjectMeta {
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
  const [stage, setStage] = useState<Stage>("welcome");
  const [mode, setMode] = useState<UiMode>("simple");
  const [themeId, setThemeId] = useState("synclab-dark");
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [recents, setRecents] = useState<ProjectMeta[]>([]);
  const [project, setProjectState] = useState<ProjectMeta | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  // hydrate after mount so SSR markup matches
  useEffect(() => {
    const p = read();
    if (p.themeId) setThemeId(p.themeId);
    if (p.mode) setMode(p.mode);
    if (p.customThemes) setCustomThemes(p.customThemes);
    if (p.recents) setRecents(p.recents);
    if (p.signedIn) setSignedIn(true);
  }, []);

  const allThemes = useMemo(() => [...THEMES, ...customThemes], [customThemes]);
  const activeTheme = useMemo(
    () => allThemes.find((x) => x.id === themeId) ?? themeById("synclab-dark") ?? (THEMES[0] as Theme),
    [allThemes, themeId],
  );

  useEffect(() => {
    applyThemeVars(activeTheme.vars);
  }, [activeTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const data: Persisted = { themeId, mode, customThemes, recents, signedIn };
    window.localStorage.setItem(KEY, JSON.stringify(data));
  }, [themeId, mode, customThemes, recents, signedIn]);

  const setProject = useCallback((p: ProjectMeta) => {
    setProjectState(p);
    setRecents((r) => [p, ...r.filter((x) => x.name !== p.name)].slice(0, 12));
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
      recents,
      signedIn,
      setSignedIn,
    }),
    [stage, mode, themeId, customThemes, allThemes, activeTheme, project, setProject, recents, signedIn],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

export type { Theme, ThemeVars };
