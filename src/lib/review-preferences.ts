import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'wk-flash:show-mnemonics';
const initial = browser ? localStorage.getItem(STORAGE_KEY) !== 'false' : true;
const store = writable(initial);

export const showMnemonics = {
	subscribe: store.subscribe,
	set(value: boolean) {
		if (browser) localStorage.setItem(STORAGE_KEY, String(value));
		store.set(value);
	}
};
