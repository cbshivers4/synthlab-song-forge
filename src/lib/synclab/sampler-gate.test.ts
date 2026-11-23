import { describe, expect, it } from "vitest";
import {
  KEY_RELEASE_VERSION,
  liveSampleVoiceKeys,
  loadedVideoChopSounds,
  stopsOnRelease,
} from "./sampler-gate";
import { DEFAULT_PAD_SOUND, type PadSound } from "./mpc-pad";

describe("sampler key release", () => {
  it("new pad and video chop sounds stop when the key is let go", () => {
    expect(DEFAULT_PAD_SOUND.oneShot).toBe(false);
    expect(stopsOnRelease(DEFAULT_PAD_SOUND)).toBe(true);
  });

  it("One-shot sounds keep playing after release, looping sounds always stop", () => {
    expect(stopsOnRelease({ oneShot: true, loop: false })).toBe(false);
    expect(stopsOnRelease({ oneShot: true, loop: true })).toBe(true);
    expect(stopsOnRelease({ oneShot: false, loop: false })).toBe(true);
  });

  it("each played key gets its own voice so releasing one key leaves the others", () => {
    const s = { rootNote: 60, slices: undefined, chopChoke: undefined, multiPitch: undefined };
    expect(liveSampleVoiceKeys(s, 64)).toEqual(["note-64"]);
    expect(liveSampleVoiceKeys(s, 67)).toEqual(["note-67"]);
  });

  it("chop keys release their own chop (or their choke group)", () => {
    const s = { rootNote: 60, slices: [0, 0.25, 0.5, 0.75], chopChoke: undefined, multiPitch: undefined };
    expect(liveSampleVoiceKeys(s, 62)).toEqual(["chop-2"]);
    expect(liveSampleVoiceKeys({ ...s, chopChoke: 3 }, 62)).toEqual(["chop-choke-3"]);
  });

  it("video kits saved before Gate existed keep every chop One-shot", () => {
    const saved: (Partial<PadSound> | null)[] = [{ gain: 0.5 }, null];
    const old = loadedVideoChopSounds(saved, 3, undefined);
    expect(old.map((s) => s?.oneShot)).toEqual([true, true, true]);
    expect(old[0]).toMatchObject({ gain: 0.5 });
  });

  it("an explicit choice in an old kit is kept", () => {
    expect(loadedVideoChopSounds([{ oneShot: false }], 1, undefined)[0]?.oneShot).toBe(false);
  });

  it("new kits load exactly as saved", () => {
    const sounds: (Partial<PadSound> | null)[] = [{ gain: 1 }, null];
    expect(loadedVideoChopSounds(sounds, 2, KEY_RELEASE_VERSION)).toBe(sounds);
  });
});
