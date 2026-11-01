import { describe, expect, it } from 'vitest';
import { firstRepeatTime, stepAtTime } from './note-repeat';
import { peakInWindow, sampleWindow } from './audio-engine';
import { SYNTH_PRESETS } from './presets';

describe('note repeat', () => {
  const clock = { step: 10, time: 5, dur: 0.125 };
  it('with the song playing, the roll starts on the next grid line of the chosen rate', () => {
    // at t=5.05 the song is at step 10.4 → next 1/8 (2 steps) line is step 12 → 5.25 s
    expect(firstRepeatTime(5.05, 2, clock)).toBeCloseTo(5.25);
    expect(stepAtTime(5.25, clock)).toBe(12);
  });
  it('stopped, it starts straight away', () => {
    expect(firstRepeatTime(3, 1, null)).toBeCloseTo(3.005);
  });
});

describe('sampler reverse', () => {
  it('reverse plays the trimmed part backwards (mirror window in the flipped buffer)', () => {
    expect(sampleWindow(0.1, 0.4, false)).toEqual([0.1, 0.4]);
    const [a, b] = sampleWindow(0.1, 0.4, true);
    expect(a).toBeCloseTo(0.6);
    expect(b).toBeCloseTo(0.9);
  });
});

describe('normalize', () => {
  it('finds the loudest point only inside the trimmed part', () => {
    const left = new Float32Array([0.9, 0.1, 0.2, 0.3, 0.1, 0.05, 0, 0, 0, 0]);
    const right = new Float32Array([0, 0, 0.1, -0.5, 0, 0, 0, 0, 0, 0]);
    expect(peakInWindow([left, right], 0.2, 0.6)).toBeCloseTo(0.5);
  });
});

describe('sequence presets', () => {
  it('ship a Sequence category whose patches run the arpeggiator in sync', () => {
    const seq = SYNTH_PRESETS.filter((p) => p.category === 'Sequence');
    expect(seq.length).toBeGreaterThanOrEqual(8);
  });
});
