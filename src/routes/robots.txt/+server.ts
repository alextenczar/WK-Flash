import { siteOrigin } from '$lib/seo';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	const sitemap = new URL('/sitemap.xml', siteOrigin(url.origin)).href;
	const body = `User-agent: *
Allow: /
Allow: /about
Allow: /jlpt
Allow: /jlpt-coverage
Allow: /how-it-works
Disallow: /review
Disallow: /settings
Disallow: /lessons
Disallow: /analytics
Disallow: /keybindings
Disallow: /kanji
Disallow: /radical
Disallow: /vocab

Sitemap: ${sitemap}
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
