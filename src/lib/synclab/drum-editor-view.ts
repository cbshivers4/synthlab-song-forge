import { useEffect, useState } from "react";

type DrumEditorView = { padId: string | null; step: number; start: number; zoom: number };
const empty: DrumEditorView = { padId: null, step: 0, start: 0, zoom: 1 };
const views = new Map<string, DrumEditorView>();

/** Session-only editor navigation, independent of saved patterns and audio state. */
export function useDrumEditorView(trackId: string) {
  const [view, setView] = useState<DrumEditorView>(empty);
  const [ready, setReady] = useState(false);
  useEffect(() => { setView(views.get(trackId) ?? empty); setReady(true); }, [trackId]);
  const updateView = (patch: Partial<DrumEditorView>) => {
    setView((current) => {
      const next = { ...current, ...patch };
      views.set(trackId, next);
      return next;
    });
  };
  return { view, updateView, ready };
}