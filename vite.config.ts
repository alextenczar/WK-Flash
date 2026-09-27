import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter({ runtime: 'nodejs22.x' }),
			csp: {
				mode: 'nonce',
				directives: {
					'default-src': ['self'],
					'base-uri': ['self'],
					'connect-src': ['self', 'https://api.wanikani.com', 'ws:', 'wss:'],
					'font-src': ['self', 'data:'],
					'form-action': ['self'],
					'frame-ancestors': ['none'],
					'img-src': ['self', 'data:', 'https://cdn.wanikani.com'],
					'manifest-src': ['self'],
					'media-src': ['self', 'https://cdn.wanikani.com', 'https://files.wanikani.com'],
					'object-src': ['none'],
					'script-src': ['self'],
					'script-src-attr': ['none'],
					'style-src': ['self', 'unsafe-inline'],
					'worker-src': ['self']
				}
			}
		})
	]
});
