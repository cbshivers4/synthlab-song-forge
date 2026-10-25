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
