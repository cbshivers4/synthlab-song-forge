import { describe, expect, it } from "vitest";
import {
  controllerAutoButton,
  controllerAutoMap,
  shiftStripBank,
  stripTrackIndex,
} from "./controller-profiles";

const PORT = "nanoKONTROL Studio CTRL";

describe("Korg nanoKONTROL Studio is set up automatically", () => {
  it("PLAY, STOP and REC run the transport", () => {
    expect(controllerAutoButton(PORT, 80)).toBe("play");
    expect(controllerAutoButton(PORT, 63)).toBe("stop");
    expect(controllerAutoButton(PORT, 81)).toBe("record");
  });

  it("all 8 channels get volume, pan, mute, solo and record-arm", () => {
    const faders = [2, 3, 4, 5, 6, 8, 9, 12];
    faders.forEach((cc, strip) =>
      expect(controllerAutoMap(PORT, cc)).toEqual({ strip, param: "volume" }),
    );
    for (let strip = 0; strip < 8; strip++) {
      expect(controllerAutoMap(PORT, 13 + strip)).toEqual({ strip, param: "pan" });
      expect(controllerAutoMap(PORT, 21 + strip)).toEqual({ strip, param: "mute" });
      expect(controllerAutoMap(PORT, 38 + strip)).toEqual({ strip, param: "arm" });
    }
    [29, 30, 31, 33, 34, 35, 36, 37].forEach((cc, strip) =>
      expect(controllerAutoMap(PORT, cc)).toEqual({ strip, param: "solo" }),
    );
  });

  it("TRACK ◀ / ▶ move the strips to tracks 9–16 and back, never past the last track", () => {
    expect(shiftStripBank(1, 12)).toBe(1);
    expect(stripTrackIndex(0)).toBe(8);
    expect(shiftStripBank(1, 12)).toBe(1);
    expect(shiftStripBank(-1, 12)).toBe(0);
    expect(stripTrackIndex(0)).toBe(0);
  });
});
