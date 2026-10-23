import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** A level has no content of its own, so its root sends visitors and crawlers to the kanji section with a 308. */
export const ssr = true;

export const load: PageLoad = ({ params }) => {
	redirect(308, `/jlpt/${params.level}/kanji`);
};
