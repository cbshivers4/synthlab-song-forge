/**
 * Mounted once in the root layout.
 * 1. Every signed-in visit tells the server (which records a sign-in or app opening
 *    with its location; repeat calls in the same visit are ignored there).
 * 2. For the founder (admin role) only: live pop-ups when someone else signs in or
 *    sends a support message, on any screen. The dashboard opens in a new tab so an
 *    unsaved song in the studio is never closed.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { recordSignIn } from "@/utils/founder.functions";
import { isSupportAdmin } from "@/lib/synclab/support";
import { TEST_MODE } from "@/lib/synclab/test-mode";
import { MARKETING_OPT_IN_KEY, formatPlace } from "@/lib/founder/insights";
import { countryName, openFounderDashboard } from "@/lib/founder/links";

export function FounderAlerts() {
  const recorded = useRef<string | null>(null);
  const watching = useRef<string | null>(null);

  useEffect(() => {
    if (TEST_MODE) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const stopWatching = () => {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      watching.current = null;
    };

    const watch = async (userId: string) => {
      if (watching.current === userId) return;
      stopWatching();
      if (!(await isSupportAdmin(userId))) return;
      watching.current = userId;
      channel = supabase
        .channel(`founder-alerts-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "login_events" },
          (payload) => {
            const e = payload.new as {
              user_id: string;
              kind: string;
              name: string;
              email: string;
              city: string;
              region: string;
              country: string;
              timezone: string;
              device: string;
              plan: string;
            };
            if (e.user_id === userId) return;
            toast(`${e.name || e.email} ${e.kind === "sign_in" ? "signed in" : "opened SYNCLAB"}`, {
              description: `${e.email} · ${formatPlace(e, countryName)} · ${e.device} · ${e.plan.toUpperCase()}`,
              duration: 12_000,
              action: { label: "View", onClick: () => openFounderDashboard("logins") },
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "support_tickets" },
          (payload) => {
            const t = payload.new as { name: string; email: string; subject: string; kind: string };
            toast(`New ${t.kind === "problem" ? "problem report" : "support message"}`, {
              description: `${t.name || t.email}: ${t.subject}`,
              duration: 15_000,
              action: { label: "Read", onClick: () => openFounderDashboard("messages") },
            });
          },
        )
        .subscribe();
    };

    const onSession = (session: { access_token: string; user: { id: string } } | null) => {
      if (!session) {
        recorded.current = null;
        stopWatching();
        return;
      }
      void watch(session.user.id);
      if (recorded.current === session.user.id) return;
      recorded.current = session.user.id;
      let optIn = false;
      try {
        optIn = localStorage.getItem(MARKETING_OPT_IN_KEY) === "1";
      } catch {
        /* storage unavailable */
      }
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
      recordSignIn({ data: { timezone, ...(optIn ? { marketingOptIn: true } : {}) } })
        .then(() => {
          if (optIn) localStorage.removeItem(MARKETING_OPT_IN_KEY);
        })
        .catch((err: unknown) => {
          recorded.current = null;
          console.warn("sign-in history not recorded", err);
        });
    };

    void supabase.auth.getSession().then(({ data }) => onSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") onSession(session);
    });
    return () => {
      sub.subscription.unsubscribe();
      stopWatching();
    };
  }, []);

  return null;
}
