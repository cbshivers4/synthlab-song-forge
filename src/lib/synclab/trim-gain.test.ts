import { describe, expect, it } from 'vitest';
import { clampTrim, trimDb, trimFromCc, trimGain } from './trim-gain';

describe('mixer GAIN trim', () => {
  it('reaches +24 dB (about 15.8×) so a quiet channel can be pushed into the red', () => {
    expect(trimGain(24)).toBeCloseTo(15.85, 1);
    expect(clampTrim(100)).toBeCloseTo(15.85, 1);
    // a -17.5 dB peak plus +18 dB of trim goes over 0 dBFS
    expect(20 * Math.log10(Math.pow(10, -17.5 / 20) * trimGain(18))).toBeGreaterThan(0);
  });
  it('keeps old projects: 1× is 0 dB and 2× is about +6 dB', () => {
    expect(trimDb(1)).toBe(0);
    expect(trimDb(2)).toBeCloseTo(6, 0);
    expect(trimDb(undefined)).toBe(0);
  });
  it('maps a controller knob end to end and centre to 0 dB', () => {
    expect(trimDb(trimFromCc(0))).toBe(-24);
    expect(trimDb(trimFromCc(1))).toBe(24);
    expect(trimFromCc(0.5)).toBeCloseTo(1);
  });
});
