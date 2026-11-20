import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — SYNCLAB" },
      { name: "description", content: "Choose a new password for your SYNCLAB account." },
      { property: "og:title", content: "Set a new password — SYNCLAB" },
      { property: "og:description", content: "Choose a new password for your SYNCLAB account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const hash = window.location.hash;
      const isRecovery = hash.includes("type=recovery");
      if (data.session || isRecovery) {
        setValidLink(true);
      }
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) setValidLink(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated", {
        description: "Use your new password next time you sign in.",
      });
      setPassword("");
      setConfirm("");
      void navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("rate limit") || msg.includes("too many")) {
        toast.error("Too many attempts right now. Wait a minute and try again.");
      } else if (msg.includes("at least 6")) {
        toast.error("Password must be at least 6 characters.");
      } else {
        toast.error(
          err instanceof Error
            ? err.message
            : "Could not update the password. Open the email link again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-background px-4 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center">
        <img
          src={synclabLogoAsset.url}
          alt="SYNCLAB"
          className="mb-5 size-16 rounded-xl border border-border object-cover"
        />
        <h1 className="font-display text-xl font-semibold">Set a new password</h1>
        {checking ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking your link…
          </p>
        ) : validLink ? (
          <>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Choose a new password for your SYNCLAB account.
            </p>
            <form onSubmit={submit} className="mt-6 w-full space-y-3">
              <Input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "WORKING…" : "SAVE NEW PASSWORD"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              This password-reset link has expired or was already used. Request a new one from the
              sign-in screen.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
