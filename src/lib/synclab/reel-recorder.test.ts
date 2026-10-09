import { afterEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({ left: new Float32Array([0.2, -0.6]), right: new Float32Array([0.1, -0.35]) }));
vi.mock("./audio-engine", () => ({ getEngine: () => ({ getMasterChannel: (channel: number) => channel === 0 ? audio.left : audio.right }) }));
vi.mock("./mic", () => ({ openMic: vi.fn(), releaseMic: vi.fn(), getInputChannel: () => "stereo" }));
import { getReelRecorder } from "./reel-recorder";

afterEach(() => { getReelRecorder().setMasterMetering(false); });
describe("reel timeline meters", () => {
  it("reads both live master taps without enabling recording input", () => {
    const recorder = getReelRecorder();
    recorder.setMasterMetering(true);
    expect(recorder.getSnapshot().ready).toBe(false);
    expect(recorder.getSnapshot().levelL).toBeCloseTo(0.6);
    expect(recorder.getSnapshot().levelR).toBeCloseTo(0.35);
    audio.left.fill(0); audio.right.fill(0);
    recorder.setMasterMetering(true);
    expect(recorder.getSnapshot().levelL).toBe(0);
    expect(recorder.getSnapshot().levelR).toBe(0);
  });
});