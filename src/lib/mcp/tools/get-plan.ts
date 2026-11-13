import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_plan",
  title: "Get subscription plan",
  description: "Show the signed-in user's SYNCLAB subscription status and renewal date (read-only; billing changes happen in the app).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Sign in to SYNCLAB first.");
    const db = supabaseForUser(ctx);
    const { data, error } = await db.from("subscriptions").select("status, current_period_end, cancel_at_period_end").order("updated_at", { ascending: false }).limit(1);
    if (error) throw new ToolError(`Could not read the plan: ${error.message}`);
    const sub = data?.[0];
    if (!sub) return { content: [{ type: "text", text: "No paid subscription — free plan (projects can't be saved)." }], structuredContent: { status: "free", renews: null, cancelsAtPeriodEnd: false } };
    const text = `Subscription ${sub.status}${sub.current_period_end ? `, ${sub.cancel_at_period_end ? "ends" : "renews"} ${sub.current_period_end}` : ""}.`;
    return { content: [{ type: "text", text }], structuredContent: { status: sub.status, renews: sub.current_period_end, cancelsAtPeriodEnd: sub.cancel_at_period_end } };
  },
});
