import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error('Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  notes: string | null;
  scent_profile: string | null;
  burn_time: string | null;
  weight_g: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Order = {
  id: string;
  stripe_session_id: string;
  stripe_payment_intent: string | null;
  customer_email: string;
  customer_name: string | null;
  amount_total_pence: number;
  currency: string;
  status: string;
  line_items: any;
  shipping_address: any;
  created_at: string;
};

export async function getActiveProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as Product[];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return (data as Product) || null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('id', ids)
    .eq('is_active', true);
  if (error) throw error;
  return (data || []) as Product[];
}
