import { describe, expect, it } from "vitest";
import { GHOST_TAP_WINDOW_MS, shouldBlockMenuClick } from "./ghost-tap";

const base = { downInside: false, detail: 1, pointerType: "touch", now: 1000, blockUntil: 0 };

describe("menu ghost-tap guard", () => {
  it("blocks the click from the finger that opened the menu", () => {
    expect(shouldBlockMenuClick(base)).toBe(true);
  });
  it("blocks Safari-style clicks that report no pointer type", () => {
    expect(shouldBlockMenuClick({ ...base, pointerType: "" })).toBe(true);
  });
  it("allows a real tap that pressed inside the menu", () => {
    expect(shouldBlockMenuClick({ ...base, downInside: true })).toBe(false);
  });
  it("allows desktop mouse press-drag-release", () => {
    expect(shouldBlockMenuClick({ ...base, pointerType: "mouse" })).toBe(false);
  });
  it("allows keyboard choices", () => {
    expect(shouldBlockMenuClick({ ...base, detail: 0, pointerType: "" })).toBe(false);
  });
  it("blocks the script click fired by a stray finger lift, only within the window", () => {
    const blockUntil = 1000 + GHOST_TAP_WINDOW_MS;
    expect(shouldBlockMenuClick({ ...base, detail: 0, blockUntil })).toBe(true);
    expect(shouldBlockMenuClick({ ...base, detail: 0, blockUntil, now: blockUntil + 1 })).toBe(false);
  });
});
