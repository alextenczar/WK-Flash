import { browser } from '$app/environment';
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from '$lib/safe-storage';

const DB_NAME = 'wk-flash';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

const LARGE_KEYS = new Set([
	'wk-flash:active-review',
	'wk-flash:pending-reviews',
	'wk-flash:local-n1-review-progress'
]);

const memory = new Map<string, string>();
const dirty = new Set<string>();
const hydrators = new Set<() => void>();

let database: IDBDatabase | null = null;
let hydrated = false;
let initPromise: Promise<void> | null = null;

function isAppKey(key: string): boolean {
	return key.startsWith('wk-flash:');
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function kvStore(mode: IDBTransactionMode): IDBObjectStore | null {
	if (!database) return null;
	return database.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

async function idbGetAll(): Promise<Map<string, string>> {
	const store = kvStore('readonly');
	if (!store) return new Map();
	const entries = new Map<string, string>();
	await new Promise<void>((resolve, reject) => {
		const cursorRequest = store.openCursor();
		cursorRequest.onerror = () => reject(cursorRequest.error);
		cursorRequest.onsuccess = () => {
			const cursor = cursorRequest.result;
			if (!cursor) {
				resolve();
				return;
			}
			if (typeof cursor.key === 'string' && typeof cursor.value === 'string') {
				entries.set(cursor.key, cursor.value);
			}
			cursor.continue();
		};
	});
	return entries;
}

async function idbPut(key: string, value: string): Promise<void> {
	const store = kvStore('readwrite');
	if (!store) return;
	await requestToPromise(store.put(value, key));
}

async function idbDelete(key: string): Promise<void> {
	const store = kvStore('readwrite');
	if (!store) return;
	await requestToPromise(store.delete(key));
}

function localStorageAppKeys(): string[] {
	if (!browser) return [];
	try {
		return Object.keys(localStorage).filter(isAppKey);
	} catch {
		return [];
	}
}

function mirrorOrBackup(key: string, value: string): void {
	if (!LARGE_KEYS.has(key) || !database) writeLocalStorage(key, value);
}

async function flushToIndexedDb(key: string, value: string): Promise<void> {
	if (!database) return;
	try {
		await idbPut(key, value);
		if (LARGE_KEYS.has(key)) removeLocalStorage(key);
	} catch {
		if (LARGE_KEYS.has(key)) writeLocalStorage(key, value);
	}
}

export function readPersistent(key: string): string | null {
	if (!browser) return null;
	if (memory.has(key)) return memory.get(key) ?? null;
	return readLocalStorage(key);
}

export function writePersistent(key: string, value: string): void {
	if (!browser) return;
	memory.set(key, value);
	dirty.add(key);
	mirrorOrBackup(key, value);
	void flushToIndexedDb(key, value);
}

export function removePersistent(key: string): void {
	if (!browser) return;
	memory.delete(key);
	dirty.add(key);
	removeLocalStorage(key);
	void idbDelete(key).catch(() => {
		// IndexedDB may be unavailable; localStorage was already cleared.
	});
}

export function onPersistentHydrate(callback: () => void): () => void {
	if (hydrated) {
		callback();
		return () => {};
	}
	hydrators.add(callback);
	return () => hydrators.delete(callback);
}

export function whenPersistentStorageReady(): Promise<void> {
	if (!browser) return Promise.resolve();
	return initPersistentStorage();
}

export async function initPersistentStorage(): Promise<void> {
	if (!browser) return;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		try {
			database = await openDatabase();
			const stored = await idbGetAll();
			for (const [key, value] of stored) {
				if (dirty.has(key)) continue;
				memory.set(key, value);
			}

			for (const key of localStorageAppKeys()) {
				if (dirty.has(key) || memory.has(key)) continue;
				const value = readLocalStorage(key);
				if (value === null) continue;
				memory.set(key, value);
				try {
					await idbPut(key, value);
				} catch {
					continue;
				}
			}

			for (const [key, value] of memory) {
				if (LARGE_KEYS.has(key)) {
					try {
						await idbPut(key, value);
						removeLocalStorage(key);
					} catch {
						writeLocalStorage(key, value);
					}
				} else {
					writeLocalStorage(key, value);
				}
			}
		} catch {
			database = null;
			for (const key of localStorageAppKeys()) {
				const value = readLocalStorage(key);
				if (value !== null && !memory.has(key)) memory.set(key, value);
			}
		} finally {
			hydrated = true;
			for (const callback of hydrators) callback();
			hydrators.clear();
		}
	})();

	return initPromise;
}

if (browser) void initPersistentStorage();
