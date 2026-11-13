import { createFileRoute } from "@tanstack/react-router";
import { WelcomeScreen } from "@/components/studio/WelcomeScreen";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/login")({
  // The session lives in browser storage; SSR can't see it.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: oauthReturnPath(s["next"]) }),
  head: () => ({
    meta: [
      { title: "Sign in — SYNCLAB" },
      { name: "description", content: "Sign in to your SYNCLAB account to continue." },
      { property: "og:title", content: "Sign in — SYNCLAB" },
      { property: "og:description", content: "Sign in to your SYNCLAB account to continue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { next } = Route.useSearch();
  return <WelcomeScreen next={next === "/" ? undefined : next} />;
}
