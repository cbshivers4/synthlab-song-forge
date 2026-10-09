import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/synclab/store";

const PREFIX = "PREVIEW · ";

/**
 * Audition generator output as a real temporary track so it plays in sync with
 * the song through the normal engine. Stop removes it; Keep turns it into a
 * normal project track.
 */
export function usePreviewTrack() {
  const { transport, togglePlay, stop: stopTransport, removeTrack, updateTrack } = useStudio();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);
  const startedPlay = useRef(false);
  const removeRef = useRef(removeTrack);
  removeRef.current = removeTrack;
  const stopRef = useRef(stopTransport);
  stopRef.current = stopTransport;

  const clear = useCallback(() => {
    if (idRef.current) removeRef.current(idRef.current);
    idRef.current = null;
    setPreviewId(null);
  }, []);

  const start = useCallback((build: (name: (n: string) => string) => string) => {
    clear();
    const id = build((n) => `${PREFIX}${n}`.slice(0, 40));
    idRef.current = id;
    setPreviewId(id);
    if (!transport.playing) { togglePlay(); startedPlay.current = true; }
  }, [clear, transport.playing, togglePlay]);

  const stop = useCallback(() => {
    clear();
    if (startedPlay.current) { stopRef.current(); startedPlay.current = false; }
  }, [clear]);

  /** Keep the previewed track in the project. Returns true if there was one. */
  const keep = useCallback((name: string) => {
    const id = idRef.current;
    if (!id) return false;
    updateTrack(id, { name: name.slice(0, 40) });
    idRef.current = null;
    startedPlay.current = false;
    setPreviewId(null);
    return true;
  }, [updateTrack]);

  // Leaving the panel discards an un-kept preview.
  useEffect(() => () => { if (idRef.current) removeRef.current(idRef.current); }, []);

  return { previewing: previewId !== null, start, stop, keep };
}
