import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getPaddleEnvironment,
  getPaddlePriceId,
  initializePaddle,
  onPaddleCheckoutCompleted,
} from "@/lib/paddle";
import {
  cancelMyPlan,
  changePlan,
  checkoutAllowed,
  createPortalLink,
  keepMyPlan,
} from "@/utils/payments.functions";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PREMIUM_FEATURES, StartChoice } from "@/components/plan/StartChoice";
import {
  FREE_ACCESS_DAYS,
  PLAN_PRICES,
  TRIAL_DAYS,
  canSave,
  canUseAi,
  formatPlanDate,
  needsStartChoice,
  planIdOf,
  planTier,
  subscriptionIsActive,
  trialStatusLabel,
  type FreeAccessRow,
  type PlanId,
  type SubscriptionRow,
  type Tier,
} from "./plan-tier";

const PRO_KEY = "synclab.pro"; // optimistic unlock right after checkout, until the payment record lands
const RECEIPT_MS = 2 * 60 * 60 * 1000;
/** "free" | "premium:monthly" | "premium:yearly" chosen on the pricing page before signing in. */
const INTENT_KEY = "synclab.startIntent";
const DAY = 86_400_000;

export type { Tier };

interface PlanState {
  tier: Tier;
  email: string | null;
  /** Days left in the Premium trial or Free Access (0 otherwise). */
  trialDaysLeft: number;
  /** When the running Premium trial / Free Access ends (ms), or null. */
  trialEndsAt: number | null;
  /** True when the account may save projects, export and save mastered files. */
  isPro: boolean;
  /** True when the account may use the AI tools (Premium). */
  canUseAi: boolean;
  /** The current trial or paid plan, when one exists. */
  subscription: SubscriptionRow | null;
  /** This account's Free Access record (running or ended), when it was ever started. */
  freeAccess: FreeAccessRow | null;
  /** Plan action in progress (checkout, cancel, switch…). */
  busy: boolean;
  /**
   * Returns true when the feature may proceed. Otherwise it opens the plan
   * screen and returns false. Saving/export: Free Access, Premium trial or a plan.
   */
  requirePro: (featureLabel: string) => boolean;
  /** Same, for Premium-only features (AI tools). */
  requirePremium: (featureLabel: string) => boolean;
  openUpgrade: (featureLabel?: string) => void;
  openStartChoice: () => void;
  startFreeAccess: () => Promise<void>;
  startPremium: (plan: PlanId) => Promise<void>;
  switchPlan: (plan: PlanId) => Promise<void>;
  manageBilling: () => Promise<void>;
  cancelPlan: () => Promise<void>;
  keepPlan: () => Promise<void>;
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
  const [freeAccess, setFreeAccess] = useState<FreeAccessRow | null>(null);
  const [receipt, setReceipt] = useState<boolean>(() => hasProReceipt());
  const [dialog, setDialog] = useState<"none" | "choice" | "upgrade">("none");
  const [blocked, setBlocked] = useState<{ label: string; premium: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Account whose plan records have been read (so offers never flash before they load). */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const intentRan = useRef(false);

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

  // A start option picked on the pricing page (/?start=free, /?start=premium&plan=yearly).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const start = url.searchParams.get("start");
    if (!start) return;
    const plan = url.searchParams.get("plan") === "yearly" ? "yearly" : "monthly";
    try {
      sessionStorage.setItem(INTENT_KEY, start === "free" ? "free" : `premium:${plan}`);
    } catch {
      /* storage unavailable */
    }
    url.searchParams.delete("start");
    url.searchParams.delete("plan");
    window.history.replaceState(null, "", url.toString());
  }, []);

  const env = getPaddleEnvironment();

  const loadSubscription = useCallback(
    async (uid: string) => {
      const [subRes, faRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select(
            "paddle_subscription_id, price_id, status, current_period_end, cancel_at_period_end",
          )
          .eq("user_id", uid)
          .eq("environment", env)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("free_access_trials")
          .select("started_at, ends_at")
          .eq("user_id", uid)
          .maybeSingle(),
      ]);
      if (subRes.error) {
        // No connection: use the last plan this device saw for this account.
        setSubscription(readCachedSubscription(uid));
      } else {
        const row = (subRes.data as SubscriptionRow | null) ?? null;
        setSubscription(row);
        writeCachedSubscription(uid, row);
      }
      if (!faRes.error) setFreeAccess((faRes.data as FreeAccessRow | null) ?? null);
      setLoadedFor(uid);
    },
    [env],
  );

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setFreeAccess(null);
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

  const premiumStartedToast = useCallback(() => {
    toast.success(`Your ${TRIAL_DAYS}-day Premium trial has started`, {
      description: `Everything is unlocked. Nothing is charged before ${formatPlanDate(
        Date.now() + TRIAL_DAYS * DAY,
      )} — cancel before then in Settings → Account and you pay nothing.`,
    });
  }, []);

  // Unlock the moment checkout completes; the webhook confirms it in the database.
  useEffect(() => {
    onPaddleCheckoutCompleted(() => {
      markProPaid();
      setReceipt(true);
      setDialog("none");
      premiumStartedToast();
      if (userId) void loadSubscription(userId);
    });
  }, [userId, loadSubscription, premiumStartedToast]);

  // Returning from a successful checkout URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("upgraded") === "1") {
      markProPaid();
      setReceipt(true);
      premiumStartedToast();
      if (userId) void loadSubscription(userId);
      url.searchParams.delete("upgraded");
      window.history.replaceState(null, "", url.toString());
    }
  }, [userId, loadSubscription, premiumStartedToast]);

  const subActive = subscriptionIsActive(subscription);

  const { tier, trialDaysLeft, trialEndsAt } = useMemo(
    () => planTier(email, subscription, receipt, Date.now(), freeAccess),
    [email, subscription, receipt, freeAccess],
  );

  const isPro = canSave(tier);
  const aiOk = canUseAi(tier);

  const openUpgrade = useCallback((featureLabel?: string) => {
    setBlocked(featureLabel ? { label: featureLabel, premium: false } : null);
    setDialog("upgrade");
  }, []);
  const openStartChoice = useCallback(() => setDialog("choice"), []);

  // Once per visit after signing in: new accounts pick how to start; lapsed accounts see the plans.
  useEffect(() => {
    if (tier !== "free" || !userId || loadedFor !== userId) return;
    try {
      if (sessionStorage.getItem(INTENT_KEY)) return; // handled below
      const key = `synclab.trialOffer.${userId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    if (needsStartChoice(tier, subscription, freeAccess)) setDialog("choice");
    else setDialog("upgrade");
  }, [tier, userId, loadedFor, subscription, freeAccess]);

  const requirePro = useCallback(
    (featureLabel: string) => {
      if (isPro) return true;
      setBlocked({ label: featureLabel, premium: false });
      setDialog(needsStartChoice(tier, subscription, freeAccess) ? "choice" : "upgrade");
      return false;
    },
    [isPro, tier, subscription, freeAccess],
  );

  const requirePremium = useCallback(
    (featureLabel: string) => {
      if (aiOk) return true;
      setBlocked({ label: featureLabel, premium: true });
      setDialog("upgrade");
      return false;
    },
    [aiOk],
  );

  const startFreeAccess = useCallback(async () => {
    if (!userId) {
      toast("Sign in first", { description: "Free Access is linked to your account." });
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("start_free_access");
      if (error) throw new Error(error.message);
      const r = data as { started_at: string; ends_at: string; created: boolean } | null;
      if (!r?.ends_at) throw new Error("Free Access could not start");
      setFreeAccess({ started_at: r.started_at, ends_at: r.ends_at });
      const ends = new Date(r.ends_at).getTime();
      if (ends <= Date.now()) {
        toast("Free Access was already used on this account", {
          description: "Start the Premium trial or choose a plan to keep saving and exporting.",
        });
        setDialog("upgrade");
        return;
      }
      setDialog("none");
      toast.success(r.created ? `Free Access started — ${FREE_ACCESS_DAYS} days` : "Free Access is on", {
        description: `Save, export and master until ${formatPlanDate(ends)}. No card, nothing to cancel.`,
      });
    } catch (e) {
      toast.error("Free Access could not start", {
        description: e instanceof Error ? e.message : "Please try again in a moment.",
      });
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const switchPlan = useCallback(
    async (plan: PlanId) => {
      const priceId = PLAN_PRICES[plan].id;
      if (!subscription || subscription.price_id === priceId) return;
      setBusy(true);
      try {
        await changePlan({ data: { priceId, environment: env } });
        toast.success("Plan switched", {
          description:
            subscription.status === "trialing"
              ? `Nothing changes during your trial. ${PLAN_PRICES[plan].label} per ${PLAN_PRICES[plan].per} starts when it ends.`
              : "Unused time was credited automatically. Your next bill reflects the new plan.",
        });
        if (userId) await loadSubscription(userId);
      } catch (e) {
        toast.error("Plan could not be switched", {
          description: e instanceof Error ? e.message : "Please try again in a moment.",
        });
      } finally {
        setBusy(false);
      }
    },
    [subscription, env, userId, loadSubscription],
  );

  const startPremium = useCallback(
    async (plan: PlanId) => {
      const priceId = PLAN_PRICES[plan].id;
      if (subActive && subscription) {
        // Already subscribed: switch instead of buying a second plan.
        await switchPlan(plan);
        setDialog("none");
        return;
      }
      if (!userId) {
        toast("Sign in first", {
          description: "You need an account so the purchase can be linked to you.",
        });
        return;
      }
      setBusy(true);
      try {
        const guard = await checkoutAllowed({ data: { environment: env } });
        if (!guard.allowed) {
          await loadSubscription(userId);
          toast("You already have a plan", {
            description: "Switch monthly / yearly or cancel in Settings → Account.",
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
        setBusy(false);
      }
    },
    [subActive, subscription, switchPlan, userId, env, email, loadSubscription],
  );

  // Run the option picked on the pricing page once the account's plan has loaded.
  useEffect(() => {
    if (!userId || loadedFor !== userId || intentRan.current) return;
    let intent: string | null = null;
    try {
      intent = sessionStorage.getItem(INTENT_KEY);
      if (intent) sessionStorage.removeItem(INTENT_KEY);
    } catch {
      return;
    }
    if (!intent) return;
    intentRan.current = true;
    if (tier !== "free") return; // already has access
    if (intent === "free") void startFreeAccess();
    else void startPremium(intent === "premium:yearly" ? "yearly" : "monthly");
  }, [userId, loadedFor, tier, startFreeAccess, startPremium]);

  const manageBilling = useCallback(async () => {
    try {
      const { url } = await createPortalLink({ data: { environment: env } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error("Billing page unavailable", {
        description: e instanceof Error ? e.message : "Please try again in a moment.",
      });
    }
  }, [env]);

  const cancelPlan = useCallback(async () => {
    const wasTrial = subscription?.status === "trialing";
    const end = subscription?.current_period_end
      ? formatPlanDate(new Date(subscription.current_period_end).getTime())
      : null;
    setBusy(true);
    try {
      await cancelMyPlan({ data: { environment: env } });
      if (userId) await loadSubscription(userId);
      toast.success(wasTrial ? "Trial cancelled — you won't be charged" : "Plan cancelled", {
        description: end
          ? `Premium stays on until ${end}. No further payments will be taken.`
          : "No further payments will be taken.",
      });
    } catch (e) {
      toast.error("Could not cancel", {
        description: e instanceof Error ? e.message : "Please try again in a moment.",
      });
    } finally {
      setBusy(false);
    }
  }, [subscription, env, userId, loadSubscription]);

  const keepPlan = useCallback(async () => {
    setBusy(true);
    try {
      await keepMyPlan({ data: { environment: env } });
      if (userId) await loadSubscription(userId);
      toast.success("Your plan will continue");
    } catch (e) {
      toast.error("Could not undo the cancellation", {
        description: e instanceof Error ? e.message : "Please try again in a moment.",
      });
    } finally {
      setBusy(false);
    }
  }, [env, userId, loadSubscription]);

  const value: PlanState = {
    tier,
    email,
    trialDaysLeft,
    trialEndsAt,
    isPro,
    canUseAi: aiOk,
    subscription,
    freeAccess,
    busy,
    requirePro,
    requirePremium,
    openUpgrade,
    openStartChoice,
    startFreeAccess,
    startPremium,
    switchPlan,
    manageBilling,
    cancelPlan,
    keepPlan,
  };

  const freeAvailable = !freeAccess && !subscription;

  return (
    <PlanContext.Provider value={value}>
      <PaymentTestModeBanner />
      {children}
      <Dialog open={dialog === "choice"} onOpenChange={(o) => !o && setDialog("none")}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest">
              Choose how to start
            </DialogTitle>
            <DialogDescription>
              {blocked && !isPro ? `${blocked.label} needs Free Access, the Premium trial or a plan. ` : ""}
              Two ways to try SYNCLAB for {TRIAL_DAYS} days. You can upgrade any time.
            </DialogDescription>
          </DialogHeader>
          <StartChoice
            freeAvailable={freeAvailable}
            busy={busy}
            onStartFree={() => void startFreeAccess()}
            onStartPremium={(p) => void startPremium(p)}
          />
          <p className="text-center text-xs text-muted-foreground">
            Not now? Close this — you can still make music in the free version, and start later
            from Settings → Account.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "upgrade"} onOpenChange={(o) => !o && setDialog("none")}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display uppercase tracking-widest">
              <Crown className="size-4 text-primary" />{" "}
              {subActive ? "Your SYNCLAB plan" : "SYNCLAB Premium"}
            </DialogTitle>
            <DialogDescription>
              {blocked?.premium && !aiOk
                ? `${blocked.label} is part of SYNCLAB Premium. `
                : blocked && !isPro
                  ? `${blocked.label} needs Free Access, the Premium trial or a plan. `
                  : ""}
              {subActive
                ? "Switch between monthly and yearly, update your card or cancel below."
                : `Try every Premium feature free for ${TRIAL_DAYS} days. A card is required; nothing is charged until the trial ends, and you can cancel before then to pay nothing.`}
            </DialogDescription>
          </DialogHeader>
          {subActive ? (
            <PlanStatusPanel />
          ) : (
            <UpgradeOffer
              busy={busy}
              freeAvailable={freeAvailable}
              onPremium={(p) => void startPremium(p)}
              onFree={() => void startFreeAccess()}
            />
          )}
        </DialogContent>
      </Dialog>
    </PlanContext.Provider>
  );
}

/** Premium sales screen for people without a running subscription. */
function UpgradeOffer({
  busy,
  freeAvailable,
  onPremium,
  onFree,
}: {
  busy: boolean;
  freeAvailable: boolean;
  onPremium: (plan: PlanId) => void;
  onFree: () => void;
}) {
  const billDate = formatPlanDate(Date.now() + TRIAL_DAYS * DAY);
  return (
    <div className="space-y-3">
      <ul className="space-y-1 text-sm">
        {PREMIUM_FEATURES.map((f) => (
          <li key={f} className="flex gap-2">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["monthly", "yearly"] as const).map((id) => (
          <button
            key={id}
            disabled={busy}
            onClick={() => onPremium(id)}
            className={cn(
              "rounded-sm border px-3 py-3 text-left transition-colors disabled:opacity-50",
              id === "yearly"
                ? "border-primary bg-primary/15 hover:bg-primary/25"
                : "border-border bg-surface-2 hover:border-primary/60",
            )}
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {id === "monthly" ? "Monthly" : "Yearly"}
            </div>
            <div className="mt-1 font-display text-xl">{PLAN_PRICES[id].label}</div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              per {PLAN_PRICES[id].per} after {TRIAL_DAYS} free days
            </div>
          </button>
        ))}
      </div>
      <Button onClick={() => onPremium("monthly")} disabled={busy} className="w-full">
        <Sparkles className="size-4" /> Start {TRIAL_DAYS}-day Premium trial
      </Button>
      <p className="text-xs text-muted-foreground">
        Renews automatically: the first charge is on {billDate} unless you cancel before then in
        Settings → Account. Taxes are handled by our payment partner, Paddle.
      </p>
      {freeAvailable && (
        <Button variant="outline" onClick={onFree} disabled={busy} className="w-full">
          Or start {FREE_ACCESS_DAYS} days Free Access — no card (no AI tools)
        </Button>
      )}
    </div>
  );
}

/**
 * Account dashboard card: plan, trial countdown, end date and every plan action
 * (upgrade, switch, payment method, cancel / keep).
 */
export function PlanStatusPanel() {
  const {
    tier,
    trialEndsAt,
    subscription,
    freeAccess,
    busy,
    openUpgrade,
    openStartChoice,
    startFreeAccess,
    switchPlan,
    manageBilling,
    cancelPlan,
    keepPlan,
  } = usePlan();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const now = Date.now();
  const planId = planIdOf(subscription);
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : null;
  const subRunning = subscriptionIsActive(subscription, now) && subscription?.status !== "canceled";
  const cancelling = !!subscription?.cancel_at_period_end;
  const pastDue = subscription?.status === "past_due";
  const faEnded = freeAccess && new Date(freeAccess.ends_at).getTime() <= now;

  const name =
    tier === "founder"
      ? "Founder — lifetime access"
      : tier === "trial"
        ? "Premium trial"
        : tier === "pro"
          ? `Premium — ${planId === "yearly" ? "Yearly" : "Monthly"}`
          : tier === "free_access"
            ? "Free Access"
            : "Free version";

  const nextPrice = planId ? PLAN_PRICES[planId] : PLAN_PRICES.monthly;

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface-2 p-4" data-plan-status>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-display text-lg">{name}</div>
        {trialEndsAt !== null && (tier === "trial" || tier === "free_access") && (
          <div className="font-mono text-xs uppercase tracking-widest text-primary" data-trial-countdown>
            {trialStatusLabel(trialEndsAt, now)}
          </div>
        )}
      </div>

      <div className="space-y-1 text-sm text-muted-foreground">
        {tier === "founder" && <p>Everything is unlocked. Nothing to pay.</p>}
        {tier === "free_access" && trialEndsAt !== null && (
          <>
            <p>Free Access ends {formatPlanDate(trialEndsAt)}. No card on file — nothing will be charged.</p>
            <p>Saving, export and mastering are on. AI tools need Premium.</p>
          </>
        )}
        {tier === "trial" && periodEnd !== null && (
          <p>
            {cancelling
              ? `Trial cancelled — you won't be charged. Premium stays on until ${formatPlanDate(periodEnd)}.`
              : `Trial ends ${formatPlanDate(periodEnd)}. Then ${nextPrice.label} per ${nextPrice.per} is charged automatically unless you cancel before that date.`}
          </p>
        )}
        {tier === "pro" && periodEnd !== null && (
          <p>
            {cancelling || subscription?.status === "canceled"
              ? `Cancelled — Premium stays on until ${formatPlanDate(periodEnd)}. No further payments.`
              : `${nextPrice.label} per ${nextPrice.per}. Renews ${formatPlanDate(periodEnd)}.`}
          </p>
        )}
        {tier === "free" && (
          <p>
            {faEnded
              ? `Free Access ended ${formatPlanDate(new Date(freeAccess!.ends_at).getTime())}. Your songs are still in your account — choose a plan to save and export again.`
              : subscription
                ? "Your plan has ended. Your songs are still in your account — choose a plan to save and export again."
                : "You can make music, but saving, export, mastering and AI tools need Free Access, the Premium trial or a plan."}
          </p>
        )}
      </div>

      {pastDue && (
        <div className="flex gap-2 rounded-sm border border-destructive/60 bg-destructive/10 p-2 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            Your last payment didn't go through. Update your card to keep Premium — our payment
            partner will try again automatically.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tier === "free" && !freeAccess && !subscription && (
          <Button size="sm" onClick={openStartChoice}>
            Start 14 days free
          </Button>
        )}
        {(tier === "free" || tier === "free_access") && (
          <Button size="sm" variant={tier === "free" && !freeAccess && !subscription ? "secondary" : "default"} onClick={() => openUpgrade()}>
            <Crown className="size-4" /> Upgrade to Premium
          </Button>
        )}
        {tier === "free" && !freeAccess && subscription && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void startFreeAccess()}>
            Start Free Access (no card)
          </Button>
        )}
        {subRunning && planId && !cancelling && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void switchPlan(planId === "yearly" ? "monthly" : "yearly")}
          >
            Switch to {planId === "yearly" ? "Monthly" : "Yearly"} (
            {PLAN_PRICES[planId === "yearly" ? "monthly" : "yearly"].label})
          </Button>
        )}
        {subscription && (subRunning || pastDue) && (
          <Button size="sm" variant={pastDue ? "default" : "secondary"} onClick={() => void manageBilling()}>
            {pastDue ? "Update payment method" : "Manage payment method"}
          </Button>
        )}
        {subRunning && !cancelling && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmCancel(true)}>
            {tier === "trial" ? "Cancel trial" : "Cancel subscription"}
          </Button>
        )}
        {subRunning && cancelling && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void keepPlan()}>
            Keep my plan
          </Button>
        )}
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tier === "trial" ? "Cancel your trial?" : "Cancel your subscription?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {tier === "trial"
                ? `You won't be charged. Premium stays on until ${periodEnd ? formatPlanDate(periodEnd) : "the trial ends"}, then the account goes back to the free version. Your songs stay in your account.`
                : `No further payments will be taken. Premium stays on until ${periodEnd ? formatPlanDate(periodEnd) : "the paid period ends"}. Your songs stay in your account.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Premium</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void cancelPlan()}
            >
              {tier === "trial" ? "Cancel trial" : "Cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function usePlan(): PlanState {
  const v = useContext(PlanContext);
  if (!v) throw new Error("usePlan must be used inside PlanProvider");
  return v;
}

/** Small badge for headers/menus: shows trial days left or the plan. */
export function PlanBadge() {
  const { tier, trialDaysLeft, openUpgrade, openStartChoice, subscription, freeAccess } =
    usePlan();
  const needsChoice = needsStartChoice(tier, subscription, freeAccess);
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
  if (tier === "trial" || tier === "free_access")
    return (
      <button
        onClick={() => openUpgrade()}
        className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        title={
          tier === "free_access"
            ? "Free Access — no card, nothing will be charged"
            : subscription?.cancel_at_period_end
              ? "Trial cancelled — you won't be charged"
              : "Premium trial — billing starts when it ends unless you cancel"
        }
      >
        {tier === "free_access" ? "Free Access" : "Trial"} · {trialDaysLeft}d left
      </button>
    );
  return (
    <button
      onClick={() => (needsChoice ? openStartChoice() : openUpgrade())}
      className="flex items-center gap-1 rounded-sm border border-primary/60 bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary"
      title="Free version — projects can't be saved. Tap to see the 14-day options."
    >
      <Crown className="size-3" /> Free · {needsChoice ? "Start 14 days free" : "Upgrade"}
    </button>
  );
}

/**
 * Test mode (?test=1) only: a fixed local plan with no account, trial check, checkout or server call.
 * Local features (export to a file, mastering) work; cloud saving is refused.
 */
const TEST_MSG = "Not available in test mode — nothing is saved or sent.";
const testNoop = async () => {
  toast(TEST_MSG);
};

export function TestPlanProvider({ children }: { children: ReactNode }) {
  const value = useMemo<PlanState>(
    () => ({
      tier: "trial",
      email: null,
      trialDaysLeft: TRIAL_DAYS,
      trialEndsAt: null,
      isPro: true,
      canUseAi: true,
      subscription: null,
      freeAccess: null,
      busy: false,
      requirePro: (feature) => {
        if (/cloud/i.test(feature)) {
          toast("Not available in test mode — nothing is saved or sent.");
          return false;
        }
        return true;
      },
      requirePremium: () => true,
      openUpgrade: () => toast(TEST_MSG),
      openStartChoice: () => toast(TEST_MSG),
      startFreeAccess: testNoop,
      startPremium: testNoop,
      switchPlan: testNoop,
      manageBilling: testNoop,
      cancelPlan: testNoop,
      keepPlan: testNoop,
    }),
    [],
  );
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
