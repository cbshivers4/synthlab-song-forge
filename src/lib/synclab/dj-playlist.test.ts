import { describe, expect, it } from "vitest";
import { createPlaylistStore, memoryBackend } from "./dj-playlist-store";
import { addToPlaylist, audioKey, moveInPlaylist, playlistChanged, playlistName, removeFromPlaylist, unusedAudio, type Playlist, type PlaylistTrack } from "./dj-playlist";

let n = 0;
const id = () => `t${++n}`;
const file = (name: string, size = 1000) => ({ key: audioKey({ name, size }), name, size });

describe("DJ playlists", () => {
  it("adds files in order and skips a file already in the list", () => {
    const first = addToPlaylist([], [file("a.mp3"), file("b.mp3")], id);
    const again = addToPlaylist(first.tracks, [file("b.mp3"), file("c.wav")], id);
    expect(again.tracks.map((t) => t.name)).toEqual(["a.mp3", "b.mp3", "c.wav"]);
    expect(again.duplicates).toBe(1);
  });

  it("removes only the chosen entry", () => {
    const { tracks } = addToPlaylist([], [file("a.mp3"), file("b.mp3"), file("c.mp3")], id);
    expect(removeFromPlaylist(tracks, tracks[1]!.id).map((t) => t.name)).toEqual(["a.mp3", "c.mp3"]);
  });

  it("moves an entry up and down, and the ends stay put", () => {
    const { tracks } = addToPlaylist([], [file("a"), file("b"), file("c")], id);
    expect(moveInPlaylist(tracks, tracks[2]!.id, -1).map((t) => t.name)).toEqual(["a", "c", "b"]);
    expect(moveInPlaylist(tracks, tracks[0]!.id, -1)).toBe(tracks);
  });

  it("names an unnamed playlist and never repeats another playlist's name", () => {
    expect(playlistName("  ", [])).toBe("Playlist 1");
    expect(playlistName("", ["Playlist 1"])).toBe("Playlist 2");
    expect(playlistName("Friday  set", ["friday set"])).toBe("Friday set (2)");
  });

  it("deleting a playlist frees only audio no other saved playlist uses", () => {
    const t = (key: string): PlaylistTrack => ({ id: key, key, name: key, size: 1, duration: null });
    const keep: Playlist = { id: "p2", name: "Keep", tracks: [t("shared")], savedAt: 1 };
    expect(unusedAudio(["shared", "only-deleted"], [keep])).toEqual(["only-deleted"]);
  });

  it("saves a playlist, reopens it, and deleting it keeps music another playlist still lists", async () => {
    const storage = memoryBackend();
    const s = createPlaylistStore(storage);
    const shared = new File([new Uint8Array(10)], "shared.mp3", { type: "audio/mpeg" });
    const solo = new File([new Uint8Array(20)], "solo.wav", { type: "audio/wav" });
    s.addFiles([shared, solo]);
    const first = await s.save("Friday set");
    s.newPlaylist();
    s.addFiles([shared]);
    const second = await s.save("Saturday");
    expect(s.saved.map((p) => p.name).sort()).toEqual(["Friday set", "Saturday"]);
    s.open(first.id);
    expect(s.tracks.map((t) => t.name)).toEqual(["shared", "solo"]);
    expect(s.dirty).toBe(false);
    await s.deletePlaylist(first.id);
    expect(s.saved.map((p) => p.id)).toEqual([second.id]);
    expect(s.currentId).toBeNull();
    expect(await storage.hasAudio(audioKey(solo))).toBe(false);
    // after a reload, the remaining playlist still plays the shared file
    const reloaded = createPlaylistStore(storage);
    await reloaded.init();
    reloaded.open(second.id);
    expect(await reloaded.audioFor(reloaded.tracks[0]!)).not.toBeNull();
  });

  it("knows when there are unsaved changes", () => {
    const { tracks } = addToPlaylist([], [file("a"), file("b")], id);
    const saved = { name: "Set", tracks };
    expect(playlistChanged("Set", tracks, saved)).toBe(false);
    expect(playlistChanged("Set", [...tracks].reverse(), saved)).toBe(true);
    expect(playlistChanged("Set", [], null)).toBe(false);
  });
});
