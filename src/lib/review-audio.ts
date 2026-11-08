import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { onPersistentHydrate, readPersistent, writePersistent } from '$lib/persistent-storage';

const STORAGE_KEY = 'wk-flash:audio-settings';
const defaults: ReviewAudioSettings = { autoplayAfterAnswer: false, volume: 0.7, keepAudioAwake: false };

export interface ReviewAudioSettings {
	autoplayAfterAnswer: boolean;
	volume: number;
	/** Plays silence during reviews so Bluetooth headphones stay awake between cards. */
	keepAudioAwake: boolean;
}

function loadSettings(): ReviewAudioSettings {
	if (!browser) return defaults;
	try {
		const stored = JSON.parse(readPersistent(STORAGE_KEY) ?? 'null') as Partial<ReviewAudioSettings> | null;
		if (!stored) return defaults;
		return {
			autoplayAfterAnswer:
				typeof stored.autoplayAfterAnswer === 'boolean'
					? stored.autoplayAfterAnswer
					: defaults.autoplayAfterAnswer,
			volume:
				typeof stored.volume === 'number' && Number.isFinite(stored.volume)
					? Math.min(1, Math.max(0, stored.volume))
					: defaults.volume,
			keepAudioAwake:
				typeof stored.keepAudioAwake === 'boolean' ? stored.keepAudioAwake : defaults.keepAudioAwake
		};
	} catch {
		return defaults;
	}
}

const store = writable<ReviewAudioSettings>(loadSettings());
onPersistentHydrate(() => store.set(loadSettings()));

let currentPlayer: HTMLAudioElement | null = null;

/** Pronunciation clips already downloaded in memory, keyed by their original URL. */
const readyClips = new Map<string, string>();
/** Downloads in progress or finished, so each clip is fetched once. */
const clipRequests = new Map<string, Promise<void>>();
const MAX_CACHED_CLIPS = 8;

/**
 * Downloads a clip ahead of time so playing it does not wait on the network. This matters with
 * Bluetooth headphones, where a cold fetch adds delay before the sound starts. Failures are ignored,
 * and playback then uses the original URL.
 */
export function prefetchPronunciation(url: string | undefined): void {
	if (!browser || !url || clipRequests.has(url)) return;
	const request = fetch(url, { cache: 'force-cache' })
		.then(async (response) => {
			const contentType = response.headers.get('content-type') ?? '';
			// Only keep real audio. An error page cached here would fail to play.
			if (!response.ok || !contentType.startsWith('audio/')) return;
			const blob = await response.blob();
			readyClips.set(url, URL.createObjectURL(new Blob([blob], { type: contentType })));
			trimClipCache();
		})
		.catch(() => {
			clipRequests.delete(url);
		});
	clipRequests.set(url, request);
}

function trimClipCache(): void {
	while (readyClips.size > MAX_CACHED_CLIPS) {
		const oldestUrl = readyClips.keys().next().value;
		if (oldestUrl === undefined) return;
		URL.revokeObjectURL(readyClips.get(oldestUrl) ?? '');
		readyClips.delete(oldestUrl);
		clipRequests.delete(oldestUrl);
	}
}

/**
 * Plays pronunciation without interrupting other audio sources (iOS ambient session).
 * Uses the downloaded copy when it is ready, synchronously, so iOS still counts it as a user gesture.
 */
export function playPronunciation(url: string | undefined, volume: number): Promise<boolean> {
	if (!browser || !url) return Promise.resolve(false);
	currentPlayer?.pause();
	const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
	if (audioSession) audioSession.type = 'ambient';
	const ready = readyClips.get(url);
	const player = new Audio(ready ?? url);
	player.volume = Math.min(1, Math.max(0, volume));
	currentPlayer = player;
	return player.play().then(
		() => true,
		() => {
			if (!ready) return false;
			// The downloaded copy would not play (some phones reject blob audio), so use the original link.
			URL.revokeObjectURL(ready);
			readyClips.delete(url);
			clipRequests.delete(url);
			const fallback = new Audio(url);
			fallback.volume = player.volume;
			currentPlayer = fallback;
			return fallback.play().then(
				() => true,
				() => false
			);
		}
	);
}

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
		if (browser) writePersistent(STORAGE_KEY, JSON.stringify(next));
	}
};

let keepAwakePlayer: HTMLAudioElement | null = null;
let silentClipUrl: string | null = null;

/** One second of silent 8 kHz mono WAV, generated in memory. */
function silentClip(): string {
	if (silentClipUrl) return silentClipUrl;
	const sampleRate = 8000;
	const dataSize = sampleRate * 2;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);
	const writeText = (offset: number, text: string) => {
		for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
	};
	writeText(0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	writeText(8, 'WAVE');
	writeText(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeText(36, 'data');
	view.setUint32(40, dataSize, true);
	silentClipUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
	return silentClipUrl;
}

/**
 * Starts a silent loop when the setting is on. It must follow a user gesture, since iOS blocks
 * audio that starts on its own. The ambient session lets other apps' audio keep playing.
 */
export function keepAudioAwake(): void {
	if (!browser || !get(store).keepAudioAwake) return;
	if (keepAwakePlayer) return;
	const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
	if (audioSession) audioSession.type = 'ambient';
	const player = new Audio(silentClip());
	player.loop = true;
	keepAwakePlayer = player;
	void player.play().catch(() => {
		if (keepAwakePlayer === player) keepAwakePlayer = null;
	});
}

/** Stops the silent loop, for example when the review page is hidden or left. */
export function releaseAudioAwake(): void {
	keepAwakePlayer?.pause();
	keepAwakePlayer = null;
}
