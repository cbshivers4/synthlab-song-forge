import { describe, expect, it } from "vitest";
import {
  answersJoin,
  applyTrackChange,
  chunkTracks,
  cleanEmail,
  livePeers,
  trackKey,
  type Peer,
} from "./sync";
import type { Track } from "../types";

const t = (id: string, over: Partial<Track> = {}) =>
  ({ id, name: id, volume: 0.8, armed: false, ...over }) as Track;
const peer = (clientId: string, joinedAt: number, seenAt = Date.now()): Peer => ({
  clientId,
  userId: clientId,
  name: clientId,
  email: `${clientId}@x.com`,
  joinedAt,
  seenAt,
});

describe("live song sync", () => {
  it("someone else's change replaces the channel but keeps my record-arm", () => {
    const out = applyTrackChange([t("a", { armed: true, volume: 0.5 })], {
      upserts: [t("a", { volume: 0.2 })],
      removed: [],
      order: null,
    });
    expect(out[0]).toMatchObject({ volume: 0.2, armed: true });
  });
  it("adds, removes and reorders channels", () => {
    const out = applyTrackChange([t("a"), t("b"), t("c")], {
      upserts: [t("d")],
      removed: ["b"],
      order: ["d", "c", "a"],
    });
    expect(out.map((x) => x.id)).toEqual(["d", "c", "a"]);
  });
  it("arming a channel is not a change others need", () => {
    expect(trackKey(t("a", { armed: true }))).toBe(trackKey(t("a")));
    expect(trackKey(t("a", { volume: 0.1 }))).not.toBe(trackKey(t("a")));
  });
  it("splits big sends into chunks", () => {
    const big = Array.from({ length: 5 }, (_, i) => t(`t${i}`, { name: "x".repeat(1000) }));
    expect(chunkTracks(big, 2500).map((c) => c.length)).toEqual([2, 2, 1]);
  });
  it("people silent for 50 seconds have left", () => {
    expect(
      livePeers([peer("a", 1, Date.now() - 60_000), peer("b", 2)]).map((p) => p.clientId),
    ).toEqual(["b"]);
  });
  it("only the person in the song longest sends it to a newcomer", () => {
    const me = peer("me", 5);
    expect(answersJoin(me, [peer("old", 1), peer("new", 9)], "new")).toBe(false);
    expect(answersJoin(me, [peer("new", 9)], "new")).toBe(true);
  });
  it("checks invite emails", () => {
    expect(cleanEmail(" Jane@Example.com ")).toBe("jane@example.com");
    expect(cleanEmail("nope")).toBeNull();
  });
});
