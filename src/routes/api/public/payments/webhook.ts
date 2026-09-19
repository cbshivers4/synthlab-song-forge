import { createFileRoute } from "@tanstack/react-router";
import { handlePaddleWebhook } from "@/lib/paddle-webhook.server";

/** Canonical Paddle webhook endpoint. */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handlePaddleWebhook(request),
    },
  },
});
