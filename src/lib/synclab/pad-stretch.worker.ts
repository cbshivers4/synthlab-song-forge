import { stretchPadPcm } from './pad-chops';

self.onmessage = (event: MessageEvent<{ left: Float32Array; right: Float32Array; speed: number }>) => {
  try {
    const { left, right, speed } = event.data;
    if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) throw new Error('Stretch must be between 25% and 400%');
    const l = stretchPadPcm(left, speed), r = stretchPadPcm(right, speed);
    self.postMessage({ left: l, right: r }, { transfer: [l.buffer, r.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Stretch failed' });
  }
};