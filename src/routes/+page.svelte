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
	let currentLevelKanji = $state<{
		character: string;
		srsStage: number | null;
		availableAt: string | null;
		passedAt: string | null;
	}[] | null>(null);
	let selectedKanjiCharacter = $state<string | null>(null);
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
				currentLevelKanji !== null &&
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
			currentLevelKanji = overview.currentLevelKanji;
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

	function kanjiDueLabel(item: { srsStage: number | null; availableAt: string | null }): string {
		if (item.srsStage === null) return 'Not started';
		if (item.srsStage >= 9) return 'Burned; no further reviews';
		if (!item.availableAt) return 'No review scheduled';
		const dueAt = Date.parse(item.availableAt);
		if (!Number.isFinite(dueAt)) return 'Due date unavailable';
		if (dueAt <= now) return 'Due now';
		return `Due ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(dueAt)}`;
	}

	function dismissKanjiPopup(event: MouseEvent) {
		if (!(event.target instanceof Element) || !event.target.closest('.kanji-item')) {
			selectedKanjiCharacter = null;
		}
	}
</script>

<svelte:window onclick={dismissKanjiPopup} />

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
		<p>
			You have <strong>{reviewCount}</strong> review{reviewCount === 1 ? '' : 's'} due.
			{#if nextReviewBatch !== undefined}
				<span class="next-review-batch">
					{#if nextReviewBatch}
						{#if Date.parse(nextReviewBatch.availableAt) > now}
							<strong>{nextReviewBatch.count}</strong> review{nextReviewBatch.count === 1 ? '' : 's'} coming in
							<time datetime={nextReviewBatch.availableAt}>{formatCountdown(nextReviewBatch.availableAt)}</time>.
						{:else}
							<strong>{nextReviewBatch.count}</strong> upcoming review{nextReviewBatch.count === 1 ? '' : 's'} available now.
						{/if}
					{:else}
						No more reviews are queued in the next 24 hours.
					{/if}
				</span>
			{/if}
		</p>

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

		{#if currentLevelKanji?.length}
			<section class="level-kanji" aria-labelledby="level-kanji-heading">
				<div class="level-kanji-heading">
					<h2 id="level-kanji-heading">Level {user?.level} kanji</h2>
					<p><strong>{currentLevelKanji.filter((item) => item.passedAt !== null).length}</strong> / {currentLevelKanji.length} Guru'd</p>
				</div>
				<div class="kanji-grid">
					{#each currentLevelKanji as item (item.character)}
						<button
							type="button"
							class="kanji-item"
							data-tooltip={kanjiDueLabel(item)}
							aria-label="{item.character}: {kanjiDueLabel(item)}"
							aria-expanded={selectedKanjiCharacter === item.character}
							onclick={() => selectedKanjiCharacter = selectedKanjiCharacter === item.character ? null : item.character}
						>
							<span class="kanji-character">{item.character}</span>
							<span class="stage-track" aria-hidden="true">
								{#each Array(5) as _, index}
									<span class:filled={index < (item.passedAt !== null ? 5 : Math.min(item.srsStage ?? 0, 4))}></span>
								{/each}
							</span>
							{#if selectedKanjiCharacter === item.character}
								<span class="kanji-due" role="status">{kanjiDueLabel(item)}</span>
							{/if}
						</button>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	.next-review-batch {
		margin-left: 0.35rem;
		color: var(--muted);
	}

	.next-review-batch time {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	.level-kanji {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.level-kanji-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.level-kanji-heading h2,
	.level-kanji-heading p {
		margin: 0;
	}

	.level-kanji-heading h2 {
		font-size: 1rem;
	}

	.level-kanji-heading p {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.kanji-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr));
		gap: 0.65rem 0.75rem;
		max-width: 44rem;
	}

	.kanji-item {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 0.4rem;
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.kanji-item:hover .kanji-character,
	.kanji-item:focus-visible .kanji-character {
		border-color: var(--accent);
	}

	.kanji-item:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	.kanji-item:not([aria-expanded='true']):hover::after,
	.kanji-item:not([aria-expanded='true']):focus-visible::after,
	.kanji-due {
		position: absolute;
		z-index: 2;
		left: 50%;
		bottom: calc(100% + 0.35rem);
		width: max-content;
		max-width: min(12rem, 75vw);
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface);
		color: var(--text);
		font-size: 0.8rem;
		line-height: 1.3;
		text-align: center;
		white-space: normal;
		transform: translateX(-50%);
		box-shadow: 0 2px 8px rgb(0 0 0 / 18%);
	}

	.kanji-item:not([aria-expanded='true']):hover::after,
	.kanji-item:not([aria-expanded='true']):focus-visible::after {
		content: attr(data-tooltip);
	}

	.kanji-due {
		position: fixed;
		z-index: 10;
		left: 50%;
		top: auto;
		bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem);
		max-width: calc(100vw - 2rem);
	}

	.kanji-character {
		display: grid;
		place-items: center;
		width: 2.75rem;
		aspect-ratio: 1;
		border: 1px solid var(--border);
		border-radius: 4px;
		font-size: 1.5rem;
	}

	.stage-track {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 2px;
		width: 2.75rem;
	}

	.stage-track span {
		height: 3px;
		border-radius: 1px;
		background: var(--border);
	}

	.stage-track span.filled {
		background: var(--accent);
	}

	.error {
		color: var(--bad);
	}

	.muted {
		color: var(--muted);
	}
</style>
