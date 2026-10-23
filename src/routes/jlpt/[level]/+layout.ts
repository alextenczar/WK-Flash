import { error } from '@sveltejs/kit';
import { kanjiSetSize, levelFromSlug, levelSlug, vocabularyForLevel } from '$lib/jlpt-pages';
import type { LayoutLoad } from './$types';

/** Shared data for a JLPT level's kanji and vocabulary pages. Server-rendered so crawlers get full HTML. */
export const ssr = true;

export const load: LayoutLoad = ({ params }) => {
	const level = levelFromSlug(params.level);
	if (!level) error(404, 'Not found');
	return {
		level,
		slug: levelSlug(level),
		kanjiCount: kanjiSetSize(level),
		vocabularyCount: vocabularyForLevel(level).length
	};
};
