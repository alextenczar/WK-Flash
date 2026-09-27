import { writable } from 'svelte/store';
import { readLocalStorage, writeLocalStorage } from '$lib/safe-storage';

const STORAGE_KEY = 'wk-flash:show-mnemonics';
const initial = readLocalStorage(STORAGE_KEY) !== 'false';
const store = writable(initial);
const SHOW_SRS_CHANGES_KEY = 'wk-flash:show-srs-changes';
const showSrsChangesStore = writable(readLocalStorage(SHOW_SRS_CHANGES_KEY) !== 'false');
const SHOW_PARTS_OF_SPEECH_KEY = 'wk-flash:show-parts-of-speech';
const showPartsOfSpeechStore = writable(readLocalStorage(SHOW_PARTS_OF_SPEECH_KEY) !== 'false');

export const showMnemonics = {
	subscribe: store.subscribe,
	set(value: boolean) {
		writeLocalStorage(STORAGE_KEY, String(value));
		store.set(value);
	}
};

export const showSrsChanges = {
	subscribe: showSrsChangesStore.subscribe,
	set(value: boolean) {
		writeLocalStorage(SHOW_SRS_CHANGES_KEY, String(value));
		showSrsChangesStore.set(value);
	}
};

export const showPartsOfSpeech = {
	subscribe: showPartsOfSpeechStore.subscribe,
	set(value: boolean) {
		writeLocalStorage(SHOW_PARTS_OF_SPEECH_KEY, String(value));
		showPartsOfSpeechStore.set(value);
	}
};
