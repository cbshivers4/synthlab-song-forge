import { describe, expect, it, vi } from "vitest";
import { arpHitOffset, arpStepSeconds, FREE_ARP_STEP_SECONDS, lfoHz } from "./synth-timing";
import { importAudioToSampler } from "./import-audio";
import { consumeTakeFailure, markTakeFailed } from "./take-status";

describe("synth LFO SYNC", () => {
  it("free LFO keeps the RATE knob in Hz", () => {
    expect(lfoHz({ rate: 3.3, sync: false }, 140)).toBe(3.3);
  });
  it("synced LFO locks to the song tempo", () => {
    // 2 Hz at 120 BPM is one cycle per beat; at 90 BPM the same setting follows the slower beat.
    expect(lfoHz({ rate: 2, sync: true }, 120)).toBeCloseTo(2);
    expect(lfoHz({ rate: 2, sync: true }, 90)).toBeCloseTo(1.5);
    // 3 Hz at 120 BPM snaps to the nearest musical length (2 cycles per beat = 4 Hz).
    expect(lfoHz({ rate: 3, sync: true }, 120)).toBeCloseTo(4);
  });
});

describe("arpeggiator TEMPO SYNC and SWING", () => {
  it("sync on follows the song step; sync off uses a fixed 120 BPM clock", () => {
    expect(arpStepSeconds({ rate: 2, sync: true }, 0.1)).toBeCloseTo(0.05);
    expect(arpStepSeconds({ rate: 2, sync: false }, 0.1)).toBeCloseTo(FREE_ARP_STEP_SECONDS / 2);
    expect(arpStepSeconds({ rate: 2 }, 0.1)).toBeCloseTo(0.05);
  });
  it("swing delays every second arp note by up to half a note", () => {
    expect(arpHitOffset(0, 0.1, 1)).toBe(0);
    expect(arpHitOffset(1, 0.1, 1)).toBeCloseTo(0.15);
    expect(arpHitOffset(2, 0.1, 1)).toBeCloseTo(0.2);
    expect(arpHitOffset(1, 0.1, 0)).toBeCloseTo(0.1);
  });
});

describe("audio import", () => {
  it("a file that cannot be read leaves no empty sampler channel", async () => {
    const removeTrack = vi.fn();
    const ok = await importAudioToSampler(
      { addTrack: () => "t1", setPanel: () => {}, loadSample: async () => false, removeTrack },
      new File([""], "bad.mp3"),
    );
    expect(ok).toBe(false);
    expect(removeTrack).toHaveBeenCalledWith("t1");
  });
  it("a readable file keeps its channel", async () => {
    const removeTrack = vi.fn();
    expect(
      await importAudioToSampler(
        { addTrack: () => "t1", setPanel: () => {}, loadSample: async () => true, removeTrack },
        new File([""], "ok.wav"),
      ),
    ).toBe(true);
    expect(removeTrack).not.toHaveBeenCalled();
  });
});

describe("save after a failed take", () => {
  it("reports the failure once", () => {
    consumeTakeFailure();
    expect(consumeTakeFailure()).toBe(false);
    markTakeFailed();
    expect(consumeTakeFailure()).toBe(true);
    expect(consumeTakeFailure()).toBe(false);
  });
});
