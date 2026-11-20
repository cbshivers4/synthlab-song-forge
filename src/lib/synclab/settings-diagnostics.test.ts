import { describe, expect, it, vi } from "vitest";
import {
  accessFailure,
  capturePreferences,
  comparePreferences,
  probeMicrophone,
} from "./settings-diagnostics";

describe("settings diagnostics", () => {
  it("verifies saved settings after reload", () => {
    const values = { "synclab.prefs": '{"midiThru":false,"clickLevel":0.4}' };
    expect(comparePreferences(values, { ...values }).status).toBe("passed");
  });
  it("fails when a saved preference disappears", () => {
    expect(comparePreferences({ "synclab.prefs": "saved" }, { "synclab.prefs": null }).status).toBe(
      "blocked",
    );
  });
  it("does not claim defaults are persisted settings", () => {
    expect(comparePreferences({ "synclab.prefs": null }, { "synclab.prefs": null }).status).toBe(
      "attention",
    );
  });
  it("only snapshots preferences, never projects or credentials", () => {
    const getItem = vi.fn((_key: string) => null);
    capturePreferences({ getItem });
    expect(getItem.mock.calls.map((call) => call[0])).toEqual([
      "synclab.prefs",
      "synclab.input.device",
      "synclab.input.channel",
      "synclab.input.gainDb",
      "synclab.output.device",
      "synclab.qwerty",
      "synclab.qwerty.octave",
      "synclab.mobile-accessibility.v1",
    ]);
  });
  it("releases test capture after successful microphone access", async () => {
    const stop = vi.fn();
    const track = { readyState: "live", label: "Test microphone", stop };
    const stream = {
      getAudioTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream;
    expect((await probeMicrophone(async () => stream)).status).toBe("passed");
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("distinguishes denied permission from missing hardware", () => {
    expect(accessFailure({ name: "NotAllowedError" }).status).toBe("blocked");
    expect(accessFailure({ name: "NotFoundError" }).status).toBe("attention");
  });
});
