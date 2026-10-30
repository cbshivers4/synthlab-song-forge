/**
 * Native plugin insert — the studio half of the audio link to a native plugin host
 * (see /mnt/documents/SYNCLAB-plugin-hosting-design.md, "Option A").
 *
 * Audio for one insert travels through two lock-free ring buffers in shared memory:
 *   toHost   : the channel's audio, written by the AudioWorklet, read by the native host
 *   fromHost : the processed audio, written by the native host, read by the AudioWorklet
 *
 * Shared-memory layout of each ring (little-endian, what the C++ host must match):
 *   Int32[0] write position (frames, wraps at 2^31)   Int32[1] read position
 *   Int32[2] capacity (frames)                         Int32[3] channel count
 *   then Float32 interleaved samples, capacity × channels
 * The writer only moves the write position and the reader only the read position (Atomics),
 * so neither side ever blocks the audio thread.
 *
 * Nothing here loads a plugin. Without a host the insert passes audio through untouched.
 */

export const NATIVE_INSERT_PROCESSOR = "synclab-native-insert";
export const HEADER_INTS = 4;
/** Frames the worklet waits for before using host output: the insert's fixed latency. */
export const PRIME_FRAMES = 256;

/** Self-contained (no outside references) so its source can run inside the AudioWorklet too. */
export class NativeInsertCore {
  static HEADER = 4;
  static create(capacity: number, channels: number): SharedArrayBuffer {
    const sab = new SharedArrayBuffer(NativeInsertCore.HEADER * 4 + capacity * channels * 4);
    const head = new Int32Array(sab, 0, NativeInsertCore.HEADER);
    head[2] = capacity;
    head[3] = channels;
    return sab;
  }
  static readable(sab: SharedArrayBuffer): number {
    const head = new Int32Array(sab, 0, NativeInsertCore.HEADER);
    return (Atomics.load(head, 0) - Atomics.load(head, 1) + 0x80000000) % 0x80000000;
  }
  static writable(sab: SharedArrayBuffer): number {
    const head = new Int32Array(sab, 0, NativeInsertCore.HEADER);
    return head[2]! - NativeInsertCore.readable(sab);
  }
  /** Writes up to `frames` frames from planar channels; returns frames written (drops on overflow). */
  static write(sab: SharedArrayBuffer, channels: Float32Array[], frames: number): number {
    const head = new Int32Array(sab, 0, NativeInsertCore.HEADER);
    const cap = head[2]!, ch = head[3]!;
    const data = new Float32Array(sab, NativeInsertCore.HEADER * 4, cap * ch);
    const n = Math.min(frames, NativeInsertCore.writable(sab));
    let w = Atomics.load(head, 0);
    for (let i = 0; i < n; i++) {
      const slot = (w % cap) * ch;
      for (let c = 0; c < ch; c++) data[slot + c] = (channels[c] ?? channels[0])?.[i] ?? 0;
      w = (w + 1) % 0x80000000;
    }
    Atomics.store(head, 0, w);
    return n;
  }
  /** Reads up to `frames` frames into planar channels; returns frames read. */
  static read(sab: SharedArrayBuffer, out: Float32Array[], frames: number): number {
    const head = new Int32Array(sab, 0, NativeInsertCore.HEADER);
    const cap = head[2]!, ch = head[3]!;
    const data = new Float32Array(sab, NativeInsertCore.HEADER * 4, cap * ch);
    const n = Math.min(frames, NativeInsertCore.readable(sab));
    let r = Atomics.load(head, 1);
    for (let i = 0; i < n; i++) {
      const slot = (r % cap) * ch;
      for (let c = 0; c < out.length; c++) out[c]![i] = data[slot + Math.min(c, ch - 1)]!;
      r = (r + 1) % 0x80000000;
    }
    Atomics.store(head, 1, r);
    return n;
  }

  primed = false;
  underruns = 0;
  constructor(public toHost: SharedArrayBuffer | null, public fromHost: SharedArrayBuffer | null, public prime = 256) {}

  /**
   * One audio block. Sends input to the host; plays host output once `prime` frames are queued.
   * Before priming, without a host, or if the host falls behind, the dry input plays instead,
   * so the channel never goes silent because of the link.
   */
  process(input: Float32Array[], output: Float32Array[]): "processed" | "dry" {
    const frames = output[0]?.length ?? 0;
    const dry = () => {
      for (let c = 0; c < output.length; c++) output[c]!.set(input[c] ?? input[0] ?? new Float32Array(frames));
      return "dry" as const;
    };
    if (!this.toHost || !this.fromHost) return dry();
    if (input.length) NativeInsertCore.write(this.toHost, input, frames);
    if (!this.primed) {
      if (NativeInsertCore.readable(this.fromHost) < this.prime) return dry();
      this.primed = true;
    }
    if (NativeInsertCore.readable(this.fromHost) < frames) {
      this.underruns += 1;
      this.primed = false;
      return dry();
    }
    NativeInsertCore.read(this.fromHost, output, frames);
    return "processed";
  }
}

/** Source for audioWorklet.addModule (via a Blob URL), built from the same tested core. */
export function nativeInsertWorkletSource(): string {
  return `${NativeInsertCore.toString()}
class SynclabNativeInsert extends AudioWorkletProcessor {
  constructor() {
    super();
    this.core = new NativeInsertCore(null, null, ${PRIME_FRAMES});
    this.port.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "attach") { this.core = new NativeInsertCore(m.toHost, m.fromHost, m.prime || ${PRIME_FRAMES}); }
      if (m.type === "detach") { this.core = new NativeInsertCore(null, null, ${PRIME_FRAMES}); }
    };
  }
  process(inputs, outputs) {
    const input = inputs[0] || [];
    const output = outputs[0] || [];
    if (!output.length) return true;
    const before = this.core.underruns;
    this.core.process(input, output);
    if (this.core.underruns !== before) this.port.postMessage({ type: "underrun", count: this.core.underruns });
    return true;
  }
}
registerProcessor("${NATIVE_INSERT_PROCESSOR}", SynclabNativeInsert);`;
}

/** Control messages between the studio and the native host for one insert (JSON over the existing local link). */
export type NativeInsertMessage =
  | { type: "insert-attach"; insertId: string; uid: string; sampleRate: number; channels: number; blockSize: number; state?: string | undefined }
  | { type: "insert-detach"; insertId: string }
  | { type: "insert-state-get"; insertId: string }
  | { type: "insert-state"; insertId: string; state: string }
  | { type: "insert-latency"; insertId: string; samples: number }
  | { type: "insert-crashed"; insertId: string; message: string };

/** How a saved insert runs right now: through the native host, or passed through untouched. */
export function nativeInsertMode(plugin: { native?: unknown }, hostAvailable: boolean): "builtin" | "host" | "passthrough" {
  if (!plugin.native) return "builtin";
  return hostAvailable ? "host" : "passthrough";
}

/**
 * Stand-in for the C++ host, for automated tests and development: drains `toHost`, applies a
 * gain, writes `fromHost`. The real host does the same with a VST3 / AU / CLAP process call.
 */
export class FakeNativeHost {
  constructor(private toHost: SharedArrayBuffer, private fromHost: SharedArrayBuffer, private gain = 1) {}
  pump(maxFrames = 1 << 16) {
    const head = new Int32Array(this.toHost, 0, HEADER_INTS);
    const ch = head[3]!;
    const n = Math.min(maxFrames, NativeInsertCore.readable(this.toHost), NativeInsertCore.writable(this.fromHost));
    if (n <= 0) return 0;
    const buf = Array.from({ length: ch }, () => new Float32Array(n));
    NativeInsertCore.read(this.toHost, buf, n);
    for (const c of buf) for (let i = 0; i < n; i++) c[i]! *= this.gain;
    NativeInsertCore.write(this.fromHost, buf, n);
    return n;
  }
}
