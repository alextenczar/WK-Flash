import { browser } from '$app/environment';
import { writable } from 'svelte/store';

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
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			try {
				initial = { ...defaultKeybindings, ...JSON.parse(stored) };
			} catch {
				initial = defaultKeybindings;
			}
		}
	}

	const { subscribe, set, update } = writable<Keybindings>(initial);

	function persist(value: Keybindings) {
		if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
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
