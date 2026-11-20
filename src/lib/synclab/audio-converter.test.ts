import { describe, expect, it, vi } from "vitest";
vi.mock("./media-library", () => ({ retainMediaInBackground: vi.fn() }));
import { conversionFilename, conversionSupported, convertAudio } from "./audio-converter";

describe("audio file conversion", () => {
  const cap = {
    left: new Float32Array([0.5, -0.5]),
    right: new Float32Array([0.25, -0.25]),
    sampleRate: 44100,
  };
  it("creates WAV audio with the requested mono channel count", async () => {
    const blob = await convertAudio(cap, "wav", 44100, 192, true, new AbortController().signal);
    const v = new DataView(await blob.arrayBuffer());
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getInt16(44, true)).toBe(12287);
    expect([...cap.left]).toEqual([0.5, -0.5]);
  });
  it("produces real AIFF and FLAC file signatures", async () => {
    for (const [fmt, signature] of [
      ["aiff", "FORM"],
      ["flac", "fLaC"],
    ] as const) {
      const blob = await convertAudio(cap, fmt, 44100, 192, false, new AbortController().signal);
      expect(new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 4))).toBe(signature);
    }
  });
  it("never disguises WebM Opus as another file type", () => {
    expect(conversionFilename("voice.m4a", "wav", "audio/wav")).toBe("voice-converted.wav");
    expect(conversionFilename("voice.wav", "opus", "audio/webm")).toBe("voice-converted.webm");
  });
  it("rejects unavailable M4A encoders instead of claiming conversion", async () => {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: () => false });
    expect(conversionSupported("m4a")).toBe(false);
    await expect(
      convertAudio(cap, "m4a", 44100, 192, false, new AbortController().signal),
    ).rejects.toThrow("unavailable");
    vi.unstubAllGlobals();
  });
  it("cancellation prevents creating a result", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      convertAudio(cap, "wav", 44100, 192, false, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
