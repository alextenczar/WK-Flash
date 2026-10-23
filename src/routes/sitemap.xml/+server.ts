import { publicPaths, siteOrigin } from '$lib/seo';
import { jlptSitemapPaths } from '$lib/jlpt-pages';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	const origin = siteOrigin(url.origin);
	const paths: string[] = [...publicPaths, ...jlptSitemapPaths()];
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
	.map(
		(path) => `  <url>
    <loc>${new URL(path, origin).href}</loc>
    <changefreq>${path === '/' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${path === '/' ? '1.0' : '0.7'}</priority>
  </url>`
	)
	.join('\n')}
</urlset>
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
