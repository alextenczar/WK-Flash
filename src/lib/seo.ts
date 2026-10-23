import { env } from '$env/dynamic/public';

export const siteName = 'WK Flash';

export const defaultTitle = 'WK Flash | Faster unofficial WaniKani reviews';

export const defaultDescription =
	'WK Flash is an unofficial WaniKani study app that combines meaning and reading on one card, with keyboard-fast reviews, controller support, and JLPT analytics.';

export const aboutDescription =
	'WK Flash is an unofficial third-party study app for WaniKani users. It combines meaning and reading on one card to cut review time, with offline reviews, controller support, and JLPT analytics.';

export const publicPaths = ['/', '/about', '/how-it-works', '/jlpt-coverage'] as const;

// Matches /jlpt, /jlpt/n5 … /jlpt/n1, /jlpt/<level>/kanji and /jlpt/<level>/vocabulary, and /jlpt/kanji/<character>.
const jlptPagePattern = /^\/jlpt(\/(n[1-5](\/(kanji|vocabulary))?|kanji\/[^/]+))?$/;

export function isPublicPath(pathname: string): boolean {
	return (publicPaths as readonly string[]).includes(pathname) || jlptPagePattern.test(pathname);
}

/**
 * Origin used for canonical, Open Graph, sitemap, and robots URLs. Set PUBLIC_SITE_URL to the production
 * domain so every hostname the app is reachable on still points search engines at one canonical address.
 */
export function siteOrigin(requestOrigin: string): string {
	const configured = env.PUBLIC_SITE_URL?.trim();
	if (!configured) return requestOrigin;
	try {
		return new URL(configured).origin;
	} catch {
		return requestOrigin;
	}
}

export function absoluteUrl(origin: string, pathname: string): string {
	return new URL(pathname, origin).href;
}

export function webAppJsonLd(origin: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: siteName,
		url: origin,
		applicationCategory: 'EducationalApplication',
		operatingSystem: 'Web',
		isAccessibleForFree: true,
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD'
		},
		description: defaultDescription,
		featureList: [
			'Combined meaning and reading reviews on one flashcard',
			'Keyboard and game controller controls that work out of the box',
			'JLPT coverage, weakest items, and level-up forecast',
			'Offline review sessions with automatic sync',
			'Review session recovery stored in the browser'
		],
		browserRequirements: 'Requires JavaScript and a WaniKani personal access token.'
	};
}
