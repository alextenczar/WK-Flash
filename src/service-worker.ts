import { base, build, files, version } from '$service-worker';

const CACHE_NAME = `wk-flash-${version}`;
const APP_SHELL = `${base.replace(/\/$/, '')}/`;
const PRECACHE_URLS = [...new Set([...build, ...files, APP_SHELL])];
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

	if (!PRECACHED_PATHS.has(url.pathname)) return;
	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			return (await cache.match(request)) ?? fetch(request);
		})()
	);
});