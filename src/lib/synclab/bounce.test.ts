import { describe, expect, it, vi } from "vitest";
vi.mock("./media-library", () => ({ retainMediaInBackground: vi.fn() }));
import { encodeWav } from "./bounce";

describe("timeline WAV channel format", () => {
  const cap = { left: new Float32Array([1, 0.5]), right: new Float32Array([-1, 0.5]), sampleRate: 44100 };
  it("makes a one-channel mono file by averaging both channels without mutating them", async () => {
    const view = new DataView(await encodeWav(cap, 1).arrayBuffer());
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(28, true)).toBe(88200);
    expect(view.getUint32(40, true)).toBe(4);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(16383);
    expect([...cap.left]).toEqual([1, 0.5]);
    expect([...cap.right]).toEqual([-1, 0.5]);
  });
  it("makes a two-channel stereo file preserving left and right", async () => {
    const view = new DataView(await encodeWav(cap, 2).arrayBuffer());
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(28, true)).toBe(176400);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
  it("keeps existing WAV exports stereo by default", async () => {
    const view = new DataView(await encodeWav(cap).arrayBuffer());
    expect(view.getUint16(22, true)).toBe(2);
  });
});