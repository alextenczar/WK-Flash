import { error } from '@sveltejs/kit';
import { kanjiDetail } from '$lib/jlpt-pages';
import type { PageLoad } from './$types';

/** Public per-kanji page. Server-rendered so crawlers get full HTML. */
export const ssr = true;

export const load: PageLoad = ({ params }) => {
	const detail = kanjiDetail(params.character);
	if (!detail) error(404, 'Kanji not found');
	return { detail };
};
