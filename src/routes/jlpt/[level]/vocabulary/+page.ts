import { error } from '@sveltejs/kit';
import { levelFromSlug, vocabularyForLevel } from '$lib/jlpt-pages';
import type { PageLoad } from './$types';

/** Vocabulary for one JLPT level. Server-rendered so crawlers get full HTML. */
export const ssr = true;

export const load: PageLoad = ({ params }) => {
	const level = levelFromSlug(params.level);
	if (!level) error(404, 'Not found');
	return { vocabulary: vocabularyForLevel(level) };
};
