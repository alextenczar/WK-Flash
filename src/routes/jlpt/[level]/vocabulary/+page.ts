import { error } from '@sveltejs/kit';
import { levelFromSlug, vocabularyListForLevel } from '$lib/jlpt-pages';
import type { PageLoad } from './$types';

/** Vocabulary for one JLPT level, ordered by WaniKani level. Server-rendered so crawlers get full HTML. */
export const ssr = true;

export const load: PageLoad = ({ params }) => {
	const level = levelFromSlug(params.level);
	if (!level) error(404, 'Not found');
	return { vocabulary: vocabularyListForLevel(level) };
};
