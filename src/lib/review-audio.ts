import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'wk-flash:audio-settings';
const defaults: ReviewAudioSettings = { autoplayAfterAnswer: false, volume: 0.7 };

export interface ReviewAudioSettings {
	autoplayAfterAnswer: boolean;
	volume: number;
}

function loadSettings(): ReviewAudioSettings {
	if (!browser) return defaults;
	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ReviewAudioSettings> | null;
		if (!stored) return defaults;
		return {
			autoplayAfterAnswer:
				typeof stored.autoplayAfterAnswer === 'boolean'
					? stored.autoplayAfterAnswer
					: defaults.autoplayAfterAnswer,
			volume:
				typeof stored.volume === 'number' && Number.isFinite(stored.volume)
					? Math.min(1, Math.max(0, stored.volume))
					: defaults.volume
		};
	} catch {
		return defaults;
	}
}

const store = writable<ReviewAudioSettings>(loadSettings());

export const reviewAudioSettings = {
	subscribe: store.subscribe,
	update(patch: Partial<ReviewAudioSettings>) {
		let next = defaults;
		store.update((current) => {
			next = {
				...current,
				...patch,
				volume:
					typeof patch.volume === 'number' && Number.isFinite(patch.volume)
						? Math.min(1, Math.max(0, patch.volume))
						: current.volume
			};
			return next;
		});
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			} catch {
				// Audio settings remain usable for this page session when storage is unavailable.
			}
		}
	}
};
