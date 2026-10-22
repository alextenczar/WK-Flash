import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { onPersistentHydrate, readPersistent, writePersistent } from '$lib/persistent-storage';

export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'wk-flash:theme';

const themeColors: Record<ThemeMode, string> = {
	dark: '#000000',
	light: '#ffffff'
};

/** Dark is the default; only an explicit "light" choice changes the theme. */
function currentTheme(): ThemeMode {
	return readPersistent(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

function applyTheme(mode: ThemeMode): void {
	if (!browser) return;
	document.documentElement.dataset.theme = mode;
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[mode]);
}

const themeStore = writable<ThemeMode>(currentTheme());
themeStore.subscribe(applyTheme);
onPersistentHydrate(() => themeStore.set(currentTheme()));

export const theme = {
	subscribe: themeStore.subscribe,
	set(mode: ThemeMode) {
		writePersistent(THEME_STORAGE_KEY, mode);
		themeStore.set(mode);
	}
};
