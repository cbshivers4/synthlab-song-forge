import { describe, expect, it, vi } from "vitest";

const clock = vi.hoisted(() => ({ now: 10 }));
vi.mock("./audio-engine", () => {
  const engine = {
    ctx: {
      get currentTime() {
        return clock.now;
      },
    },
    init: () => engine.ctx,
    playDrum: vi.fn(),
    playNote: vi.fn(),
    silenceChannels: vi.fn(),
  };
  return { getEngine: () => engine };
});
vi.mock("./song-clock", () => ({ activeSongClock: () => null }));

import { getDrummer } from "./drummer-player";
import { getKeysPlayer } from "./keyboardist-player";
import { joinBandPreview, stopBandPreview } from "./live-band";
import { defaultDrummer } from "./drummer";
import { defaultKeys, keysPatch } from "./keyboardist";
import type { Track } from "./types";

const drumTrack = { id: "drums", drummer: defaultDrummer() } as unknown as Track;
const keysTrack = {
  id: "keys",
  keyboardist: defaultKeys(),
  patch: keysPatch(defaultKeys().sound),
} as unknown as Track;

describe("Live Drummer + Live Keys preview together", () => {
  it("Preview on the drummer starts the keys on the same step grid, and Stop stops both", () => {
    vi.useFakeTimers();
    const drums = getDrummer();
    const keys = getKeysPlayer();
    drums.sync(drumTrack, 120, 0, 16);
    keys.sync(keysTrack, 120, 0, 16);

    drums.start("alone");
    clock.now = 11.3; // drummer has been playing for a moment
    vi.advanceTimersByTime(1300);
    joinBandPreview("drums");

    expect(keys.isRunning).toBe(true);
    const d = drums.previewGrid();
    const k = keys.previewGrid();
    expect(d && k).toBeTruthy();
    // same next step number at the same audio time: bars and beats line up
    expect(k!.step).toBe(d!.step);
    expect(k!.time).toBeCloseTo(d!.time, 9);
    expect(d!.step).toBeGreaterThan(0);

    stopBandPreview("drums");
    drums.stop();
    expect(keys.isRunning).toBe(false);
    expect(drums.isRunning).toBe(false);
    vi.useRealTimers();
  });

  it("doesn't start the keys when the song has no Live Keys channel", () => {
    vi.useFakeTimers();
    const drums = getDrummer();
    const keys = getKeysPlayer();
    keys.sync(null, 120, 0, 16);
    drums.start("alone");
    joinBandPreview("drums");
    expect(keys.isRunning).toBe(false);
    drums.stop();
    vi.useRealTimers();
  });
});
