import { useState } from "react";
import { useHydrated } from "@tanstack/react-router";
import { Check, Crown, Minus, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FREE_ACCESS_DAYS,
  PLAN_PRICES,
  TRIAL_DAYS,
  formatPlanDate,
  type PlanId,
} from "@/lib/synclab/plan-tier";

const DAY = 86_400_000;

export const FREE_ACCESS_FEATURES = [
  "No credit card required",
  "Explore the full SYNCLAB studio",
  "Instruments, recording, beat-making tools and sound library",
  "Save your projects, export WAV / MP3 and master your songs",
  "Upgrade to Premium any time",
];
export const FREE_ACCESS_MISSING = ["AI tools (Co-Producer, Generate Stem, Separate Stems)"];

export const PREMIUM_FEATURES = [
  "Full access to every premium feature",
  "All instruments and production tools",
  "AI music tools: Co-Producer, Generate Stem, Separate Stems",
  "Advanced recording, mixing and mastering",
  "Save, export and sync your projects across devices",
];

function Item({ children, off }: { children: string; off?: boolean }) {
  return (
    <li className={cn("flex gap-2 text-sm", off ? "text-muted-foreground" : "text-foreground")}>
      {off ? (
        <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Not included" />
      ) : (
        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      )}
      <span>{children}</span>
    </li>
  );
}

export interface StartChoiceProps {
  /** Free Access can be started (never used on this account). */
  freeAvailable: boolean;
  busy?: boolean;
  onStartFree: () => void;
  onStartPremium: (plan: PlanId) => void;
  /** Fixed "today" for the disclosed dates (tests / SSR); defaults to now. */
  now?: number;
}

/** The two ways to start: Free Access (no card) and the Premium trial (card, auto-renews). */
export function StartChoice({
  freeAvailable,
  busy,
  onStartFree,
  onStartPremium,
  now,
}: StartChoiceProps) {
  const [plan, setPlan] = useState<PlanId>("monthly");
  const hydrated = useHydrated();
  const today = now ?? Date.now();
  // Dates use the visitor's own calendar and language, so they're only shown in the browser.
  const billDate = hydrated
    ? formatPlanDate(today + TRIAL_DAYS * DAY)
    : `the day your ${TRIAL_DAYS}-day trial ends`;
  const price = PLAN_PRICES[plan];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section
        aria-labelledby="start-free-title"
        className="flex flex-col rounded-md border border-border bg-surface-2 p-5"
      >
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <Music2 className="size-4" aria-hidden /> Free Access
        </div>
        <h3 id="start-free-title" className="mt-2 font-display text-2xl">
          {FREE_ACCESS_DAYS} Days Free
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">$0 · nothing to cancel</p>
        <ul className="mt-4 space-y-2">
          {FREE_ACCESS_FEATURES.map((f) => (
            <Item key={f}>{f}</Item>
          ))}
          {FREE_ACCESS_MISSING.map((f) => (
            <Item key={f} off>{`Not included: ${f}`}</Item>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          After {FREE_ACCESS_DAYS} days, saving and export pause until you pick a plan. Your songs
          stay in your account.
        </p>
        <div className="mt-auto pt-4">
          <Button
            variant="secondary"
            className="w-full font-bold tracking-widest"
            disabled={busy || !freeAvailable}
            onClick={onStartFree}
          >
            START FREE
          </Button>
          {!freeAvailable && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Free Access has already been used on this account.
            </p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="start-premium-title"
        className="flex flex-col rounded-md border-2 border-primary bg-primary/10 p-5"
      >
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-primary">
          <Crown className="size-4" aria-hidden /> Premium Access
        </div>
        <h3 id="start-premium-title" className="mt-2 font-display text-2xl">
          {TRIAL_DAYS} Days Free
        </h3>
        <p className="mt-1 text-sm text-foreground">
          Then <strong>{price.label}</strong> per {price.per}
        </p>
        <div
          role="radiogroup"
          aria-label="Billing after the trial"
          className="mt-3 grid grid-cols-2 gap-2"
        >
          {(["monthly", "yearly"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={plan === id}
              onClick={() => setPlan(id)}
              className={cn(
                "rounded-sm border px-3 py-2 text-left transition-colors",
                plan === id
                  ? "border-primary bg-primary/20"
                  : "border-border bg-surface-2 hover:border-primary/60",
              )}
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {id === "monthly" ? "Monthly" : "Yearly"}
              </div>
              <div className="font-display text-lg">{PLAN_PRICES[id].label}</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                per {PLAN_PRICES[id].per}
              </div>
            </button>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {PREMIUM_FEATURES.map((f) => (
            <Item key={f}>{f}</Item>
          ))}
          <Item>Requires a credit card</Item>
        </ul>
        <p className="mt-4 text-xs text-foreground">
          Nothing is charged today. If you don't cancel, {price.label} per {price.per} is charged on{" "}
          <strong>{billDate}</strong> and then every {price.per} until you cancel. Cancel any time
          before then in Settings → Account and you pay nothing.
        </p>
        <div className="mt-auto pt-4">
          <Button
            className="w-full font-bold tracking-widest"
            disabled={busy}
            onClick={() => onStartPremium(plan)}
          >
            START PREMIUM TRIAL
          </Button>
          <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground">
            Secure checkout by Paddle · tax added where required
          </p>
        </div>
      </section>
    </div>
  );
}
