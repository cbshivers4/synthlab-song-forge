import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Ends a visit when the page closes. Browsers only deliver requests sent while a page closes
 * as plain keep-alive requests, so this is a route rather than a server function. The caller's
 * sign-in token is checked here and only their own visit is changed.
 */
const Body = z.object({
  token: z.string().min(20).max(4000),
  visitId: z.string().uuid(),
  seconds: z.number().min(0).max(100_000),
});

export const Route = createFileRoute("/api/public/visit-end")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(JSON.parse(await request.text()));
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.getUser(body.token);
        if (error || !data.user) return new Response("Unauthorized", { status: 401 });
        const { recordVisitBeat } = await import("@/lib/founder/visits.server");
        await recordVisitBeat(
          supabaseAdmin,
          {
            id: data.user.id,
            email: (data.user.email ?? "").toLowerCase(),
            meta: data.user.user_metadata ?? null,
          },
          { visitId: body.visitId, seconds: body.seconds, ended: true },
        );
        return new Response(null, { status: 204 });
      },
    },
  },
});
