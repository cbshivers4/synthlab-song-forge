import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalFooter } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — SYNCLAB" },
      {
        name: "description",
        content:
          "SYNCLAB pricing: 14-day free trial, then Pro at $9.95 per month or $119.40 per year. Cancel before day 14 and pay nothing.",
      },
      { property: "og:title", content: "Pricing — SYNCLAB" },
      {
        property: "og:description",
        content: "14-day free trial, then $9.95/month or $119.40/year for SYNCLAB Pro.",
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
  "Projects can't be saved in the free version",
];

const TRIAL = [
  "Everything in Pro for 14 days",
  "Card required to start — nothing is charged during the trial",
  "Cancel before day 14 and you won't be charged",
  "After 14 days your chosen plan starts automatically",
];

const PRO = [
  "Save your projects to your account",
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
          Try everything free for 14 days. A card is required to start the trial, and if you cancel
          before day 14 you won't be charged. After that it's $9.95 a month or $119.40 a year.
          Without a trial or plan you can still make music in the free version, but you can't save
          projects.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/70 p-6">
            <h2 className="text-lg font-semibold">Free version</h2>
            <p className="mt-2 text-3xl font-bold">
              $0 <span className="text-base font-normal text-muted-foreground">/ no saving</span>
            </p>
            <ul className="mt-5 space-y-2">
              {FREE.map((f) => (
                <Check key={f}>{f}</Check>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 p-6">
            <h2 className="text-lg font-semibold">Free trial</h2>
            <p className="mt-2 text-3xl font-bold">
              $0 <span className="text-base font-normal text-muted-foreground">/ 14 days</span>
            </p>
            <ul className="mt-5 space-y-2">
              {TRIAL.map((f) => (
                <Check key={f}>{f}</Check>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border-2 border-primary p-6">
            <h2 className="text-lg font-semibold">Pro — monthly</h2>
            <p className="mt-2 text-3xl font-bold">
              $9.95 <span className="text-base font-normal text-muted-foreground">/ month</span>
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
              $119.40 <span className="text-base font-normal text-muted-foreground">/ year</span>
            </p>
            <p className="mt-1 text-xs text-primary">One payment a year</p>
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
