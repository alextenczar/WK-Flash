import { get, writable } from 'svelte/store';
import { onPersistentHydrate, readPersistent, writePersistent } from '$lib/persistent-storage';

const STORAGE_KEY = 'wk-flash:keybindings';
const GAMEPAD_STORAGE_KEY = 'wk-flash:gamepad-bindings';

export interface Keybindings {
	/** Flips the card from front to back. */
	flip: string;
	/** Grades the card correct. Only takes effect once the card is flipped. */
	correct: string;
	/** Grades the card wrong. Only takes effect once the card is flipped. */
	wrong: string;
	/** Opens or closes the more-information panel. Only takes effect once the card is flipped. */
	moreInfo: string;
	/** Returns to the previous review question. Needs the undo button preference turned on. */
	undo: string;
}

export const defaultKeybindings: Keybindings = {
	flip: 'd',
	correct: 'd',
	wrong: 'a',
	moreInfo: 'f',
	undo: 'ArrowUp'
};

/** Gamepad button indices, using the W3C "standard" mapping. */
export interface GamepadBindings {
	flip: number;
	correct: number;
	wrong: number;
	moreInfo: number;
	undo: number;
}

export const defaultGamepadBindings: GamepadBindings = {
	flip: 0,
	correct: 0,
	wrong: 1,
	moreInfo: 3,
	undo: 5
};

const keyboardKeyNames: Record<string, string> = {
	ArrowUp: '↑',
	ArrowDown: '↓',
	ArrowLeft: '←',
	ArrowRight: '→',
	' ': 'Space'
};

/** Human-readable name for a stored keyboard binding. */
export function keyboardKeyLabel(key: string): string {
	return keyboardKeyNames[key] ?? key.toUpperCase();
}

/** Button names for the W3C "standard" mapping, with Xbox and PlayStation names. */
const gamepadButtonNames = [
	'A / Cross',
	'B / Circle',
	'X / Square',
	'Y / Triangle',
	'LB / L1',
	'RB / R1',
	'LT / L2',
	'RT / R2',
	'Back / Select',
	'Start / Options',
	'L3',
	'R3',
	'D-pad up',
	'D-pad down',
	'D-pad left',
	'D-pad right',
	'Home / PS'
];

export function gamepadButtonLabel(button: number): string {
	return gamepadButtonNames[button] ?? `Button ${button}`;
}

function parseKeybindings(stored: string | null): Keybindings {
	if (!stored) return defaultKeybindings;
	try {
		const parsed: Partial<Keybindings> = JSON.parse(stored);
		return {
			flip: typeof parsed.flip === 'string' ? parsed.flip : defaultKeybindings.flip,
			correct: typeof parsed.correct === 'string' ? parsed.correct : defaultKeybindings.correct,
			wrong: typeof parsed.wrong === 'string' ? parsed.wrong : defaultKeybindings.wrong,
			moreInfo: typeof parsed.moreInfo === 'string' ? parsed.moreInfo : defaultKeybindings.moreInfo,
			undo: typeof parsed.undo === 'string' ? parsed.undo : defaultKeybindings.undo
		};
	} catch {
		return defaultKeybindings;
	}
}

function parseGamepadBindings(stored: string | null): GamepadBindings {
	if (!stored) return defaultGamepadBindings;
	try {
		const parsed: Partial<GamepadBindings> = JSON.parse(stored);
		const valid = (value: unknown, fallback: number) =>
			Number.isInteger(value) && (value as number) >= 0 ? (value as number) : fallback;
		return {
			flip: valid(parsed.flip, defaultGamepadBindings.flip),
			correct: valid(parsed.correct, defaultGamepadBindings.correct),
			wrong: valid(parsed.wrong, defaultGamepadBindings.wrong),
			moreInfo: valid(parsed.moreInfo, defaultGamepadBindings.moreInfo),
			undo: valid(parsed.undo, defaultGamepadBindings.undo)
		};
	} catch {
		return defaultGamepadBindings;
	}
}

function createKeybindingsStore() {
	const { subscribe, set } = writable<Keybindings>(parseKeybindings(readPersistent(STORAGE_KEY)));

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
			persist({ ...get({ subscribe }), [action]: key });
		},
		reset() {
			persist(defaultKeybindings);
		}
	};
}

function createGamepadBindingsStore() {
	const { subscribe, set } = writable<GamepadBindings>(
		parseGamepadBindings(readPersistent(GAMEPAD_STORAGE_KEY))
	);

	onPersistentHydrate(() => {
		set(parseGamepadBindings(readPersistent(GAMEPAD_STORAGE_KEY)));
	});

	function persist(value: GamepadBindings) {
		writePersistent(GAMEPAD_STORAGE_KEY, JSON.stringify(value));
		set(value);
	}

	return {
		subscribe,
		setBinding(action: keyof GamepadBindings, button: number) {
			persist({ ...get({ subscribe }), [action]: button });
		},
		reset() {
			persist(defaultGamepadBindings);
		}
	};
}

export const keybindings = createKeybindingsStore();
export const gamepadBindings = createGamepadBindingsStore();
