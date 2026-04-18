import type { APIRoute } from 'astro';
import { stripe } from '../../../lib/stripe';
import { supabase } from '../../../lib/supabase';
import { sendOrderConfirmation } from '../../../lib/email';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const sig = request.headers.get('stripe-signature');
  const secret = import.meta.env.STRIPE_WEBHOOK_SECRET as string | undefined;
  const raw = await request.text();

  let event: any;
  try {
    if (!secret) {
      // Unsigned path (dev only) — parse JSON directly.
      event = JSON.parse(raw);
      console.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
    } else {
      event = stripe.webhooks.constructEvent(raw, sig || '', secret);
    }
  } catch (e: any) {
    console.error('Invalid webhook signature', e?.message);
    return new Response(`Webhook Error: ${e?.message}`, { status: 400 });
  }

  // Idempotency: record each event_id once.
  const alreadyHandled = await supabase
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();
  if (alreadyHandled.data) {
    return new Response('already handled', { status: 200 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items.data.price.product', 'customer_details'],
      });

      const lineItems = (full.line_items?.data || []).map((li: any) => ({
        name: li.description || li.price?.product?.name || 'Item',
        quantity: li.quantity || 1,
        unit_amount_pence: li.price?.unit_amount || 0,
      }));

      const orderInsert = {
        stripe_session_id: full.id,
        stripe_payment_intent:
          typeof full.payment_intent === 'string' ? full.payment_intent : full.payment_intent?.id || null,
        customer_email: full.customer_details?.email || 'unknown@noreply',
        customer_name: full.customer_details?.name || null,
        amount_total_pence: full.amount_total || 0,
        currency: (full.currency || 'gbp').toLowerCase(),
        status: full.payment_status || 'paid',
        line_items: lineItems,
        shipping_address: full.shipping_details || full.customer_details?.address || null,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('orders')
        .insert(orderInsert)
        .select('id')
        .single();

      if (insertErr) console.error('orders insert error', insertErr);

      if (orderInsert.customer_email && orderInsert.customer_email !== 'unknown@noreply') {
        await sendOrderConfirmation({
          to: orderInsert.customer_email,
          customerName: orderInsert.customer_name,
          orderId: inserted?.id || full.id,
          amountTotalPence: orderInsert.amount_total_pence,
          currency: orderInsert.currency,
          items: lineItems,
        });
      }
    }

    await supabase.from('stripe_events').insert({ event_id: event.id, type: event.type });

    return new Response('ok', { status: 200 });
  } catch (e: any) {
    console.error('webhook handler error', e);
    return new Response(`handler error: ${e?.message || 'unknown'}`, { status: 500 });
  }
};

// Stripe requires raw body for signature validation — Astro gives us request.text() above.
export const GET: APIRoute = () => new Response('Stripe webhook endpoint', { status: 200 });
