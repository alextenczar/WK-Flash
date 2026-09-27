import { writable } from 'svelte/store';
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from '$lib/safe-storage';

const STORAGE_KEY = 'wk-flash:api-key';

function createApiKeyStore() {
	const initial = readLocalStorage(STORAGE_KEY) ?? '';
	const { subscribe, set } = writable<string>(initial);

	return {
		subscribe,
		set(value: string) {
			if (value) writeLocalStorage(STORAGE_KEY, value);
			else removeLocalStorage(STORAGE_KEY);
			set(value);
		},
		clear() {
			removeLocalStorage(STORAGE_KEY);
			set('');
		}
	};
}

export const apiKey = createApiKeyStore();
