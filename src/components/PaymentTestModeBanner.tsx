import { getPaddleEnvironment } from "@/lib/paddle";

/** Shown only while the app runs against the test payment environment. */
export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="payment-test-banner w-full border-b border-amber-500/40 bg-amber-500/10 px-3 py-1 text-center font-mono text-[10px] uppercase tracking-widest text-amber-300">
      Test payments mode — no real charges
    </div>
  );
}
