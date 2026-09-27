<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import '$lib/app.css';
	import { apiKey } from '$lib/storage';
	import { formatSrsStageUpdate, latestSrsStageUpdate, pendingReviews, syncPendingReviews } from '$lib/review-outbox';
	import { showSrsChanges } from '$lib/review-preferences';

	let { children } = $props();
	let isOnline = $state(true);

	onMount(() => {
		const updateConnection = () => {
			isOnline = navigator.onLine;
			if (isOnline) void syncPendingReviews($apiKey);
		};
		const unsubscribeApiKey = apiKey.subscribe((token) => {
			if (token && navigator.onLine) void syncPendingReviews(token);
		});
		window.addEventListener('online', updateConnection);
		window.addEventListener('offline', updateConnection);
		updateConnection();

		return () => {
			unsubscribeApiKey();
			window.removeEventListener('online', updateConnection);
			window.removeEventListener('offline', updateConnection);
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
</svelte:head>

<header>
	<nav class="container">
		<a href="/" class="brand">WK Flash</a>
		<div class="links">
			<a href="/settings">Settings</a>
			<a href="/about">About</a>
		</div>
	</nav>
</header>

{#if $showSrsChanges && $latestSrsStageUpdate && page.url.pathname !== '/review'}
	<div
		class="srs-stage-notification srs-stage-notification--global"
		class:decreased={$latestSrsStageUpdate.endingStage < $latestSrsStageUpdate.startingStage}
		class:unchanged={$latestSrsStageUpdate.endingStage === $latestSrsStageUpdate.startingStage}
		role="status"
		aria-live="polite"
	>
		{formatSrsStageUpdate($latestSrsStageUpdate)}
	</div>
{/if}

{#if !isOnline || $pendingReviews.length > 0}
	<div class="connection-status" role="status">
		{#if !isOnline}
			Offline. Saved review sessions are available, and completed answers will sync when you reconnect.
		{:else if $pendingReviews.length > 0}
			{$pendingReviews.length} completed review{$pendingReviews.length === 1 ? '' : 's'} waiting to sync.
		{/if}
	</div>
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
		background: var(--surface);
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
		gap: 1.25rem;
		a {
			color: white;
			text-decoration: none;
		}
	}

	.brand {
		font-weight: 700;
		font-size: 1.1rem;
		text-decoration: none;
		color: var(--text);
	}
</style>
