/** Detect attacks in decoded PCM, not display waveform peaks. Fractions refer to the original buffer. */
export function detectSampleChops(
  channels: Float32Array[],
  sampleRate: number,
  start: number,
  end: number,
  sensitivity: number,
): number[] {
  const length = channels[0]?.length ?? 0;
  if (!length || sampleRate <= 0 || end <= start) return [];
  const window = Math.max(1, Math.round(sampleRate * 0.01));
  const from = Math.floor(start * length),
    to = Math.floor(end * length);
  const envelope: { frame: number; energy: number }[] = [];
  for (let frame = from; frame < to; frame += window) {
    let sum = 0,
      count = 0;
    for (const channel of channels)
      for (let j = frame; j < Math.min(to, frame + window); j++) {
        sum += (channel[j] ?? 0) ** 2;
        count++;
      }
    envelope.push({ frame, energy: Math.sqrt(sum / Math.max(1, count)) });
  }
  const peak = envelope.reduce((max, item) => Math.max(max, item.energy), 0);
  const threshold = peak * (0.32 - Math.min(1, Math.max(0, sensitivity)) * 0.26);
  const gap = sampleRate * 0.08;
  const slices = [start];
  let last = from;
  for (let i = 1; i < envelope.length; i++) {
    const now = envelope[i],
      previous = envelope[i - 1];
    if (!now || !previous) continue;
    if (
      now.energy - previous.energy > threshold &&
      now.frame - last >= gap &&
      now.frame < to - window
    ) {
      slices.push(now.frame / length);
      last = now.frame;
      if (slices.length >= 16) break;
    }
  }
  return slices;
}
