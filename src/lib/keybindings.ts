import { writable } from 'svelte/store';
import { onPersistentHydrate, readPersistent, writePersistent } from '$lib/persistent-storage';

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

function parseKeybindings(stored: string | null): Keybindings {
	if (!stored) return defaultKeybindings;
	try {
		const parsed: Partial<Keybindings> = JSON.parse(stored);
		return {
			flip: typeof parsed.flip === 'string' ? parsed.flip : defaultKeybindings.flip,
			correct: typeof parsed.correct === 'string' ? parsed.correct : defaultKeybindings.correct,
			wrong: typeof parsed.wrong === 'string' ? parsed.wrong : defaultKeybindings.wrong
		};
	} catch {
		return defaultKeybindings;
	}
}

function createKeybindingsStore() {
	const { subscribe, set, update } = writable<Keybindings>(parseKeybindings(readPersistent(STORAGE_KEY)));

	onPersistentHydrate(() => {
		set(parseKeybindings(readPersistent(STORAGE_KEY)));
	});

	function persist(value: Keybindings) {
		writePersistent(STORAGE_KEY, JSON.stringify(value));
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
