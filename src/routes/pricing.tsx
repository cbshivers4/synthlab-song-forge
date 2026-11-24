import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalFooter } from "@/components/legal/LegalPage";
import { StartChoice } from "@/components/plan/StartChoice";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing & free trial — SYNCLAB" },
      {
        name: "description",
        content:
          "Start SYNCLAB free for 14 days: Free Access with no card, or the Premium trial — then $9.95 a month or $119.40 a year. Cancel before the trial ends and pay nothing.",
      },
      { property: "og:title", content: "Pricing & free trial — SYNCLAB" },
      {
        property: "og:description",
        content: "14 days free with no card, or a 14-day Premium trial, then $9.95/month or $119.40/year.",
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
  "Projects can't be saved, exported or mastered",
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
        <h1 className="text-4xl font-bold tracking-tight">Try SYNCLAB free for 14 days</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Two ways to start. Free Access needs no card at all. The Premium trial unlocks everything,
          including the AI tools, and needs a card — nothing is charged during the 14 days, and if
          you cancel before the trial ends you pay nothing. Otherwise it continues at $9.95 a month
          or $119.40 a year.
        </p>

        <div className="mt-10">
          <StartChoice
            freeAvailable
            onStartFree={() => window.location.assign("/?start=free")}
            onStartPremium={(plan) => window.location.assign(`/?start=premium&plan=${plan}`)}
          />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            You'll sign in or create your account first. Free Access can be used once per account.
          </p>
        </div>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-border/70 p-6">
            <h2 className="text-lg font-semibold">Free version</h2>
            <p className="mt-2 text-3xl font-bold">
              $0 <span className="text-base font-normal text-muted-foreground">/ no saving</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              What every account has when no trial or plan is running.
            </p>
            <ul className="mt-5 space-y-2">
              {FREE.map((f) => (
                <Check key={f}>{f}</Check>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border/70 p-6">
            <h2 className="text-lg font-semibold">Cancelling is easy</h2>
            <ul className="mt-5 space-y-2">
              <Check>Settings → Account shows your plan, days remaining and end date</Check>
              <Check>Cancel the trial or plan there in two taps — no emails or calls</Check>
              <Check>Cancel during the trial and you are never charged</Check>
              <Check>Switch monthly / yearly or update your card any time</Check>
            </ul>
          </div>
        </section>

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
