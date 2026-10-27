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
	const jlptLevels = ['n5', 'n4', 'n3', 'n2', 'n1'];
	// The footer is hidden during review and lesson sessions so nothing distracts from the task.
	const hideFooter = $derived(/^\/(review|lessons\/study)(\/|$)/.test(page.url.pathname));

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
		<a href="/" class="brand">
			<svg class="brand-mark" viewBox="145 72 282 368" aria-hidden="true" focusable="false">
				<path d="M286 72 145 279h98l-17 161 141-226h-98l17-142Z" fill="currentColor" />
			</svg>
			WK Flash
		</a>
		<div class="links">
			{#if $apiKey}
				<a href="/lessons">Lessons</a>
				<a href="/analytics">Analytics</a>
				<a href="/settings">Settings</a>
			{:else}
				<a href="/how-it-works">How it works</a>
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

{#if !hideFooter}
<footer class="site-footer">
	<div class="container">
		<nav class="footer-links" aria-label="Footer">
			<div>
				<h2>App</h2>
				<ul>
					{#if $apiKey}
						<li><a href="/review">Review</a></li>
						<li><a href="/lessons">Lessons</a></li>
					{:else}
						<li><a href="/settings">Connect</a></li>
					{/if}
					<li><a href="/about">About</a></li>
					<li><a href="/how-it-works">How it works</a></li>
				</ul>
			</div>
			{#if $apiKey}
				<div>
					<h2>Analytics</h2>
					<ul>
						<li><a href="/analytics">Overview</a></li>
						<li><a href="/analytics#level-up-heading">Level-up calculator</a></li>
						<li><a href="/analytics/kanji">Kanji heatmap</a></li>
						<li><a href="/analytics#jlpt-vocabulary-heading">JLPT vocabulary</a></li>
						<li><a href="/analytics/results">JLPT results</a></li>
					</ul>
				</div>
			{/if}
			<div>
				<h2>JLPT</h2>
				<ul>
					<li><a href="/jlpt">All levels</a></li>
					<li class="jlpt-levels">
						{#each jlptLevels as level, index (level)}
							<a href="/jlpt/{level}/kanji">{level.toUpperCase()}</a>{index < jlptLevels.length - 1 ? ', ' : ''}
						{/each}
					</li>
					<li><a href="/jlpt-coverage">WaniKani coverage</a></li>
				</ul>
			</div>
			<div>
				<h2>Settings</h2>
				<ul>
					<li><a href="/settings">Settings</a></li>
					<li><a href="/settings#appearance-heading">Appearance</a></li>
					<li><a href="/settings#keybindings">Keyboard and controller</a></li>
				</ul>
			</div>
		</nav>
		<p class="disclaimer">
			WK Flash is an unofficial, independent project. It is not made, owned, approved, or endorsed by WaniKani
			or Tofugu. WaniKani and its content, names, and artwork belong to their respective owners.
		</p>
	</div>
</footer>
{/if}

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
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 700;
		font-size: 1.1rem;
		text-decoration: none;
		color: var(--text);
	}

	.site-footer {
		margin-top: 3rem;
		padding: 2rem 0 3rem;
		border-top: 1px solid var(--border);
	}

	.footer-links {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 14rem));
		justify-content: start;
		align-items: start;
		gap: 2rem 3rem;
	}

	.footer-links h2 {
		margin: 0 0 0.5rem;
		color: var(--muted);
		font-size: 0.85rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.footer-links ul {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.footer-links a {
		color: var(--text);
		text-decoration: none;
	}

	.footer-links a:hover,
	.footer-links a:focus-visible {
		color: var(--accent);
		text-decoration: underline;
	}

	.disclaimer {
		margin: 2rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.6;
	}

	.brand-mark {
		width: 1.15em;
		height: 1.55em;
		flex: none;
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
