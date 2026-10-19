import type { CloudSession } from './cloud';

/** Compare saved musical content, not playhead movement or editor selection. */
export function projectFingerprint(session: CloudSession): string {
  const { playing, recording, paused, step, countInLeft, ...transport } = session.transport;
  const tracks = session.tracks.map(({ recording, activeClipId, activeRegion, ...track }) => track);
  return JSON.stringify({ ...session, tracks, transport });
}

export function needsSavePrompt(projectId: string | undefined, baseline: string, current: string, recording: boolean): boolean {
  return recording || !projectId || baseline !== current;
}

export async function completeProjectClose(save: () => Promise<boolean>, proceed: () => void): Promise<boolean> {
  if (!await save()) return false;
  proceed();
  return true;
}