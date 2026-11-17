import { describe, expect, it } from 'vitest';
import { DRUM_MEASURED_DB, DRUM_TARGET_DB, drumMakeup, drumVelocityGain } from './drum-levels';

const db = (g: number) => 20 * Math.log10(g);

describe('built-in drum loudness', () => {
  it('brings each factory voice up to peak at 0 dBFS at full velocity and pad volume', () => {
    expect(DRUM_TARGET_DB).toBe(0);
    expect(DRUM_MEASURED_DB['909:kick']! + db(drumMakeup('909', 'kick'))).toBeCloseTo(0, 5);
    expect(DRUM_MEASURED_DB['808:hat']! + db(drumMakeup('808', 'hat'))).toBeCloseTo(0, 5);
  });
  it('never makes a voice quieter than it was', () => {
    for (const key of Object.keys(DRUM_MEASURED_DB)) {
      const [kit, voice] = key.split(':');
      expect(drumMakeup(kit, voice!)).toBeGreaterThanOrEqual(1);
    }
  });
  it('soft hits (0.35) sit about 4.6 dB below full hits', () => {
    expect(db(drumVelocityGain(0.35))).toBeCloseTo(-4.6, 1);
    expect(drumVelocityGain(1)).toBe(1);
  });
});
