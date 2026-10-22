<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import '$lib/app.css';
	import { initPersistentStorage } from '$lib/persistent-storage';
	// Applies the saved light/dark theme to <html> on every page.
	import '$lib/theme';
	import { isPublicPath } from '$lib/seo';
	import { apiKey } from '$lib/storage';
	import { syncPendingLessonStarts } from '$lib/lesson-outbox';
	import { pendingReviews, syncPendingReviews } from '$lib/review-outbox';

	let { children } = $props();
	let isOnline = $state(true);

	onMount(() => {
		// The pre-paint sign-in flag from app.html only needs to hide the landing page until the app hydrates.
		// After that, the page's own key check decides what to show.
		delete document.documentElement.dataset.signedIn;
		void initPersistentStorage();
		const updateConnection = () => {
			isOnline = navigator.onLine;
			if (isOnline && $apiKey) {
				void syncPendingReviews($apiKey);
				void syncPendingLessonStarts($apiKey);
			}
		};
		const unsubscribeApiKey = apiKey.subscribe((token) => {
			if (token && navigator.onLine) {
				void syncPendingReviews(token);
				void syncPendingLessonStarts(token);
			}
		});
		window.addEventListener('online', updateConnection);
		window.addEventListener('offline', updateConnection);
		window.addEventListener('focus', updateConnection);
		updateConnection();

		return () => {
			unsubscribeApiKey();
			window.removeEventListener('online', updateConnection);
			window.removeEventListener('offline', updateConnection);
			window.removeEventListener('focus', updateConnection);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href="/wk-flash-icon.svg" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/wk-flash-icon.svg" />
	<meta name="theme-color" content="#000000" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="WK Flash" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black" />
	{#if !isPublicPath(page.url.pathname)}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

<header>
	<nav class="container">
		<a href="/" class="brand">WK Flash</a>
		<div class="links">
			{#if $apiKey}
				<a href="/lessons">Lessons</a>
				<a href="/analytics">Analytics</a>
				<a href="/settings">Settings</a>
				<a href="/about">About</a>
			{:else}
				<a href="/about">About</a>
				<a class="connect" href="/settings">Connect</a>
			{/if}
		</div>
	</nav>
</header>

{#if !isOnline || $pendingReviews.length > 0}
	<!-- <div class="connection-status" role="status">
		{#if !isOnline}
			Offline. Saved review sessions are available, and completed answers will sync when you reconnect.
		{:else if $pendingReviews.length > 0}
			{$pendingReviews.length} completed review{$pendingReviews.length === 1 ? '' : 's'} waiting to sync.
		{/if}
	</div> -->
{/if}

<main>
	{@render children()}
</main>

<style>
	.connection-status {
		padding: 0.55rem 1rem;
		border-bottom: 1px solid var(--border);
		color: var(--muted);
		font-size: 0.875rem;
		text-align: center;
	}

	header {
		border-bottom: 1px solid var(--border);
		background: var(--bg);
	}

	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 1rem;
		padding-bottom: 1rem;
	}

	.links {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		a {
			display: inline-flex;
			align-items: center;
			min-height: 2.15rem;
			color: var(--text);
			text-decoration: none;
		}
	}

	@media (max-width: 400px) {
		nav {
			gap: 0.75rem;
		}

		.links {
			gap: 0.65rem;
			font-size: 0.875rem;
		}
	}

	.brand {
		font-weight: 700;
		font-size: 1.1rem;
		text-decoration: none;
		color: var(--text);
	}

	.links a.connect {
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		background: linear-gradient(120deg, #2563eb, #7c3aed);
		color: #fff;
	}

	.links a.connect:hover,
	.links a.connect:focus-visible {
		text-decoration: none;
		color: #fff;
	}
</style>
