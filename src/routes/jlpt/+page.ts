import { JLPT_LEVELS, kanjiSetSize, levelSlug, vocabularyForLevel } from '$lib/jlpt-pages';
import type { PageLoad } from './$types';

/** Public JLPT index. Server-rendered so crawlers get full HTML. */
export const ssr = true;

export const load: PageLoad = () => ({
	levels: JLPT_LEVELS.map((level) => ({
		level,
		slug: levelSlug(level),
		kanjiCount: kanjiSetSize(level),
		vocabularyCount: vocabularyForLevel(level).length
	}))
});
