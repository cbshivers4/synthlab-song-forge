import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { TEST_MODE } from "../test-mode";
import { livePeers, PRESENCE_EVERY_MS, type Peer } from "./sync";

/**
 * One live connection to a shared song. Every edit, "still here" signal and catch-up copy is a
 * row in project_ops (only people in the song can read or write them); everyone listens for new
 * rows of their song. Rows from this same browser tab are ignored.
 */
export type OpKind = "hello" | "presence" | "leave" | "tracks" | "song";
export interface Op {
  id: number;
  kind: OpKind;
  client_id: string;
  user_id: string;
  payload: Record<string, unknown>;
}

export interface LiveState {
  projectId: string | null;
  connected: boolean;
  peers: Peer[];
  /** set when the connection was refused (removed from the song, signed out…) */
  problem: string | null;
}

let state: LiveState = { projectId: null, connected: false, peers: [], problem: null };
const listeners = new Set<() => void>();
const emit = (next: Partial<LiveState>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};
export const liveState = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export interface LiveHandlers {
  onOp: (op: Op, from: Peer | undefined) => void;
}

export class LiveSong {
  readonly clientId = crypto.randomUUID();
  readonly me: Peer;
  private peers = new Map<string, Peer>();
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(
    readonly projectId: string,
    me: { userId: string; name: string; email: string },
    private handlers: LiveHandlers,
  ) {
    const now = Date.now();
    this.me = { ...me, clientId: this.clientId, joinedAt: now, seenAt: now };
  }

  otherPeers(): Peer[] {
    return livePeers(this.peers.values());
  }

  async start() {
    if (TEST_MODE) return;
    emit({ projectId: this.projectId, connected: false, peers: [], problem: null });
    const channel = supabase.channel(`song-${this.projectId}-${this.clientId.slice(0, 8)}`).on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "project_ops",
        filter: `project_id=eq.${this.projectId}`,
      },
      (payload) => void this.receive(payload.new as Op),
    );
    this.channel = channel;
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          emit({ connected: true });
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          emit({ connected: false });
          resolve();
        }
      });
    });
    if (this.closed) return;
    this.send("hello", this.presence());
    this.timers.push(
      setInterval(() => this.send("presence", this.presence()), PRESENCE_EVERY_MS),
      setInterval(() => this.publishPeers(), 10_000),
    );
  }

  private presence() {
    return { name: this.me.name, email: this.me.email, joinedAt: this.me.joinedAt };
  }

  private publishPeers() {
    emit({ peers: this.otherPeers() });
  }

  private async receive(row: Op) {
    if (this.closed || row.client_id === this.clientId) return;
    let op = row;
    // Very large rows reach listeners without their contents: read the row itself.
    if (!op.payload || typeof op.payload !== "object" || !Object.keys(op.payload).length) {
      const { data } = await supabase
        .from("project_ops")
        .select("id,kind,client_id,user_id,payload")
        .eq("id", row.id)
        .maybeSingle();
      if (!data) return;
      op = data as unknown as Op;
    }
    const p = op.payload;
    if (op.kind === "hello" || op.kind === "presence") {
      const prev = this.peers.get(op.client_id);
      this.peers.set(op.client_id, {
        clientId: op.client_id,
        userId: op.user_id,
        name: String(p["name"] ?? "Someone"),
        email: String(p["email"] ?? ""),
        joinedAt: Number(p["joinedAt"] ?? Date.now()),
        seenAt: Date.now(),
      });
      if (!prev || op.kind === "hello") this.publishPeers();
      // say hi back so the newcomer sees who's already here
      if (op.kind === "hello") void this.send("presence", this.presence());
    } else if (op.kind === "leave") {
      this.peers.delete(op.client_id);
      this.publishPeers();
    } else {
      const to = p["to"];
      if (typeof to === "string" && to !== this.clientId) return;
      const peer = this.peers.get(op.client_id);
      if (peer) peer.seenAt = Date.now();
    }
    this.handlers.onOp(op, this.peers.get(op.client_id));
  }

  /** Sends one row; rows from this tab go out in order. */
  send(kind: OpKind, payload: Record<string, unknown>): Promise<boolean> {
    if (TEST_MODE || this.closed) return Promise.resolve(false);
    const run = this.queue.then(async () => {
      const { error } = await supabase.from("project_ops").insert({
        project_id: this.projectId,
        user_id: this.me.userId,
        client_id: this.clientId,
        kind,
        payload: payload as Json,
      });
      if (error) {
        if (error.code === "42501" || /row-level security/i.test(error.message))
          emit({ problem: "You're no longer in this shared song." });
        return false;
      }
      return true;
    });
    this.queue = run.catch(() => false);
    return run;
  }

  /** Best-effort goodbye so others see you leave straight away. */
  stop() {
    if (this.closed) return;
    void this.send("leave", {});
    this.closed = true;
    this.timers.forEach(clearInterval);
    if (this.channel) void supabase.removeChannel(this.channel);
    emit({ projectId: null, connected: false, peers: [], problem: null });
  }
}

export const MEMBERS_CHANGED = "synclab:song-members-changed";

export interface SongMember {
  id: string;
  email: string;
  ownerEmail: string;
  createdAt: string;
}

export async function listMembers(projectId: string): Promise<SongMember[]> {
  if (TEST_MODE) return [];
  const { data, error } = await supabase
    .from("project_members")
    .select("id,email,owner_email,created_at")
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    email: m.email,
    ownerEmail: m.owner_email,
    createdAt: m.created_at,
  }));
}

export async function inviteMember(projectId: string, email: string) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error("Sign in to share a song.");
  if ((user.email ?? "").toLowerCase() === email)
    throw new Error("That's your own email — you're already in this song.");
  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    email,
    invited_by: user.id,
    owner_email: user.email ?? "",
  });
  if (error) {
    if (error.code === "23505") throw new Error(`${email} is already invited.`);
    if (error.code === "42501" || /row-level security/i.test(error.message))
      throw new Error("Only the person who owns this song can invite people.");
    throw new Error(error.message);
  }
  document.dispatchEvent(new CustomEvent(MEMBERS_CHANGED));
}

export async function removeMember(id: string) {
  const { error } = await supabase.from("project_members").delete().eq("id", id);
  if (error) throw new Error(error.message);
  document.dispatchEvent(new CustomEvent(MEMBERS_CHANGED));
}

export const songLink = (projectId: string) =>
  `${window.location.origin}/?song=${encodeURIComponent(projectId)}`;
