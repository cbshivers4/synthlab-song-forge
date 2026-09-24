/**
 * WSOLA time stretch: changes length without changing pitch.
 * speed > 1 makes audio shorter/faster, < 1 longer/slower.
 * Runs on the main thread offline; fine for sampler-length audio.
 */
export function wsolaStretch(input: Float32Array, speed: number, frame = 2048, search = 384): Float32Array {
  const hopOut = frame / 4;
  const hopIn = hopOut * speed;
  const outLen = Math.max(frame, Math.floor(input.length / speed));
  const out = new Float32Array(outLen + frame);
  const norm = new Float32Array(outLen + frame);
  const win = new Float32Array(frame);
  for (let i = 0; i < frame; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1));

  let prevPos = 0;
  for (let o = 0, k = 0; o < outLen; o += hopOut, k++) {
    const nominal = Math.round(k * hopIn);
    let best = nominal;
    if (k > 0) {
      // find the input position whose start best continues the previous grain
      const target = prevPos + hopOut;
      let bestScore = -Infinity;
      const lo = Math.max(0, nominal - search);
      const hi = Math.min(input.length - frame, nominal + search);
      for (let p = lo; p <= hi; p += 4) {
        let score = 0;
        for (let i = 0; i < hopOut; i += 4) score += (input[p + i] ?? 0) * (input[target + i] ?? 0);
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
    }
    if (best + frame > input.length) break;
    for (let i = 0; i < frame; i++) {
      out[o + i]! += (input[best + i] ?? 0) * win[i]!;
      norm[o + i]! += win[i]!;
    }
    prevPos = best;
  }
  const res = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) res[i] = norm[i]! > 1e-3 ? out[i]! / norm[i]! : 0;
  return res;
}
