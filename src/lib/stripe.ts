import Stripe from 'stripe';

const key = import.meta.env.STRIPE_SECRET_KEY as string;
if (!key) throw new Error('Missing STRIPE_SECRET_KEY');

export const stripe = new Stripe(key, {
  apiVersion: '2025-09-30.clover' as any,
  typescript: true,
});
