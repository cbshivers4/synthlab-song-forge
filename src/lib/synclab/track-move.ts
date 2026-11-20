import type { Track } from "./types";
import { uid } from "./presets";
import { clipSeconds } from "./types";
import { addCut, cutNotesAt, deleteRegion, notesInRegion, unrollNotes } from "./note-cuts";
import { timelineUsesWaveform } from "./timeline-content";

/**
 * Reorder a track by dropping it onto another track's slot (or the end of the
 * list). The moved track takes the target position and the rest shift over.
 */
export function moveTrackToIndexIn(tracks: Track[], id: string, index: number): Track[] {
  const from = tracks.findIndex((t) => t.id === id);
  if (from < 0 || index < 0 || index >= tracks.length || from === index) return tracks;
  const next = [...tracks];
  const [moved] = next.splice(from, 1);
  if (!moved) return tracks;
  next.splice(index, 0, moved);
  return next;
}

/**
 * Move a track's material — recordings, notes, drum patterns, automation — to a
 * brand-new channel at the end of the list, the way Add Track creates one. The
 * original channel keeps its place, name and sound but is emptied of material.
 */
export function moveTrackToNewIn(
  tracks: Track[],
  id: string,
): { tracks: Track[]; movedId: string | null } {
  const i = tracks.findIndex((t) => t.id === id);
  if (i < 0) return { tracks, movedId: null };
  const src = tracks[i];
  if (!src) return { tracks, movedId: null };
  const moved: Track = { ...(structuredClone(src) as Track), id: uid(), name: `${src.name} NEW` };
  if (moved.pads) moved.pads = moved.pads.map((p) => ({ ...p, id: uid() }));
  if (moved.notes) moved.notes = moved.notes.map((n) => ({ ...n, id: uid() }));
  const emptied: Track = {
    ...src,
    clips: [],
    activeClipId: undefined,
    notes: src.notes ? [] : undefined,
    cuts: undefined,
    activeRegion: undefined,
    patternRegion: undefined,
    printedAudio: false,
    recording: false,
    pads: src.pads?.map((p) => ({ ...p, steps: p.steps.map(() => 0) })),
    drumPatterns: src.drumPatterns?.map((pat) =>
      pat.map((p) => ({ ...p, steps: p.steps.map(() => 0) })),
    ),
    bendLane: undefined,
    modLane: undefined,
    automation: undefined,
  };
  const next = [...tracks];
  next[i] = emptied;
  return { tracks: [...next, moved], movedId: moved.id };
}

/** Move only the dragged recording, clearing its original note/hit region. */
export function moveClipToNewIn(
  tracks: Track[],
  trackId: string,
  clipId: string,
  sourceStart: number,
  stepDuration: number,
): { tracks: Track[]; movedId: string | null } {
  const src = tracks.find((track) => track.id === trackId);
  const clip = src?.clips?.find((item) => item.id === clipId);
  if (!src || !clip || stepDuration <= 0) return { tracks, movedId: null };
  const end = sourceStart + clipSeconds(clip) / stepDuration;
  const leftClips = (src.clips ?? []).filter((item) => item.id !== clipId);
  const emptied: Track = {
    ...src,
    clips: leftClips,
    activeClipId: undefined,
    notes: src.notes ? deleteRegion(src.notes, [sourceStart, end]) : undefined,
    pads: src.pads?.map((pad) => ({
      ...pad,
      steps: pad.steps.map((value, i) => {
        const length = Math.max(1, pad.steps.length);
        const first = i + Math.max(0, Math.ceil((sourceStart - i) / length)) * length;
        return first < end ? 0 : value;
      }),
    })),
    printedAudio: leftClips.length > 0 && Boolean(src.printedAudio),
  };
  const moved: Track = {
    ...src,
    id: uid(),
    name: clip.name,
    kind: "audio",
    folderId: undefined,
    clips: [clip],
    activeClipId: clip.id,
    notes: [],
    pads: undefined,
    drumPatterns: undefined,
    cuts: undefined,
    activeRegion: undefined,
    patternRegion: undefined,
    printedAudio: false,
    recording: false,
    armed: false,
    patch: undefined,
    sampler: undefined,
    bendLane: undefined,
    modLane: undefined,
    automation: undefined,
    plugins: src.plugins?.map((plugin) => ({ ...structuredClone(plugin), id: uid() })),
  };
  return {
    tracks: [...tracks.map((track) => (track.id === trackId ? emptied : track)), moved],
    movedId: moved.id,
  };
}

// ---------------------------------------------------------------------------
// Moving one note block or beat part onto another channel (drag it up/down, or
// "Move to track above/below" in its menu). Repeats are written out first so
// only the block you picked leaves; the destination keeps everything it had.
// ---------------------------------------------------------------------------

const NOTE_KINDS: Track["kind"][] = ["instrument", "midi", "sampler"];

/** Which part family a lane is showing: note blocks, beat parts, or audio/other (not movable here). */
export function partFamily(
  track: Pick<Track, "kind" | "clips" | "printedAudio" | "clipView">,
): "notes" | "drums" | null {
  if (timelineUsesWaveform(track)) return null;
  if (track.kind === "drum") return "drums";
  return NOTE_KINDS.includes(track.kind) ? "notes" : null;
}

/** Nearest channel above (-1) or below (+1) that can take this part, skipping channels of another kind. */
export function neighbourPartTarget(tracks: Track[], id: string, dir: -1 | 1): Track | null {
  const i = tracks.findIndex((t) => t.id === id);
  const src = tracks[i];
  const family = src ? partFamily(src) : null;
  if (!src || !family) return null;
  for (let j = i + dir; j >= 0 && j < tracks.length; j += dir) {
    const t = tracks[j];
    if (t && !t.hidden && partFamily(t) === family) return t;
  }
  return null;
}

const EPS_STEP = 0.001;
const repeatTo = <T>(values: T[] | undefined, total: number, fill: T): T[] | undefined => {
  if (!values) return undefined;
  const len = Math.max(1, values.length);
  return Array.from({ length: total }, (_, i) => values[i % len] ?? fill);
};

/**
 * Move the part [a, b) from `srcId` onto `destId`, landing at `to`. Returns null when nothing
 * moves (different kinds, empty part, same channel). `unmatched` counts drum hits whose pad has
 * no counterpart on the destination kit (matched by drum kind, then by pad position).
 */
export function movePartBetweenTracks(
  tracks: Track[],
  srcId: string,
  destId: string,
  a: number,
  b: number,
  to: number,
  total: number,
): { tracks: Track[]; unmatched: number } | null {
  const src = tracks.find((t) => t.id === srcId);
  const dest = tracks.find((t) => t.id === destId);
  if (!src || !dest || src.id === dest.id || b - a < EPS_STEP) return null;
  const family = partFamily(src);
  if (!family || partFamily(dest) !== family) return null;
  const len = b - a;
  const start = Math.max(0, Math.min(total - len, to));
  const delta = start - a;
  const whole = a <= EPS_STEP && b >= total - EPS_STEP;
  const destCuts =
    whole && !dest.cuts?.length
      ? dest.cuts
      : addCut(addCut(dest.cuts, start, total), start + len, total);

  if (family === "notes") {
    const expanded = unrollNotes(src.notes ?? [], src.steps || total, total);
    const split = cutNotesAt(cutNotesAt(expanded, a).notes, b).notes;
    const part = notesInRegion(split, [a, b]);
    if (!part.length) return null;
    const moved = part.map((n) => ({
      ...n,
      id: uid(),
      step: n.step + delta,
      ...(n.recordedEnd != null ? { recordedEnd: n.recordedEnd + delta } : {}),
    }));
    const destNotes = [...unrollNotes(dest.notes ?? [], dest.steps || total, total), ...moved];
    return {
      unmatched: 0,
      tracks: tracks.map((t) =>
        t.id === src.id
          ? { ...t, notes: deleteRegion(split, [a, b]), steps: total, activeRegion: undefined }
          : t.id === dest.id
            ? {
                ...t,
                notes: destNotes,
                steps: total,
                cuts: destCuts,
                activeRegion: start,
                activeClipId: undefined,
              }
            : t,
      ),
    };
  }

  // Beat parts: per-step arrays are written out to song length on both channels first.
  const lo = Math.floor(a),
    hi = Math.ceil(b),
    shift = Math.round(delta);
  const unroll = (pad: NonNullable<Track["pads"]>[number]) => ({
    ...pad,
    steps: repeatTo(pad.steps, total, 0)!,
    probability: repeatTo(pad.probability, total, 1),
    stepPitch: repeatTo(pad.stepPitch, total, 0),
    stepDecay: repeatTo(pad.stepDecay, total, 1),
    flam: repeatTo(pad.flam, total, 0),
    retrig: repeatTo(pad.retrig, total, 1),
    glitch: repeatTo(pad.glitch, total, 0),
  });
  const srcPads = (src.pads ?? []).map(unroll);
  const destPads = (dest.pads ?? []).map(unroll);
  let any = false,
    unmatched = 0;
  const used = new Set<number>();
  srcPads.forEach((pad, index) => {
    const hits: number[] = [];
    for (let i = lo; i < hi && i < total; i++) if ((pad.steps[i] ?? 0) > 0) hits.push(i);
    if (!hits.length) return;
    any = true;
    let j = destPads.findIndex((p, k) => !used.has(k) && p.kind === pad.kind);
    if (j < 0) j = destPads.findIndex((p) => p.kind === pad.kind);
    if (j < 0 && index < destPads.length) j = index;
    const target = j >= 0 ? destPads[j] : undefined;
    if (!target) {
      unmatched += hits.length;
      return;
    }
    used.add(j);
    for (const i of hits) {
      const at = i + shift;
      if (at < 0 || at >= total) continue;
      target.steps[at] = pad.steps[i] ?? 1;
      for (const key of [
        "probability",
        "stepPitch",
        "stepDecay",
        "flam",
        "retrig",
        "glitch",
      ] as const) {
        const from = pad[key],
          into = target[key];
        if (from && into) into[at] = from[i] ?? into[at]!;
      }
    }
  });
  if (!any) return null;
  const clearedSrc = srcPads.map((pad) => ({
    ...pad,
    steps: pad.steps.map((v, i) => (i >= lo && i < hi ? 0 : v)),
  }));
  return {
    unmatched,
    tracks: tracks.map((t) =>
      t.id === src.id
        ? { ...t, pads: clearedSrc, steps: total, activeRegion: undefined }
        : t.id === dest.id
          ? {
              ...t,
              pads: destPads,
              steps: total,
              cuts: destCuts,
              activeRegion: start,
              activeClipId: undefined,
            }
          : t,
    ),
  };
}
