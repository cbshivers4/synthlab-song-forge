import { createFileRoute } from "@tanstack/react-router";
import { FounderDashboard } from "@/components/founder/FounderDashboard";
import {
  FOUNDER_TABS,
  founderOverviewQuery,
  type FounderTab,
} from "@/components/founder/founder-queries";

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (s: Record<string, unknown>): { tab?: FounderTab } => {
    const t = s["tab"];
    return FOUNDER_TABS.includes(t as FounderTab) ? { tab: t as FounderTab } : {};
  },
  head: () => ({
    meta: [
      { title: "Founder Analytics — SYNCLAB" },
      { name: "description", content: "Private SYNCLAB founder dashboard: accounts, sign-ins, plans and messages." },
      { property: "og:title", content: "Founder Analytics — SYNCLAB" },
      { property: "og:description", content: "Private SYNCLAB founder dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(founderOverviewQuery),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-xl font-bold text-foreground">Founder only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error && error.message.includes("Forbidden")
            ? "This page is only for the SYNCLAB founder account."
            : "The dashboard didn't load. Refresh to try again."}
        </p>
        <a href="/" className="mt-4 inline-block text-sm text-primary underline">
          Back to the studio
        </a>
      </div>
    </div>
  ),
  component: AdminRoute,
});

function AdminRoute() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <FounderDashboard
      tab={tab ?? "overview"}
      onTab={(t) => void navigate({ search: t === "overview" ? {} : { tab: t }, replace: true })}
    />
  );
}
