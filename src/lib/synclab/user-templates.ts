import type { CloudSession } from "./cloud";

/** A session the user saved as a reusable starting point, kept on this computer. */
export interface UserTemplate {
  id: string;
  name: string;
  bpm: number;
  savedAt: number;
  trackCount: number;
  session: CloudSession;
}

const KEY = "synclab.templates.v1";

export function listUserTemplates(): UserTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as UserTemplate[]) : [];
  } catch {
    return [];
  }
}

function write(list: UserTemplate[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    throw new Error("This computer's storage is full — remove a template and try again.");
  }
}

export function saveUserTemplate(name: string, session: CloudSession): UserTemplate {
  const tpl: UserTemplate = {
    id: `tpl-${Date.now()}`,
    name,
    bpm: session.transport?.bpm ?? 128,
    savedAt: Date.now(),
    trackCount: session.tracks?.length ?? 0,
    session,
  };
  write([tpl, ...listUserTemplates().filter((t) => t.name !== name)].slice(0, 20));
  return tpl;
}

export function removeUserTemplate(id: string) {
  write(listUserTemplates().filter((t) => t.id !== id));
}
