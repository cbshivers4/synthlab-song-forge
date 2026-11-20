import { describe, expect, it } from "vitest";
import { joggedStep, jogTicks, mackieAction, PAN_STEP, stopPress } from "./mackie-control";
import { controllerSpeaksMackie, withKnownSurfaces } from "./controller-profiles";

describe("nanoKONTROL Studio in a DAW mode (Mackie Control)", () => {
  it("fader 1 at the top sends full volume for strip 1; fader 8 is strip 8", () => {
    expect(mackieAction(0xe0, 0x7f, 0x7f)).toEqual({ kind: "volume", strip: 0, value: 1 });
    expect(mackieAction(0xe7, 0, 0)).toEqual({ kind: "volume", strip: 7, value: 0 });
  });
  it("knobs turn pan by detents, left and right", () => {
    expect(mackieAction(0xb0, 16, 0x01)).toEqual({ kind: "pan", strip: 0, delta: PAN_STEP });
    expect(mackieAction(0xb0, 23, 0x42)).toEqual({ kind: "pan", strip: 7, delta: -2 * PAN_STEP });
  });
  it("R / S / M / SELECT buttons for all 8 channels act on press only", () => {
    expect(mackieAction(0x90, 0, 127)).toEqual({ kind: "switch", strip: 0, param: "arm" });
    expect(mackieAction(0x90, 15, 127)).toEqual({ kind: "switch", strip: 7, param: "solo" });
    expect(mackieAction(0x90, 16, 127)).toEqual({ kind: "switch", strip: 0, param: "mute" });
    expect(mackieAction(0x90, 31, 127)).toEqual({ kind: "switch", strip: 7, param: "select" });
    expect(mackieAction(0x90, 16, 0)).toEqual({ kind: "ignore" });
  });
  it("PLAY, STOP, REC, CYCLE and bank buttons run the transport", () => {
    expect(mackieAction(0x90, 94, 127)).toEqual({ kind: "button", button: "play" });
    expect(mackieAction(0x90, 93, 127)).toEqual({ kind: "button", button: "stop" });
    expect(mackieAction(0x90, 95, 127)).toEqual({ kind: "button", button: "record" });
    expect(mackieAction(0x90, 86, 127)).toEqual({ kind: "button", button: "loop" });
    expect(mackieAction(0x90, 47, 127)).toEqual({ kind: "button", button: "bank-next" });
    expect(mackieAction(0xb0, 60, 0x01)).toEqual({ kind: "jog", ticks: 1 });
    expect(mackieAction(0xb0, 60, 0x41)).toEqual({ kind: "jog", ticks: -1 });
  });
  it("only Korg nanoKONTROL ports are treated as DAW-mode surfaces", () => {
    expect(controllerSpeaksMackie("nanoKONTROL Studio CTRL")).toBe(true);
    expect(controllerSpeaksMackie("Arturia KeyLab")).toBe(false);
  });
});

describe("plugging a mixer surface in turns it on", () => {
  const korg = { id: "k", name: "nanoKONTROL Studio" };
  const keys = { id: "a", name: "Arturia KeyLab" };
  it("adds the Korg to a keyboard-only choice", () => {
    expect(withKnownSurfaces(JSON.stringify(["a"]), [keys, korg], [])).toBe(
      JSON.stringify(["a", "k"]),
    );
  });
  it("respects a Korg the user switched off, All devices and Disable all", () => {
    expect(withKnownSurfaces(JSON.stringify(["a"]), [keys, korg], ["nanoKONTROL Studio"])).toBe(
      JSON.stringify(["a"]),
    );
    expect(withKnownSurfaces("all", [keys, korg], [])).toBe("all");
    expect(withKnownSurfaces(null, [keys, korg], [])).toBeNull();
  });
});

describe("Korg STOP and jog wheel", () => {
  it("STOP once stops where you are; again (while stopped) goes to the start", () => {
    expect(stopPress({ playing: true, recording: false })).toBe("stop-here");
    expect(stopPress({ playing: false, recording: false })).toBe("to-start");
    expect(stopPress({ playing: true, recording: true })).toBe("end-take");
  });
  it("jog wheel clicks read both relative settings and an absolute wheel", () => {
    expect(jogTicks(1, undefined)).toBe(1);
    expect(jogTicks(127, undefined)).toBe(-1);
    expect(jogTicks(65, undefined)).toBe(-1);
    expect(jogTicks(64, undefined)).toBe(0);
    expect(jogTicks(40, 38)).toBe(2);
    expect(jogTicks(47, 50)).toBe(-3);
  });
  it("each jog click moves the playhead one beat, never before the start or past the song end", () => {
    expect(joggedStep(16, 1, 4, 64)).toBe(20);
    expect(joggedStep(17, -1, 4, 64)).toBe(12);
    expect(joggedStep(4, -5, 4, 64)).toBe(0);
    expect(joggedStep(60, 3, 4, 64)).toBe(63);
  });
});
