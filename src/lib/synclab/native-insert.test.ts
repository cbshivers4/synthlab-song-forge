import { describe, expect, it } from 'vitest';
import { FakeNativeHost, NativeInsertCore, PRIME_FRAMES, nativeInsertMode, nativeInsertWorkletSource } from './native-insert';

const block = (v: number, n = 128) => [new Float32Array(n).fill(v), new Float32Array(n).fill(v)];
const out = (n = 128) => [new Float32Array(n), new Float32Array(n)];

describe('native plugin insert link', () => {
  it('ring buffer keeps samples in order across the wrap-around', () => {
    const sab = NativeInsertCore.create(300, 2);
    const o = out(128);
    for (let k = 0; k < 10; k++) {
      expect(NativeInsertCore.write(sab, block(k), 128)).toBe(128);
      expect(NativeInsertCore.read(sab, o, 128)).toBe(128);
      expect(o[0]![0]).toBe(k);
      expect(o[1]![127]).toBe(k);
    }
  });
  it('without a host the channel plays dry, never silent', () => {
    const core = new NativeInsertCore(null, null);
    const o = out();
    expect(core.process(block(0.5), o)).toBe('dry');
    expect(o[0]![10]).toBe(0.5);
  });
  it('with a host the processed sound plays after the fixed 256-frame latency', () => {
    const toHost = NativeInsertCore.create(4096, 2);
    const fromHost = NativeInsertCore.create(4096, 2);
    const core = new NativeInsertCore(toHost, fromHost, PRIME_FRAMES);
    const host = new FakeNativeHost(toHost, fromHost, 0.5);
    const results: string[] = [];
    const o = out();
    for (let k = 0; k < 4; k++) {
      results.push(core.process(block(1), o));
      host.pump();
    }
    expect(results).toEqual(['dry', 'dry', 'processed', 'processed']);
    expect(o[0]![0]).toBe(0.5);
  });
  it('if the host falls behind, the insert falls back to dry and counts the dropout', () => {
    const toHost = NativeInsertCore.create(4096, 2);
    const fromHost = NativeInsertCore.create(4096, 2);
    const core = new NativeInsertCore(toHost, fromHost, 128);
    const host = new FakeNativeHost(toHost, fromHost, 0.5);
    const o = out();
    core.process(block(1), o); host.pump();
    expect(core.process(block(1), o)).toBe('processed');
    expect(core.process(block(1), o)).toBe('dry'); // host didn't pump in time
    expect(core.underruns).toBe(1);
  });
  it('saved desktop plugins pass through where no host runs; built-in effects are unchanged', () => {
    expect(nativeInsertMode({}, false)).toBe('builtin');
    expect(nativeInsertMode({ native: { uid: 'x' } }, false)).toBe('passthrough');
    expect(nativeInsertMode({ native: { uid: 'x' } }, true)).toBe('host');
  });
  it('the AudioWorklet source is valid JavaScript built from the same core', () => {
    const src = nativeInsertWorkletSource();
    let registered = '';
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function('AudioWorkletProcessor', 'registerProcessor', src)(class { port = { onmessage: null, postMessage() {} }; }, (name: string) => { registered = name; });
    expect(registered).toBe('synclab-native-insert');
  });
});
