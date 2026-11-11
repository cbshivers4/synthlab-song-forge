import { describe, expect, it } from "vitest";
import { systemAudioSupport, recordingExt, type SystemEnv } from "./sample-sources";

const desktop: SystemEnv = { hasDisplayMedia: true, apple: false, android: false, touchOnly: false, framed: false };

describe("computer sound sampling support", () => {
  it("is offered on a Windows computer with screen sharing, ticking system audio", () => {
    const r = systemAudioSupport(desktop, "Win32");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tip).toMatch(/system audio/);
  });
  it("tells Mac users to share a tab's audio", () => {
    const r = systemAudioSupport(desktop, "MacIntel");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tip).toMatch(/tab audio/);
  });
  it("is never offered on iPhone/iPad or Android, which block hearing other apps", () => {
    expect(systemAudioSupport({ ...desktop, apple: true }).ok).toBe(false);
    expect(systemAudioSupport({ ...desktop, android: true }).ok).toBe(false);
  });
  it("is not offered when the browser has no screen sharing", () => {
    expect(systemAudioSupport({ ...desktop, hasDisplayMedia: false }).ok).toBe(false);
  });
  it("names takes after the recorder's real format", () => {
    expect(recordingExt("audio/webm;codecs=opus")).toBe("webm");
    expect(recordingExt("audio/mp4")).toBe("m4a");
  });
});
