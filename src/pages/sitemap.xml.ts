import type { APIRoute } from 'astro';
import { getActiveProducts, supabase } from '../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const siteUrl =
    (import.meta.env.PUBLIC_SITE_URL as string) || `${url.protocol}//${url.host}`;

  const products = await getActiveProducts().catch(() => []);
  const { data: posts } = await supabase
    .from('content')
    .select('slug, published_at')
    .not('published_at', 'is', null);

  const urls = [
    { loc: '/', priority: '1.0' },
    { loc: '/shop', priority: '0.9' },
    { loc: '/about', priority: '0.7' },
    { loc: '/journal', priority: '0.7' },
    { loc: '/cart', priority: '0.3' },
    ...products.map((p) => ({ loc: `/shop/${p.slug}`, priority: '0.8' })),
    ...((posts || []).map((p: any) => ({ loc: `/journal/${p.slug}`, priority: '0.6' }))),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${siteUrl}${u.loc}</loc><priority>${u.priority}</priority></url>`,
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
