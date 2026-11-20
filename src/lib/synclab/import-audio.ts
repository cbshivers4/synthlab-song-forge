/** Accepted by the File → Import Audio and IMPORT buttons. */
export const AUDIO_IMPORT_ACCEPT = "audio/*,.mp3,.wav,.wave,.aif,.aiff,.m4a,.aac,.ogg,.flac,.webm";

interface ImportActions {
  addTrack: (kind: "sampler", name: string) => string;
  setPanel: (panel: "sampler") => void;
  loadSample: (trackId: string, file: File) => Promise<boolean>;
  removeTrack: (id: string) => void;
}

/**
 * Imports an audio file onto a new sampler channel. loadSample reports success or failure itself;
 * a file that can't be decoded leaves no empty channel behind.
 */
export async function importAudioToSampler(a: ImportActions, file: File): Promise<boolean> {
  const id = a.addTrack(
    "sampler",
    file.name
      .replace(/\.[^.]+$/, "")
      .toUpperCase()
      .slice(0, 16),
  );
  a.setPanel("sampler");
  const ok = await a.loadSample(id, file);
  if (!ok) a.removeTrack(id);
  return ok;
}
