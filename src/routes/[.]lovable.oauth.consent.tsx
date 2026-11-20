import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import synclabLogoAsset from "@/assets/synclab-logo-neon.jpg.asset.json";

type AuthorizationDetails = {
  client?: { name?: string; uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
} | null;
type OAuthResult = { data: AuthorizationDetails; error: { message: string } | null };
// The OAuth server namespace is still beta in the SDK typings.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // SSR has no localStorage session and would redirect signed-in users.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Connect an assistant — SYNCLAB" },
      { name: "description", content: "Allow an AI assistant to use your SYNCLAB account." },
      { property: "og:title", content: "Connect an assistant — SYNCLAB" },
      { property: "og:description", content: "Allow an AI assistant to use your SYNCLAB account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id)
      throw new Error(
        "This connect link is missing its request ID. Start connecting again from your assistant.",
      );
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/login", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="grid min-h-[100dvh] place-items-center bg-background p-6 text-foreground">
      <div className="max-w-md space-y-2 rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="font-display text-lg font-semibold">Could not load this connect request</h1>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <p className="text-xs text-muted-foreground">
          Connect links expire after a few minutes. Start again from your assistant.
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = details?.client?.name ?? "This assistant";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = approve
        ? await oauth().approveAuthorization(authorization_id)
        : await oauth().denyAuthorization(authorization_id);
      if (error) throw new Error(error.message);
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target)
        throw new Error("The sign-in service did not say where to go next. Try connecting again.");
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <img src={synclabLogoAsset.url} alt="SYNCLAB" className="size-12 rounded" />
          <Bot className="size-6 text-primary" aria-hidden="true" />
          <h1 className="font-display text-lg font-semibold">Connect {client} to SYNCLAB</h1>
        </div>
        <div className="space-y-2 text-sm">
          <p>{client} will be able to, as you:</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>See your saved projects, their tracks and settings</li>
            <li>Rename your saved projects</li>
            <li>See your media library and your plan</li>
            <li>Search the SYNCLAB help articles</li>
          </ul>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            It can't delete anything, pay, or see other people's work. You can only approve this
            while signed in.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => void decide(true)}>
            Allow
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            disabled={busy}
            onClick={() => void decide(false)}
          >
            Deny
          </Button>
        </div>
      </div>
    </main>
  );
}
