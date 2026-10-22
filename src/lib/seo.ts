export const siteName = 'WK Flash';

export const defaultTitle = 'WK Flash | Faster unofficial WaniKani reviews';

export const defaultDescription =
	'WK Flash is an unofficial WaniKani study app that combines meaning and reading on one card, with keyboard-fast reviews, controller support, and JLPT analytics.';

export const aboutDescription =
	'WK Flash is an unofficial third-party study app for WaniKani users. It combines meaning and reading on one card to cut review time, with offline reviews, controller support, and JLPT analytics.';

export const publicPaths = ['/', '/about'] as const;

export function isPublicPath(pathname: string): boolean {
	return (publicPaths as readonly string[]).includes(pathname);
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
