import type { APIRoute } from 'astro';
import { getProductsByIds } from '../../lib/supabase';
import { stripe } from '../../lib/stripe';

export const prerender = false;

type InputItem = { id: string; quantity: number };

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const items: InputItem[] = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) {
      return json({ error: 'Cart is empty' }, 400);
    }

    // Build quantity map, clamped.
    const qtyMap = new Map<string, number>();
    for (const it of items) {
      if (!it?.id) continue;
      const q = Math.max(1, Math.min(20, Number(it.quantity) || 1));
      qtyMap.set(it.id, (qtyMap.get(it.id) || 0) + q);
    }

    // Load trusted prices from Supabase.
    const ids = Array.from(qtyMap.keys());
    const products = await getProductsByIds(ids);
    if (!products.length) {
      return json({ error: 'No valid products found' }, 400);
    }

    const currency = (products[0].currency || 'gbp').toLowerCase();

    // Dynamic price_data — no Stripe products / prices required.
    const line_items = products.map((p) => ({
      price_data: {
        currency,
        unit_amount: p.price_pence,
        product_data: {
          name: p.name,
          description: p.description?.slice(0, 180) || undefined,
          images: p.image_url ? [p.image_url] : undefined,
          metadata: { supabase_product_id: p.id, slug: p.slug },
        },
      },
      quantity: qtyMap.get(p.id) || 1,
    }));

    const subtotal = products.reduce(
      (a, p) => a + p.price_pence * (qtyMap.get(p.id) || 0),
      0,
    );
    const freeShippingThreshold = 6000;
    const shipping_options: any[] = [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: subtotal >= freeShippingThreshold ? 'Free UK delivery' : 'UK tracked delivery',
          fixed_amount: {
            amount: subtotal >= freeShippingThreshold ? 0 : 495,
            currency,
          },
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 3 },
            maximum: { unit: 'business_day', value: 5 },
          },
        },
      },
    ];

    const origin =
      (import.meta.env.PUBLIC_SITE_URL as string) || new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_address_collection: { allowed_countries: ['GB', 'IE', 'FR', 'DE', 'NL', 'ES', 'IT', 'US'] },
      shipping_options,
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: false },
      allow_promotion_codes: true,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      metadata: {
        supabase_product_ids: ids.join(','),
      },
    });

    return json({ id: session.id, url: session.url });
  } catch (e: any) {
    console.error('checkout error', e);
    return json({ error: e?.message || 'Checkout failed' }, 500);
  }
};

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
