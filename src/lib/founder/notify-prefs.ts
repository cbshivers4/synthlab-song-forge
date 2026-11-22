import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_NOTIFY_PREFS, prefsFromRow, rowFromPrefs, type NotifyPrefs } from "./notify-rules";

/**
 * The founder's notification settings, kept in the account (so they follow you between
 * computer and phone) with an in-memory copy the pop-ups read instantly.
 */
let current: NotifyPrefs = DEFAULT_NOTIFY_PREFS;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getNotifyPrefs = () => current;
export function subscribeNotifyPrefs(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export async function loadNotifyPrefs(userId: string): Promise<NotifyPrefs> {
  const { data, error } = await supabase
    .from("founder_notification_prefs")
    .select("sign_ins,app_opens,time_spent,messages,desktop")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  current = prefsFromRow(data);
  loadedFor = userId;
  emit();
  return current;
}

export async function saveNotifyPrefs(userId: string, patch: Partial<NotifyPrefs>) {
  const before = current;
  current = { ...current, ...patch };
  emit();
  const { error } = await supabase
    .from("founder_notification_prefs")
    .upsert(
      { user_id: userId, ...rowFromPrefs(current), updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) {
    current = before;
    emit();
    throw error;
  }
}

export const notifyPrefsLoadedFor = () => loadedFor;

/** Browser notification while SYNCLAB is open but not on screen (another tab or app in front). */
export function desktopNotify(title: string, body: string, onClick?: () => void) {
  if (!current.desktop || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted" || document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.png",
      tag: `${title}:${body}`,
      // stays until dismissed, like the in-app pop-up
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* some phones only allow notifications from an installed app */
  }
}
