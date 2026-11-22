import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { TEST_MODE } from "@/lib/synclab/test-mode";
import { isSupportAdmin } from "@/lib/synclab/support";
import {
  getNotifyPrefs,
  loadNotifyPrefs,
  saveNotifyPrefs,
  subscribeNotifyPrefs,
} from "@/lib/founder/notify-prefs";
import type { NotifyPrefs } from "@/lib/founder/notify-rules";
import { openFounderDashboard } from "@/lib/founder/links";

const ROWS: { key: Exclude<keyof NotifyPrefs, "desktop">; label: string; hint: string }[] = [
  {
    key: "signIns",
    label: "Someone signs in",
    hint: "Name, email, location, device and plan.",
  },
  {
    key: "appOpens",
    label: "Someone comes back to the app",
    hint: "Already signed in and opening SYNCLAB again after 6 hours or more.",
  },
  {
    key: "timeSpent",
    label: "Someone leaves, with the time they spent",
    hint: "When they close SYNCLAB: how many minutes it was on their screen.",
  },
  {
    key: "messages",
    label: "Someone messages you",
    hint: "Contact Support messages and Report a Problem reports.",
  },
];

/** Settings → Notifications: only the founder (admin) account sees and receives these. */
export function FounderNotificationSettings() {
  const prefs = useSyncExternalStore(subscribeNotifyPrefs, getNotifyPrefs, getNotifyPrefs);
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  useEffect(() => {
    if (TEST_MODE) return;
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id;
      if (!id || !(await isSupportAdmin(id))) {
        if (active) setState("denied");
        return;
      }
      await loadNotifyPrefs(id).catch(() => undefined);
      if (active) {
        setUserId(id);
        setState("ready");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading")
    return <p className="text-xs text-muted-foreground">Loading your notification settings…</p>;
  if (state === "denied" || !userId)
    return (
      <p className="text-xs text-muted-foreground">
        Notifications are only for the founder account.
      </p>
    );

  const save = async (patch: Partial<NotifyPrefs>) => {
    try {
      await saveNotifyPrefs(userId, patch);
    } catch {
      toast.error("Couldn't save that setting. Please try again.");
    }
  };

  const setDesktop = async (on: boolean) => {
    if (!on) return save({ desktop: false });
    if (typeof Notification === "undefined") {
      toast.error("This browser can't show desktop notifications.");
      return;
    }
    const result =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    setPermission(result);
    if (result !== "granted") {
      toast.error("Notifications are blocked for SYNCLAB", {
        description:
          "Allow notifications for this site in your browser's settings, then try again.",
      });
      return;
    }
    await save({ desktop: true });
  };

  return (
    <div className="space-y-1">
      <p className="pb-2 text-xs text-muted-foreground">
        Only you see these. Pop-ups appear on any screen while you have SYNCLAB open; your own
        sign-ins are never shown. Settings are saved to your account.
      </p>
      {ROWS.map((r) => (
        <label
          key={r.key}
          className="settings-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 py-2.5"
        >
          <span className="min-w-0">
            <span className="block text-sm">{r.label}</span>
            <span className="block text-xs text-muted-foreground">{r.hint}</span>
          </span>
          <Switch
            checked={prefs[r.key]}
            aria-label={r.label}
            onCheckedChange={(v) => void save({ [r.key]: v })}
          />
        </label>
      ))}
      <label className="settings-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 py-2.5">
        <span className="min-w-0">
          <span className="block text-sm">Desktop notifications</span>
          <span className="block text-xs text-muted-foreground">
            Also show them in your computer's notification area when SYNCLAB is open in another tab
            or behind other windows. Nothing arrives once SYNCLAB is fully closed.
            {permission === "denied" && " Notifications are currently blocked in this browser."}
            {permission === "unsupported" && " This browser doesn't support them."}
          </span>
        </span>
        <Switch
          checked={prefs.desktop && permission === "granted"}
          aria-label="Desktop notifications"
          disabled={permission === "unsupported"}
          onCheckedChange={(v) => void setDesktop(v)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 pt-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            toast("This is how a notification looks", {
              description: "Name · email · location · device · plan",
              duration: 6000,
            })
          }
        >
          Show a test pop-up
        </Button>
        <Button variant="outline" size="sm" onClick={() => openFounderDashboard("accounts")}>
          See time spent per person
        </Button>
      </div>
    </div>
  );
}
