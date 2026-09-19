import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Accounts that get SYNCLAB free forever (the app's founder/owner). */
const FOUNDER_EMAILS = ["cbshivers@gmail.com"];

const TRIAL_DAYS = 7;
const TRIAL_KEY = "synclab.trialStart";
const PRO_KEY = "synclab.pro"; // set after a completed Paddle checkout

export type Tier = "founder" | "pro" | "trial" | "expired";

interface PlanState {
  tier: Tier;
  email: string | null;
  /** Days left in the free trial (0 when expired). */
  trialDaysLeft: number;
  /** True when the account may use pro features (export, mastering, cloud save). */
  isPro: boolean;
  /**
   * Returns true when the feature may proceed. Otherwise it opens the upgrade
   * dialog and returns false.
   */
  requirePro: (featureLabel: string) => boolean;
  openUpgrade: (featureLabel?: string) => void;
}

const PlanContext = createContext<PlanState | null>(null);

function trialStart(): number {
  try {
    const raw = localStorage.getItem(TRIAL_KEY);
    if (raw) return Number(raw) || Date.now();
    const now = Date.now();
    localStorage.setItem(TRIAL_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function hasProReceipt(): boolean {
  try {
    return localStorage.getItem(PRO_KEY) === "1";
  } catch {
    return false;
  }
}

/** Marks the current device as paid after a completed checkout. */
export function markProPaid() {
  try {
    localStorage.setItem(PRO_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email?.toLowerCase() ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email?.toLowerCase() ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { tier, trialDaysLeft } = useMemo(() => {
    if (email && FOUNDER_EMAILS.includes(email)) return { tier: "founder" as Tier, trialDaysLeft: TRIAL_DAYS };
    if (hasProReceipt()) return { tier: "pro" as Tier, trialDaysLeft: TRIAL_DAYS };
    const elapsedDays = (Date.now() - trialStart()) / 86_400_000;
    const left = Math.max(0, TRIAL_DAYS - elapsedDays);
    return { tier: left > 0 ? ("trial" as Tier) : ("expired" as Tier), trialDaysLeft: Math.ceil(left) };
  }, [email]);

  const isPro = tier !== "expired";

  const openUpgrade = useCallback((featureLabel?: string) => {
    setBlockedFeature(featureLabel ?? null);
    setUpgradeOpen(true);
  }, []);

  const requirePro = useCallback(
    (featureLabel: string) => {
      if (isPro) return true;
      openUpgrade(featureLabel);
      return false;
    },
    [isPro, openUpgrade]
  );

  const subscribe = (plan: "monthly" | "yearly") => {
    const paddle = (window as unknown as { Paddle?: { Checkout?: { open: (opts: unknown) => void } } }).Paddle;
    if (paddle?.Checkout) {
      paddle.Checkout.open({ items: [{ priceId: plan === "monthly" ? "synclab-monthly" : "synclab-yearly", quantity: 1 }] });
      return;
    }
    toast("Card payments are still being connected", {
      description: "Checkout opens here as soon as the payment account is approved. Your trial keeps working meanwhile.",
    });
  };

  const value: PlanState = { tier, email, trialDaysLeft, isPro, requirePro, openUpgrade };

  return (
    <PlanContext.Provider value={value}>
      {children}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display uppercase tracking-widest">
              <Crown className="size-4 text-amber-400" /> Upgrade to SYNCLAB Pro
            </DialogTitle>
            <DialogDescription>
              {blockedFeature
                ? `${blockedFeature} is part of SYNCLAB Pro.`
                : "Your free trial has ended."}{" "}
              The studio itself stays open — everything you made keeps playing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: "monthly" as const, name: "Monthly", price: "$19.95", per: "per month, cancel anytime" },
                { id: "yearly" as const, name: "Yearly", price: "$149", per: "per year — two months free" },
              ]
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => subscribe(p.id)}
                className={cn(
                  "rounded-sm border px-3 py-3 text-left transition-colors",
                  p.id === "yearly"
                    ? "border-primary bg-primary/15 hover:bg-primary/25"
                    : "border-border bg-surface-2 hover:bg-surface-3"
                )}
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{p.name}</div>
                <div className="mt-1 font-display text-xl">{p.price}</div>
                <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{p.per}</div>
              </button>
            ))}
          </div>
          <ul className="space-y-1 font-mono text-[10px] text-muted-foreground">
            <li>· Export &amp; share finished WAV / MP3 files</li>
            <li>· Mastering with loudness-matched presets</li>
            <li>· Save projects and exports to your cloud</li>
            <li>· Taxes handled for you worldwide by our payment partner</li>
          </ul>
          <Button onClick={() => subscribe("monthly")} className="w-full">
            <Sparkles className="size-4" /> Start Pro — $19.95/mo
          </Button>
          <p className="text-center font-mono text-[9px] text-muted-foreground">
            Secure checkout by Paddle · cancel anytime
          </p>
        </DialogContent>
      </Dialog>
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanState {
  const v = useContext(PlanContext);
  if (!v) throw new Error("usePlan must be used inside PlanProvider");
  return v;
}

/** Small badge for headers/menus: shows trial days left or the plan. */
export function PlanBadge() {
  const { tier, trialDaysLeft, openUpgrade } = usePlan();
  if (tier === "founder")
    return (
      <span className="flex items-center gap-1 rounded-sm border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-300">
        <Crown className="size-3" /> Founder
      </span>
    );
  if (tier === "pro")
    return (
      <span className="rounded-sm border border-primary/50 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
        Pro
      </span>
    );
  if (tier === "trial")
    return (
      <button
        onClick={() => openUpgrade()}
        className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        title="Free trial — tap to see Pro plans"
      >
        Trial · {trialDaysLeft}d left
      </button>
    );
  return (
    <button
      onClick={() => openUpgrade()}
      className="flex items-center gap-1 rounded-sm border border-red-500/60 bg-red-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-red-300"
    >
      <Crown className="size-3" /> Trial ended
    </button>
  );
}
