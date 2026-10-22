import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	const sitemap = new URL('/sitemap.xml', url.origin).href;
	const body = `User-agent: *
Allow: /
Allow: /about
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
