import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'wk-flash:api-key';

function createApiKeyStore() {
	const initial = browser ? (localStorage.getItem(STORAGE_KEY) ?? '') : '';
	const { subscribe, set } = writable<string>(initial);

	return {
		subscribe,
		set(value: string) {
			if (browser) {
				if (value) {
					localStorage.setItem(STORAGE_KEY, value);
				} else {
					localStorage.removeItem(STORAGE_KEY);
				}
			}
			set(value);
		},
		clear() {
			if (browser) localStorage.removeItem(STORAGE_KEY);
			set('');
		}
	};
}

export const apiKey = createApiKeyStore();
