<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiKey } from '$lib/storage';
	import { readPersistent, writePersistent, whenPersistentStorageReady } from '$lib/persistent-storage';
	import { hasSavedReviewSession } from '$lib/review-session';
	import LandingPage from '$lib/components/LandingPage.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { defaultDescription, defaultTitle } from '$lib/seo';
	import { pendingReviews } from '$lib/review-outbox';
	import {
		getCachedReviewQueue,
		getSubjectsByIds,
		getReviewOverview,
		REVIEW_QUEUE_FRESH_MS,
		WaniKaniError
	} from '$lib/wanikani/api';
	import type { LevelRadical, NextReviewBatch } from '$lib/wanikani/api';
	import type { ReviewCard, WKUser } from '$lib/wanikani/types';
	import type { WKSubject } from '$lib/wanikani/types';
	import { primaryMeaning, subjectImageUrl, subjectRouteId } from '$lib/wanikani/matching';
	import type { WeakestItem } from '$lib/wanikani/weakest-items';

	const REVIEW_COUNT_KEY = 'wk-flash:last-due-count';
	const hour = new Date().getHours();
	const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

	let user = $state<WKUser | null>(null);
	let reviewCount = $state<number | null>(null);
	let weakestItems = $state<WeakestItem[] | null>(null);
	let weakestExpanded = $state(false);
	let nextReviewBatch = $state<NextReviewBatch | null | undefined>(undefined);
	let upcomingReviewBatches = $state<NextReviewBatch[] | undefined>(undefined);
	let selectedUpcomingHour = $state<number | null>(null);
	let upcomingSubjects = $state<WKSubject[]>([]);
	let upcomingSubjectsLoading = $state(false);
	let upcomingSubjectsError = $state('');
	let currentLevelKanji = $state<{
		id: number;
		character: string;
		srsStage: number | null;
		availableAt: string | null;
		passedAt: string | null;
		unlocked: boolean;
	}[] | null>(null);
	let currentLevelRadicals = $state<LevelRadical[] | null>(null);
	let guruRadicalCount = $derived(currentLevelRadicals?.filter((item) => item.passedAt !== null).length ?? 0);
	let guruKanjiCount = $derived(currentLevelKanji?.filter((item) => item.passedAt !== null).length ?? 0);
	// Locked kanji go last, dimmed, so the unlocked ones read first.
	let orderedLevelKanji = $derived(
		currentLevelKanji
			? [...currentLevelKanji.filter((item) => item.unlocked), ...currentLevelKanji.filter((item) => !item.unlocked)]
			: []
	);
	let requiredGuruKanji = $derived(currentLevelKanji?.length ? Math.ceil(currentLevelKanji.length * 0.9) : 0);
	let selectedKanjiCharacter = $state<string | null>(null);
	let selectedKanjiPopupPosition = $state<{ left: number; top: number } | null>(null);
	let now = $state(Date.now());
	let hasSavedReview = $state(false);
	let hasCachedReviewQueue = $state(false);
	let loading = $state(true);
	let error = $state('');
	// False on the server and during hydrate so crawlers get the landing page HTML.
	let clientReady = $state(false);
	let loadingRequest = false;
	let refreshedForBatch: string | null = null;

	function showCachedQueue(
		cards: ReviewCard[],
		cachedUser?: WKUser,
		serverReviewCount?: number,
		upcomingBatch?: NextReviewBatch | null,
		nextDayBatches?: NextReviewBatch[],
		cachedWeakestItems?: WeakestItem[] | null
	) {
		const pendingAssignmentIds = new Set($pendingReviews.map((review) => review.assignmentId));
		const availableCards = cards.filter((card) => !pendingAssignmentIds.has(card.assignmentId));
		if (cachedUser) user = cachedUser;
		nextReviewBatch = upcomingBatch;
		upcomingReviewBatches = nextDayBatches;
		if (cachedWeakestItems !== undefined) weakestItems = cachedWeakestItems;
		reviewCount = navigator.onLine && serverReviewCount !== undefined
			? serverReviewCount
			: availableCards.length;
		hasCachedReviewQueue = availableCards.length > 0;
		writePersistent(REVIEW_COUNT_KEY, String(reviewCount));
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
				currentLevelRadicals !== null &&
				typeof cachedQueue.reviewCount === 'number' &&
				cachedQueue.reviewCount > 0 &&
				cachedQueue.nextReviewBatch !== undefined &&
				(!cachedQueue.nextReviewBatch || Date.parse(cachedQueue.nextReviewBatch.availableAt) > Date.now()) &&
				Date.now() - cachedQueue.fetchedAt < REVIEW_QUEUE_FRESH_MS
			) {
				showCachedQueue(
					cachedQueue.cards,
					cachedQueue.user,
					cachedQueue.reviewCount,
					cachedQueue.nextReviewBatch,
					cachedQueue.upcomingReviewBatches,
					cachedQueue.weakestItems
				);
				return;
			}
			const overview = await getReviewOverview($apiKey);
			user = overview.user;
			currentLevelKanji = overview.currentLevelKanji;
			currentLevelRadicals = overview.currentLevelRadicals;
			showCachedQueue(
				overview.cards,
				overview.user,
				overview.reviewCount,
				overview.nextReviewBatch,
				overview.upcomingReviewBatches,
				overview.weakestItems
			);
		} catch (e) {
			if (cachedQueue) {
				showCachedQueue(
					cachedQueue.cards,
					cachedQueue.user,
					cachedQueue.reviewCount,
					cachedQueue.nextReviewBatch,
					cachedQueue.upcomingReviewBatches,
					cachedQueue.weakestItems
				);
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
		clientReady = true;
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
			await whenPersistentStorageReady();
			hasSavedReview = hasSavedReviewSession();
			const storedCount = readPersistent(REVIEW_COUNT_KEY);
			if (storedCount !== null) {
				const cachedCount = Number(storedCount);
				if (Number.isInteger(cachedCount) && cachedCount >= 0) reviewCount = cachedCount;
			}
			const cachedQueue = await getCachedReviewQueue();
			nextReviewBatch = cachedQueue?.nextReviewBatch;
			upcomingReviewBatches = cachedQueue?.upcomingReviewBatches;
			weakestItems = cachedQueue?.weakestItems ?? null;
			const pendingAssignmentIds = new Set($pendingReviews.map((review) => review.assignmentId));
			const availableCards = cachedQueue?.cards.filter(
				(card) => !pendingAssignmentIds.has(card.assignmentId)
			);
			hasCachedReviewQueue = Boolean(availableCards?.length);
			if (availableCards && (reviewCount === null || !navigator.onLine)) {
				reviewCount = availableCards.length;
			}
			if (!$apiKey) return;
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

	const totalUpcomingReviews = $derived(
		upcomingReviewBatches?.reduce((total, batch) => total + batch.count, 0) ?? null
	);
	const hourlyUpcomingReviews = $derived.by(() => {
		const start = new Date(now);
		start.setMinutes(0, 0, 0);
		return Array.from({ length: 24 }, (_, index) => {
			const hourStart = new Date(start);
			hourStart.setHours(start.getHours() + index);
			const hourEnd = new Date(hourStart);
			hourEnd.setHours(hourStart.getHours() + 1);
			const count = upcomingReviewBatches?.reduce((total, batch) => {
				const availableAt = Date.parse(batch.availableAt);
				return availableAt >= hourStart.getTime() && availableAt < hourEnd.getTime()
					? total + batch.count
					: total;
			}, 0) ?? 0;
			const subjectIds = upcomingReviewBatches?.flatMap((batch) => {
				const availableAt = Date.parse(batch.availableAt);
				return availableAt >= hourStart.getTime() && availableAt < hourEnd.getTime()
					? batch.subjectIds
					: [];
			}) ?? [];
			return { start: hourStart, count, subjectIds };
		});
	});

	function formatHour(value: Date): string {
		return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(value);
	}

	function subjectPath(subject: WKSubject): string {
		const type = subject.object === 'vocabulary' || subject.object === 'kana_vocabulary'
			? 'vocab'
			: subject.object;
		return `/${type}/${encodeURIComponent(subjectRouteId(subject))}?from=home`;
	}

	function subjectTypeLabel(subject: WKSubject): string {
		if (subject.object === 'kana_vocabulary') return 'Vocabulary';
		return subject.object.charAt(0).toUpperCase() + subject.object.slice(1);
	}

	async function toggleUpcomingReviewItems(hour: { start: Date; subjectIds: number[] }) {
		const hourKey = hour.start.getTime();
		if (selectedUpcomingHour === hourKey) {
			selectedUpcomingHour = null;
			upcomingSubjects = [];
			upcomingSubjectsError = '';
			return;
		}
		selectedUpcomingHour = hourKey;
		upcomingSubjects = [];
		upcomingSubjectsError = '';
		upcomingSubjectsLoading = true;
		try {
			const subjects = await getSubjectsByIds($apiKey, hour.subjectIds);
			if (selectedUpcomingHour === hourKey) upcomingSubjects = subjects;
		} catch {
			if (selectedUpcomingHour === hourKey) {
				upcomingSubjectsError = 'Unable to load the items in this review batch.';
			}
		} finally {
			if (selectedUpcomingHour === hourKey) upcomingSubjectsLoading = false;
		}
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

	function kanjiStatusLabel(item: { unlocked: boolean; srsStage: number | null; availableAt: string | null }): string {
		return item.unlocked ? kanjiDueLabel(item) : 'Locked: not unlocked yet';
	}

	function dismissKanjiPopup(event: MouseEvent) {
		if (!(event.target instanceof Element) || !event.target.closest('.kanji-item')) {
			selectedKanjiCharacter = null;
			selectedKanjiPopupPosition = null;
		}
	}

	function handleKanjiClick(event: MouseEvent, character: string) {
		event.preventDefault();
		void goto(`/kanji/${encodeURIComponent(character)}?from=home`);
	}

	function toggleKanjiPopup(event: MouseEvent, character: string) {
		if (selectedKanjiCharacter === character) {
			selectedKanjiCharacter = null;
			selectedKanjiPopupPosition = null;
			return;
		}

		const target = event.currentTarget as HTMLButtonElement;
		const bounds = target.getBoundingClientRect();
		const popupWidth = Math.min(192, window.innerWidth * 0.75);
		const left = Math.max(
			12,
			Math.min(bounds.left + bounds.width / 2 - popupWidth / 2, window.innerWidth - popupWidth - 12)
		);
		const popupHeight = 48;
		const below = bounds.bottom + 8;
		const top = below + popupHeight <= window.innerHeight - 8
			? below
			: Math.max(8, bounds.top - popupHeight - 8);
		selectedKanjiCharacter = character;
		selectedKanjiPopupPosition = { left, top };
	}
</script>

<svelte:window onclick={dismissKanjiPopup} />

<Seo
	title={$apiKey && clientReady ? 'Home · WK Flash' : defaultTitle}
	description={defaultDescription}
/>

{#if !clientReady || !$apiKey}
	<div class="guest-only">
		<LandingPage />
	</div>
{:else}
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

		{#if currentLevelRadicals?.length}
			<section class="level-kanji" aria-labelledby="level-radicals-heading">
				<div class="level-kanji-heading">
					<h2 id="level-radicals-heading">Level {user?.level} radicals</h2>
					<p><strong>{guruRadicalCount}</strong> / {currentLevelRadicals.length} Guru'd</p>
				</div>
				<div class="radical-grid">
					{#each currentLevelRadicals as item (item.id)}
						<a
							href="/radical/{encodeURIComponent(item.slug)}?from=home"
							class="radical-item"
							title="{item.meaning}: {kanjiDueLabel(item)}"
							aria-label="{item.meaning}: {kanjiDueLabel(item)}"
						>
							<span class="radical-glyph" lang="ja">
								{#if item.character}
									{item.character}
								{:else if item.imageUrl}
									<img class="radical-image" src={item.imageUrl} alt="" />
								{:else}
									{item.slug}
								{/if}
							</span>
							<span class="stage-track" aria-hidden="true">
								{#each Array(5) as _, index}
									<span class:filled={index < (item.passedAt !== null ? 5 : Math.min(item.srsStage ?? 0, 4))}></span>
								{/each}
							</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}
		{#if currentLevelKanji?.length}
			<section class="level-kanji" aria-labelledby="level-kanji-heading">
				<div class="level-kanji-heading">
					<h2 id="level-kanji-heading">Level {user?.level} kanji</h2>
					<p><strong>{guruKanjiCount}</strong> / {currentLevelKanji.length} Guru'd</p>
				</div>
				<div class="kanji-grid">
					{#each orderedLevelKanji as item (item.character)}
						<button
							type="button"
							class="kanji-item"
							class:kanji-locked={!item.unlocked}
							data-tooltip={kanjiStatusLabel(item)}
							aria-label="{item.character}: {kanjiStatusLabel(item)}"
							aria-expanded={selectedKanjiCharacter === item.character}
							onclick={(event) => handleKanjiClick(event, item.character)}
						>
							<span class="kanji-character">{item.character}</span>
							<span class="stage-track" aria-hidden="true">
								{#each Array(5) as _, index}
									<span class:filled={index < (item.passedAt !== null ? 5 : Math.min(item.srsStage ?? 0, 4))}></span>
								{/each}
							</span>
							{#if selectedKanjiCharacter === item.character}
								<span
									class="kanji-due"
									role="status"
									style="left: {selectedKanjiPopupPosition?.left ?? 8}px; top: {selectedKanjiPopupPosition?.top ?? 8}px;"
								>{kanjiStatusLabel(item)}</span>
							{/if}
						</button>
					{/each}
				</div>
				<p class="level-up-requirement">
					<strong>{Math.max(0, requiredGuruKanji - guruKanjiCount)}</strong>
					more kanji need to reach Guru to level up.
				</p>
			</section>
		{/if}
		{#if upcomingReviewBatches !== undefined}
			<section class="upcoming-reviews" aria-labelledby="upcoming-reviews-heading">
				<div class="upcoming-reviews-heading">
					<h2 id="upcoming-reviews-heading">Upcoming reviews</h2>
					<p>
						{totalUpcomingReviews === null
							? 'Next 24 hours'
							: `${totalUpcomingReviews} scheduled in the next 24 hours`}
					</p>
				</div>
				{#if hourlyUpcomingReviews.some((hour) => hour.count > 0)}
					<div class="hourly-review-grid">
						{#each hourlyUpcomingReviews.filter((hour) => hour.count > 0) as hour (hour.start.getTime())}
							<button
								type="button"
								class="hourly-review-slot"
								class:selected={selectedUpcomingHour === hour.start.getTime()}
								aria-expanded={selectedUpcomingHour === hour.start.getTime()}
								onclick={() => void toggleUpcomingReviewItems(hour)}
							>
								<time datetime={hour.start.toISOString()}>{formatHour(hour.start)}</time>
								<strong>{hour.count}</strong>
							</button>
						{/each}
					</div>
				{:else}
					<p class="muted">No reviews are scheduled in the next 24 hours.</p>
				{/if}
				{#if selectedUpcomingHour !== null}
					<div class="upcoming-subjects">
						{#if upcomingSubjectsLoading}
							<p class="muted">Loading review batch items...</p>
						{:else if upcomingSubjectsError}
							<p class="error" role="status">{upcomingSubjectsError}</p>
						{:else}
							<h3>Review batch items</h3>
							<div class="upcoming-subject-grid">
								{#each upcomingSubjects as subject (subject.id)}
									<a href={subjectPath(subject)} class="upcoming-subject">
										<strong lang="ja">{subject.data.characters ?? subject.data.slug}</strong>
										<span>{primaryMeaning(subject)}</span>
									</a>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</section>
		{/if}

		{#if weakestItems}
			<section class="weakest-items" aria-labelledby="weakest-items-heading">
				<div class="level-kanji-heading">
					<h2 id="weakest-items-heading">Weakest items</h2>
					<button
						type="button"
						class="weakest-toggle"
						aria-expanded={weakestExpanded}
						aria-controls="weakest-items-list"
						onclick={() => (weakestExpanded = !weakestExpanded)}
					>
						<span>Lowest lifetime accuracy</span>
						<span class="weakest-chevron" class:open={weakestExpanded} aria-hidden="true">▾</span>
					</button>
				</div>
				{#if !weakestExpanded}
					<p class="muted weakest-collapsed-hint">
						{weakestItems.length === 0
							? 'No items are below 90% with enough answers yet.'
							: `${weakestItems.length} item${weakestItems.length === 1 ? '' : 's'} below 90%. Expand to see them.`}
					</p>
				{:else if weakestItems.length === 0}
					<p class="muted" id="weakest-items-list">No items are below 90% with enough answers yet.</p>
				{:else}
					<ul class="weakest-list" id="weakest-items-list">
						{#each weakestItems as item (item.subjectId)}
							<li>
								<a class="weakest-row" href={subjectPath(item.subject)}>
									<span class="weakest-glyph" lang="ja">
										{#if item.subject.data.characters}
											{item.subject.data.characters}
										{:else if subjectImageUrl(item.subject)}
											<img class="weakest-image" src={subjectImageUrl(item.subject)} alt="" />
										{:else}
											{item.subject.data.slug}
										{/if}
									</span>
									<span class="weakest-copy">
										<strong>{primaryMeaning(item.subject)}</strong>
										<span>
											{subjectTypeLabel(item.subject)} · {item.incorrect} missed / {item.total}
										</span>
									</span>
									<strong class="weakest-rate">{item.accuracyPercent}%</strong>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	{/if}
</div>
{/if}

<style>
	/* The app.html script sets data-signed-in before first paint, so signed-in users never see the landing page. */
	:global(html[data-signed-in]) .guest-only {
		display: none;
	}

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

	.weakest-items {
		width: 100%;
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.weakest-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--muted);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.weakest-toggle:hover,
	.weakest-toggle:focus-visible {
		border-color: var(--accent);
		color: var(--text);
	}

	.weakest-chevron {
		display: inline-block;
		transition: transform 0.15s ease;
	}

	.weakest-chevron.open {
		transform: rotate(180deg);
	}

	.weakest-collapsed-hint {
		margin: 0;
		font-size: 0.85rem;
	}

	.weakest-list {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.weakest-row {
		display: grid;
		grid-template-columns: 2.6rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text);
		text-decoration: none;
	}

	.weakest-row:hover,
	.weakest-row:focus-visible {
		border-color: var(--accent);
		text-decoration: none;
	}

	.weakest-glyph {
		display: grid;
		place-items: center;
		min-height: 2.2rem;
		font-size: 1.35rem;
		line-height: 1;
	}

	.weakest-image {
		width: 1.5rem;
		height: 1.5rem;
		object-fit: contain;
		filter: invert(var(--image-invert));
	}

	.weakest-copy {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.weakest-copy strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.weakest-copy span {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.8rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.weakest-rate {
		color: #c084fc;
		font-variant-numeric: tabular-nums;
	}

	.upcoming-reviews {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.upcoming-reviews-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.upcoming-reviews-heading h2,
	.upcoming-reviews-heading p {
		margin: 0;
	}

	.upcoming-reviews-heading h2 {
		font-size: 1rem;
	}

	.upcoming-reviews-heading p {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.hourly-review-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(3.5rem, 1fr));
		gap: 0.5rem;
	}

	.hourly-review-slot {
		display: grid;
		gap: 0.25rem;
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface);
		color: var(--muted);
		font: inherit;
		font-size: 0.75rem;
		text-align: left;
	}

	.hourly-review-slot strong {
		color: var(--text);
		font-size: 1rem;
	}

	.hourly-review-slot.selected {
		background: var(--surface-alt);
	}

	@media (hover: hover) {
		.hourly-review-slot:hover:not(:disabled) {
			border-color: var(--accent-hover);
			background: var(--surface-alt);
		}
	}

	.upcoming-subjects {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.upcoming-subjects h3 {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
	}

	.upcoming-subject-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: 0.5rem;
	}

	.upcoming-subject {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text);
		text-decoration: none;
	}

	.upcoming-subject:hover,
	.upcoming-subject:focus-visible {
		border-color: var(--accent);
		text-decoration: none;
	}

	.upcoming-subject strong {
		font-size: 1.1rem;
	}

	.upcoming-subject span {
		overflow: hidden;
		color: var(--muted);
		font-size: 0.8rem;
		text-overflow: ellipsis;
		white-space: nowrap;
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

	.radical-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr));
		gap: 0.65rem 0.75rem;
		max-width: 44rem;
	}

	.radical-item {
		display: grid;
		justify-items: center;
		gap: 0.4rem;
		color: var(--text);
		text-decoration: none;
	}

	.radical-item:hover .radical-glyph,
	.radical-item:focus-visible .radical-glyph {
		border-color: var(--accent);
	}

	.radical-item:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	.radical-glyph {
		display: grid;
		place-items: center;
		width: 2.75rem;
		aspect-ratio: 1;
		border: 1px solid var(--border);
		border-radius: 4px;
		font-size: 1.5rem;
		overflow: hidden;
	}

	.radical-image {
		width: 64%;
		height: 64%;
		filter: invert(var(--image-invert));
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

	.kanji-item:focus-visible .kanji-character {
		border-color: var(--accent);
	}

	.kanji-item:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	.kanji-item:not([aria-expanded='true']):focus-visible::after,
	.kanji-item:not([aria-expanded='true']):hover::after,
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

	.kanji-item:not([aria-expanded='true']):focus-visible::after {
		content: attr(data-tooltip);
	}

	@media (hover: hover) and (pointer: fine) {
		.kanji-item:hover {
			z-index: 3;
		}

		.kanji-item:hover .kanji-character {
			border-color: var(--accent);
		}

		.kanji-item:not([aria-expanded='true']):hover::after {
			content: attr(data-tooltip);
		}
	}

	.kanji-due {
		position: fixed;
		z-index: 10;
		left: auto;
		top: auto;
		bottom: auto;
		transform: none;
	}

	/* Locked kanji are dimmed; the tooltip and popup stay at full strength. */
	.kanji-item.kanji-locked .kanji-character,
	.kanji-item.kanji-locked .stage-track {
		opacity: 0.35;
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
