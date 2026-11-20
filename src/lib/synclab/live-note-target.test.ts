import { describe, expect, it } from "vitest";
import { liveNoteTarget, type LiveNoteTrack } from "./live-note-target";

type T = LiveNoteTrack & { kind: string };
const playable = (t: T) => t.kind === "instrument";
const acid: T = { id: "acid", kind: "instrument", armed: true };
const poly: T = { id: "poly", kind: "instrument", armed: true };
const drums: T = { id: "drums", kind: "drum", armed: true };

describe("liveNoteTarget", () => {
  it("plays the selected synth even when another synth is armed above it", () => {
    expect(liveNoteTarget([acid, poly], "poly", { playable })?.id).toBe("poly");
    expect(liveNoteTarget([acid, { ...poly, armed: false }], "poly", { playable })?.id).toBe(
      "poly",
    );
  });
  it("falls back to the armed synth when a drum track is selected", () => {
    expect(liveNoteTarget([drums, acid, poly], "drums", { playable })?.id).toBe("acid");
  });
  it("while recording, notes go to the channel that is recording", () => {
    const tracks = [
      { ...acid, recording: true },
      { ...poly, armed: false },
    ];
    expect(liveNoteTarget(tracks, "poly", { playable, recording: true })?.id).toBe("acid");
    const both = [
      { ...acid, recording: true },
      { ...poly, recording: true },
    ];
    expect(liveNoteTarget(both, "poly", { playable, recording: true })?.id).toBe("poly");
  });
  it("a channel set to the incoming MIDI channel owns it; others set elsewhere never hear it", () => {
    const ch2 = { ...acid, midiChannel: 2 };
    expect(liveNoteTarget([ch2, poly], "poly", { playable, channel: 2 })?.id).toBe("acid");
    expect(
      liveNoteTarget([ch2, { ...poly, midiChannel: 3 }], "poly", { playable, channel: 1 }),
    ).toBeUndefined();
  });
  it("only uses any channel when asked", () => {
    const idle = [{ ...acid, armed: false }];
    expect(liveNoteTarget(idle, null, { playable })).toBeUndefined();
    expect(liveNoteTarget(idle, null, { playable, anyFallback: true })?.id).toBe("acid");
  });
});
