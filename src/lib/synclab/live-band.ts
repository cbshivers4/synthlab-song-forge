/**
 * Live Drummer and Live Keys preview as one band: Preview on either player starts the other
 * (when its channel exists) on the same step grid, and Stop on either stops both previews.
 * Players register themselves here, so neither player module imports the other.
 */
export type BandPart = "drums" | "keys";
/** The next step a free-running preview will play and when (audio-clock seconds). */
export interface BandGrid {
  step: number;
  time: number;
}
export interface BandMember {
  /** Set up on a channel (a Live Drummer / Live Keys track exists). */
  hasPart(): boolean;
  /** Playing on its own clock (not following or waiting for the song). */
  previewGrid(): BandGrid | null;
  running(): boolean;
  /** Start previewing on its own (joins the other part's grid when that one is previewing). */
  startPreview(): void;
  stop(): void;
}

const members = new Map<BandPart, BandMember>();

export function registerBandMember(part: BandPart, member: BandMember) {
  members.set(part, member);
}

/** The grid another part is previewing on, so a joining part lands on the same steps and bars. */
export function bandGrid(except: BandPart): BandGrid | null {
  for (const [part, member] of members) {
    if (part === except) continue;
    const grid = member.previewGrid();
    if (grid) return grid;
  }
  return null;
}

/** Bring every other part into the preview (stopping any that were following the song). */
export function joinBandPreview(from: BandPart) {
  for (const [part, member] of members) {
    if (part === from || !member.hasPart()) continue;
    if (member.previewGrid()) continue;
    if (member.running()) member.stop();
    member.startPreview();
  }
}

/** Stop every part's preview; parts playing with the song are left alone. */
export function stopBandPreview(from: BandPart) {
  for (const [part, member] of members) {
    if (part === from) continue;
    if (member.previewGrid()) member.stop();
  }
}
