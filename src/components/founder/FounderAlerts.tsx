/**
 * Mounted once in the root layout.
 * 1. Every signed-in visit tells the server (which records a sign-in or app opening
 *    with its location; repeat calls in the same visit are ignored there).
 * 2. For the founder (admin role) only: live pop-ups when someone else signs in, opens
 *    the app, leaves it (with the time they spent) or sends a support message, on any
 *    screen, each switchable in Settings → Notifications (plus optional desktop
 *    notifications). The dashboard opens in a new tab so an unsaved song is never closed.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { recordSignIn } from "@/utils/founder.functions";
import { isSupportAdmin } from "@/lib/synclab/support";
import { TEST_MODE } from "@/lib/synclab/test-mode";
import { MARKETING_OPT_IN_KEY, formatPlace } from "@/lib/founder/insights";
import { countryName, openFounderDashboard } from "@/lib/founder/links";
import { desktopNotify, getNotifyPrefs, loadNotifyPrefs } from "@/lib/founder/notify-prefs";
import { wantsAlert } from "@/lib/founder/notify-rules";
import { LEFT_CONFIRM_MS, formatDuration } from "@/lib/founder/visits";

/** One pop-up (and a desktop notification when the app isn't on screen). */
function alert(title: string, description: string, label: string, open: () => void, ms: number) {
  toast(title, { description, duration: ms, action: { label, onClick: open } });
  desktopNotify(title, description, open);
}

export function FounderAlerts() {
  const recorded = useRef<string | null>(null);
  const watching = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (TEST_MODE) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const leftTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const toldLeft = new Set<string>();

    const stopWatching = () => {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      leftTimers.forEach((t) => clearTimeout(t));
      leftTimers.clear();
      watching.current = null;
    };

    const watch = async (userId: string) => {
      if (watching.current === userId) return;
      stopWatching();
      if (!(await isSupportAdmin(userId))) return;
      watching.current = userId;
      await loadNotifyPrefs(userId).catch(() => undefined);
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
            void queryClient.invalidateQueries({ queryKey: ["founder"] });
            if (e.user_id === userId) return;
            if (!wantsAlert(e.kind === "sign_in" ? "sign_in" : "open", getNotifyPrefs())) return;
            alert(
              `${e.name || e.email} ${e.kind === "sign_in" ? "signed in" : "opened SYNCLAB"}`,
              `${e.email} · ${formatPlace(e, countryName)} · ${e.device} · ${e.plan.toUpperCase()}`,
              "View",
              () => openFounderDashboard("logins"),
              12_000,
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "support_tickets" },
          (payload) => {
            void queryClient.invalidateQueries({ queryKey: ["founder", "messages"] });
            const t = payload.new as { name: string; email: string; subject: string; kind: string };
            if (!wantsAlert("message", getNotifyPrefs())) return;
            alert(
              `New ${t.kind === "problem" ? "problem report" : "support message"}`,
              `${t.name || t.email}: ${t.subject}`,
              "Read",
              () => openFounderDashboard("messages"),
              15_000,
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "app_visits" },
          (payload) => {
            const v = payload.new as { id: string; user_id: string; ended_at: string | null };
            if (!v.ended_at || v.user_id === userId || toldLeft.has(v.id)) return;
            if (leftTimers.has(v.id)) clearTimeout(leftTimers.get(v.id));
            // Wait a moment: a page reload ends a visit and picks it straight up again.
            leftTimers.set(
              v.id,
              setTimeout(() => {
                leftTimers.delete(v.id);
                if (!wantsAlert("left", getNotifyPrefs())) return;
                void supabase
                  .from("app_visits")
                  .select("id,name,email,device,active_seconds,ended_at")
                  .eq("id", v.id)
                  .maybeSingle()
                  .then(({ data }) => {
                    if (!data?.ended_at || toldLeft.has(data.id)) return;
                    toldLeft.add(data.id);
                    void queryClient.invalidateQueries({ queryKey: ["founder"] });
                    alert(
                      `${data.name || data.email} left SYNCLAB`,
                      `Spent ${formatDuration(data.active_seconds)} in the app · ${data.email} · ${data.device}`,
                      "View",
                      () => openFounderDashboard("accounts"),
                      12_000,
                    );
                  });
              }, LEFT_CONFIRM_MS),
            );
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
  }, [queryClient]);

  return null;
}
