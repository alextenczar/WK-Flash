import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';

export const ssr = false;

injectAnalytics({ mode: dev ? 'development' : 'production' });
