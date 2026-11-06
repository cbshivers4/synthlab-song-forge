/**
 * Turn a rendered pattern (which runs past its last bar by the release tail) into an
 * exact-length loop: the tail is folded back onto the start, so the loop repeats seamlessly
 * and the last note still rings into bar 1 the way it would in the song.
 */
export function foldLoopTail(channels: Float32Array[], loopFrames: number): Float32Array[] {
  const len = Math.max(1, Math.floor(loopFrames));
  return channels.map((src) => {
    const out = new Float32Array(len);
    out.set(src.subarray(0, Math.min(len, src.length)));
    for (let i = len; i < src.length; i++) out[(i - len) % len]! += src[i]!;
    return out;
  });
}
