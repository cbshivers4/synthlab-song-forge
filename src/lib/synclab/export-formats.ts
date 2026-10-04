import type { Capture } from "./bounce";

export type BitDepth = 16 | 24 | 32;

const clamp = (s: number) => Math.max(-1, Math.min(1, s));

/** Interleaved PCM bytes. 32 = 32-bit float. */
function pcm(cap: Capture, bits: BitDepth, bigEndian: boolean): Uint8Array {
  const frames = Math.min(cap.left.length, cap.right.length);
  const bps = bits / 8;
  const out = new Uint8Array(frames * 2 * bps);
  const v = new DataView(out.buffer);
  const le = !bigEndian;
  let o = 0;
  for (let i = 0; i < frames; i++) {
    for (const ch of [cap.left, cap.right]) {
      const s = clamp(ch[i] ?? 0);
      if (bits === 32) v.setFloat32(o, s, le);
      else if (bits === 16) v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, le);
      else {
        const n = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff);
        if (le) {
          out[o] = n & 255; out[o + 1] = (n >> 8) & 255; out[o + 2] = (n >> 16) & 255;
        } else {
          out[o] = (n >> 16) & 255; out[o + 1] = (n >> 8) & 255; out[o + 2] = n & 255;
        }
      }
      o += bps;
    }
  }
  return out;
}

const ascii = (v: DataView, off: number, s: string) => {
  for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
};

export function encodeWavDepth(cap: Capture, bits: BitDepth): Blob {
  const data = pcm(cap, bits, false);
  const h = new DataView(new ArrayBuffer(44));
  const ba = 2 * (bits / 8);
  ascii(h, 0, "RIFF"); h.setUint32(4, 36 + data.length, true); ascii(h, 8, "WAVE");
  ascii(h, 12, "fmt "); h.setUint32(16, 16, true); h.setUint16(20, bits === 32 ? 3 : 1, true);
  h.setUint16(22, 2, true); h.setUint32(24, cap.sampleRate, true); h.setUint32(28, cap.sampleRate * ba, true);
  h.setUint16(32, ba, true); h.setUint16(34, bits, true);
  ascii(h, 36, "data"); h.setUint32(40, data.length, true);
  return new Blob([h.buffer, data as BlobPart], { type: "audio/wav" });
}

/** 80-bit IEEE extended for the AIFF sample rate field. */
function ext80(v: DataView, off: number, num: number) {
  let exp = Math.floor(Math.log2(num));
  const mant = num / 2 ** exp;
  exp += 16383;
  v.setUint16(off, exp);
  const hi = Math.floor(mant * 2 ** 31);
  v.setUint32(off + 2, hi);
  v.setUint32(off + 6, Math.floor((mant * 2 ** 31 - hi) * 2 ** 32));
}

export function encodeAiff(cap: Capture, bits: 16 | 24): Blob {
  const data = pcm(cap, bits, true);
  const frames = data.length / (2 * (bits / 8));
  const h = new DataView(new ArrayBuffer(54));
  ascii(h, 0, "FORM"); h.setUint32(4, 46 + data.length); ascii(h, 8, "AIFF");
  ascii(h, 12, "COMM"); h.setUint32(16, 18); h.setUint16(20, 2); h.setUint32(22, frames); h.setUint16(26, bits);
  ext80(h, 28, cap.sampleRate);
  ascii(h, 38, "SSND"); h.setUint32(42, 8 + data.length); h.setUint32(46, 0); h.setUint32(50, 0);
  return new Blob([h.buffer, data as BlobPart], { type: "audio/aiff" });
}

export function encodeCaf(cap: Capture, bits: BitDepth): Blob {
  const data = pcm(cap, bits, true);
  const h = new DataView(new ArrayBuffer(8 + 12 + 32 + 12 + 4));
  ascii(h, 0, "caff"); h.setUint16(4, 1); h.setUint16(6, 0);
  ascii(h, 8, "desc"); h.setBigUint64(12, 32n);
  h.setFloat64(20, cap.sampleRate); ascii(h, 28, "lpcm");
  h.setUint32(32, bits === 32 ? 1 : 0); // float flag, big-endian
  h.setUint32(36, 2 * (bits / 8)); h.setUint32(40, 1); h.setUint32(44, 2); h.setUint32(48, bits);
  ascii(h, 52, "data"); h.setBigUint64(56, BigInt(data.length + 4)); h.setUint32(64, 0);
  return new Blob([h.buffer, data as BlobPart], { type: "audio/x-caf" });
}

/* ---------------- FLAC (lossless, fixed-predictor + Rice coding) ---------------- */

class BitWriter {
  buf = new Uint8Array(1 << 16);
  pos = 0; // bits
  private grow(n: number) {
    if (((this.pos + n) >> 3) + 8 < this.buf.length) return;
    const nb = new Uint8Array(this.buf.length * 2 + (n >> 3));
    nb.set(this.buf);
    this.buf = nb;
  }
  write(val: number, n: number) {
    this.grow(n);
    for (let i = n - 1; i >= 0; i--) {
      const bit = Math.floor(val / 2 ** i) & 1;
      if (bit) this.buf[this.pos >> 3]! |= 0x80 >> (this.pos & 7);
      this.pos++;
    }
  }
  unary(q: number) {
    this.grow(q + 1);
    this.pos += q;
    this.buf[this.pos >> 3]! |= 0x80 >> (this.pos & 7);
    this.pos++;
  }
  align() { this.pos = (this.pos + 7) & ~7; }
  bytes() { return this.buf.slice(0, this.pos >> 3); }
}

const crc8 = (b: Uint8Array) => {
  let c = 0;
  for (const x of b) { c ^= x; for (let i = 0; i < 8; i++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 255 : (c << 1) & 255; }
  return c;
};
const crc16 = (b: Uint8Array) => {
  let c = 0;
  for (const x of b) { c ^= x << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x8005) & 0xffff : (c << 1) & 0xffff; }
  return c;
};

function residuals(s: Int32Array, order: number) {
  const r = new Int32Array(s.length - order);
  for (let i = order; i < s.length; i++) {
    const p = order === 0 ? 0 : order === 1 ? s[i - 1]! : 2 * s[i - 1]! - s[i - 2]!;
    r[i - order] = s[i]! - p;
  }
  return r;
}

function writeSubframe(w: BitWriter, s: Int32Array, bps: number) {
  let best = 1, bestK = 0, bestCost = Infinity, bestRes: Int32Array = new Int32Array();
  for (const order of [0, 1, 2]) {
    if (s.length <= order) continue;
    const r = residuals(s, order);
    let sum = 0;
    for (const x of r) sum += x < 0 ? -2 * x - 1 : 2 * x;
    const mean = sum / Math.max(1, r.length);
    const k = Math.min(14, Math.max(0, Math.floor(Math.log2(mean + 1))));
    const cost = r.length * (k + 1) + sum / 2 ** k;
    if (cost < bestCost) { bestCost = cost; best = order; bestK = k; bestRes = r; }
  }
  w.write(0, 1); w.write(0b001000 | best, 6); w.write(0, 1);
  for (let i = 0; i < best; i++) w.write(s[i]! < 0 ? s[i]! + 2 ** bps : s[i]!, bps);
  w.write(0, 2); w.write(0, 4); // Rice, partition order 0
  w.write(bestK, 4);
  for (const x of bestRes) {
    const u = x < 0 ? -2 * x - 1 : 2 * x;
    w.unary(Math.floor(u / 2 ** bestK));
    if (bestK) w.write(u % 2 ** bestK, bestK);
  }
}

export function encodeFlac(cap: Capture, bits: 16 | 24): Blob {
  const frames = Math.min(cap.left.length, cap.right.length);
  const scale = bits === 16 ? 0x7fff : 0x7fffff;
  const toInt = (f: Float32Array) => {
    const o = new Int32Array(frames);
    for (let i = 0; i < frames; i++) o[i] = Math.round(clamp(f[i] ?? 0) * scale);
    return o;
  };
  const L = toInt(cap.left), R = toInt(cap.right);
  const block = 4096;
  const parts: BlobPart[] = [];
  const head = new BitWriter();
  head.write(0x664c6143, 32); // fLaC
  head.write(1, 1); head.write(0, 7); head.write(34, 24); // last STREAMINFO
  head.write(block, 16); head.write(block, 16); head.write(0, 24); head.write(0, 24);
  head.write(cap.sampleRate, 20); head.write(1, 3); head.write(bits - 1, 5);
  head.write(Math.floor(frames / 2 ** 32), 4); head.write(frames >>> 0, 32);
  for (let i = 0; i < 4; i++) head.write(0, 32); // MD5 unknown
  parts.push(head.bytes());
  const bpsCode = bits === 16 ? 0b100 : 0b110;
  let fn = 0;
  for (let start = 0; start < frames; start += block, fn++) {
    const n = Math.min(block, frames - start);
    const w = new BitWriter();
    w.write(0b11111111111110, 14); w.write(0, 1); w.write(0, 1);
    w.write(0b0111, 4); // blocksize from end of header (16-bit)
    w.write(0, 4); // sample rate from STREAMINFO
    w.write(0b1000, 4); // left/side stereo
    w.write(bpsCode, 3); w.write(0, 1);
    // UTF-8 coded frame number
    if (fn < 0x80) w.write(fn, 8);
    else if (fn < 0x800) { w.write(0xc0 | (fn >> 6), 8); w.write(0x80 | (fn & 63), 8); }
    else if (fn < 0x10000) { w.write(0xe0 | (fn >> 12), 8); w.write(0x80 | ((fn >> 6) & 63), 8); w.write(0x80 | (fn & 63), 8); }
    else { w.write(0xf0 | (fn >> 18), 8); w.write(0x80 | ((fn >> 12) & 63), 8); w.write(0x80 | ((fn >> 6) & 63), 8); w.write(0x80 | (fn & 63), 8); }
    w.write(n - 1, 16);
    w.write(crc8(w.bytes()), 8);
    const l = L.subarray(start, start + n), r = R.subarray(start, start + n);
    const side = new Int32Array(n);
    for (let i = 0; i < n; i++) side[i] = l[i]! - r[i]!;
    writeSubframe(w, l, bits);
    writeSubframe(w, side, bits + 1);
    w.align();
    const body = w.bytes();
    const crc = crc16(body);
    const full = new Uint8Array(body.length + 2);
    full.set(body); full[body.length] = crc >> 8; full[body.length + 1] = crc & 255;
    parts.push(full);
  }
  return new Blob(parts, { type: "audio/flac" });
}

/* ---------------- Browser-encoded formats (Ogg / Opus / M4A) ---------------- */

export const BROWSER_MIME: Record<"ogg" | "opus" | "m4a", string[]> = {
  ogg: ["audio/ogg;codecs=vorbis", "audio/ogg;codecs=opus", "audio/ogg"],
  opus: ["audio/ogg;codecs=opus", "audio/webm;codecs=opus"],
  m4a: ["audio/mp4;codecs=mp4a.40.2", "audio/mp4"],
};

export function browserMime(kind: "ogg" | "opus" | "m4a"): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return BROWSER_MIME[kind].find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/** Encodes by replaying the finished mix into the browser's own encoder (runs in real time). */
export async function encodeWithBrowser(cap: Capture, mime: string, kbps: number): Promise<Blob> {
  const ctx = new AudioContext({ sampleRate: cap.sampleRate });
  const buf = ctx.createBuffer(2, cap.left.length, cap.sampleRate);
  buf.copyToChannel(cap.left as Float32Array<ArrayBuffer>, 0);
  buf.copyToChannel(cap.right as Float32Array<ArrayBuffer>, 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const dest = ctx.createMediaStreamDestination();
  src.connect(dest);
  const rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: kbps * 1000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));
  rec.start();
  src.onended = () => setTimeout(() => rec.stop(), 150);
  src.start();
  await done;
  await ctx.close();
  return new Blob(chunks, { type: mime.split(";")[0] ?? mime });
}

/* ---------------- Sample rate + loudness ---------------- */

export async function resample(cap: Capture, rate: number): Promise<Capture> {
  if (rate === cap.sampleRate) return cap;
  const len = Math.ceil((cap.left.length * rate) / cap.sampleRate);
  const off = new OfflineAudioContext(2, len, rate);
  const b = off.createBuffer(2, cap.left.length, cap.sampleRate);
  b.copyToChannel(cap.left as Float32Array<ArrayBuffer>, 0);
  b.copyToChannel(cap.right as Float32Array<ArrayBuffer>, 1);
  const s = off.createBufferSource();
  s.buffer = b;
  s.connect(off.destination);
  s.start();
  const out = await off.startRendering();
  return { left: out.getChannelData(0), right: out.getChannelData(1), sampleRate: rate };
}

/** Integrated loudness (ITU BS.1770 K-weighting with absolute + relative gating), in LUFS. */
export async function measureLufs(cap: Capture): Promise<number> {
  const off = new OfflineAudioContext(2, cap.left.length, cap.sampleRate);
  const b = off.createBuffer(2, cap.left.length, cap.sampleRate);
  b.copyToChannel(cap.left as Float32Array<ArrayBuffer>, 0);
  b.copyToChannel(cap.right as Float32Array<ArrayBuffer>, 1);
  const s = off.createBufferSource();
  s.buffer = b;
  const shelf = off.createBiquadFilter();
  shelf.type = "highshelf"; shelf.frequency.value = 1681; shelf.gain.value = 4;
  const hp = off.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 38; hp.Q.value = 0.5;
  s.connect(shelf).connect(hp).connect(off.destination);
  s.start();
  const k = await off.startRendering();
  const l = k.getChannelData(0), r = k.getChannelData(1);
  const win = Math.round(0.4 * cap.sampleRate), hop = Math.round(0.1 * cap.sampleRate);
  const blocks: number[] = [];
  for (let i = 0; i + win <= l.length; i += hop) {
    let sum = 0;
    for (let j = i; j < i + win; j++) sum += l[j]! * l[j]! + r[j]! * r[j]!;
    blocks.push(sum / win);
  }
  const lk = (ms: number) => -0.691 + 10 * Math.log10(ms);
  const abs = blocks.filter((m) => lk(m) > -70);
  if (!abs.length) return -Infinity;
  const relGate = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const rel = abs.filter((m) => lk(m) > relGate);
  return lk(rel.reduce((a, b) => a + b, 0) / Math.max(1, rel.length));
}

export function applyGain(cap: Capture, db: number): Capture {
  const g = 10 ** (db / 20);
  const l = new Float32Array(cap.left.length), r = new Float32Array(cap.right.length);
  for (let i = 0; i < l.length; i++) { l[i] = (cap.left[i] ?? 0) * g; r[i] = (cap.right[i] ?? 0) * g; }
  return { left: l, right: r, sampleRate: cap.sampleRate };
}
