import { describe, expect, it } from "vitest";
import { clampBeat, formatDuration, isVisitLive, resumesVisit } from "./visits";
import { DEFAULT_NOTIFY_PREFS, wantsAlert } from "./notify-rules";

const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

describe("time in app", () => {
  it("one report can add at most 2 minutes", () => {
    expect(clampBeat(60)).toBe(60);
    expect(clampBeat(86_400)).toBe(120);
    expect(clampBeat(-5)).toBe(0);
  });
  it("a reload within 2 minutes continues the same visit", () => {
    expect(resumesVisit({ ended_at: at(60_000), last_seen_at: at(60_000) })).toBe(true);
    expect(resumesVisit({ ended_at: at(5 * 60_000), last_seen_at: at(5 * 60_000) })).toBe(false);
  });
  it("a visit silent for 5 minutes is no longer live", () => {
    expect(isVisitLive({ ended_at: null, last_seen_at: at(60_000) })).toBe(true);
    expect(isVisitLive({ ended_at: null, last_seen_at: at(6 * 60_000) })).toBe(false);
  });
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 sec");
    expect(formatDuration(12 * 60)).toBe("12 min");
    expect(formatDuration(65 * 60)).toBe("1 h 05 min");
  });
});

describe("founder notification switches", () => {
  it("each kind follows its own switch", () => {
    const off = { ...DEFAULT_NOTIFY_PREFS, timeSpent: false };
    expect(wantsAlert("left", off)).toBe(false);
    expect(wantsAlert("sign_in", off)).toBe(true);
    expect(wantsAlert("message", { ...DEFAULT_NOTIFY_PREFS, messages: false })).toBe(false);
  });
  it("everything except desktop notifications is on by default", () => {
    expect(DEFAULT_NOTIFY_PREFS).toEqual({
      signIns: true,
      appOpens: true,
      timeSpent: true,
      messages: true,
      desktop: false,
    });
  });
});
