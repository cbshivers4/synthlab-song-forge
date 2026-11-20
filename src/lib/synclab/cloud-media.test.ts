import { describe, expect, it } from "vitest";
import { drumSamplePlan, mediaStorePlan } from "./cloud-media";

describe("mediaStorePlan", () => {
  it("uploads a newly loaded sample to its storage path", () => {
    expect(mediaStorePlan("blob:abc", undefined, "u/p/samples/s.wav")).toEqual({
      upload: "u/p/samples/s.wav",
      cloudPath: "u/p/samples/s.wav",
    });
  });

  it("keeps the permanent path when a reopened project is saved again", () => {
    const signed = "https://storage.example/object/sign/synclab-cloud/u/p/samples/s.wav?token=abc";
    expect(mediaStorePlan(signed, "u/p/samples/s.wav", "u/p/samples/other.wav")).toEqual({
      cloudPath: "u/p/samples/s.wav",
    });
  });

  it("never stores an expiring signed link as the path", () => {
    const signed = "https://storage.example/object/sign/x?token=abc";
    expect(mediaStorePlan(signed, signed, "u/p/a.wav")).toEqual({ url: signed });
  });
});

describe("drumSamplePlan", () => {
  const newPath = "u/p/drums/t-pad-kick.wav";
  it("pads without a sample keep everything as is", () => {
    expect(drumSamplePlan(undefined, "u/p/drums/old.wav", newPath, "u/p/")).toEqual({
      kind: "none",
    });
  });
  it("a new sample is copied into the project", () => {
    expect(drumSamplePlan("blob:x", undefined, newPath, "u/p/")).toEqual({
      kind: "copy",
      from: "blob:x",
      cloudPath: newPath,
    });
  });
  it("a reopened project keeps its stored copy without uploading again", () => {
    expect(
      drumSamplePlan("https://s/sign/u/p/drums/a.wav?token=1", "u/p/drums/a.wav", newPath, "u/p/"),
    ).toEqual({ kind: "keep", cloudPath: "u/p/drums/a.wav" });
  });
  it("a sample from a web link or app file is copied, not left pointing elsewhere", () => {
    expect(drumSamplePlan("https://example.com/kick.wav", undefined, newPath, "u/p/")).toEqual({
      kind: "copy",
      from: "https://example.com/kick.wav",
      cloudPath: newPath,
    });
    expect(drumSamplePlan("/assets/kick-abc.wav", undefined, newPath, "u/p/")).toEqual({
      kind: "copy",
      from: "/assets/kick-abc.wav",
      cloudPath: newPath,
    });
  });
  it("a copy stored by another project is copied into this one", () => {
    const signed = "https://s/sign/u/other/drums/a.wav?token=1";
    expect(drumSamplePlan(signed, "u/other/drums/a.wav", newPath, "u/p/")).toEqual({
      kind: "copy",
      from: signed,
      cloudPath: newPath,
    });
  });
  it("an old save that stored an expiring link as the path is copied again", () => {
    const signed = "https://s/sign/x?token=old";
    expect(drumSamplePlan(signed, signed, newPath, "u/p/")).toEqual({
      kind: "copy",
      from: signed,
      cloudPath: newPath,
    });
  });
});
