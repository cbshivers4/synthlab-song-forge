import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getPaddleEnvironment,
  getPaddlePriceId,
  initializePaddle,
  onPaddleCheckoutCompleted,
} from "@/lib/paddle";
import { changePlan, createPortalLink } from "@/utils/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import {
  PLAN_PRICES,
  TRIAL_DAYS,
  canSave,
  planTier,
  subscriptionIsActive,
  type SubscriptionRow,
  type Tier,
} from "./plan-tier";

const PRO_KEY = "synclab.pro"; // optimistic unlock right after checkout, until the payment record lands
const RECEIPT_MS = 2 * 60 * 60 * 1000;

const PRICE_IDS = { monthly: PLAN_PRICES.monthly.id, yearly: PLAN_PRICES.yearly.id } as const;

export type { Tier };

interface PlanState {
  tier: Tier;
  email: string | null;
  /** Days left in the 14-day free trial (0 when not trialing). */
  trialDaysLeft: number;
  /** True when the account may save projects, export and save mastered files. */
  isPro: boolean;
  /** The current trial or paid plan, when one exists. */
  subscription: SubscriptionRow | null;
  /**
   * Returns true when the feature may proceed. Otherwise it opens the trial / plan
   * dialog and returns false.
   */
  requirePro: (featureLabel: string) => boolean;
  openUpgrade: (featureLabel?: string) => void;
}

const PlanContext = createContext<PlanState | null>(null);

function hasProReceipt(): boolean {
  try {
    const at = Number(localStorage.getItem(PRO_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < RECEIPT_MS;
  } catch {
    return false;
  }
}

/** Optimistic unlock right after checkout completes; the payment record is the source of truth. */
export function markProPaid() {
  try {
    localStorage.setItem(PRO_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

const SUB_CACHE_KEY = "synclab.plan.lastSeen";

/** Last plan row the server returned for this account, used only while offline. */
function readCachedSubscription(uid: string): SubscriptionRow | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SUB_CACHE_KEY) || "null") as {
      uid: string;
      sub: SubscriptionRow | null;
    } | null;
    return raw && raw.uid === uid ? raw.sub : null;
  } catch {
    return null;
  }
}
function writeCachedSubscription(uid: string, sub: SubscriptionRow | null) {
  try {
    localStorage.setItem(SUB_CACHE_KEY, JSON.stringify({ uid, sub }));
  } catch {
    /* storage unavailable */
  }
}

export { subscriptionIsActive };

export function PlanProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [receipt, setReceipt] = useState<boolean>(() => hasProReceipt());
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  /** Account whose plan record has been read (so the trial offer never flashes before it loads). */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data, error }) => {
      // Offline (desktop offline copy) the check can't reach the server: keep the signed-in
      // session the auth listener already restored instead of treating the user as signed out.
      if (error && !data.user) return;
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

  const loadSubscription = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "paddle_subscription_id, price_id, status, current_period_end, cancel_at_period_end",
        )
        .eq("user_id", uid)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        // No connection: use the last plan this device saw for this account.
        setSubscription(readCachedSubscription(uid));
        setLoadedFor(uid);
        return;
      }
      setSubscription((data as SubscriptionRow | null) ?? null);
      writeCachedSubscription(uid, (data as SubscriptionRow | null) ?? null);
      setLoadedFor(uid);
    },
    [env],
  );

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
        () => void loadSubscription(userId),
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
      toast.success("Your 14-day free trial has started", {
        description:
          "Saving, export and mastering are unlocked. You won't be charged if you cancel before day 14.",
      });
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
      toast.success("Your 14-day free trial has started", {
        description:
          "Saving, export and mastering are unlocked. You won't be charged if you cancel before day 14.",
      });
      if (userId) void loadSubscription(userId);
      url.searchParams.delete("upgraded");
      window.history.replaceState(null, "", url.toString());
    }
  }, [userId, loadSubscription]);

  const subActive = subscriptionIsActive(subscription);

  const { tier, trialDaysLeft } = useMemo(
    () => planTier(email, subscription, receipt),
    [email, subscription, receipt],
  );

  const isPro = canSave(tier);

  const openUpgrade = useCallback((featureLabel?: string) => {
    setBlockedFeature(featureLabel ?? null);
    setUpgradeOpen(true);
  }, []);

  // Free accounts see the 14-day trial offer once per visit after signing in.
  useEffect(() => {
    if (tier !== "free" || !userId || loadedFor !== userId) return;
    try {
      const key = `synclab.trialOffer.${userId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    openUpgrade();
  }, [tier, userId, loadedFor, openUpgrade]);

  const requirePro = useCallback(
    (featureLabel: string) => {
      if (isPro) return true;
      openUpgrade(featureLabel);
      return false;
    },
    [isPro, openUpgrade],
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
          description:
            "Unused time was credited automatically. Your next bill reflects the new plan.",
        });
        if (userId) await loadSubscription(userId);
        setUpgradeOpen(false);
        return;
      }
      if (!userId) {
        toast("Sign in first", {
          description: "You need an account so the purchase can be linked to you.",
        });
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

  const value: PlanState = {
    tier,
    email,
    trialDaysLeft,
    isPro,
    subscription,
    requirePro,
    openUpgrade,
  };

  return (
    <PlanContext.Provider value={value}>
      <PaymentTestModeBanner />
      {children}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display uppercase tracking-widest">
              <Crown className="size-4 text-amber-400" />{" "}
              {subActive ? "Your SYNCLAB plan" : "Try SYNCLAB free for 14 days"}
            </DialogTitle>
            <DialogDescription>
              {blockedFeature && !isPro ? `${blockedFeature} needs the free trial or a plan. ` : ""}
              {subActive
                ? "Switch between monthly and yearly, or manage billing below."
                : "Add a card to start your 14-day free trial. Cancel any time before day 14 and you won't be charged. The free version lets you make music, but you can't save your projects."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                id: "monthly" as const,
                name: "Monthly",
                price: PLAN_PRICES.monthly.label,
                per: subActive ? "per month" : "per month after 14 free days",
              },
              {
                id: "yearly" as const,
                name: "Yearly",
                price: PLAN_PRICES.yearly.label,
                per: subActive ? "per year" : "per year after 14 free days",
              },
            ].map((p) => (
              <button
                key={p.id}
                disabled={checkoutBusy}
                onClick={() => void subscribe(p.id)}
                className={cn(
                  "rounded-sm border px-3 py-3 text-left transition-colors disabled:opacity-50",
                  p.id === "yearly"
                    ? "border-primary bg-primary/15 hover:bg-primary/25"
                    : "border-border bg-surface-2 hover:bg-surface-3",
                )}
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {p.name}
                </div>
                <div className="mt-1 font-display text-xl">{p.price}</div>
                <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{p.per}</div>
              </button>
            ))}
          </div>
          <ul className="space-y-1 font-mono text-[10px] text-muted-foreground">
            <li>· Save your projects to your account</li>
            <li>· Export &amp; share finished WAV / MP3 files</li>
            <li>· Mastering with loudness-matched presets</li>
            <li>
              · {TRIAL_DAYS} days free, then billed automatically — cancel before day {TRIAL_DAYS}{" "}
              to pay nothing
            </li>
            <li>· Taxes handled for you worldwide by our payment partner</li>
          </ul>
          {!subActive && (
            <Button
              onClick={() => void subscribe("monthly")}
              disabled={checkoutBusy}
              className="w-full"
            >
              <Sparkles className="size-4" /> Start 14-day free trial
            </Button>
          )}
          {subscription && subActive && (
            <Button variant="outline" onClick={() => void manageBilling()} className="w-full">
              {subscription?.status === "trialing"
                ? "Manage billing / cancel trial"
                : "Manage billing / cancel"}
            </Button>
          )}
          <p className="text-center font-mono text-[9px] text-muted-foreground">
            Secure checkout by Paddle · card required for the trial
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
        title={
          subscription?.cancel_at_period_end
            ? "Trial cancelled — you won't be charged"
            : "Free trial — billing starts when it ends"
        }
      >
        Trial · {trialDaysLeft}d left
      </button>
    );
  return (
    <button
      onClick={() => openUpgrade()}
      className="flex items-center gap-1 rounded-sm border border-primary/60 bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary"
      title="Free version — projects can't be saved. Tap to start the 14-day free trial."
    >
      <Crown className="size-3" /> Free · Start trial
    </button>
  );
}

/**
 * Test mode (?test=1) only: a fixed local plan with no account, trial check, checkout or server call.
 * Local features (export to a file, mastering) work; cloud saving is refused.
 */
export function TestPlanProvider({ children }: { children: ReactNode }) {
  const value = useMemo<PlanState>(
    () => ({
      tier: "trial",
      email: null,
      trialDaysLeft: TRIAL_DAYS,
      isPro: true,
      subscription: null,
      requirePro: (feature) => {
        if (/cloud/i.test(feature)) {
          toast("Not available in test mode — nothing is saved or sent.");
          return false;
        }
        return true;
      },
      openUpgrade: () => toast("Not available in test mode — nothing is saved or sent."),
    }),
    [],
  );
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
