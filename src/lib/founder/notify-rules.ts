/** The founder's notification choices (pure: shared by the alerts, Settings and tests). */
export interface NotifyPrefs {
  signIns: boolean;
  appOpens: boolean;
  timeSpent: boolean;
  messages: boolean;
  desktop: boolean;
}

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  signIns: true,
  appOpens: true,
  timeSpent: true,
  messages: true,
  desktop: false,
};

export interface NotifyPrefsRow {
  sign_ins: boolean;
  app_opens: boolean;
  time_spent: boolean;
  messages: boolean;
  desktop: boolean;
}

export const prefsFromRow = (row: NotifyPrefsRow | null): NotifyPrefs =>
  row
    ? {
        signIns: row.sign_ins,
        appOpens: row.app_opens,
        timeSpent: row.time_spent,
        messages: row.messages,
        desktop: row.desktop,
      }
    : DEFAULT_NOTIFY_PREFS;

export const rowFromPrefs = (p: NotifyPrefs): NotifyPrefsRow => ({
  sign_ins: p.signIns,
  app_opens: p.appOpens,
  time_spent: p.timeSpent,
  messages: p.messages,
  desktop: p.desktop,
});

export type AlertKind = "sign_in" | "open" | "left" | "message";

/** Whether a pop-up of this kind should be shown with these settings. */
export function wantsAlert(kind: AlertKind, p: NotifyPrefs): boolean {
  if (kind === "sign_in") return p.signIns;
  if (kind === "open") return p.appOpens;
  if (kind === "left") return p.timeSpent;
  return p.messages;
}
