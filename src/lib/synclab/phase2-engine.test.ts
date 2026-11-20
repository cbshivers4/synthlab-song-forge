import { describe, expect, it } from "vitest";
import { activeSongClock, nextSongBarTime } from "./song-clock";
import { ClockTempo, PULSES_PER_STEP, pulseTimes, songPositionBytes } from "./midi-clock";
import { INPUT_REEL_SECONDS, reelAngles, recordingReelSeconds } from "./reel-audio";

describe("Live Looper song-bar sync", () => {
  const clock = { step: 5, time: 10, dur: 0.125 }; // 120 BPM, 16 steps per bar
  it("the first loop starts on the next song bar line", () => {
    // step 5 at t=10 → bar line at step 16 → 11 steps later = 11.375 s
    expect(nextSongBarTime(clock, 10, 16)).toBeCloseTo(11.375);
    // exactly on a bar line stays there
    expect(nextSongBarTime(clock, 11.375, 16)).toBeCloseTo(11.375);
  });
  it("only counts as playing while the scheduler keeps the clock fresh", () => {
    expect(activeSongClock(10.1)).toBeNull(); // never set yet
  });
});

describe("MIDI clock", () => {
  it("sends 24 pulses per beat — 6 per 16th step, evenly spaced", () => {
    expect(PULSES_PER_STEP).toBe(6);
    const t = pulseTimes(2, 0.125);
    expect(t).toHaveLength(6);
    expect(t[1]! - t[0]!).toBeCloseTo(0.125 / 6);
  });
  it("song position pointer counts 16th notes in two 7-bit bytes", () => {
    expect(songPositionBytes(0)).toEqual([0xf2, 0, 0]);
    expect(songPositionBytes(200)).toEqual([0xf2, 200 & 0x7f, 200 >> 7]);
  });
  it("reads the tempo from steady incoming pulses", () => {
    const tempo = new ClockTempo();
    let bpm: number | null = null;
    const gap = 60000 / (128 * 24);
    for (let i = 0; i <= 30; i++) bpm = tempo.pulse(i * gap) ?? bpm;
    expect(bpm).toBeCloseTo(128, 1);
  });
  it("a stall restarts the tempo measurement instead of reporting a wrong tempo", () => {
    const tempo = new ClockTempo();
    for (let i = 0; i <= 30; i++) tempo.pulse(i * 20);
    expect(tempo.pulse(30 * 20 + 1000)).toBeNull();
  });
});

describe("reel-to-reel reels", () => {
  it("song-master takes size the reel to the song; mic takes use a 30-minute reel", () => {
    expect(recordingReelSeconds("song", 240, 10)).toBe(240);
    expect(recordingReelSeconds("input", 240, 10)).toBe(INPUT_REEL_SECONDS);
    expect(recordingReelSeconds("song", 240, 300)).toBe(301);
  });
  it("reels stand still when the tape does and the empty reel turns faster", () => {
    expect(reelAngles(0.3, 120)).toEqual(reelAngles(0.3, 120));
    // a small step of tape: the take-up reel (small radius at the start) turns more than the full supply reel
    const a = reelAngles(0.01, 120),
      b = reelAngles(0.02, 120);
    const take = (b.takeUp - a.takeUp + 360) % 360,
      supply = (b.supply - a.supply + 360) % 360;
    expect(take).toBeGreaterThan(supply);
  });
});
