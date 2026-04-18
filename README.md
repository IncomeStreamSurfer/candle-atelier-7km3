# Candle Atelier

Dark, minimal e-commerce storefront for a small candle studio. Hand-poured four-candle
range, dynamic Stripe pricing from Supabase, client-side cart, Resend order emails.

## Stack

- **Astro 6** (SSR) with `@astrojs/vercel` adapter
- **Tailwind v4** via `@tailwindcss/vite`
- **Supabase** — products + orders + journal content
- **Stripe Checkout** — dynamic `price_data` built at request time from the Supabase row
- **Resend** — order confirmation emails
- **Vercel** — hosting

## What's in the box

- Home, Shop grid, Product detail, Cart, Success, About, Journal pages
- `/api/checkout` creates a Stripe Checkout Session with trusted prices from the DB
- `/api/stripe/webhook` handles `checkout.session.completed`, writes an `orders` row,
  sends a Resend email, and dedupes via the `stripe_events` table
- `sitemap.xml`, `robots.txt`, JSON-LD on every page (Organization, WebSite, Product,
  CollectionPage)
- `content` table already seeded for Harbor to publish articles into later

## Dev

```bash
npm install
cp .env.example .env   # fill in the values
npm run dev
```

## Database tables (already created in Supabase)

- `products` (id, slug, name, description, price_pence, currency, image_url, notes,
  scent_profile, burn_time, weight_g, is_active, sort_order, created_at)
- `orders` (stripe_session_id, customer_email, amount_total_pence, line_items, …)
- `stripe_events` (event_id, type) — idempotency guard
- `content` (slug, title, body, seo_description, published_at) — Harbor's journal hook

## Stripe dynamic pricing

`src/pages/api/checkout.ts` loads the cart IDs, reads prices from Supabase, and builds
`line_items: [{ price_data: { currency, unit_amount, product_data: {...} }, quantity }]`.
No Stripe products / prices are ever created — everything is built on the fly. Webhook
at `/api/stripe/webhook` is the source of truth for orders.

## Next steps (manual)

- Verify your own domain in Resend (`https://resend.com/domains`) and swap
  `onboarding@resend.dev` in `src/lib/email.ts` for your verified sender.
- Attach a custom domain in Vercel project settings.
- Add real product photography (currently Unsplash placeholders).
