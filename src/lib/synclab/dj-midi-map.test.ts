import { describe, expect, it } from "vitest";
import { djEvent, djProfileFor, learnBinding, learnable, relativeDelta, resolveDjAction, tempoPitch } from "./dj-midi-map";

describe("DJ controller layout", () => {
  const ddj = djProfileFor("DDJ-FLX4 MIDI 1")!;
  it("recognises Pioneer DDJ-FLX4 and DDJ-400 by port name", () => {
    expect(djProfileFor("DDJ-400")?.id).toBe("pioneer-ddj-400");
    expect(ddj.id).toBe("pioneer-ddj-400");
    expect(djProfileFor("Korg nanoKEY2")).toBeNull();
  });
  it("maps the left PLAY button (note 11, channel 1) to Deck A and the right one to Deck B", () => {
    expect(resolveDjAction(djEvent(0x90, 0x0b, 127)!.key, {}, ddj)).toBe("A:play");
    expect(resolveDjAction(djEvent(0x91, 0x0b, 127)!.key, {}, ddj)).toBe("B:play");
  });
  it("maps the crossfader, channel faders and the filter knobs", () => {
    expect(resolveDjAction("c:6:31", {}, ddj)).toBe("mix:crossfader");
    expect(resolveDjAction("c:0:19", {}, ddj)).toBe("A:fader");
    expect(resolveDjAction("c:1:19", {}, ddj)).toBe("B:fader");
    expect(resolveDjAction("c:6:23", {}, ddj)).toBe("A:filter");
    expect(resolveDjAction("c:6:24", {}, ddj)).toBe("B:filter");
  });
  it("maps pads 1-4 to hot cues on each deck", () => {
    expect(resolveDjAction("n:7:0", {}, ddj)).toBe("A:hotcue1");
    expect(resolveDjAction("n:9:3", {}, ddj)).toBe("B:hotcue4");
  });
  it("a learned control takes over from the built-in layout", () => {
    expect(resolveDjAction("n:0:11", { "n:0:11": "A:sync" }, ddj)).toBe("A:sync");
  });
});

describe("DJ controller messages", () => {
  it("note on is a press, note on with velocity 0 or note off is a release", () => {
    expect(djEvent(0x90, 11, 127)).toEqual({ key: "n:0:11", type: "press" });
    expect(djEvent(0x90, 11, 0)).toEqual({ key: "n:0:11", type: "release" });
    expect(djEvent(0x81, 11, 0)).toEqual({ key: "n:1:11", type: "release" });
  });
  it("jog wheels centre on 64; browse knobs are signed", () => {
    expect(relativeDelta(66, "centre")).toBe(2);
    expect(relativeDelta(61, "centre")).toBe(-3);
    expect(relativeDelta(1, "signed")).toBe(1);
    expect(relativeDelta(127, "signed")).toBe(-1);
  });
  it("tempo slider covers the full pitch range, slower at the top", () => {
    expect(tempoPitch(0, null, 0.08, false)).toBe(-0.08);
    expect(tempoPitch(127, null, 0.08, false)).toBe(0.08);
    expect(tempoPitch(64, 0, 0.08, false)).toBeCloseTo(0, 3);
    expect(tempoPitch(0, null, 0.08, true)).toBe(0.08);
  });
});

describe("DJ learn", () => {
  it("one hardware control per action and one action per control", () => {
    let m = learnBinding({}, "c:0:7", "A:fader");
    m = learnBinding(m, "c:0:8", "A:fader");
    expect(m).toEqual({ "c:0:8": "A:fader" });
    m = learnBinding(m, "c:0:8", "B:fader");
    expect(m).toEqual({ "c:0:8": "B:fader" });
  });
  it("a knob only learns from a knob; a button learns from a press", () => {
    expect(learnable("knob", { key: "n:0:1", type: "press" })).toBe(false);
    expect(learnable("knob", { key: "c:0:1", type: "value", raw: 30 })).toBe(true);
    expect(learnable("button", { key: "n:0:1", type: "release" })).toBe(false);
    expect(learnable("button", { key: "n:0:1", type: "press" })).toBe(true);
  });
});
