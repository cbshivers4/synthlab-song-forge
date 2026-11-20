import { afterEach, describe, expect, it } from "vitest";
import {
  canHold,
  HELD_NOTE_SECONDS,
  holdApplies,
  isHoldOn,
  latchPitch,
  liveNoteSeconds,
  onHoldRelease,
  releaseLatched,
  resetSynthHold,
  setHold,
} from "./synth-hold";
import type { SynthPatch } from "./types";

const patch = {} as SynthPatch;
const synth = { id: "s1", kind: "instrument" as const, patch };

afterEach(() => resetSynthHold());

describe("synth HOLD", () => {
  it("only synth channels can hold", () => {
    expect(canHold(synth)).toBe(true);
    expect(canHold({ kind: "midi", patch })).toBe(true);
    expect(canHold({ kind: "sampler", patch })).toBe(false);
    expect(canHold({ kind: "drum", patch })).toBe(false);
    expect(canHold({ kind: "instrument", patch: undefined })).toBe(false);
  });

  it("held notes sound until released, otherwise the normal length", () => {
    expect(liveNoteSeconds(synth, 0.6)).toBe(0.6);
    setHold("s1", true);
    expect(holdApplies(synth)).toBe(true);
    expect(liveNoteSeconds(synth, 0.6)).toBe(HELD_NOTE_SECONDS);
    expect(liveNoteSeconds({ ...synth, id: "other" }, 0.6)).toBe(0.6);
  });

  it("switching HOLD off lets go of exactly that channel's latched notes", () => {
    const released: [string, number[]][] = [];
    const off = onHoldRelease((id, pitches) => released.push([id, pitches]));
    setHold("s1", true);
    setHold("s2", true);
    latchPitch("s1", 60);
    latchPitch("s1", 64);
    latchPitch("s2", 48);
    setHold("s1", false);
    expect(released).toEqual([["s1", [60, 64]]]);
    expect(isHoldOn("s2")).toBe(true);
    off();
  });

  it("Stop lets go of every latched note but leaves HOLD switched on", () => {
    const released: string[] = [];
    const off = onHoldRelease((id) => released.push(id));
    setHold("s1", true);
    latchPitch("s1", 60);
    releaseLatched();
    expect(released).toEqual(["s1"]);
    expect(isHoldOn("s1")).toBe(true);
    off();
  });
});
