export interface ReferenceAnalysisResult {
  duration: number;
  sampleRate: number;
  channels: number;
  peakDb: number;
  averageDb: number;
  tempo: number | null;
  key: string | null;
  waveform: number[];
}

const clampDb = (value: number) => Math.max(-96, 20 * Math.log10(Math.max(value, 0.0000158)));

function monoSamples(buffer: AudioBuffer) {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index++) mono[index] = (mono[index] ?? 0) + (data[index] ?? 0) / buffer.numberOfChannels;
  }
  return mono;
}

function waveformPeaks(data: Float32Array, points = 160) {
  const width = Math.min(points, data.length);
  const size = Math.max(1, Math.floor(data.length / width));
  return Array.from({ length: width }, (_, point) => {
    let peak = 0;
    const end = Math.min(data.length, (point + 1) * size);
    for (let index = point * size; index < end; index++) peak = Math.max(peak, Math.abs(data[index] ?? 0));
    return peak;
  });
}

function estimateTempo(data: Float32Array, sampleRate: number) {
  const hop = 1024;
  const energy: number[] = [];
  for (let start = 0; start < data.length; start += hop) {
    let sum = 0;
    const end = Math.min(data.length, start + hop);
    for (let index = start; index < end; index++) {
      const value = data[index] ?? 0;
      sum += value * value;
    }
    energy.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  const novelty = energy.map((value, index) => Math.max(0, value - (energy[index - 1] ?? value)));
  const mean = novelty.reduce((sum, value) => sum + value, 0) / Math.max(1, novelty.length);
  const centered = novelty.map((value) => Math.max(0, value - mean * 1.25));
  let bestTempo: number | null = null;
  let bestScore = 0;
  for (let tempo = 70; tempo <= 180; tempo++) {
    const lag = Math.round((60 * sampleRate) / (tempo * hop));
    let score = 0;
    for (let index = lag; index < centered.length; index++) score += (centered[index] ?? 0) * (centered[index - lag] ?? 0);
    if (score > bestScore) {
      bestScore = score;
      bestTempo = tempo;
    }
  }
  return bestScore > 0 ? bestTempo : null;
}

function goertzel(data: Float32Array, sampleRate: number, frequency: number) {
  const stride = Math.max(1, Math.floor(data.length / Math.min(data.length, sampleRate * 45)));
  const omega = (2 * Math.PI * frequency * stride) / sampleRate;
  const coefficient = 2 * Math.cos(omega);
  let previous = 0;
  let previousTwo = 0;
  for (let index = 0; index < data.length; index += stride) {
    const current = (data[index] ?? 0) + coefficient * previous - previousTwo;
    previousTwo = previous;
    previous = current;
  }
  return previousTwo * previousTwo + previous * previous - coefficient * previous * previousTwo;
}

function estimateKey(data: Float32Array, sampleRate: number) {
  const chroma = Array.from({ length: 12 }, () => 0);
  for (let midi = 36; midi <= 83; midi++) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const pitchClass = midi % 12;
    chroma[pitchClass] = (chroma[pitchClass] ?? 0) + goertzel(data, sampleRate, frequency);
  }
  const major = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minor = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  let best = { score: 0, label: "" };
  for (let root = 0; root < 12; root++) {
    for (const [mode, profile] of [["major", major], ["minor", minor]] as const) {
      const score = profile.reduce((sum, weight, index) => sum + weight * (chroma[(index + root) % 12] ?? 0), 0);
      if (score > best.score) best = { score, label: `${names[root]} ${mode}` };
    }
  }
  return best.score > 0 ? best.label : null;
}

export function analyzeReferenceBuffer(buffer: AudioBuffer): ReferenceAnalysisResult {
  const mono = monoSamples(buffer);
  let peak = 0;
  let squareSum = 0;
  for (const value of mono) {
    peak = Math.max(peak, Math.abs(value));
    squareSum += value * value;
  }
  return {
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    peakDb: clampDb(peak),
    averageDb: clampDb(Math.sqrt(squareSum / Math.max(1, mono.length))),
    tempo: estimateTempo(mono, buffer.sampleRate),
    key: estimateKey(mono, buffer.sampleRate),
    waveform: waveformPeaks(mono),
  };
}