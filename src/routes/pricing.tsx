import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalFooter } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — SYNCLAB" },
      {
        name: "description",
        content:
          "SYNCLAB pricing: 7-day free trial, then Pro at $19.95 per month or $149 per year. Cancel anytime.",
      },
      { property: "og:title", content: "Pricing — SYNCLAB" },
      {
        property: "og:description",
        content: "7-day free trial, then $19.95/month or $149/year for SYNCLAB Pro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingRoute,
});

const FREE = [
  "Full studio: timeline, unlimited tracks, recording",
  "Instruments, drum machine, piano roll, sampler",
  "Mixer, effects, automation, arrangement sections",
  "Local project saving on this device",
];

const PRO = [
  "Everything in the free trial, forever",
  "Export finished tracks as WAV and MP3",
  "Save mastered files from the mastering suite",
  "Cloud project saving and sync across devices",
  "Stem separation and voice removal exports",
  "Priority email support",
];

function Check({ children }: { children: string }) {
  return (
    <li className="flex gap-2 text-sm text-muted-foreground">
      <span className="text-primary">✓</span>
      <span>{children}</span>
    </li>
  );
}

function PricingRoute() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-sm font-bold tracking-[0.2em]">
            SYNCLAB
          </Link>
          <Link
            to="/"
            className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            OPEN THE STUDIO
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="text-4xl font-bold tracking-tight">Simple pricing</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Start with a 7-day free trial — no card required. After that, keep making music for
          $19.95 a month, or save with the yearly plan. Cancel anytime; you keep Pro until the end of
          the period you paid for.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 p-6">
            <h2 className="text-lg font-semibold">Free trial</h2>
            <p className="mt-2 text-3xl font-bold">
              $0 <span className="text-base font-normal text-muted-foreground">/ 7 days</span>
            </p>
            <ul className="mt-5 space-y-2">
              {FREE.map((f) => (
                <Check key={f}>{f}</Check>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border-2 border-primary p-6">
            <h2 className="text-lg font-semibold">Pro — monthly</h2>
            <p className="mt-2 text-3xl font-bold">
              $19.95 <span className="text-base font-normal text-muted-foreground">/ month</span>
            </p>
            <ul className="mt-5 space-y-2">
              {PRO.map((f) => (
                <Check key={f}>{f}</Check>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 p-6">
            <h2 className="text-lg font-semibold">Pro — yearly</h2>
            <p className="mt-2 text-3xl font-bold">
              $149 <span className="text-base font-normal text-muted-foreground">/ year</span>
            </p>
            <p className="mt-1 text-xs text-primary">Two months free vs. monthly</p>
            <ul className="mt-5 space-y-2">
              {PRO.map((f) => (
                <Check key={f}>{f}</Check>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Prices in USD. Sales tax or VAT is added at checkout where required. Payments are handled
          by Paddle, our Merchant of Record. 30-day money-back guarantee — see our{" "}
          <Link to="/refunds" className="underline">
            refund policy
          </Link>
          .
        </p>
      </main>

      <footer className="border-t border-border/60 py-8">
        <LegalFooter />
      </footer>
    </div>
  );
}
