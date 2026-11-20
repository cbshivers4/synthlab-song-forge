import { supabase } from "@/integrations/supabase/client";
import { KNOWLEDGE_BASE, type Article } from "./help-articles";

export const SYNCLAB_VERSION = "1.0.0";
export const SYNCLAB_NAME = "SYNCLAB";
export const SYNCLAB_TAGLINE = "Create. Record. Produce. Finish.";

export type SupportSettings = {
  support_email: string;
  support_website: string;
  help_center_url: string;
  knowledge_base_url: string;
  terms_url: string;
  privacy_url: string;
  status_url: string;
  community_url: string;
  tutorials_url: string;
};

export const EMPTY_SETTINGS: SupportSettings = {
  support_email: "",
  support_website: "",
  help_center_url: "",
  knowledge_base_url: "",
  terms_url: "/terms",
  privacy_url: "/privacy",
  status_url: "",
  community_url: "",
  tutorials_url: "",
};

export async function loadSupportSettings(): Promise<SupportSettings> {
  const { data, error } = await supabase
    .from("support_settings")
    .select(
      "support_email,support_website,help_center_url,knowledge_base_url,terms_url,privacy_url,status_url,community_url,tutorials_url",
    )
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return EMPTY_SETTINGS;
  return { ...EMPTY_SETTINGS, ...(data as Partial<SupportSettings>) };
}

export async function saveSupportSettings(s: SupportSettings): Promise<string | null> {
  const { error } = await supabase
    .from("support_settings")
    .update({ ...s, updated_at: new Date().toISOString() })
    .eq("id", true);
  return error ? error.message : null;
}

export async function isSupportAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export type TicketInput = {
  kind: "support" | "problem";
  name: string;
  email: string;
  category: string;
  subject: string;
  description: string;
  expected?: string;
  steps?: string;
  project_name?: string;
  diagnostics?: Record<string, unknown>;
};

export async function submitTicket(userId: string, t: TicketInput): Promise<string | null> {
  const { error } = await supabase.from("support_tickets").insert({
    user_id: userId,
    kind: t.kind,
    name: t.name,
    email: t.email,
    category: t.category,
    subject: t.subject,
    description: t.description,
    expected: t.expected ?? "",
    steps: t.steps ?? "",
    project_name: t.project_name ?? "",
    diagnostics: (t.diagnostics ?? {}) as never,
  });
  return error ? error.message : null;
}

export function collectDiagnostics(extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (typeof window === "undefined") return { version: SYNCLAB_VERSION, ...extra };
  const ua = navigator.userAgent;
  const os = /Mac/i.test(ua)
    ? "macOS"
    : /Windows/i.test(ua)
      ? "Windows"
      : /Android/i.test(ua)
        ? "Android"
        : /iPhone|iPad/i.test(ua)
          ? "iOS"
          : "Other";
  const device = /iPhone|Android.*Mobile/i.test(ua)
    ? "Phone"
    : /iPad|Tablet/i.test(ua)
      ? "Tablet"
      : "Desktop";
  return {
    version: SYNCLAB_VERSION,
    runtime: "Web browser (SYNCLAB Desktop not installed)",
    os,
    device,
    browser: ua,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    audio_engine: "Web Audio",
    native_plugins: "unavailable in browser",
    ...extra,
  };
}

export { HELP_CATEGORIES, KNOWLEDGE_BASE, type Article, type HelpCategory } from "./help-articles";
export function searchArticles(q: string): Article[] {
  const t = q.trim().toLowerCase();
  if (!t) return KNOWLEDGE_BASE;
  return KNOWLEDGE_BASE.filter(
    (a) =>
      a.title.toLowerCase().includes(t) ||
      a.tags.includes(t) ||
      a.category.toLowerCase().includes(t) ||
      [...a.body, ...a.can, ...a.cant].some((p) => p.toLowerCase().includes(t)),
  );
}
