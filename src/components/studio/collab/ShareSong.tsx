import { useEffect, useState } from "react";
import { Copy, Loader2, Mail, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/synclab/app-state";
import {
  inviteMember,
  listMembers,
  MEMBERS_CHANGED,
  removeMember,
  songLink,
  type SongMember,
} from "@/lib/synclab/collab/live-song";
import { cleanEmail, initials } from "@/lib/synclab/collab/sync";
import { TEST_MODE } from "@/lib/synclab/test-mode";
import { useLiveSong } from "./use-live-song";

/** Top-bar Share button: shows who's in the song right now and opens the invite window. */
export function ShareSongButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const live = useLiveSong();
  const here = live.connected ? live.peers : [];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          here.length
            ? `Share song — ${here.length} other ${here.length === 1 ? "person" : "people"} here`
            : "Share song"
        }
        title="Work on this song with other people"
        className="ml-2 flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] border border-border px-2 font-mono text-[10px] font-semibold tracking-widest uppercase text-foreground hover:border-primary hover:text-primary"
      >
        {here.length ? (
          <span className="flex -space-x-1.5">
            {here.slice(0, 3).map((p) => (
              <span
                key={p.clientId}
                title={`${p.name} is in the song`}
                className="flex size-5 items-center justify-center rounded-full border border-background bg-primary text-[8px] text-primary-foreground"
              >
                {initials(p.name)}
              </span>
            ))}
          </span>
        ) : (
          <Users className="size-3.5" />
        )}
        {!compact && (here.length ? `Live · ${here.length + 1}` : "Share")}
      </button>
      <ShareSongDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ShareSongDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { project } = useApp();
  const live = useLiveSong();
  const [members, setMembers] = useState<SongMember[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [myEmail, setMyEmail] = useState("");
  const id = project?.id;
  const owner = !project?.shared;

  useEffect(() => {
    if (!open || !id || TEST_MODE) return;
    let alive = true;
    const load = () =>
      void listMembers(id)
        .then((m) => alive && setMembers(m))
        .catch(() => alive && setMembers([]));
    load();
    void supabase.auth.getUser().then(({ data }) => alive && setMyEmail(data.user?.email ?? ""));
    document.addEventListener(MEMBERS_CHANGED, load);
    return () => {
      alive = false;
      document.removeEventListener(MEMBERS_CHANGED, load);
    };
  }, [open, id]);

  const invite = async () => {
    if (!id) return;
    const clean = cleanEmail(email);
    if (!clean) {
      toast.error("Type a full email address, like name@example.com");
      return;
    }
    setBusy(true);
    try {
      await inviteMember(id, clean);
      setEmail("");
      toast.success(`${clean} can now open this song`, {
        description: "Send them the link so they know — SYNCLAB doesn't email invitations.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't invite them");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(songLink(id));
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link", { description: songLink(id) });
    }
  };

  const mailto = (to: string) => {
    if (!id || !project) return "#";
    const subject = `Work on “${project.name}” with me in SYNCLAB`;
    const body = `I've invited you to my song “${project.name}” in SYNCLAB so we can work on it together live.\n\nSign in with this email (${to}) and open:\n${songLink(id)}\n\nIt's also under Recent files, marked “Shared with you”.`;
    return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const leave = async (m: SongMember) => {
    setBusy(true);
    try {
      await removeMember(m.id);
      toast.success(owner ? `${m.email} was removed from the song` : "You left the song", {
        description: owner
          ? undefined
          : "It stays open on this device; it's gone from your Recent files.",
      });
      if (!owner) onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't do that");
    } finally {
      setBusy(false);
    }
  };

  const mine = members?.find((m) => m.email.toLowerCase() === myEmail.toLowerCase());
  const ownerEmail = members?.[0]?.ownerEmail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="app-menu sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Work on this song together</DialogTitle>
          <DialogDescription>
            Everyone in the song sees each other's changes as they happen. Each person plays and
            records on their own device. File → Save saves the song for everyone.
          </DialogDescription>
        </DialogHeader>

        {TEST_MODE ? (
          <p className="text-sm text-muted-foreground">Sharing is off in test mode.</p>
        ) : !id ? (
          <p className="rounded-sm border border-border bg-surface-2 p-3 text-sm">
            Save this song first (File → Save). Then you can invite people to it.
          </p>
        ) : (
          <div className="space-y-4">
            {live.connected && (
              <div>
                <div className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  In the song now
                </div>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary" /> You
                  </li>
                  {live.peers.map((p) => (
                    <li key={p.clientId} className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-primary" />
                      {p.name}
                      <span className="truncate text-xs text-muted-foreground">{p.email}</span>
                    </li>
                  ))}
                  {!live.peers.length && (
                    <li className="text-xs text-muted-foreground">
                      Nobody else has it open right now.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {owner && (
              <div className="space-y-2">
                <label
                  htmlFor="invite-email"
                  className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
                >
                  Invite by email
                </label>
                <div className="flex gap-2">
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    maxLength={254}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void invite();
                    }}
                  />
                  <Button onClick={() => void invite()} disabled={busy || !email.trim()}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : "Invite"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  They sign in to SYNCLAB with that email and find the song under Recent files.
                  Saving changes needs a plan or the free trial.
                </p>
              </div>
            )}

            <div>
              <div className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                {owner ? "Invited" : `Shared by ${ownerEmail || "the owner"}`}
              </div>
              {members === null ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : members.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nobody invited yet.</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-sm border border-border">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">{m.email}</span>
                      {owner && (
                        <>
                          <a
                            href={mailto(m.email)}
                            className="rounded-sm p-1 text-muted-foreground hover:text-primary"
                            aria-label={`Email the invite to ${m.email}`}
                            title="Email them the link"
                          >
                            <Mail className="size-4" />
                          </a>
                          <button
                            type="button"
                            className="rounded-sm p-1 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${m.email}`}
                            title="Remove from song"
                            disabled={busy}
                            onClick={() => void leave(m)}
                          >
                            <UserMinus className="size-4" />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                <Copy className="size-3.5" /> Copy song link
              </Button>
              {!owner && mine && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => void leave(mine)}
                >
                  Leave this song
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              If two people change the same channel at the same moment, the last change wins. Undo
              only steps back through your own changes.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
