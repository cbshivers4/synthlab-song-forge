/**
 * Mounted once in the root layout for every signed-in person: reports how long the app is
 * actually on screen (in one-minute beats, only while visible) and closes the visit when the
 * page is closed, so the founder dashboard can show time spent. Nothing runs in test mode.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { visitBeat } from "@/utils/founder.functions";
import { TEST_MODE } from "@/lib/synclab/test-mode";
import { BEAT_MS } from "@/lib/founder/visits";

export function VisitTracker() {
  useEffect(() => {
    if (TEST_MODE) return;
    let userId: string | null = null;
    let token: string | null = null;
    let visitId: string | null = null;
    let starting: Promise<void> | null = null;
    /** start of the on-screen stretch not yet reported (null while hidden) */
    let shownSince: number | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const takeSeconds = () => {
      if (shownSince === null) return 0;
      const now = Date.now();
      const s = (now - shownSince) / 1000;
      shownSince = document.visibilityState === "visible" ? now : null;
      return s;
    };
    const beat = (ended = false) => {
      if (!userId || !visitId) return;
      const seconds = takeSeconds();
      void visitBeat({ data: { visitId, seconds, ...(ended ? { ended } : {}) } })
        .then((r) => {
          if (r.visitId) visitId = r.visitId;
        })
        .catch(() => undefined);
    };
    const start = () => {
      if (starting || visitId) return;
      shownSince = document.visibilityState === "visible" ? Date.now() : null;
      starting = visitBeat({ data: { seconds: 0 } })
        .then((r) => {
          visitId = r.visitId;
        })
        .catch(() => undefined)
        .finally(() => {
          starting = null;
        });
      if (!timer)
        timer = setInterval(() => {
          if (document.visibilityState === "visible") beat();
        }, BEAT_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      visitId = null;
      shownSince = null;
    };

    const onVisibility = () => {
      if (!visitId) return;
      if (document.visibilityState === "visible") shownSince ??= Date.now();
      else beat();
    };
    // A closing page can only send a keep-alive request; the route checks the sign-in token.
    const onPageHide = () => {
      if (!visitId || !token) return;
      const seconds = takeSeconds();
      try {
        void fetch("/api/public/visit-end", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, visitId, seconds }),
        });
      } catch {
        /* the visit will be treated as finished once it stops reporting */
      }
      // Coming back from the browser's page cache picks the same visit up again.
      visitId = null;
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && userId) start();
    };

    const onSession = (s: { access_token: string; user: { id: string } } | null) => {
      token = s?.access_token ?? null;
      if (!s) {
        userId = null;
        stop();
        return;
      }
      if (userId === s.user.id) return;
      stop();
      userId = s.user.id;
      start();
    };
    void supabase.auth.getSession().then(({ data }) => onSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => onSession(session));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      stop();
    };
  }, []);
  return null;
}
