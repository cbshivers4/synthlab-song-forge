import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock("./library", () => ({ listLibrary: mocks.list, saveToLibrary: mocks.save }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { retainMedia, isSharedMedia } from "./media-library";
beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue([]); mocks.save.mockResolvedValue(undefined); });
describe("account media retention", () => {
  it("recognizes MP3 and MP4 without retaining unrelated downloads", async () => {
    expect(isSharedMedia("mix.MP3")).toBe(true);
    expect(isSharedMedia("film.mp4")).toBe(true);
    await retainMedia(new Blob(["zip"]), "project.zip");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("retains the original video and filename", async () => {
    const blob = new Blob(["video"]);
    await retainMedia(blob, "film.mp4");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ audio: blob, name: "film.mp4", location: "cloud", data: expect.objectContaining({ mediaType: "video", mimeType: "video/mp4", filename: "film.mp4" }) }));
  });
  it("does not duplicate retained content", async () => {
    const blob = new Blob(["audio"]);
    await retainMedia(blob, "mix.mp3");
    const call = mocks.save.mock.calls[0];
    if (!call) throw new Error("Expected a saved media item");
    const saved = call[0];
    mocks.list.mockResolvedValue([{ data: saved.data }]);
    await retainMedia(blob, "mix.mp3");
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("reports cloud save failures instead of claiming retention", async () => {
    mocks.save.mockRejectedValue(new Error("offline"));
    await expect(retainMedia(new Blob(["a"]), "mix.mp3")).rejects.toThrow("offline");
  });
});