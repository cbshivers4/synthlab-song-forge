/**
 * AIFF / AIFF-C reader. Chrome, Edge and Firefox can't decode AIFF with decodeAudioData (only Safari can),
 * so every file-loading path goes through decodeAudioFile, which reads AIFF here and hands everything else to the browser.
 */
export interface PcmAudio { sampleRate: number; channels: Float32Array[] }

const tag = (v: DataView, off: number) => String.fromCharCode(v.getUint8(off), v.getUint8(off + 1), v.getUint8(off + 2), v.getUint8(off + 3));

/** True when the bytes start with an AIFF or AIFF-C header. */
export function isAiff(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 12) return false;
  const v = new DataView(bytes);
  return tag(v, 0) === "FORM" && (tag(v, 8) === "AIFF" || tag(v, 8) === "AIFC");
}

/** 80-bit IEEE 754 extended float (AIFF sample-rate field). */
function readExt80(v: DataView, off: number): number {
  const se = v.getUint16(off);
  const sign = se & 0x8000 ? -1 : 1;
  const exp = se & 0x7fff;
  const hi = v.getUint32(off + 2), lo = v.getUint32(off + 6);
  if (!exp && !hi && !lo) return 0;
  return sign * (hi * 2 ** 32 + lo) * 2 ** (exp - 16383 - 63);
}

function ulaw(b: number): number {
  const u = ~b & 0xff;
  const t = (((u & 0x0f) << 3) + 0x84) << ((u & 0x70) >> 4);
  return (u & 0x80 ? 0x84 - t : t - 0x84) / 32768;
}
function alaw(b: number): number {
  const a = b ^ 0x55;
  const seg = (a & 0x70) >> 4;
  let t = (a & 0x0f) << 4;
  t = seg === 0 ? t + 8 : seg === 1 ? t + 0x108 : (t + 0x108) << (seg - 1);
  return (a & 0x80 ? t : -t) / 32768;
}

/** Parses an AIFF/AIFC file into float channels. Throws a readable error for unsupported compression. */
export function parseAiff(bytes: ArrayBuffer): PcmAudio {
  if (!isAiff(bytes)) throw new Error("Not an AIFF file.");
  const v = new DataView(bytes);
  const aifc = tag(v, 8) === "AIFC";
  let channels = 0, frames = 0, bits = 0, rate = 0, comp = "NONE";
  let dataOff = -1, dataLen = 0;
  let p = 12;
  // Walk every chunk to the end of the file (some writers store a wrong FORM size).
  while (p + 8 <= bytes.byteLength) {
    const id = tag(v, p);
    const size = v.getUint32(p + 4);
    const body = p + 8;
    if (id === "COMM" && body + 18 <= bytes.byteLength) {
      channels = v.getInt16(body);
      frames = v.getUint32(body + 2);
      bits = v.getInt16(body + 6);
      rate = readExt80(v, body + 8);
      if (aifc && size >= 22 && body + 22 <= bytes.byteLength) comp = tag(v, body + 18);
    } else if (id === "SSND" && body + 8 <= bytes.byteLength) {
      const offset = v.getUint32(body);
      dataOff = body + 8 + offset;
      dataLen = Math.max(0, Math.min(size - 8 - offset, bytes.byteLength - dataOff));
    }
    p = body + size + (size & 1);
  }
  if (!channels || !rate || dataOff < 0) throw new Error("This AIFF file is damaged or incomplete.");
  const c = comp.toLowerCase();
  type Reader = (off: number) => number;
  let width: number; let read: Reader;
  if (c === "none" || c === "twos" || c === "sowt" || c === "in24" || c === "in32" || c === "42ni" || c === "23ni") {
    const little = c === "sowt" || c === "42ni" || c === "23ni";
    const b = c === "in24" || c === "42ni" ? 24 : c === "in32" || c === "23ni" ? 32 : bits;
    width = Math.ceil(b / 8);
    if (width < 1 || width > 4) throw new Error(`AIFF files with ${b}-bit samples aren't supported.`);
    const scale = 2 ** (width * 8 - 1);
    read = (off) => {
      let x = 0;
      for (let i = 0; i < width; i++) x = x * 256 + v.getUint8(off + (little ? width - 1 - i : i));
      if (x >= scale) x -= scale * 2;
      return x / scale;
    };
  } else if (c === "fl32") { width = 4; read = (off) => v.getFloat32(off); }
  else if (c === "fl64") { width = 8; read = (off) => v.getFloat64(off); }
  else if (c === "ulaw") { width = 1; read = (off) => ulaw(v.getUint8(off)); }
  else if (c === "alaw") { width = 1; read = (off) => alaw(v.getUint8(off)); }
  else throw new Error(`This AIFF-C file uses "${comp.trim()}" compression, which SYNCLAB can't read. Save it as a normal AIFF or WAV and try again.`);
  const n = Math.min(frames || Infinity, Math.floor(dataLen / (width * channels)));
  if (!n) throw new Error("The file contains no audio.");
  const out = Array.from({ length: channels }, () => new Float32Array(n));
  const stride = width * channels;
  for (let f = 0; f < n; f++) {
    const base = dataOff + f * stride;
    for (let ch = 0; ch < channels; ch++) out[ch]![f] = read(base + ch * width);
  }
  return { sampleRate: rate, channels: out };
}

/** Builds an AudioBuffer at the context's own rate, exactly like decodeAudioData does. */
async function toAudioBuffer(ctx: BaseAudioContext, pcm: PcmAudio): Promise<AudioBuffer> {
  const rate = Math.round(pcm.sampleRate);
  const length = pcm.channels[0]!.length;
  const make = (c: BaseAudioContext, r: number) => {
    const buf = c.createBuffer(pcm.channels.length, length, r);
    pcm.channels.forEach((d, i) => buf.copyToChannel(d as Float32Array<ArrayBuffer>, i));
    return buf;
  };
  if (rate === ctx.sampleRate || typeof OfflineAudioContext === "undefined") return make(ctx, rate);
  const outLen = Math.max(1, Math.ceil(length * ctx.sampleRate / rate));
  const off = new OfflineAudioContext(pcm.channels.length, outLen, ctx.sampleRate);
  const src = off.createBufferSource();
  src.buffer = make(off, rate);
  src.connect(off.destination);
  src.start();
  return off.startRendering();
}

/** decodeAudioData that also opens AIFF / AIFF-C on every browser. Never detaches the caller's bytes. */
export async function decodeAudioFile(ctx: BaseAudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  if (isAiff(bytes)) return toAudioBuffer(ctx, parseAiff(bytes));
  return ctx.decodeAudioData(bytes);
}
