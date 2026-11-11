import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { onPersistentHydrate, readPersistent, writePersistent } from '$lib/persistent-storage';

const STORAGE_KEY = 'wk-flash:audio-settings';
/** Volume multiplier. 1 is the clip's normal level; values above 1 boost it through Web Audio. */
const MAX_VOLUME = 4;
/** The slider shows 0–200%. Each displayed percent plays at twice that level, so 200% shown = 400% gain. */
export const SLIDER_MAX = 200;
const defaults: ReviewAudioSettings = { autoplayAfterAnswer: false, volume: 1.5, keepAudioAwake: false };

function clampVolume(volume: number): number {
	return Math.min(MAX_VOLUME, Math.max(0, volume));
}

/** Converts a slider percent (0–200) to a volume multiplier (0–4). */
export function volumeFromSlider(percent: number): number {
	return clampVolume(Math.min(SLIDER_MAX, Math.max(0, percent)) / 50);
}

/** Converts a volume multiplier (0–4) back to a slider percent (0–200). */
export function sliderFromVolume(volume: number): number {
	return clampVolume(volume) * 50;
}

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
					? clampVolume(stored.volume)
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
	const level = clampVolume(volume);
	const ready = readyClips.get(url);
	const player = createPlayer(ready ?? url, level, ready !== undefined);
	currentPlayer = player;
	return player.play().then(
		() => true,
		() => {
			// Only retry when there is something different to try: a downloaded copy that would not play
			// (some phones reject blob audio), or a boosted remote request that the CDN refused (no CORS).
			if (!ready && level <= 1) return false;
			if (ready) {
				URL.revokeObjectURL(ready);
				readyClips.delete(url);
				clipRequests.delete(url);
			}
			const fallback = createPlayer(url, Math.min(1, level), false);
			currentPlayer = fallback;
			return fallback.play().then(
				() => true,
				() => false
			);
		}
	);
}

let sharedContext: AudioContext | null = null;

/**
 * Creates an element for a clip. Levels above 1 are routed through Web Audio, since an element's own
 * volume cannot go past 1. Remote clips need CORS for Web Audio to read them; without it the output is silent.
 */
function createPlayer(source: string, level: number, sameOrigin: boolean): HTMLAudioElement {
	const player = new Audio();
	if (level > 1 && !sameOrigin) player.crossOrigin = 'anonymous';
	player.src = source;
	if (level <= 1 || !boostOutput(player, level)) player.volume = Math.min(1, level);
	return player;
}

/** Sends the element through a gain stage and a light limiter. Returns false if Web Audio is unavailable. */
function boostOutput(player: HTMLAudioElement, level: number): boolean {
	try {
		if (!sharedContext) {
			const AudioContextCtor =
				window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!AudioContextCtor) return false;
			sharedContext = new AudioContextCtor();
		}
		const context = sharedContext;
		// Must run inside the user gesture that starts playback, or iOS leaves the context suspended.
		void context.resume();

		const source = context.createMediaElementSource(player);
		const gain = context.createGain();
		gain.gain.value = level;
		// Stops boosted peaks from clipping harshly. It only acts on loud peaks, so normal clips are unchanged.
		const limiter = context.createDynamicsCompressor();
		limiter.threshold.value = -1;
		limiter.knee.value = 0;
		limiter.ratio.value = 20;
		limiter.attack.value = 0.003;
		limiter.release.value = 0.1;
		source.connect(gain).connect(limiter).connect(context.destination);

		player.addEventListener(
			'ended',
			() => {
				source.disconnect();
				gain.disconnect();
				limiter.disconnect();
			},
			{ once: true }
		);
		return true;
	} catch {
		return false;
	}
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
						? clampVolume(patch.volume)
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
