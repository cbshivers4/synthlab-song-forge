import { describe, expect, it } from 'vitest';
import { phasedHarmonics } from './oscillator-phase';

describe('audible oscillator phase', () => {
  it('rotates a sine by one quarter cycle without changing its magnitude', () => {
    const rotated = phasedHarmonics('sine', 0.25);
    expect(rotated.real[1]).toBeCloseTo(1);
    expect(rotated.imag[1]).toBeCloseTo(0);
  });
  it('preserves square harmonic energy while changing phase relationships', () => {
    const original = phasedHarmonics('square', 0);
    const rotated = phasedHarmonics('square', 0.25);
    expect(rotated.real[3]).not.toBe(original.real[3]);
    expect(Math.hypot(rotated.real[3] ?? 0, rotated.imag[3] ?? 0)).toBeCloseTo(1 / 3);
  });
});