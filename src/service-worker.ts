import { base, build, files, version } from '$service-worker';

const CACHE_NAME = `wk-flash-${version}`;
const APP_SHELL = `${base.replace(/\/$/, '')}/`;
const APP_ASSETS = [...new Set([...build, ...files])];
const isFontAsset = (path: string) => /\.(?:woff2?|ttf|otf)$/i.test(new URL(path, self.location.origin).pathname);
const FONT_PATHS = new Set(
	APP_ASSETS.filter(isFontAsset).map((path) => new URL(path, self.location.origin).pathname)
);
const PRECACHE_URLS = [...new Set([...APP_ASSETS.filter((path) => !isFontAsset(path)), APP_SHELL])];
const PRECACHED_PATHS = new Set(
	PRECACHE_URLS.map((path) => new URL(path, self.location.origin).pathname)
);

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await cache.addAll(PRECACHE_URLS);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const cacheNames = await caches.keys();
			await Promise.all(
				cacheNames
					.filter((cacheName) => cacheName.startsWith('wk-flash-') && cacheName !== CACHE_NAME)
					.map((cacheName) => caches.delete(cacheName))
			);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE_NAME);
				try {
					const response = await fetch(request);
					if (response.ok) {
						try {
							await cache.put(request, response.clone());
						} catch {
							// Keep the network response even if this navigation cannot be cached.
						}
					}
					return response;
				} catch {
					return (await cache.match(request)) ?? (await cache.match(APP_SHELL)) ?? Response.error();
				}
			})()
		);
		return;
	}

	if (FONT_PATHS.has(url.pathname)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE_NAME);
				const cached = await cache.match(request);
				if (cached) return cached;

				const response = await fetch(request);
				if (response.ok) {
					try {
						await cache.put(request, response.clone());
					} catch {
						// Keep the font response if storage is unavailable or full.
					}
				}
				return response;
			})()
		);
		return;
	}

	if (!PRECACHED_PATHS.has(url.pathname)) return;
	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			return (await cache.match(request)) ?? fetch(request);
		})()
	);
});