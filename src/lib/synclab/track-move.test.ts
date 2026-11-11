import { describe, expect, it } from "vitest";
import { moveClipToNewIn, moveTrackToIndexIn, moveTrackToNewIn } from "./track-move";
import type { Track } from "./types";

const track = (id: string, extra: Partial<Track> = {}): Track => ({
  id,
  name: id.toUpperCase(),
  kind: "instrument",
  color: "#3B82F6",
  volume: 1,
  pan: 0,
  muted: false,
  solo: false,
  armed: false,
  frozen: false,
  hidden: false,
  input: "none",
  bus: "instruments",
  steps: 16,
  ...extra,
});

describe("moveTrackToIndexIn", () => {
  it("moves a track to the dropped position and shifts the others", () => {
    const tracks = [track("a"), track("b"), track("c")];
    expect(moveTrackToIndexIn(tracks, "a", 2).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("ignores out-of-range targets and keeps the order", () => {
    const tracks = [track("a"), track("b")];
    expect(moveTrackToIndexIn(tracks, "a", 5).map((t) => t.id)).toEqual(["a", "b"]);
    expect(moveTrackToIndexIn(tracks, "a", -1).map((t) => t.id)).toEqual(["a", "b"]);
    expect(moveTrackToIndexIn(tracks, "zzz", 1).map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("moveTrackToNewIn", () => {
  it("sends the material to a new channel at the end and empties the old one", () => {
    const src = track("kick", {
      name: "KICK",
      clips: [{ id: "c1", name: "take", peaks: [1], duration: 2, url: "blob:x" }],
      notes: [{ id: "n1", step: 0, length: 1, pitch: 60, velocity: 1 }],
      printedAudio: true,
      pads: [{ id: "p1", name: "KICK", kind: "kick", volume: 1, pan: 0, pitch: 0, decay: 1, muted: false, solo: false, steps: [1, 0] }],
      patch: { name: "Acid", oscillators: [], noise: 0, filterType: "lowpass", cutoff: 1000, resonance: 0, drive: 0, amp: { attack: 0, decay: 1, sustain: 1, release: 0 }, filterEnv: { attack: 0, decay: 1, sustain: 1, release: 0, amount: 1 }, lfos: [], unison: { voices: 1, detune: 0, width: 0 }, glide: 0, fx: { distortion: 0, chorus: 0, delay: 0, delayFeedback: 0, reverb: 0, bitcrush: 0 }, arp: { on: false, rate: 1, direction: "up", octaves: 1, gate: 1 } },
    });
    const { tracks, movedId } = moveTrackToNewIn([src, track("other")], "kick");
    expect(movedId).toBeTruthy();
    expect(tracks.map((t) => t.id)).toEqual(["kick", "other", movedId!]);
    const moved = tracks[2]!;
    const emptied = tracks[0]!;
    // Material travels with the new channel.
    expect(moved.clips?.[0]?.id).toBe("c1");
    expect(moved.notes?.[0]?.step).toBe(0);
    expect(moved.printedAudio).toBe(true);
    expect(moved.name).toBe("KICK NEW");
    // Pad and note ids are regenerated so editors never alias the old ones.
    expect(moved.pads?.[0]?.id).not.toBe("p1");
    expect(moved.notes?.[0]?.id).not.toBe("n1");
    // The old channel keeps its place, kind, name and sound but loses material.
    expect(emptied.name).toBe("KICK");
    expect(emptied.kind).toBe("instrument");
    expect(emptied.patch?.name).toBe("Acid");
    expect(emptied.clips).toEqual([]);
    expect(emptied.notes).toEqual([]);
    expect(emptied.printedAudio).toBe(false);
    expect(emptied.pads?.[0]?.steps).toEqual([0, 0]);
  });

  it("leaves the list unchanged when the track is missing", () => {
    const tracks = [track("a")];
    const result = moveTrackToNewIn(tracks, "zzz");
    expect(result.tracks).toBe(tracks);
    expect(result.movedId).toBeNull();
  });
});

describe('moveClipToNewIn', () => {
  it('moves only the dragged recording to a new channel and retains other takes', () => {
    const clip = { id: 'take', name: 'Synth take', peaks: [0.5], duration: 2, start: 32, url: 'blob:take' };
    const other = { ...clip, id: 'other', start: 64 };
    const src = track('synth', { clips: [clip, other], folderId: 'collapsed', printedAudio: true,
      notes: [{ id: 'under', pitch: 60, step: 0, length: 2, velocity: 1 }, { id: 'later', pitch: 64, step: 64, length: 2, velocity: 1 }] });
    const result = moveClipToNewIn([src, track('bass')], 'synth', 'take', 0, 0.125);
    expect(result.tracks).toHaveLength(3);
    expect(result.tracks[2]?.clips).toEqual([clip]);
    expect(result.tracks[2]?.kind).toBe('audio');
    expect(result.tracks[2]?.folderId).toBeUndefined();
    expect(result.tracks[0]?.clips).toEqual([other]);
    expect(result.tracks[0]?.notes?.map(note => note.id)).toEqual(['later']);
    expect(result.tracks[1]?.id).toBe('bass');
  });
  it('leaves no notes or repeated drum hits beneath a moved recording', () => {
    const src = track('drums', { kind: 'drum', printedAudio: true,
      clips: [{ id: 'take', name: 'Beat', peaks: [1], duration: 4, url: 'blob:beat' }],
      notes: [{ id: 'n', pitch: 36, step: 0, length: 1, velocity: 1 }],
      pads: [{ id: 'p', name: 'Kick', kind: 'kick', volume: 1, pan: 0, pitch: 0, decay: 1, muted: false, solo: false, steps: [1, 0, 1, 0] }] });
    const result = moveClipToNewIn([src], 'drums', 'take', 0, 0.125);
    expect(result.tracks[0]?.clips).toEqual([]);
    expect(result.tracks[0]?.notes).toEqual([]);
    expect(result.tracks[0]?.pads?.[0]?.steps).toEqual([0, 0, 0, 0]);
    expect(result.tracks[0]?.printedAudio).toBe(false);
    expect(result.tracks[1]?.clips?.[0]?.duration).toBe(4);
  });
  it('does not create a channel when the recording is missing', () => {
    const tracks = [track('a')];
    expect(moveClipToNewIn(tracks, 'a', 'missing', 0, 0.125)).toEqual({ tracks, movedId: null });
  });
});

describe("moving one block to another track", () => {
  const note = (id: string, step: number) => ({ id, step, length: 1, pitch: 60, velocity: 0.9 });
  it("moves only the chosen note block to the track below and keeps the others", async () => {
    const { movePartBetweenTracks } = await import("./track-move");
    const tracks = [
      track("a", { steps: 64, notes: [note("x", 0), note("y", 20)], cuts: [16] }),
      track("b", { steps: 64, notes: [note("z", 40)] }),
    ];
    const r = movePartBetweenTracks(tracks, "a", "b", 16, 64, 16, 64)!;
    expect(r.tracks[0]!.notes!.map((n) => n.step)).toEqual([0]);
    expect(r.tracks[1]!.notes!.map((n) => n.step).sort((p, q) => p - q)).toEqual([20, 40]);
    expect(r.tracks[1]!.activeRegion).toBe(16);
  });
  it("lands the block at the new bar when dragged sideways as well", async () => {
    const { movePartBetweenTracks } = await import("./track-move");
    const tracks = [track("a", { steps: 64, notes: [note("x", 0)], cuts: [16] }), track("b", { steps: 64, notes: [] })];
    const r = movePartBetweenTracks(tracks, "a", "b", 0, 16, 32, 64)!;
    expect(r.tracks[1]!.notes!.map((n) => n.step)).toEqual([32]);
    expect(r.tracks[0]!.notes).toEqual([]);
  });
  it("moves a beat part onto the matching drums of another drum track", async () => {
    const { movePartBetweenTracks } = await import("./track-move");
    const pad = (id: string, kind: "kick" | "snare", steps: number[]) => ({ id, name: kind, kind, volume: 1, pan: 0, pitch: 0, decay: 1, muted: false, solo: false, steps });
    const tracks = [
      track("d1", { kind: "drum", steps: 16, pads: [pad("k1", "kick", [1, 0, 0, 0]), pad("s1", "snare", [0, 0, 1, 0])], cuts: [16] }),
      track("d2", { kind: "drum", steps: 16, pads: [pad("s2", "snare", [0, 0, 0, 0]), pad("k2", "kick", [0, 0, 0, 0])] }),
    ];
    const r = movePartBetweenTracks(tracks, "d1", "d2", 16, 32, 16, 64)!;
    const [src, dest] = r.tracks;
    expect(src!.pads![0]!.steps[16]).toBe(0);
    expect(src!.pads![0]!.steps[0]).toBe(1);
    expect(dest!.pads!.find((p) => p.kind === "kick")!.steps[16]).toBe(1);
    expect(dest!.pads!.find((p) => p.kind === "snare")!.steps[18]).toBe(1);
    expect(r.unmatched).toBe(0);
  });
  it("never moves a note block onto a drum track", async () => {
    const { movePartBetweenTracks, neighbourPartTarget } = await import("./track-move");
    const tracks = [track("a", { notes: [note("x", 0)] }), track("d", { kind: "drum", pads: [] }), track("c", { notes: [] })];
    expect(movePartBetweenTracks(tracks, "a", "d", 0, 16, 0, 64)).toBeNull();
    expect(neighbourPartTarget(tracks, "a", 1)?.id).toBe("c");
    expect(neighbourPartTarget(tracks, "a", -1)).toBeNull();
  });
});
