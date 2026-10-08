import { writable } from 'svelte/store';
import { onPersistentHydrate, readPersistent, removePersistent, writePersistent } from '$lib/persistent-storage';

const STORAGE_KEY = 'wk-flash:api-key';

function createApiKeyStore() {
	const { subscribe, set } = writable<string>(readPersistent(STORAGE_KEY) ?? '');

	onPersistentHydrate(() => {
		set(readPersistent(STORAGE_KEY) ?? '');
	});

	return {
		subscribe,
		set(value: string) {
			if (value) writePersistent(STORAGE_KEY, value);
			else removePersistent(STORAGE_KEY);
			set(value);
		},
		clear() {
			removePersistent(STORAGE_KEY);
			set('');
		}
	};
}

export const apiKey = createApiKeyStore();
