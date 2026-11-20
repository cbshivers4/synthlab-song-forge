import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/synclab/audio-engine", () => ({ getEngine: vi.fn() }));
vi.mock("@/lib/synclab/canvas-point", () => ({ sidewaysCanvas: vi.fn() }));
import { sidewaysCanvas } from "@/lib/synclab/canvas-point";
import { waveformFraction } from "./WaveformZoom";

describe("zoomed waveform source coordinates", () => {
  it("keeps desktop cuts source-relative after scrolling an expanded waveform", () => {
    vi.mocked(sidewaysCanvas).mockReturnValue(false);
    const el = {
      getBoundingClientRect: () => ({ left: -2300, top: 20, width: 3200, height: 112 }),
    } as HTMLElement;
    expect(waveformFraction(el, 500, 70)).toBe(0.875);
    expect(waveformFraction(el, -2500, 70)).toBe(0);
    expect(waveformFraction(el, 1000, 70)).toBe(1);
  });
  it("maps rotated phone cuts through the visible scrolled source rectangle", () => {
    vi.mocked(sidewaysCanvas).mockReturnValue(true);
    const el = {
      getBoundingClientRect: () => ({ left: 100, top: -2300, width: 112, height: 3200 }),
    } as HTMLElement;
    expect(waveformFraction(el, 150, 500)).toBe(0.875);
  });
});
