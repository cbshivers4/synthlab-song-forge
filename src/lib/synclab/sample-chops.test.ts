import { describe, expect, it } from 'vitest';
import { detectSampleChops } from './sample-chops';
describe('sample attack chopping', () => {
  it('finds separated attacks and respects trim', () => {
    const pcm = new Float32Array(1000);
    for (const at of [200, 500, 800]) for (let i = at; i < at + 30; i++) pcm[i] = 0.8;
    expect(detectSampleChops([pcm], 1000, 0, 1, 0.5)).toEqual([0, 0.2, 0.5, 0.8]);
    expect(detectSampleChops([pcm], 1000, 0.4, 0.7, 0.5)).toEqual([0.4, 0.5]);
  });
  it('does not invent attacks in silence or sustained audio', () => {
    expect(detectSampleChops([new Float32Array(1000)], 1000, 0, 1, 1)).toEqual([0]);
    expect(detectSampleChops([new Float32Array(1000).fill(0.5)], 1000, 0, 1, 1)).toEqual([0]);
  });
});