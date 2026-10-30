import { describe, expect, it } from 'vitest';
import { shownPassIndex, splitLoopPasses } from './loop-takes';

// 1-bar loop at 120 BPM: 16 steps × 0.125 s = 2 s per pass
const loop = { lo: 0, hi: 16, stepDur: 0.125 };

describe('loop take recording', () => {
  it('three passes round a 1-bar loop become three 2-second takes, back to back in the file', () => {
    const passes = splitLoopPasses({ start: 0, offset: 0, duration: 6, ...loop });
    expect(passes).toEqual([
      { start: 0, offset: 0, length: 2 },
      { start: 0, offset: 2, length: 2 },
      { start: 0, offset: 4, length: 2 },
    ]);
  });
  it('a first pass started mid-loop keeps its real position', () => {
    const passes = splitLoopPasses({ start: 8, offset: 0.01, duration: 3.01, ...loop });
    expect(passes[0]).toEqual({ start: 8, offset: 0.01, length: 1 });
    expect(passes[1]).toEqual({ start: 0, offset: 1.01, length: 2 });
  });
  it('shows the newest pass, unless the last one was stopped early', () => {
    expect(shownPassIndex(splitLoopPasses({ start: 0, offset: 0, duration: 6, ...loop }), 0, 16, 0.125)).toBe(2);
    expect(shownPassIndex(splitLoopPasses({ start: 0, offset: 0, duration: 4.5, ...loop }), 0, 16, 0.125)).toBe(1);
  });
});
