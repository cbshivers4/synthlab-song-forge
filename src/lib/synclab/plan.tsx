import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPaddleEnvironment, getPaddlePriceId, initializePaddle, onPaddleCheckoutCompleted } from "@/lib/paddle";
import { changePlan, createPortalLink } from "@/utils/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

/** Accounts that get SYNCLAB free forever (the app's founder/owner). */
const FOUNDER_EMAILS = ["christophershivers@synclabsapp.com", "cbshivers@gmail.com"];

const TRIAL_DAYS = 7;
const TRIAL_KEY = "synclab.trialStart";
const PRO_KEY = "synclab.pro"; // optimistic unlock until the webhook lands

const PRICE_IDS = { monthly: "synclab_monthly", yearly: "synclab_yearly" } as const;

export type Tier = "founder" | "pro" | "trial" | "expired";

interface SubscriptionRow {
  paddle_subscription_id: string;
  price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface PlanState {
  tier: Tier;
  email: string | null;
  /** Days left in the free trial (0 when expired). */
  trialDaysLeft: number;
  /** True when the account may use pro features (export, mastering, cloud save). */
  isPro: boolean;
  /** The current paid plan, when one exists. */
  subscription: SubscriptionRow | null;
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

/** Optimistic unlock right after checkout completes; the webhook is the source of truth. */
export function markProPaid() {
  try {
    localStorage.setItem(PRO_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

/** Active means usable now: paid/current, or canceled but still inside the paid period. */
export function subscriptionIsActive(sub: SubscriptionRow | null): boolean {
  if (!sub) return false;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const inPeriod = periodEnd === null || periodEnd > Date.now();
  if (["active", "trialing", "past_due"].includes(sub.status)) return inPeriod;
  if (sub.status === "canceled") return inPeriod; // access until the paid period ends
  return false;
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [receipt, setReceipt] = useState<boolean>(() => hasProReceipt());
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email?.toLowerCase() ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setEmail(session?.user?.email?.toLowerCase() ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const env = getPaddleEnvironment();

  const loadSubscription = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("subscriptions")
      .select("paddle_subscription_id, price_id, status, current_period_end, cancel_at_period_end")
      .eq("user_id", uid)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription((data as SubscriptionRow | null) ?? null);
  }, [env]);

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      return;
    }
    void loadSubscription(userId);
    // Live updates when the payment webhook writes a row.
    const channel = supabase
      .channel(`plan-sub-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => void loadSubscription(userId)
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, loadSubscription]);

  // Unlock the moment checkout completes; the webhook confirms it in the database.
  useEffect(() => {
    onPaddleCheckoutCompleted(() => {
      markProPaid();
      setReceipt(true);
      setUpgradeOpen(false);
      toast.success("Welcome to SYNCLAB Pro", { description: "Export, mastering and cloud saving are unlocked." });
      if (userId) void loadSubscription(userId);
    });
  }, [userId, loadSubscription]);

  // Returning from a successful checkout URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("upgraded") === "1") {
      markProPaid();
      setReceipt(true);
      toast.success("Welcome to SYNCLAB Pro", { description: "Export, mastering and cloud saving are unlocked." });
      if (userId) void loadSubscription(userId);
      url.searchParams.delete("upgraded");
      window.history.replaceState(null, "", url.toString());
    }
  }, [userId, loadSubscription]);

  const subActive = subscriptionIsActive(subscription);

  const { tier, trialDaysLeft } = useMemo(() => {
    if (email && FOUNDER_EMAILS.includes(email)) return { tier: "founder" as Tier, trialDaysLeft: TRIAL_DAYS };
    if (subActive || receipt) return { tier: "pro" as Tier, trialDaysLeft: TRIAL_DAYS };
    const elapsedDays = (Date.now() - trialStart()) / 86_400_000;
    const left = Math.max(0, TRIAL_DAYS - elapsedDays);
    return { tier: left > 0 ? ("trial" as Tier) : ("expired" as Tier), trialDaysLeft: Math.ceil(left) };
  }, [email, subActive, receipt]);

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

  const subscribe = async (plan: "monthly" | "yearly") => {
    const priceId = PRICE_IDS[plan];
    setCheckoutBusy(true);
    try {
      // Already subscribed? Switch plan with automatic proration instead of a second checkout.
      if (subActive && subscription) {
        if (subscription.price_id === priceId) {
          setUpgradeOpen(false);
          return;
        }
        await changePlan({ data: { priceId, environment: env } });
        toast.success("Plan switched", {
          description: "Unused time was credited automatically. Your next bill reflects the new plan.",
        });
        if (userId) await loadSubscription(userId);
        setUpgradeOpen(false);
        return;
      }
      if (!userId) {
        toast("Sign in first", { description: "You need an account so the purchase can be linked to you." });
        return;
      }
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(priceId);
      window.Paddle!.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: email ? { email } : undefined,
        customData: { userId, priceId },
        settings: {
          displayMode: "overlay",
          variant: "one-page",
          allowLogout: false,
          successUrl: `${window.location.origin}/?upgraded=1`,
        },
      });
    } catch (e) {
      toast.error("Checkout could not open", {
        description: e instanceof Error ? e.message : "Please try again in a moment.",
      });
    } finally {
      setCheckoutBusy(false);
    }
  };

  const manageBilling = async () => {
    try {
      const { url } = await createPortalLink({ data: { environment: env } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error("Billing portal unavailable", {
        description: e instanceof Error ? e.message : "Please try again in a moment.",
      });
    }
  };

  const value: PlanState = { tier, email, trialDaysLeft, isPro, subscription, requirePro, openUpgrade };

  return (
    <PlanContext.Provider value={value}>
      <PaymentTestModeBanner />
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
                disabled={checkoutBusy}
                onClick={() => void subscribe(p.id)}
                className={cn(
                  "rounded-sm border px-3 py-3 text-left transition-colors disabled:opacity-50",
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
            <li>· Cancel anytime — you keep Pro until the paid period ends</li>
            <li>· Taxes handled for you worldwide by our payment partner</li>
          </ul>
          <Button onClick={() => void subscribe("monthly")} disabled={checkoutBusy} className="w-full">
            <Sparkles className="size-4" /> Start Pro — $19.95/mo
          </Button>
          {subscription && subActive && (
            <Button variant="outline" onClick={() => void manageBilling()} className="w-full">
              Manage billing / cancel
            </Button>
          )}
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
  const { tier, trialDaysLeft, openUpgrade, subscription } = usePlan();
  if (tier === "founder")
    return (
      <span className="flex items-center gap-1 rounded-sm border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-300">
        <Crown className="size-3" /> Founder
      </span>
    );
  if (tier === "pro")
    return (
      <span
        className="rounded-sm border border-primary/50 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary"
        title={
          subscription?.cancel_at_period_end
            ? "Pro until the current paid period ends"
            : subscription?.price_id === "synclab_yearly"
              ? "Pro — yearly plan"
              : "Pro"
        }
      >
        {subscription?.cancel_at_period_end ? "Pro · ends soon" : "Pro"}
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
