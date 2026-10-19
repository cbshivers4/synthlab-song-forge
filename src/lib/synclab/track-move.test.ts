import { describe, expect, it } from "vitest";
import { moveTrackToIndexIn, moveTrackToNewIn } from "./track-move";
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
