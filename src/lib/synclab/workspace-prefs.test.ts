import { describe, expect, it } from "vitest";
import { clampMixerHeight, workspacePrefs } from "./workspace-prefs";
import { matchShortcut } from "./shortcuts";

describe("docked desktop mixer", () => {
  it("docks under the timeline by default", () => {
    expect(workspacePrefs().mixerDock).toBe(true);
  });
  it("keeps the dragged mixer between one compact strip and most of the screen", () => {
    expect(clampMixerHeight(100, 1000)).toBe(240);
    expect(clampMixerHeight(2000, 1000)).toBe(780);
    expect(clampMixerHeight(450, 1000)).toBe(450);
  });
  it("F3 shows or hides the mixer", () => {
    expect(
      matchShortcut({
        key: "F3",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        repeat: false,
        defaultPrevented: false,
      }),
    ).toBe("toggleMixer");
  });
});
