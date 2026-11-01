/** Daily AI allowance per signed-in person (UTC day). Shared by every AI server function. */
export const AI_DAILY_LIMIT = 25;

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

export type Reservation = { ok: true; id: string; remaining: number } | { ok: false; error: string };

export const limitMessage = () =>
  `You've used all ${AI_DAILY_LIMIT} AI uses for today. They reset at midnight UTC (7 PM Detroit time in winter, 8 PM in summer).`;

/** Reserves one use before calling a paid AI service. */
export async function reserveAiUse(supabase: unknown, tool: string): Promise<Reservation> {
  const { data, error } = await (supabase as Rpc).rpc("consume_ai_use", { _tool: tool, _daily_limit: AI_DAILY_LIMIT });
  if (error) return { ok: false, error: "Couldn't check your AI allowance. Try again in a moment." };
  const r = data as { id: string | null; remaining: number } | null;
  if (!r?.id) return { ok: false, error: limitMessage() };
  return { ok: true, id: r.id, remaining: r.remaining };
}

/** Gives the use back when the AI service failed without producing anything. */
export async function refundAiUse(supabase: unknown, id: string) {
  await (supabase as Rpc).rpc("refund_ai_use", { _id: id });
}
