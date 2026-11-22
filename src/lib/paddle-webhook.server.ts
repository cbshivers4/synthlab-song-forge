/** Shared Paddle webhook handling (server-only). Both webhook URLs call handlePaddleWebhook. */
import { createClient } from '@supabase/supabase-js';
import { verifyWebhook, EventName, type PaddleEnv } from '@/lib/paddle.server';

// Public by design: every request is authenticated by its Paddle signature.
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!);
  return _supabase;
}

// Supabase returns { error } instead of throwing. Throwing here makes the route answer 400,
// so Paddle retries the event instead of treating a failed write as delivered.
function assertOk(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what} failed: ${error.message}`);
}

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;
  const userId = customData?.userId;
  if (!userId) { console.error('No userId in customData'); return; }
  const item = items[0];
  const priceId = item.price.importMeta?.externalId;
  const productId = item.product.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn('Skipping subscription: missing importMeta.externalId', { rawPriceId: item.price.id, rawProductId: item.product.id });
    return;
  }
  const { error } = await getSupabase().from('subscriptions').upsert({
    user_id: userId,
    paddle_subscription_id: id,
    paddle_customer_id: customerId,
    product_id: productId,
    price_id: priceId,
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    cancel_at_period_end: data.scheduledChange?.action === 'cancel',
    environment: env,
    updated_at: new Date().toISOString(),
  } as never, { onConflict: 'paddle_subscription_id' });
  assertOk(error, 'Subscription upsert');
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange } = data;
  const { data: existing, error: lookupError } = await getSupabase().from('subscriptions').select('id').eq('paddle_subscription_id', id).maybeSingle();
  assertOk(lookupError, 'Subscription lookup');
  if (!existing) return handleSubscriptionCreated(data, env);
  const { error } = await getSupabase().from('subscriptions').update({
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    cancel_at_period_end: scheduledChange?.action === 'cancel',
    updated_at: new Date().toISOString(),
  } as never).eq('paddle_subscription_id', id).eq('environment', env);
  assertOk(error, 'Subscription update');
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const { error } = await getSupabase().from('subscriptions').update({ status: 'canceled', cancel_at_period_end: false, current_period_end: data.canceledAt ?? new Date().toISOString(), updated_at: new Date().toISOString() } as never)
    .eq('paddle_subscription_id', data.id).eq('environment', env);
  assertOk(error, 'Subscription cancel');
}

/**
 * Best-effort: tell the email service the account's new plan so the upgrade campaign
 * stops once someone pays. Never throws — a payment record must not fail because of it.
 */
async function syncMarketingPlan(data: any) {
  try {
    let userId: string | undefined = data?.customData?.userId;
    if (!userId && data?.id) {
      const { data: row } = await getSupabase().from('subscriptions').select('user_id').eq('paddle_subscription_id', data.id).maybeSingle();
      userId = (row as { user_id?: string } | null)?.user_id;
    }
    if (!userId) return;
    const { syncAccountPlan } = await import('@/lib/founder/loops.server');
    await syncAccountPlan(getSupabase() as never, userId);
  } catch (e) {
    console.error('Marketing plan sync failed (payment still recorded):', e);
  }
}

/** Verifies the Paddle signature, records the subscription change, and answers Paddle. */
export async function handlePaddleWebhook(request: Request): Promise<Response> {
  const env = (new URL(request.url).searchParams.get('env') || 'sandbox') as PaddleEnv;
  try {
    const event = await verifyWebhook(request, env);
    switch (event.eventType) {
      case EventName.SubscriptionCreated: await handleSubscriptionCreated(event.data, env); break;
      case EventName.SubscriptionUpdated: await handleSubscriptionUpdated(event.data, env); break;
      case EventName.SubscriptionCanceled: await handleSubscriptionCanceled(event.data, env); break;
      default: console.log('Unhandled event:', event.eventType);
    }
    await syncMarketingPlan(event.data as any);
    return Response.json({ received: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Webhook error', { status: 400 });
  }
}
