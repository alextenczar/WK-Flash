import { browser } from '$app/environment';

export function readLocalStorage(key: string): string | null {
	if (!browser) return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function writeLocalStorage(key: string, value: string): boolean {
	if (!browser) return false;
	try {
		localStorage.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

export function removeLocalStorage(key: string): void {
	if (!browser) return;
	try {
		localStorage.removeItem(key);
	} catch {
		// Storage may be blocked by browser privacy settings.
	}
}