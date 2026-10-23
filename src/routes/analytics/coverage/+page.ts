import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Server-side so crawlers get a real 308 to the public page.
export const ssr = true;

export const load: PageLoad = () => {
	redirect(308, '/jlpt-coverage');
};
