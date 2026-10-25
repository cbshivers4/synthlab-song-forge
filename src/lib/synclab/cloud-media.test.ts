import { describe, expect, it } from "vitest";
import { mediaStorePlan } from "./cloud-media";

describe("mediaStorePlan", () => {
  it("uploads a newly loaded sample to its storage path", () => {
    expect(mediaStorePlan("blob:abc", undefined, "u/p/samples/s.wav")).toEqual({ upload: "u/p/samples/s.wav", cloudPath: "u/p/samples/s.wav" });
  });

  it("keeps the permanent path when a reopened project is saved again", () => {
    const signed = "https://storage.example/object/sign/synclab-cloud/u/p/samples/s.wav?token=abc";
    expect(mediaStorePlan(signed, "u/p/samples/s.wav", "u/p/samples/other.wav")).toEqual({ cloudPath: "u/p/samples/s.wav" });
  });

  it("never stores an expiring signed link as the path", () => {
    const signed = "https://storage.example/object/sign/x?token=abc";
    expect(mediaStorePlan(signed, signed, "u/p/a.wav")).toEqual({ url: signed });
  });
});
