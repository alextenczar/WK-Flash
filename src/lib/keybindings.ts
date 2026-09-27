import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { readLocalStorage, writeLocalStorage } from '$lib/safe-storage';

const STORAGE_KEY = 'wk-flash:keybindings';

export interface Keybindings {
	/** Flips the card from front to back. */
	flip: string;
	/** Grades the card correct. Only takes effect once the card is flipped. */
	correct: string;
	/** Grades the card wrong. Only takes effect once the card is flipped. */
	wrong: string;
}

export const defaultKeybindings: Keybindings = {
	flip: 'd',
	correct: 'd',
	wrong: 'a'
};

function createKeybindingsStore() {
	let initial = defaultKeybindings;
	if (browser) {
		const stored = readLocalStorage(STORAGE_KEY);
		if (stored) {
			try {
				const parsed: Partial<Keybindings> = JSON.parse(stored);
				initial = {
					flip: typeof parsed.flip === 'string' ? parsed.flip : defaultKeybindings.flip,
					correct: typeof parsed.correct === 'string' ? parsed.correct : defaultKeybindings.correct,
					wrong: typeof parsed.wrong === 'string' ? parsed.wrong : defaultKeybindings.wrong
				};
			} catch {
				initial = defaultKeybindings;
			}
		}
	}

	const { subscribe, set, update } = writable<Keybindings>(initial);

	function persist(value: Keybindings) {
		writeLocalStorage(STORAGE_KEY, JSON.stringify(value));
		set(value);
	}

	return {
		subscribe,
		setBinding(action: keyof Keybindings, key: string) {
			update((current) => {
				const next = { ...current, [action]: key };
				persist(next);
				return next;
			});
		},
		reset() {
			persist(defaultKeybindings);
		}
	};
}

export const keybindings = createKeybindingsStore();
