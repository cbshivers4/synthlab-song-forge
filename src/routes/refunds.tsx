import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy — SYNCLAB" },
      {
        name: "description",
        content: "SYNCLAB's 30-day money-back guarantee and how to request a refund through Paddle.",
      },
      { property: "og:title", content: "Refund Policy — SYNCLAB" },
      { property: "og:description", content: "30-day money-back guarantee on SYNCLAB Pro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundsRoute,
});

function RefundsRoute() {
  return (
    <LegalPage title="Refund Policy" updated="21 September 2026">
      <p>
        SYNCLAB is operated by <strong>Christopher Shivers</strong>. Every plan starts with a 7-day
        free trial, so you can test the studio before paying anything.
      </p>

      <h2>30-day money-back guarantee</h2>
      <p>
        If you are not satisfied with SYNCLAB Pro, you can request a full refund within{" "}
        <strong>30 days</strong> of your order date — monthly or yearly, no explanation needed.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Refunds are processed by our payment provider and Merchant of Record, Paddle. Visit{" "}
        <a className="underline" href="https://paddle.net" target="_blank" rel="noreferrer">
          paddle.net
        </a>{" "}
        with the email address you used at checkout, or email us at{" "}
        <strong>cbshivers@gmail.com</strong> and we will arrange it with Paddle for you.
      </p>

      <h2>After a refund</h2>
      <p>
        Refunds are returned to the original payment method, usually within 5-10 business days
        depending on your bank. The subscription ends and Pro features (export, mastering saves and
        cloud saving) return to the free level; your projects stay in your account.
      </p>

      <h2>Cancelling instead</h2>
      <p>
        You can cancel at any time from the upgrade panel in the app or via paddle.net. Cancelling
        stops future renewals and you keep Pro access until the end of the period you already paid
        for.
      </p>

      <p>
        Paddle's own{" "}
        <a
          className="underline"
          href="https://www.paddle.com/legal/refund-policy"
          target="_blank"
          rel="noreferrer"
        >
          refund policy
        </a>{" "}
        also applies to all orders.
      </p>
    </LegalPage>
  );
}
