import { useEffect, useRef, useState } from "react";
import { useLiveSong } from "./use-live-song";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/synclab/app-state";
import { getEngine } from "@/lib/synclab/audio-engine";
import { useStudio } from "@/lib/synclab/store";
import { TEST_MODE } from "@/lib/synclab/test-mode";
import type { Track } from "@/lib/synclab/types";
import { mediaUrls, shareableMedia } from "@/lib/synclab/collab/live-media";
import { listMembers, LiveSong, MEMBERS_CHANGED, type Op } from "@/lib/synclab/collab/live-song";
import {
  answersJoin,
  applyTrackChange,
  chunkTracks,
  shareableTrack,
  songKey,
  trackKey,
  type SharedSong,
} from "@/lib/synclab/collab/sync";

const CHUNK_BYTES = 300_000;
const FLUSH_MS = 150;

/**
 * Keeps a shared song in step with everyone else who has it open ("Live together").
 * Mounted once per layout. Saving stays manual: nothing here writes the saved song.
 */
export function CollabBridge() {
  const { tracks, collabSong, applyRemote } = useStudio();
  const { project } = useApp();
  const projectId = project?.id ?? null;
  const [shared, setShared] = useState(false);

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const songRef = useRef(collabSong);
  songRef.current = collabSong;
  const applyRef = useRef(applyRemote);
  applyRef.current = applyRemote;

  const liveRef = useRef<LiveSong | null>(null);
  const folderRef = useRef("");
  const known = useRef(new Map<string, string>());
  const knownOrder = useRef("");
  const knownSong = useRef("");
  const seenRefs = useRef(new Map<string, Track>());
  const dirty = useRef(new Set<string>());
  const removed = useRef(new Set<string>());
  const orderDirty = useRef(false);
  const songDirty = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef(false);
  const snapIds = useRef<Set<string> | null>(null);
  const caughtUp = useRef(false);

  // Is anyone else invited to this song? Only then does it connect.
  useEffect(() => {
    if (!projectId || TEST_MODE) {
      setShared(false);
      return;
    }
    let alive = true;
    const check = () =>
      void listMembers(projectId)
        .then((m) => alive && setShared(m.length > 0))
        .catch(() => {});
    check();
    document.addEventListener(MEMBERS_CHANGED, check);
    return () => {
      alive = false;
      document.removeEventListener(MEMBERS_CHANGED, check);
    };
  }, [projectId]);

  const remember = (list: Track[]) => {
    known.current = new Map(list.map((t) => [t.id, trackKey(t)]));
    knownOrder.current = list.map((t) => t.id).join(",");
    seenRefs.current = new Map(list.map((t) => [t.id, t]));
  };

  const shareAll = async (list: Track[]) =>
    Promise.all(list.map((t) => shareableMedia(shareableTrack(t), folderRef.current)));

  const flush = async () => {
    flushTimer.current = null;
    const live = liveRef.current;
    if (!live) return;
    if (flushing.current) {
      schedule();
      return;
    }
    flushing.current = true;
    try {
      const ids = [...dirty.current];
      dirty.current.clear();
      const gone = [...removed.current];
      removed.current.clear();
      const sendOrder = orderDirty.current;
      orderDirty.current = false;
      const current = tracksRef.current;
      const order = sendOrder ? current.map((t) => t.id) : null;
      const changed = ids
        .map((id) => current.find((t) => t.id === id))
        .filter((t): t is Track => !!t);
      if (changed.length || gone.length || order) {
        const chunks = changed.length ? chunkTracks(await shareAll(changed), CHUNK_BYTES) : [[]];
        for (const [i, chunk] of chunks.entries()) {
          const last = i === chunks.length - 1;
          await live.send("tracks", {
            upserts: chunk,
            removed: last ? gone : [],
            order: last ? order : null,
          });
        }
      }
      if (songDirty.current) {
        songDirty.current = false;
        await live.send("song", { song: songRef.current });
      }
    } finally {
      flushing.current = false;
    }
  };
  const schedule = () => {
    if (!flushTimer.current) flushTimer.current = setTimeout(() => void flush(), FLUSH_MS);
  };

  const sendSnapshot = async (to: string) => {
    const live = liveRef.current;
    if (!live) return;
    const list = tracksRef.current;
    const chunks = list.length ? chunkTracks(await shareAll(list), CHUNK_BYTES) : [[]];
    for (const [i, chunk] of chunks.entries()) {
      const last = i === chunks.length - 1;
      await live.send("tracks", {
        to,
        snapshot: last ? "final" : "chunk",
        upserts: chunk,
        removed: [],
        order: last ? list.map((t) => t.id) : null,
      });
    }
    await live.send("song", { to, song: songRef.current });
  };

  const onOp = (op: Op, from: { name: string } | undefined) => {
    const live = liveRef.current;
    if (!live) return;
    const p = op.payload;
    if (op.kind === "hello") {
      if (answersJoin(live.me, live.otherPeers(), op.client_id)) void sendSnapshot(op.client_id);
      toast(`${String(p["name"] ?? "Someone")} joined the song`);
      return;
    }
    if (op.kind === "tracks") {
      const upserts = Array.isArray(p["upserts"]) ? (p["upserts"] as Track[]) : [];
      let gone = Array.isArray(p["removed"]) ? (p["removed"] as string[]) : [];
      const order = Array.isArray(p["order"]) ? (p["order"] as string[]) : null;
      const snap = p["snapshot"];
      if (snap) {
        snapIds.current ??= new Set();
        for (const t of upserts) snapIds.current.add(t.id);
        if (snap === "final") {
          const keep = snapIds.current;
          gone = tracksRef.current.map((t) => t.id).filter((id) => !keep.has(id));
          snapIds.current = null;
        }
      }
      const before = tracksRef.current;
      const next = applyTrackChange(before, { upserts, removed: gone, order });
      const present = new Set(before.map((t) => t.id));
      for (const t of next) {
        known.current.set(t.id, trackKey(t));
        seenRefs.current.set(t.id, t);
      }
      for (const id of gone) {
        known.current.delete(id);
        seenRefs.current.delete(id);
      }
      knownOrder.current = next.map((t) => t.id).join(",");
      tracksRef.current = next;
      applyRef.current({ tracks: next, removedIds: gone.filter((id) => present.has(id)) });
      const engine = getEngine();
      if (engine.ctx)
        for (const t of upserts) for (const u of mediaUrls(t)) void engine.ensureBuffer(u);
      if (snap === "final" && !caughtUp.current) {
        caughtUp.current = true;
        toast.success(`You're in the song with ${from?.name ?? "the others"}`, {
          description: "You'll see each other's changes as they happen.",
        });
      }
      return;
    }
    if (op.kind === "song") {
      const song = p["song"] as Partial<SharedSong> | undefined;
      if (!song || typeof song !== "object") return;
      const merged = { ...songRef.current, ...song };
      knownSong.current = songKey(merged);
      songRef.current = merged;
      applyRef.current({ song });
    }
  };
  const onOpRef = useRef(onOp);
  onOpRef.current = onOp;

  // Connect while a shared song is open.
  useEffect(() => {
    if (!shared || !projectId) return;
    let cancelled = false;
    let live: LiveSong | null = null;
    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (cancelled || !user) return;
      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const name =
        String(meta?.["full_name"] ?? meta?.["name"] ?? "").trim() ||
        (user.email ?? "Someone").split("@")[0] ||
        "Someone";
      folderRef.current = `${user.id}/${projectId}/`;
      remember(tracksRef.current);
      knownSong.current = songKey(songRef.current);
      caughtUp.current = false;
      live = new LiveSong(
        projectId,
        { userId: user.id, name, email: user.email ?? "" },
        { onOp: (op, from) => onOpRef.current(op, from) },
      );
      liveRef.current = live;
      void live.start();
    });
    const bye = () => live?.stop();
    window.addEventListener("pagehide", bye);
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", bye);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = null;
      live?.stop();
      liveRef.current = null;
    };
  }, [shared, projectId]);

  // Your own edits go out to everyone else.
  useEffect(() => {
    if (!liveRef.current) return;
    let any = false;
    const ids = new Set<string>();
    for (const t of tracks) {
      ids.add(t.id);
      if (seenRefs.current.get(t.id) === t) continue;
      seenRefs.current.set(t.id, t);
      const key = trackKey(t);
      if (known.current.get(t.id) === key) continue;
      known.current.set(t.id, key);
      dirty.current.add(t.id);
      removed.current.delete(t.id);
      any = true;
    }
    for (const id of [...known.current.keys()]) {
      if (ids.has(id)) continue;
      known.current.delete(id);
      seenRefs.current.delete(id);
      dirty.current.delete(id);
      removed.current.add(id);
      any = true;
    }
    const order = tracks.map((t) => t.id).join(",");
    if (order !== knownOrder.current) {
      knownOrder.current = order;
      orderDirty.current = true;
      any = true;
    }
    if (any) schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks]);

  useEffect(() => {
    if (!liveRef.current) return;
    const key = songKey(collabSong);
    if (key === knownSong.current) return;
    knownSong.current = key;
    songDirty.current = true;
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabSong]);

  const { problem } = useLiveSong();
  useEffect(() => {
    if (problem) toast.error(problem, { description: "Your changes now stay on this device." });
  }, [problem]);

  return null;
}
