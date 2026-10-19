import type { OscWave } from './types';

/** Fourier phase rotation in cycles, for the oscillator's actual waveform. */
export function phasedHarmonics(wave: OscWave, phase: number, pulseWidth = 0.5, morph = 0.5) {
  const real = new Float32Array(64);
  const imag = new Float32Array(64);
  for (let n = 1; n < real.length; n++) {
    let sine = 0, cosine = 0;
    if (wave === 'sine') sine = n === 1 ? 1 : 0;
    else if (wave === 'triangle') sine = n % 2 ? Math.sin(n * Math.PI / 2) / (n * n) : 0;
    else if (wave === 'square') sine = n % 2 ? 1 / n : 0;
    else if (wave === 'pulse') {
      cosine = 2 * Math.sin(2 * Math.PI * n * pulseWidth) / (Math.PI * n);
      sine = 2 * (1 - Math.cos(2 * Math.PI * n * pulseWidth)) / (Math.PI * n);
    } else if (wave === 'wavetable') {
      const soft = Math.exp(-n * 0.9), saw = 1 / n;
      const hollow = (n % 2 ? 1 / n : 0) * (1 + Math.cos(n * 0.6));
      sine = morph < 0.5 ? soft + (saw - soft) * morph * 2 : saw + (hollow - saw) * (morph - 0.5) * 2;
    } else if (wave === 'sawtooth') sine = -1 / n;
    const angle = 2 * Math.PI * n * phase;
    real[n] = cosine * Math.cos(angle) + sine * Math.sin(angle);
    imag[n] = sine * Math.cos(angle) - cosine * Math.sin(angle);
  }
  return { real, imag };
}