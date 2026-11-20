import { expect, it, vi } from "vitest";
import { attachModularScope, modularScopeId, readModularScope } from "./modular-scopes";

it("sums actual voice taps and removes ended voices without changing audible connections", () => {
  const analyser = {
    fftSize: 0,
    disconnect: vi.fn(),
    getFloatTimeDomainData: (data: Float32Array) => data.fill(0.25),
  };
  const ctx = { createAnalyser: () => analyser } as unknown as BaseAudioContext;
  const source = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;
  const id = modularScopeId("track", "vco");
  expect(readModularScope(id)).toBeNull();
  const cleanup = attachModularScope(ctx, id, source);
  expect(readModularScope(id)?.[0]).toBe(0.25);
  expect(source.connect).toHaveBeenCalledWith(analyser);
  cleanup();
  expect(source.disconnect).toHaveBeenCalledWith(analyser);
  expect(readModularScope(id)).toBeNull();
});
