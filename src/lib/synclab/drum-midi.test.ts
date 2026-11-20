import { describe, expect, it } from "vitest";
import { learnedDrumPad } from "./drum-midi";
import { appendDrumPad } from "./drum-banks";
import type { Track } from "./types";

const track = {
  id: "drums",
  kind: "drum",
  pads: appendDrumPad({ steps: 16 }, "conga", { kind: "tom", voice: "conga_hi" }),
} as Track;
describe("learned drum triggers", () => {
  it("targets the saved pad identity and its actual sound", () => {
    expect(learnedDrumPad([track], { id: "drums", param: "drum-trigger:conga" })?.pad.voice).toBe(
      "conga_hi",
    );
  });
  it("does not trigger another pad in an empty or different bank", () => {
    expect(
      learnedDrumPad([{ ...track, pads: [] }], { id: "drums", param: "drum-trigger:conga" }),
    ).toBeNull();
  });
  it("does not treat envelope learning as a pad trigger", () => {
    expect(learnedDrumPad([track], { id: "drums", param: "drum:conga:attack" })).toBeNull();
  });
});
