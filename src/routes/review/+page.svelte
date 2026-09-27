<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiKey } from '$lib/storage';
	import { keybindings } from '$lib/keybindings';
	import { showMnemonics, showPartsOfSpeech, showSrsChanges } from '$lib/review-preferences';
	import { reviewAudioSettings } from '$lib/review-audio';
	import { clearReviewSession, readReviewSession, saveReviewSession } from '$lib/review-session';
	import {
		buildReviewQueue,
		getCachedReviewQueue,
		getSubjectsByIds,
		REVIEW_QUEUE_FRESH_MS,
		WaniKaniError
	} from '$lib/wanikani/api';
	import { allMeanings, primaryMeaning, readingsForDisplay, vocabularyByReading } from '$lib/wanikani/matching';
	import {
		pendingReviews,
		queueReviewSubmission,
		recordSrsStageUpdate,
		submitQueuedReview
	} from '$lib/review-outbox';
	import type { ReviewCard, WKSubject } from '$lib/wanikani/types';

	type Phase = 'loading' | 'question' | 'finished' | 'error';

	let phase = $state<Phase>('loading');
	let error = $state('');
	let audioError = $state('');
	let flipped = $state(false);
	let audioPlayer: HTMLAudioElement | null = null;
	let moreInfoOpen = $state(false);
	let moreInfoLoading = $state(false);
	let moreInfoError = $state('');
	let moreInfoLoadedFor = $state<number | null>(null);
	let relatedSubjects = $state<WKSubject[]>([]);
	let detailSubject = $state<WKSubject | null>(null);

	let queue = $state<ReviewCard[]>([]);
	let totalUnique = $state(0);
	let knownAssignmentIds = new Set<number>();
	let pendingIds = $state(new Set<number>());
	let missedIds = $state(new Set<number>());
	let completedCount = $state(0);
	let correctFirstTry = $state(0);
	let seenAssignments = new Set<number>();
	let wrapUp = $state(false);

	const current = $derived(queue[0] ?? null);
	const similarKanji = $derived(relatedSubjects.filter((subject) => subject.object === 'kanji'));
	const vocabularyGroups = $derived(vocabularyByReading(relatedSubjects));

	function mnemonicText(markup: string): string {
		return markup.replace(/<\/?(?:radical|kanji|vocabulary|meaning|reading|ja)>/gi, '');
	}

	function resetMoreInfo() {
		moreInfoOpen = false;
		moreInfoLoading = false;
		moreInfoError = '';
		moreInfoLoadedFor = null;
		relatedSubjects = [];
		detailSubject = null;
	}

	async function toggleMoreInfo() {
		if (!current) return;
		moreInfoOpen = !moreInfoOpen;
		if (!moreInfoOpen || moreInfoLoadedFor === current.subject.id || moreInfoLoading) return;

		const subject = current.subject;
		const relatedIds = subject.object === 'kanji'
			? [
				...(subject.data.visually_similar_subject_ids ?? []),
				...(subject.data.amalgamation_subject_ids ?? [])
			]
			: subject.object === 'radical'
				? (subject.data.amalgamation_subject_ids ?? [])
				: [];
		const isVocabulary = subject.object === 'vocabulary' || subject.object === 'kana_vocabulary';
		const subjectIds = [
			...relatedIds.filter((id) => id !== subject.id),
			...(isVocabulary ? [subject.id] : [])
		];
		const uniqueIds = [...new Set(subjectIds)];

		moreInfoError = '';
		if (uniqueIds.length === 0) {
			relatedSubjects = [];
			detailSubject = subject;
			moreInfoLoadedFor = subject.id;
			return;
		}

		moreInfoLoading = true;
		try {
			const fetchedSubjects = await getSubjectsByIds(
				$apiKey,
				uniqueIds,
				current.maxAccessibleLevel ?? current.subject.data.level
			);
			if (current?.subject.id !== subject.id) return;
			detailSubject = fetchedSubjects.find((item) => item.id === subject.id) ?? subject;
			relatedSubjects = fetchedSubjects.filter((item) => item.id !== subject.id);
			moreInfoLoadedFor = subject.id;
		} catch {
			if (current?.subject.id === subject.id) moreInfoError = 'Could not load related WaniKani items.';
		} finally {
			if (current?.subject.id === subject.id) moreInfoLoading = false;
		}
	}

	function saveCurrentSession() {
		if (phase !== 'question' || queue.length === 0) {
			clearReviewSession();
			return;
		}
		saveReviewSession({
			version: 1,
			queue,
			totalUnique,
			knownAssignmentIds: [...knownAssignmentIds],
			pendingIds: [...pendingIds],
			missedIds: [...missedIds],
			seenAssignments: [...seenAssignments],
			completedCount,
			correctFirstTry,
			wrapUp,
			flipped
		});
	}

	function restoreReviewSession(): boolean {
		const saved = readReviewSession();
		if (!saved || saved.queue.length === 0) return false;

		queue = saved.queue;
		totalUnique = saved.totalUnique;
		knownAssignmentIds = new Set(
			saved.knownAssignmentIds ?? [
				...saved.pendingIds,
				...saved.seenAssignments,
				...saved.queue.map((card) => card.assignmentId)
			]
		);
		pendingIds = new Set(saved.pendingIds);
		missedIds = new Set(saved.missedIds);
		seenAssignments = new Set(saved.seenAssignments);
		completedCount = saved.completedCount;
		correctFirstTry = saved.correctFirstTry;
		wrapUp = saved.wrapUp;
		flipped = false;
		phase = 'question';
		saveCurrentSession();
		return true;
	}

function withoutQueuedSubmissions(cards: ReviewCard[]): ReviewCard[] {
	const queuedIds = new Set($pendingReviews.map((review) => review.assignmentId));
	return cards.filter((card) => !queuedIds.has(card.assignmentId));
}

async function getAvailableReviewQueue(): Promise<ReviewCard[]> {
	const cachedQueue = await getCachedReviewQueue();
	const cachedCards = cachedQueue ? withoutQueuedSubmissions(cachedQueue.cards) : null;
	if (!navigator.onLine) {
		if (cachedCards) return cachedCards;
		throw new WaniKaniError('No offline review queue is saved on this device. Connect once to preload reviews.', 0);
	}
	if (cachedQueue && Date.now() - cachedQueue.fetchedAt < REVIEW_QUEUE_FRESH_MS) {
		return cachedCards ?? [];
	}
	try {
		return withoutQueuedSubmissions(await buildReviewQueue($apiKey));
	} catch (e) {
		if (cachedCards) return cachedCards;
		throw e;
	}
}

	async function addNewDueReviews() {
		if (wrapUp || phase !== 'question') return;
		try {
			const availableCards = await getAvailableReviewQueue();
			if (wrapUp || phase !== 'question') return;
			const newCards = availableCards.filter((card) => !knownAssignmentIds.has(card.assignmentId));
			if (newCards.length === 0) return;

			queue = [...queue, ...shuffle(newCards)];
			const nextKnownIds = new Set(knownAssignmentIds);
			const nextPendingIds = new Set(pendingIds);
			for (const card of newCards) {
				nextKnownIds.add(card.assignmentId);
				nextPendingIds.add(card.assignmentId);
			}
			knownAssignmentIds = nextKnownIds;
			pendingIds = nextPendingIds;
			totalUnique += newCards.length;
			saveCurrentSession();
		} catch {
			// Keep the saved queue usable if the due-review refresh is offline.
		}
	}

	function shuffle<T>(arr: T[]): T[] {
		const copy = [...arr];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j], copy[i]];
		}
		return copy;
	}

	async function load() {
		phase = 'loading';
		error = '';
		try {
			const cards = await getAvailableReviewQueue();
			if (cards.length === 0) {
				phase = 'finished';
				totalUnique = 0;
				clearReviewSession();
				return;
			}
			queue = shuffle(cards);
			totalUnique = queue.length;
			knownAssignmentIds = new Set(queue.map((card) => card.assignmentId));
			pendingIds = new Set(queue.map((c) => c.assignmentId));
			missedIds = new Set();
			seenAssignments = new Set();
			completedCount = 0;
			correctFirstTry = 0;
			wrapUp = false;
			flipped = false;
			phase = 'question';
			saveCurrentSession();
		} catch (e) {
			error = e instanceof WaniKaniError ? e.message : 'Something went wrong.';
			phase = 'error';
		}
	}

	onMount(() => {
		if (!$apiKey) {
			goto('/settings');
			return;
		}
		if (restoreReviewSession()) {
			void addNewDueReviews();
		} else {
			load();
		}
	});

	function onPageHide() {
		saveCurrentSession();
	}

	function flip() {
		flipped = true;
		saveCurrentSession();
	}

	function playAudio(subject = current?.subject) {
		const url = subject?.data.pronunciation_audios?.[0]?.url;
		if (!url) return;

		audioError = '';
		audioPlayer?.pause();
		const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
		if (audioSession) audioSession.type = 'ambient';
		audioPlayer = new Audio(url);
		audioPlayer.volume = $reviewAudioSettings.volume;
		void audioPlayer.play().catch(() => {
			audioError = 'Unable to play audio.';
		});
	}

	function finishMissed() {
		resetMoreInfo();
		wrapUp = true;
		queue = queue.filter((card) => missedIds.has(card.assignmentId));
		flipped = false;
		if (queue.length === 0) {
			clearReviewSession();
			goto('/');
		} else {
			saveCurrentSession();
		}
	}

	function endReview() {
		saveCurrentSession();
		goto('/');
	}

	async function grade(wasCorrect: boolean) {
		if (!current) return;
		error = '';
		const card = current;
		resetMoreInfo();
		flipped = false;

		const isFirstAttempt = !seenAssignments.has(card.assignmentId);
		seenAssignments.add(card.assignmentId);

		if (!wasCorrect) {
			card.incorrectCount += 1;
			missedIds = new Set(missedIds).add(card.assignmentId);
		}
		if (isFirstAttempt && wasCorrect) correctFirstTry += 1;
		if ($reviewAudioSettings.autoplayAfterAnswer) playAudio(card.subject);

		if (wasCorrect) {
			queue = queue.slice(1);
			const remainingMissed = new Set(missedIds);
			remainingMissed.delete(card.assignmentId);
			missedIds = remainingMissed;
			const remaining = new Set(pendingIds);
			remaining.delete(card.assignmentId);
			pendingIds = remaining;
			completedCount = totalUnique - pendingIds.size;
			saveCurrentSession();
			const reviewSubmission = {
				assignmentId: card.assignmentId,
				incorrectCount: card.incorrectCount,
				needsReading: card.needsReading,
				startingSrsStage: card.srsStage,
				subjectLabel: card.subject.data.characters ?? card.subject.data.slug
			};
			if (!navigator.onLine) {
				queueReviewSubmission(reviewSubmission);
			} else {
				try {
					const { startingSrsStage, endingSrsStage } = await submitQueuedReview(
						$apiKey,
						reviewSubmission
					);
					const startingStage = startingSrsStage ?? card.srsStage;
					if ($showSrsChanges && startingStage !== undefined && endingSrsStage !== null) {
						recordSrsStageUpdate({
							subjectLabel: reviewSubmission.subjectLabel,
							startingStage,
							endingStage: endingSrsStage
						});
					}
				} catch (e) {
					if (e instanceof WaniKaniError) {
						error = `${e.message} The result is saved and will retry when connected.`;
					}
				}
			}
		} else {
			// Send the card back into the deck a few cards later, Anki-style.
			const rest = queue.slice(1);
			const offset = Math.min(rest.length, 3 + Math.floor(Math.random() * 4));
			rest.splice(offset, 0, card);
			queue = rest;
			saveCurrentSession();
		}

		if (queue.length === 0) {
			clearReviewSession();
			goto('/');
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (phase !== 'question' || !current) return;
		const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

		if (!flipped) {
			if (key === $keybindings.flip) {
				e.preventDefault();
				flip();
			}
			return;
		}

		if (key === $keybindings.correct) {
			e.preventDefault();
			grade(true);
		} else if (key === $keybindings.wrong) {
			e.preventDefault();
			grade(false);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} onpagehide={onPageHide} />

<div class="container review-container">
	{#if phase === 'loading'}
		<p>Loading review queue...</p>
	{:else if phase === 'error'}
		<p class="error">{error}</p>
		<a href="/">Back home</a>
	{:else if phase === 'finished'}
		<h1>{wrapUp ? 'Missed cards cleared' : 'All done!'}</h1>
		{#if totalUnique > 0}
			<p>
				You completed {completedCount} of {totalUnique} review{totalUnique === 1 ? '' : 's'}, {correctFirstTry} correct on
				the first try.
			</p>
			{#if pendingIds.size > 0}
				<p class="muted">
					{pendingIds.size} new item{pendingIds.size === 1 ? ' remains' : 's remain'} for later.
				</p>
			{/if}
		{:else}
			<p>No reviews were available.</p>
		{/if}
		<a href="/"><button class="primary">Back home</button></a>
	{:else if current}
		<div class="review-toolbar">
			<div class="progress-details">
				<div class="progress-bar">
					<div class="progress-fill" style="width: {(completedCount / totalUnique) * 100}%"></div>
				</div>
				<p class="muted">{completedCount} / {totalUnique} complete{wrapUp ? ' · finishing missed cards' : ''}</p>
			</div>
			<div class="session-actions">
				<button class="finish-missed" onclick={endReview}>End review</button>
				{#if !wrapUp}
					<button class="finish-missed" onclick={finishMissed}>
						Wrap up ({missedIds.size})
					</button>
				{/if}
			</div>
		</div>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<div
			class="card"
			class:radical-card={current.subject.object === 'radical'}
			class:kanji-card={current.subject.object === 'kanji'}
			class:vocabulary-card={current.subject.object === 'vocabulary' || current.subject.object === 'kana_vocabulary'}
		>
			<div class="characters" class:small={!current.subject.data.characters}>
				{#if current.subject.data.characters}
					{current.subject.data.characters}
				{:else if current.subject.data.character_images?.length}
					<img
						class="radical-image"
						src={current.subject.data.character_images.find((i) => i.content_type === 'image/svg+xml')?.url ?? current.subject.data.character_images[0].url}
						alt={current.subject.data.slug}
					/>
				{:else}
					{current.subject.data.slug}
				{/if}
			</div>
			<p class="subject-type">{current.subject.object.replace('_', ' ')}</p>
			<div class="card-actions">
				{#if !flipped}
					<button class="primary flip-button" onclick={flip}>
						Flip <span class="shortcut" aria-hidden="true">({$keybindings.flip})</span>
					</button>
				{:else}
					<div class="grade-buttons">
						<button class="wrong" onclick={() => grade(false)}>
							Wrong <span class="shortcut" aria-hidden="true">({$keybindings.wrong})</span>
						</button>
						<button class="correct" onclick={() => grade(true)}>
							Correct <span class="shortcut" aria-hidden="true">({$keybindings.correct})</span>
						</button>
					</div>
				{/if}
			</div>

			{#if flipped}
				<div class="back">
					{#if current.subject.data.pronunciation_audios?.length}
						<section class="audio-section">
							<button type="button" onclick={() => playAudio()}>Play audio</button>
							{#if audioError}<p class="audio-error" role="status">{audioError}</p>{/if}
						</section>
					{/if}
					{#if current.subject.data.readings?.length}
						<section class="answer-section">
							<h3>Reading</h3>
							{#each readingsForDisplay(current.subject) as group (group.type)}
								<p>
									{#if group.type !== 'Reading'}
										<span class="reading-type">{group.type}:</span>
									{/if}
									{#each group.readings as option, index}
										{#if option.accepted}
											<strong class="answer-accent" title={option.primary ? 'Primary reading' : 'Accepted alternative'}>{option.reading}</strong>
										{:else}
											<span title="Alternative reading">{option.reading}</span>
										{/if}{index < group.readings.length - 1 ? ', ' : ''}
									{/each}
								</p>
							{/each}
						</section>
					{/if}
					<section class="answer-section">
						<h3>Meaning</h3>
						<p>
							{#each allMeanings(current.subject) as meaning, index}
								<strong class="answer-accent">{meaning}</strong>{index < current.subject.data.meanings.length - 1 ? ', ' : ''}
							{/each}
						</p>
						{#if $showPartsOfSpeech && current.subject.data.parts_of_speech?.length}
							<p class="subject-classification">
								{current.subject.data.parts_of_speech.join(' · ')}
							</p>
						{/if}
					</section>

					<button
						class="more-info-toggle"
						type="button"
						aria-expanded={moreInfoOpen}
						onclick={() => void toggleMoreInfo()}
					>
						{moreInfoOpen ? 'Hide more information' : 'More information'}
					</button>

					{#if moreInfoOpen}
						<div class="more-info">
							{#if moreInfoLoading}
								<p class="muted">Loading related items...</p>
							{:else if moreInfoError}
								<p class="error" role="status">{moreInfoError} Close and reopen to retry.</p>
							{:else if current.subject.object === 'kanji'}
								<section>
									<h3>Similar kanji</h3>
									{#if similarKanji.length}
										<div class="related-items">
											{#each similarKanji as subject (subject.id)}
												<span class="related-item">
													<strong>{subject.data.characters ?? subject.data.slug}</strong>
													{primaryMeaning(subject)}
												</span>
											{/each}
										</div>
									{:else}
										<p class="muted">No similar kanji listed.</p>
									{/if}
								</section>
								<section>
									<h3>Vocabulary by reading</h3>
									{#if vocabularyGroups.length}
										{#each vocabularyGroups as group (group.reading)}
											<p>
												<span class="reading-type">{group.reading}:</span>
												{#each group.subjects as subject, index (subject.id)}
													<strong>{subject.data.characters ?? subject.data.slug}</strong>
													{index < group.subjects.length - 1 ? ', ' : ''}
												{/each}
											</p>
										{/each}
									{:else}
										<p class="muted">No related vocabulary listed.</p>
									{/if}
								</section>
							{:else if current.subject.object === 'radical'}
								<section>
									<h3>Kanji using this radical</h3>
									{#if similarKanji.length}
										<div class="related-items">
											{#each similarKanji as subject (subject.id)}
												<span class="related-item">
													<strong>{subject.data.characters ?? subject.data.slug}</strong>
													{primaryMeaning(subject)}
												</span>
											{/each}
										</div>
									{:else}
										<p class="muted">No kanji listed for this radical.</p>
									{/if}
								</section>
							{:else if (detailSubject ?? current.subject).data.context_sentences?.length}
								<section>
									<h3>Example sentences</h3>
									{#each (detailSubject ?? current.subject).data.context_sentences ?? [] as sentence, index (`${sentence.ja}-${index}`)}
										<div class="context-sentence">
											<p lang="ja">{sentence.ja}</p>
											<p>{sentence.en}</p>
										</div>
									{/each}
								</section>
							{:else}
								<p class="muted">No additional information available for this item.</p>
							{/if}
						</div>
					{/if}

					{#if $showMnemonics}
						<section class="mnemonic">
							<h3>Meaning mnemonic</h3>
							<p>{mnemonicText(current.subject.data.meaning_mnemonic)}</p>
						</section>

						{#if current.needsReading && current.subject.data.reading_mnemonic}
							<section class="mnemonic">
								<h3>Reading mnemonic</h3>
								<p>{mnemonicText(current.subject.data.reading_mnemonic)}</p>
							</section>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.progress-bar {
		height: 8px;
		background: var(--surface-alt);
		border-radius: 999px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.2s ease;
	}

	.muted {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.review-toolbar {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		margin-bottom: 1rem;
	}

	.progress-details {
		flex: 1;
		min-width: 0;
	}

	.progress-details p {
		margin: 0.45rem 0 0;
	}

	.session-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.finish-missed {
		font-size: 0.875rem;
		white-space: nowrap;
		padding: 0.5rem 0.8rem;
	}

	.error {
		color: var(--bad);
	}

	.review-container {
		width: 100%;
		min-width: 0;
	}

	.card {
		position: relative;
		width: 100%;
		max-width: 600px;
		margin: 1.5rem auto 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 2.5rem 2rem;
		text-align: center;
	}

	.radical-card {
		border-color: rgba(0, 170, 255, 0.72);
	}

	.kanji-card {
		border-color: rgba(241, 0, 161, 0.72);
	}

	.vocabulary-card {
		border-color: rgba(161, 0, 241, 0.72);
	}

	.characters {
		font-size: 4rem;
		line-height: 1.2;
	}

	.characters.small {
		font-size: 1.5rem;
	}

	.radical-image {
		width: 64px;
		height: 64px;
		filter: invert(1);
	}

	.subject-type {
		color: var(--muted);
		font-weight: 700;
		text-transform: capitalize;
		margin-top: 0.25rem;
	}

	.radical-card .subject-type,
	.radical-card .answer-accent {
		color: #00aaff;
	}

	.kanji-card .subject-type,
	.kanji-card .answer-accent {
		color: #f100a1;
	}

	.vocabulary-card .subject-type,
	.vocabulary-card .answer-accent {
		color: #a100f1;
	}

	.card-actions {
		position: sticky;
		top: 0.5rem;
		z-index: 1;
		min-height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 1.25rem auto 0;
		padding: 0.25rem 0;
		background: var(--surface);
	}

	.flip-button {
		width: min(100%, 420px);
	}

	.radical-card .flip-button {
		background: #00aaff;
		border-color: #00aaff;
		color: #fff;
	}

	.kanji-card .flip-button {
		background: #f100a1;
		border-color: #f100a1;
		color: #fff;
	}

	.vocabulary-card .flip-button {
		background: #a100f1;
		border-color: #a100f1;
		color: #fff;
	}

	@media (hover: hover) {
		.radical-card .flip-button:hover:not(:disabled) {
			background: transparent;
			color: #00aaff;
		}

		.kanji-card .flip-button:hover:not(:disabled) {
			background: transparent;
			color: #f100a1;
		}

		.vocabulary-card .flip-button:hover:not(:disabled) {
			background: transparent;
			color: #a100f1;
		}
	}

	.back {
		text-align: left;
		max-width: 480px;
		margin: 1.5rem auto 0;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.back h3 {
		margin: 0 0 0.35rem;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	.back p {
		margin: 0;
	}

	.more-info-toggle {
		align-self: center;
		font-size: 0.9rem;
	}

	.more-info {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	.more-info section {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.related-items {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.related-item {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.35rem 0.55rem;
	}

	.context-sentence {
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
	}

	.context-sentence p + p {
		margin-top: 0.3rem;
		color: var(--muted);
	}

	.reading-type {
		color: var(--muted);
		text-transform: capitalize;
	}

	.answer-accent {
		color: var(--accent);
	}

	.audio-section {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
	}

	.answer-section {
		text-align: center;
	}

	.subject-classification {
		margin: 0.75rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
		text-transform: capitalize;
	}

	.audio-error {
		margin: 0;
		color: var(--bad);
		font-size: 0.875rem;
	}

	.mnemonic p {
		line-height: 1.5;
	}

	.mnemonic :global(radical),
	.mnemonic :global(kanji),
	.mnemonic :global(vocabulary),
	.mnemonic :global(reading),
	.mnemonic :global(meaning) {
		font-weight: 600;
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
	}

	.mnemonic :global(radical) {
		background: rgba(255, 255, 255, 0.1);
	}

	.mnemonic :global(kanji) {
		background: rgba(255, 255, 255, 0.16);
	}

	.mnemonic :global(vocabulary),
	.mnemonic :global(reading) {
		background: rgba(255, 255, 255, 0.08);
	}

	.grade-buttons {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		width: 100%;
	}

	.grade-buttons button {
		flex: 1;
		max-width: 200px;
		font-weight: 600;
	}

	.correct {
		background: var(--good);
		border-color: var(--good);
		color: #fff;
	}

	.wrong {
		background: var(--bad);
		border-color: var(--bad);
		color: #fff;
	}

	@media (min-width: 768px) {
		.card {
			display: flex;
			flex-direction: column;
			min-height: 340px;
		}

		.back {
			flex: initial;
			width: 100%;
			max-width: 480px;
			min-height: auto;
			margin: 1rem auto 0;
			overflow: visible;
		}
	}

	@media (max-width: 520px) {
		.review-container {
			padding: 0.75rem 1rem;
		}

		.review-toolbar {
			flex-wrap: wrap;
			gap: 0.5rem;
			margin-bottom: 0.5rem;
		}

		.progress-details {
			flex-basis: 100%;
		}

		.session-actions {
			margin-left: auto;
		}

		.card {
			margin-top: 0.5rem;
			padding: 1rem;
		}

		.characters {
			font-size: 3.25rem;
		}

		.card-actions {
			min-height: 48px;
			margin-top: 0.75rem;
		}

		.grade-buttons {
			gap: 0.5rem;
		}

		.grade-buttons button {
			padding: 0.6rem 0.5rem;
		}

		.shortcut {
			display: none;
		}
	}
</style>
