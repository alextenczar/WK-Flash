<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiKey } from '$lib/storage';
	import { hasSavedReviewSession } from '$lib/review-session';
	import { pendingReviews } from '$lib/review-outbox';
	import {
		getCachedReviewQueue,
		getReviewOverview,
		REVIEW_QUEUE_FRESH_MS,
		WaniKaniError
	} from '$lib/wanikani/api';
	import type { ReviewCard, WKUser } from '$lib/wanikani/types';

	const REVIEW_COUNT_KEY = 'wk-flash:last-due-count';
	const hour = new Date().getHours();
	const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

	let user = $state<WKUser | null>(null);
	let reviewCount = $state<number | null>(null);
	let hasSavedReview = $state(false);
	let hasCachedReviewQueue = $state(false);
	let loading = $state(true);
	let error = $state('');
	let loadingRequest = false;

	function showCachedQueue(cards: ReviewCard[], cachedUser?: WKUser) {
		const pendingAssignmentIds = new Set($pendingReviews.map((review) => review.assignmentId));
		const availableCards = cards.filter((card) => !pendingAssignmentIds.has(card.assignmentId));
		if (cachedUser) user = cachedUser;
		reviewCount = availableCards.length;
		hasCachedReviewQueue = availableCards.length > 0;
		try {
			localStorage.setItem(REVIEW_COUNT_KEY, String(reviewCount));
		} catch {
			// The live count remains available if local storage is disabled.
		}
	}

	async function load(forceRefresh = false) {
		if (loadingRequest) return;
		loadingRequest = true;
		loading = true;
		error = '';
		const cachedQueue = await getCachedReviewQueue();
		try {
			if (
				!forceRefresh &&
				cachedQueue &&
				Date.now() - cachedQueue.fetchedAt < REVIEW_QUEUE_FRESH_MS
			) {
				showCachedQueue(cachedQueue.cards, cachedQueue.user);
				return;
			}
			const overview = await getReviewOverview($apiKey);
			user = overview.user;
			showCachedQueue(overview.cards, overview.user);
		} catch (e) {
			if (cachedQueue) {
				showCachedQueue(cachedQueue.cards, cachedQueue.user);
				error = !navigator.onLine
					? hasSavedReview
						? 'You are offline. Your saved review is ready to continue.'
						: 'You are offline. You can start from your saved review queue.'
					: 'Unable to refresh. Showing your saved review queue.';
			} else {
				error = !navigator.onLine
					? 'You are offline. Connect to load and save your review queue.'
					: e instanceof WaniKaniError
						? e.message
						: 'Something went wrong.';
			}
		} finally {
			loading = false;
			loadingRequest = false;
		}
	}

	onMount(() => {
		const handleOnline = () => void load(true);
		window.addEventListener('online', handleOnline);
		void (async () => {
			hasSavedReview = hasSavedReviewSession();
			try {
				const storedCount = localStorage.getItem(REVIEW_COUNT_KEY);
				if (storedCount !== null) {
					const cachedCount = Number(storedCount);
					if (Number.isInteger(cachedCount) && cachedCount >= 0) reviewCount = cachedCount;
				}
			} catch {
				// Continue loading the live count if local storage is disabled.
			}
			const cachedQueue = await getCachedReviewQueue();
			const pendingAssignmentIds = new Set($pendingReviews.map((review) => review.assignmentId));
			const availableCards = cachedQueue?.cards.filter(
				(card) => !pendingAssignmentIds.has(card.assignmentId)
			);
			hasCachedReviewQueue = Boolean(availableCards?.length);
			if (availableCards && (reviewCount === null || !navigator.onLine)) {
				reviewCount = availableCards.length;
			}
			if (!$apiKey) {
				goto('/settings');
				return;
			}
			if (!navigator.onLine) {
				error = hasSavedReview
					? 'You are offline. Your saved review is ready to continue.'
					: hasCachedReviewQueue
						? 'You are offline. You can start from your saved review queue.'
						: 'You are offline. Connect once to load and save your review queue.';
				loading = false;
				return;
			}
			await load();
		})();
		return () => window.removeEventListener('online', handleOnline);
	});
</script>

<div class="container">
	{#if loading}
		<p>
			{reviewCount === null
				? 'Loading your review count...'
				: `Last known count: ${reviewCount} review${reviewCount === 1 ? '' : 's'} due.`}
		</p>
		{#if hasSavedReview}
			<a href="/review"><button class="primary">Continue Review</button></a>
		{/if}
	{:else if error}
		<p class="error">{error}</p>
		<p>
			{reviewCount === null
				? 'Unable to load your review count.'
				: `Last known count: ${reviewCount} review${reviewCount === 1 ? '' : 's'} due.`}
		</p>
		{#if hasSavedReview}
			<p class="muted">Your in-progress review is saved on this device.</p>
			<a href="/review"><button class="primary">Continue Review</button></a>
		{:else if hasCachedReviewQueue}
			<a href="/review"><button class="primary">Start Saved Reviews</button></a>
		{:else}
			<a href="/settings">Check your API key in Settings</a>
		{/if}
		<button type="button" onclick={() => void load(true)}>Refresh</button>
	{:else}
		<h1>{greeting}, {user?.username}!</h1>
		<p>You have <strong>{reviewCount}</strong> review{reviewCount === 1 ? '' : 's'} due.</p>

		{#if reviewCount === 0}
			<p>No reviews are available right now. Check back later.</p>
		{/if}
		{#if hasSavedReview}
			<p>You have a review in progress. Pick up where you left off.</p>
			<a href="/review"><button class="primary">Continue Review</button></a>
		{:else if reviewCount !== null && reviewCount > 0}
			<p class="muted">
				Each card asks for the meaning and reading together, then submits one combined result back
				to WaniKani.
			</p>
			<a href="/review"><button class="primary">Start Review</button></a>
		{/if}
	{/if}
</div>

<style>
	.error {
		color: var(--bad);
	}

	.muted {
		color: var(--muted);
	}
</style>
