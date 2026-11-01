/**
 * Decides how one audio reference is stored in a saved project.
 * Only freshly recorded/imported (blob:) audio is uploaded; audio that already lives in
 * cloud storage keeps its permanent storage path. A temporary signed link must never be
 * saved as the path, because it expires and the sample would play silently later.
 */
export type MediaStorePlan =
  | { upload: string; cloudPath: string }
  | { cloudPath: string }
  | { url: string };

export function mediaStorePlan(url: string | undefined, existingPath: string | undefined, newPath: string): MediaStorePlan {
  const path = existingPath && !/^https?:/i.test(existingPath) ? existingPath : undefined;
  if (url?.startsWith("blob:")) return { upload: path ?? newPath, cloudPath: path ?? newPath };
  if (path) return { cloudPath: path };
  return { url: url ?? "" };
}

/**
 * How one drum pad's sample is stored when a project is saved to the cloud.
 * Every pad sample ends up as the project's own copy in cloud storage, so it keeps playing after
 * temporary links expire or the place it came from changes:
 *  - this project's own stored copy is kept (reopened projects don't upload again);
 *  - a copy stored by another project or the library is copied in too, so deleting that
 *    project or library item can't silence this one;
 *  - new audio (blob:) and any other link (web link, app file, old expiring link) is copied in.
 * Old saves wrongly kept an expiring https link as the "stored path"; those are copied again.
 */
export type DrumSamplePlan =
  | { kind: "none" }
  | { kind: "keep"; cloudPath: string }
  | { kind: "copy"; from: string; cloudPath: string };

export function drumSamplePlan(sampleUrl: string | undefined, existingPath: string | undefined, newPath: string, projectPrefix: string): DrumSamplePlan {
  const path = existingPath && !/^https?:/i.test(existingPath) && existingPath.startsWith(projectPrefix) ? existingPath : undefined;
  if (!sampleUrl) return { kind: "none" };
  if (sampleUrl.startsWith("blob:")) return { kind: "copy", from: sampleUrl, cloudPath: path ?? newPath };
  if (path) return { kind: "keep", cloudPath: path };
  return { kind: "copy", from: sampleUrl, cloudPath: newPath };
}

/**
 * How a sampler sample, audio clip or pad-sampler sound is stored when a project is saved.
 * Same rule as drum pads: the project keeps its own copy, so a duplicate keeps playing after the
 * original project is deleted and old expiring links get replaced by a stored copy.
 *  - new audio (blob:) uploads to this project's path;
 *  - this project's own stored copy is kept;
 *  - anything else that still has a playable link (another project's copy, web link) is copied in;
 *  - a stored path with no link to read from is kept as it is (nothing to copy from right now).
 */
export type OwnedMediaPlan =
  | { kind: "none" }
  | { kind: "keep"; cloudPath: string }
  | { kind: "copy"; from: string; cloudPath: string; fallbackPath?: string | undefined };

export function ownedMediaPlan(url: string | undefined, existingPath: string | undefined, newPath: string, projectPrefix: string): OwnedMediaPlan {
  const stored = existingPath && !/^https?:/i.test(existingPath) ? existingPath : undefined;
  const own = stored?.startsWith(projectPrefix) ? stored : undefined;
  if (url?.startsWith("blob:")) return { kind: "copy", from: url, cloudPath: own ?? newPath };
  if (own) return { kind: "keep", cloudPath: own };
  if (url) return { kind: "copy", from: url, cloudPath: newPath, fallbackPath: stored };
  if (stored) return { kind: "keep", cloudPath: stored };
  return { kind: "none" };
}
