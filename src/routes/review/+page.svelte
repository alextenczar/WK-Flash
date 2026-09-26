<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiKey } from '$lib/storage';
	import { keybindings } from '$lib/keybindings';
	import { showMnemonics } from '$lib/review-preferences';
	import { clearReviewSession, readReviewSession, saveReviewSession } from '$lib/review-session';
	import { buildReviewQueue, submitReview, WaniKaniError } from '$lib/wanikani/api';
	import { allMeanings, readingsForDisplay } from '$lib/wanikani/matching';
	import type { ReviewCard } from '$lib/wanikani/types';

	type Phase = 'loading' | 'question' | 'finished' | 'error';

	let phase = $state<Phase>('loading');
	let error = $state('');
	let audioError = $state('');
	let flipped = $state(false);
	let audioPlayer: HTMLAudioElement | null = null;

	let queue = $state<ReviewCard[]>([]);
	let totalUnique = $state(0);
	let pendingIds = $state(new Set<number>());
	let missedIds = $state(new Set<number>());
	let completedCount = $state(0);
	let correctFirstTry = $state(0);
	let seenAssignments = new Set<number>();
	let wrapUp = $state(false);

	const current = $derived(queue[0] ?? null);

	function saveCurrentSession() {
		if (phase !== 'question' || queue.length === 0) {
			clearReviewSession();
			return;
		}
		saveReviewSession({
			version: 1,
			queue,
			totalUnique,
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
		pendingIds = new Set(saved.pendingIds);
		missedIds = new Set(saved.missedIds);
		seenAssignments = new Set(saved.seenAssignments);
		completedCount = saved.completedCount;
		correctFirstTry = saved.correctFirstTry;
		wrapUp = saved.wrapUp;
		flipped = saved.flipped;
		phase = 'question';
		return true;
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
			const cards = await buildReviewQueue($apiKey);
			if (cards.length === 0) {
				phase = 'finished';
				totalUnique = 0;
				clearReviewSession();
				return;
			}
			queue = shuffle(cards);
			totalUnique = queue.length;
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
		if (!restoreReviewSession()) load();
	});

	function onPageHide() {
		saveCurrentSession();
	}

	function flip() {
		flipped = true;
		saveCurrentSession();
	}

	function playAudio() {
		const url = current?.subject.data.pronunciation_audios?.[0]?.url;
		if (!url) return;

		audioError = '';
		audioPlayer?.pause();
		audioPlayer = new Audio(url);
		void audioPlayer.play().catch(() => {
			audioError = 'Unable to play audio.';
		});
	}

	function finishMissed() {
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
		clearReviewSession();
		goto('/');
	}

	async function grade(wasCorrect: boolean) {
		if (!current) return;
		const card = current;
		flipped = false;

		const isFirstAttempt = !seenAssignments.has(card.assignmentId);
		seenAssignments.add(card.assignmentId);

		if (!wasCorrect) {
			card.incorrectCount += 1;
			missedIds = new Set(missedIds).add(card.assignmentId);
		}
		if (isFirstAttempt && wasCorrect) correctFirstTry += 1;

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
			try {
				await submitReview($apiKey, card.assignmentId, card.incorrectCount, card.needsReading);
			} catch (e) {
				error = e instanceof WaniKaniError ? e.message : 'Failed to submit a review to WaniKani.';
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

<div class="container">
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

		<div class="card">
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
						Flip ({$keybindings.flip})
					</button>
				{:else}
					<div class="grade-buttons">
						<button class="wrong" onclick={() => grade(false)}>Wrong ({$keybindings.wrong})</button>
						<button class="correct" onclick={() => grade(true)}>Correct ({$keybindings.correct})</button>
					</div>
				{/if}
			</div>

			{#if flipped}
				<div class="back">
					{#if current.subject.data.pronunciation_audios?.length}
						<section class="audio-section">
							<button type="button" onclick={playAudio}>Play audio</button>
							{#if audioError}<p class="audio-error" role="status">{audioError}</p>{/if}
						</section>
					{/if}
					{#if current.subject.data.readings?.length}
						<section>
							<h3>Reading</h3>
							{#each readingsForDisplay(current.subject) as group (group.type)}
								<p>
									<span class="reading-type">{group.type}:</span>
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
					<section>
						<h3>Meaning</h3>
						<p>
							{#each allMeanings(current.subject) as meaning, index}
								<strong class="answer-accent">{meaning}</strong>{index < current.subject.data.meanings.length - 1 ? ', ' : ''}
							{/each}
						</p>
					</section>

					{#if $showMnemonics}
						<section class="mnemonic">
							<h3>Meaning mnemonic</h3>
							<p>{@html current.subject.data.meaning_mnemonic}</p>
						</section>

						{#if current.needsReading && current.subject.data.reading_mnemonic}
							<section class="mnemonic">
								<h3>Reading mnemonic</h3>
								<p>{@html current.subject.data.reading_mnemonic}</p>
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

	.card {
		margin-top: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 2.5rem 2rem;
		text-align: center;
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
		text-transform: capitalize;
		margin-top: 0.25rem;
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
		gap: 0.75rem;
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
		background: rgba(91, 140, 255, 0.2);
	}

	.mnemonic :global(kanji) {
		background: rgba(255, 176, 60, 0.2);
	}

	.mnemonic :global(vocabulary),
	.mnemonic :global(reading) {
		background: rgba(63, 191, 106, 0.2);
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

	@media (max-width: 520px) {
		.review-toolbar {
			flex-wrap: wrap;
			gap: 0.5rem;
		}

		.progress-details {
			flex-basis: 100%;
		}

		.session-actions {
			margin-left: auto;
		}

		.card {
			padding: 1.5rem 1rem;
		}

		.grade-buttons {
			gap: 0.5rem;
		}

		.grade-buttons button {
			padding: 0.6rem 0.5rem;
		}
	}
</style>
