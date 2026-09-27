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
	import type { NextReviewBatch } from '$lib/wanikani/api';
	import type { ReviewCard, WKUser } from '$lib/wanikani/types';

	const REVIEW_COUNT_KEY = 'wk-flash:last-due-count';
	const hour = new Date().getHours();
	const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

	let user = $state<WKUser | null>(null);
	let reviewCount = $state<number | null>(null);
	let nextReviewBatch = $state<NextReviewBatch | null | undefined>(undefined);
	let now = $state(Date.now());
	let hasSavedReview = $state(false);
	let hasCachedReviewQueue = $state(false);
	let loading = $state(true);
	let error = $state('');
	let loadingRequest = false;
	let refreshedForBatch: string | null = null;

	function showCachedQueue(
		cards: ReviewCard[],
		cachedUser?: WKUser,
		serverReviewCount?: number,
		upcomingBatch?: NextReviewBatch | null
	) {
		const pendingAssignmentIds = new Set($pendingReviews.map((review) => review.assignmentId));
		const availableCards = cards.filter((card) => !pendingAssignmentIds.has(card.assignmentId));
		if (cachedUser) user = cachedUser;
		nextReviewBatch = upcomingBatch;
		reviewCount = navigator.onLine && serverReviewCount !== undefined
			? serverReviewCount
			: availableCards.length;
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
				typeof cachedQueue.reviewCount === 'number' &&
				cachedQueue.nextReviewBatch !== undefined &&
				(!cachedQueue.nextReviewBatch || Date.parse(cachedQueue.nextReviewBatch.availableAt) > Date.now()) &&
				Date.now() - cachedQueue.fetchedAt < REVIEW_QUEUE_FRESH_MS
			) {
				showCachedQueue(cachedQueue.cards, cachedQueue.user, cachedQueue.reviewCount, cachedQueue.nextReviewBatch);
				return;
			}
			const overview = await getReviewOverview($apiKey);
			user = overview.user;
			showCachedQueue(overview.cards, overview.user, overview.reviewCount, overview.nextReviewBatch);
		} catch (e) {
			if (cachedQueue) {
				showCachedQueue(cachedQueue.cards, cachedQueue.user, cachedQueue.reviewCount, cachedQueue.nextReviewBatch);
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
		const countdownTimer = window.setInterval(() => {
			now = Date.now();
			if (
				nextReviewBatch &&
				Date.parse(nextReviewBatch.availableAt) <= now &&
				refreshedForBatch !== nextReviewBatch.availableAt &&
				!loadingRequest
			) {
				refreshedForBatch = nextReviewBatch.availableAt;
				void load(true);
			}
		}, 1000);
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
			nextReviewBatch = cachedQueue?.nextReviewBatch;
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
		return () => {
			window.clearInterval(countdownTimer);
			window.removeEventListener('online', handleOnline);
		};
	});

	function formatCountdown(availableAt: string): string {
		const seconds = Math.max(0, Math.ceil((Date.parse(availableAt) - now) / 1000));
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const remainingSeconds = seconds % 60;
		return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
	}
</script>

<div class="container">
	{#if nextReviewBatch !== undefined}
		<section class="next-review-batch" aria-label="Upcoming reviews">
			{#if nextReviewBatch}
				{#if Date.parse(nextReviewBatch.availableAt) > now}
					<p>
						<strong>{nextReviewBatch.count}</strong> review{nextReviewBatch.count === 1 ? '' : 's'} coming in
						<time datetime={nextReviewBatch.availableAt}>{formatCountdown(nextReviewBatch.availableAt)}</time>
					</p>
				{:else}
					<p><strong>{nextReviewBatch.count}</strong> upcoming review{nextReviewBatch.count === 1 ? '' : 's'} available now.</p>
				{/if}
			{:else}
				<p>No more reviews are queued in the next 24 hours.</p>
			{/if}
		</section>
	{/if}

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
	.next-review-batch {
		margin-bottom: 1.5rem;
		padding: 0.25rem 0 0.25rem 0.75rem;
		border-left: 3px solid var(--accent);
	}

	.next-review-batch p {
		margin: 0;
	}

	.next-review-batch time {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	.error {
		color: var(--bad);
	}

	.muted {
		color: var(--muted);
	}
</style>
