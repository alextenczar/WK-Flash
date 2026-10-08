<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiKey } from '$lib/storage';
	import { keybindings } from '$lib/keybindings';
	import { playPronunciation, reviewAudioSettings } from '$lib/review-audio';
	import { showMnemonics, showPartsOfSpeech } from '$lib/review-preferences';
	import { pendingLessonStarts, startQueuedLesson } from '$lib/lesson-outbox';
	import { getLessonQueue, getSubjectsByIds, WaniKaniError, type LessonCard } from '$lib/wanikani/api';
	import { allMeanings, primaryMeaning, readingsForDisplay, vocabularyByReading } from '$lib/wanikani/matching';
	import type { WKSubject } from '$lib/wanikani/types';

	const SELECTED_LESSONS_KEY = 'wk-flash:selected-lessons';
	let cards = $state<LessonCard[]>([]);
	let reviewQueue = $state<LessonCard[]>([]);
	let phase = $state<'learning' | 'review'>('learning');
	let index = $state(0);
	let revealed = $state(false);
	let loading = $state(true);
	let error = $state('');
	let submitError = $state('');
	let moreInfoOpen = $state(false);
	let moreInfoLoading = $state(false);
	let moreInfoError = $state('');
	let moreInfoLoadedFor = $state<number | null>(null);
	let relatedSubjects = $state<WKSubject[]>([]);
	let detailSubject = $state<WKSubject | null>(null);
	const current = $derived(phase === 'learning' ? cards[index] ?? null : reviewQueue[0] ?? null);
	const similarKanji = $derived(relatedSubjects.filter((subject) => subject.object === 'kanji'));
	const vocabularyGroups = $derived(vocabularyByReading(relatedSubjects));

	function playAudio(lesson: LessonCard) {
		void playPronunciation(lesson.subject.data.pronunciation_audios?.[0]?.url, $reviewAudioSettings.volume);
	}

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
			? [...(subject.data.visually_similar_subject_ids ?? []), ...(subject.data.amalgamation_subject_ids ?? [])]
			: subject.object === 'radical' ? (subject.data.amalgamation_subject_ids ?? []) : [];
		const isVocabulary = subject.object === 'vocabulary' || subject.object === 'kana_vocabulary';
		const uniqueIds = [...new Set([
			...relatedIds.filter((id) => id !== subject.id),
			...(isVocabulary ? [subject.id] : [])
		])];

		moreInfoError = '';
		if (uniqueIds.length === 0) {
			relatedSubjects = [];
			detailSubject = subject;
			moreInfoLoadedFor = subject.id;
			return;
		}
		moreInfoLoading = true;
		try {
			const fetched = await getSubjectsByIds($apiKey, uniqueIds, current.subject.data.level);
			if (current?.subject.id !== subject.id) return;
			detailSubject = fetched.find((item) => item.id === subject.id) ?? subject;
			relatedSubjects = fetched.filter((item) => item.id !== subject.id);
			moreInfoLoadedFor = subject.id;
		} catch {
			if (current?.subject.id === subject.id) moreInfoError = 'Could not load related WaniKani items.';
		} finally {
			if (current?.subject.id === subject.id) moreInfoLoading = false;
		}
	}

	function reveal() {
		revealed = true;
		if (current && $reviewAudioSettings.autoplayAfterAnswer) playAudio(current);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!current) return;
		const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
		if (!revealed && key === $keybindings.flip) {
			event.preventDefault();
			reveal();
		} else if (revealed && key === $keybindings.correct) {
			event.preventDefault();
			phase === 'learning' ? next() : grade(true);
		} else if (revealed && key === $keybindings.wrong) {
			event.preventDefault();
			if (phase === 'review') grade(false);
		}
	}

	function next() {
		resetMoreInfo();
		submitError = '';
		if (index >= cards.length - 1) {
			phase = 'review';
			reviewQueue = [...cards];
			index = 0;
			revealed = false;
			return;
		}
		index += 1;
		revealed = false;
	}

	function finishSession() {
		try {
			sessionStorage.removeItem(SELECTED_LESSONS_KEY);
		} catch {
			// The lesson still completed even if storage cleanup is unavailable.
		}
		void goto('/lessons');
	}

	function grade(wasCorrect: boolean) {
		const card = reviewQueue[0];
		if (!card) return;
		resetMoreInfo();
		revealed = false;
		submitError = '';

		if (!wasCorrect) {
			const rest = reviewQueue.slice(1);
			const offset = Math.min(rest.length, 3 + Math.floor(Math.random() * 4));
			rest.splice(offset, 0, card);
			reviewQueue = rest;
			return;
		}

		reviewQueue = reviewQueue.slice(1);
		void startQueuedLesson($apiKey, card.assignmentId).catch((e: unknown) => {
			submitError = e instanceof WaniKaniError
				? `${e.message} The lesson is saved and will retry when connected.`
				: 'Could not submit this lesson to WaniKani. It is saved and will retry when connected.';
		});
		if (reviewQueue.length === 0) finishSession();
	}

	onMount(() => {
		if (!$apiKey) {
			void goto('/settings');
			return;
		}
		let selectedIds: number[];
		try {
			selectedIds = JSON.parse(sessionStorage.getItem(SELECTED_LESSONS_KEY) ?? '[]');
		} catch {
			selectedIds = [];
		}
		if (!selectedIds.length) {
			void goto('/lessons');
			return;
		}

		void (async () => {
			try {
				const selected = new Set(selectedIds.filter((id) => Number.isInteger(id)));
				const pendingStarts = new Set($pendingLessonStarts);
				cards = (await getLessonQueue($apiKey)).filter(
					(card) => selected.has(card.assignmentId) && !pendingStarts.has(card.assignmentId)
				);
				if (!cards.length) void goto('/lessons');
			} catch (e) {
				error = e instanceof WaniKaniError ? e.message : 'Unable to load lessons.';
			} finally {
				loading = false;
			}
		})();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Learn · WK Flash</title>
</svelte:head>

<div class="container study-container">
	{#if loading}
		<p>Loading your lessons...</p>
	{:else if error}
		<p class="error" role="alert">{error}</p>
		<a href="/lessons">Back to lessons</a>
	{:else if current}
		<div class="review-toolbar">
			<div class="progress-details">
				<div class="progress-bar" aria-hidden="true">
					<div
						class="progress-fill"
						style="width: {phase === 'learning'
							? ((index + 1) / cards.length) * 50
							: 50 + ((cards.length - reviewQueue.length) / cards.length) * 50}%"
					></div>
				</div>
				<p class="muted">
					{phase === 'learning' ? `Learning ${index + 1} / ${cards.length}` : `${reviewQueue.length} left to confirm`}
				</p>
			</div>
			<div class="session-actions">
				<a href="/lessons"><button class="finish-missed" type="button">Exit</button></a>
			</div>
		</div>
		{#if phase === 'review'}
			<p class="review-heading">Review these items to confirm you know them.</p>
		{/if}

		<section
			class="lesson-card"
			class:radical-card={current.subject.object === 'radical'}
			class:kanji-card={current.subject.object === 'kanji'}
			class:vocabulary-card={current.subject.object === 'vocabulary' || current.subject.object === 'kana_vocabulary'}
		>
			<div class="characters">
				{current.subject.data.characters ?? current.subject.data.slug}
			</div>
			<p class="subject-type">{current.subject.object.replace('_', ' ')}</p>
			<div class="card-actions">
				{#if !revealed}
					<button
						class="primary flip-button"
						class:radical-button={current.subject.object === 'radical'}
						class:kanji-button={current.subject.object === 'kanji'}
						class:vocabulary-button={current.subject.object === 'vocabulary' || current.subject.object === 'kana_vocabulary'}
						type="button"
						onclick={reveal}
					>
						Show answer <span class="shortcut" aria-hidden="true">({$keybindings.flip})</span>
					</button>
				{:else if phase === 'review'}
					<div class="grade-buttons">
						<button class="wrong-button" type="button" onclick={() => grade(false)}>
							Wrong <span class="shortcut" aria-hidden="true">({$keybindings.wrong})</span>
						</button>
						<button
							class="correct-button"
							type="button"
							onclick={() => grade(true)}
						>
							Correct <span class="shortcut" aria-hidden="true">({$keybindings.correct})</span>
						</button>
					</div>
				{:else}
					<button
						class="primary flip-button"
						class:radical-button={current.subject.object === 'radical'}
						class:kanji-button={current.subject.object === 'kanji'}
						class:vocabulary-button={current.subject.object === 'vocabulary' || current.subject.object === 'kana_vocabulary'}
						type="button"
						onclick={next}
					>
						Next lesson <span class="shortcut" aria-hidden="true">({$keybindings.correct})</span>
					</button>
				{/if}
			</div>
			{#if submitError}
				<p class="error" role="alert">{submitError}</p>
			{/if}
			{#if revealed}
				<div class="answers">
					{#if current.subject.data.readings?.length}
						<section>
							<h2>Reading</h2>
							<p class="answer-accent">
								{#each readingsForDisplay(current.subject) as group, groupIndex}
									{#if groupIndex > 0} · {/if}{group.readings.map((reading) => reading.reading).join(', ')}
								{/each}
							</p>
						</section>
					{/if}
					<section>
						<h2>Meaning</h2>
						<p class="answer-accent">{allMeanings(current.subject).join(', ')}</p>
						{#if $showPartsOfSpeech && current.subject.data.parts_of_speech?.length}
							<p class="subject-classification">{current.subject.data.parts_of_speech.join(' · ')}</p>
						{/if}
					</section>
					{#if $showMnemonics && current.subject.data.meaning_mnemonic}
						<section class="mnemonic">
							<h2>Meaning mnemonic</h2>
							<p>{mnemonicText(current.subject.data.meaning_mnemonic)}</p>
						</section>
					{/if}
					{#if $showMnemonics && current.subject.data.reading_mnemonic}
						<section class="mnemonic">
							<h2>Reading mnemonic</h2>
							<p>{mnemonicText(current.subject.data.reading_mnemonic)}</p>
						</section>
					{/if}
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
									<h2>Similar kanji</h2>
									{#if similarKanji.length}
										<div class="related-items">
											{#each similarKanji as subject (subject.id)}
												<span class="related-item"><strong>{subject.data.characters ?? subject.data.slug}</strong>{primaryMeaning(subject)}</span>
											{/each}
										</div>
									{:else}
										<p class="muted">No similar kanji listed.</p>
									{/if}
								</section>
								<section>
									<h2>Vocabulary by reading</h2>
									{#if vocabularyGroups.length}
										{#each vocabularyGroups as group (group.reading)}
											<p><span class="reading-type">{group.reading}:</span> {group.subjects.map((subject) => subject.data.characters ?? subject.data.slug).join(', ')}</p>
										{/each}
									{:else}
										<p class="muted">No related vocabulary listed.</p>
									{/if}
								</section>
							{:else if current.subject.object === 'radical'}
								<section>
									<h2>Kanji using this radical</h2>
									{#if similarKanji.length}
										<div class="related-items">
											{#each similarKanji as subject (subject.id)}
												<span class="related-item"><strong>{subject.data.characters ?? subject.data.slug}</strong>{primaryMeaning(subject)}</span>
											{/each}
										</div>
									{:else}
										<p class="muted">No kanji listed for this radical.</p>
									{/if}
								</section>
							{:else if (detailSubject ?? current.subject).data.context_sentences?.length}
								<section>
									<h2>Example sentences</h2>
									{#each (detailSubject ?? current.subject).data.context_sentences ?? [] as sentence, index (`${sentence.ja}-${index}`)}
										<div class="context-sentence"><p lang="ja">{sentence.ja}</p><p>{sentence.en}</p></div>
									{/each}
								</section>
							{:else}
								<p class="muted">No additional information available for this item.</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.study-container {
		max-width: 1100px;
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
		padding: 0.5rem 0.8rem;
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.session-actions a {
		line-height: 0;
		text-decoration: none;
	}

	.muted {
		color: var(--muted);
	}

	.error {
		color: var(--bad);
	}

	.progress-bar {
		height: 8px;
		overflow: hidden;
		border-radius: 999px;
		background: var(--surface-alt);
	}

	.progress-fill {
		height: 100%;
		background: var(--accent);
		transition: width 0.2s ease;
	}

	.review-heading {
		margin: 1rem 0 0;
		color: var(--muted);
		text-align: center;
	}

	.lesson-card {
		position: relative;
		width: 100%;
		max-width: 600px;
		margin: 1.5rem auto 0;
		padding: 2.5rem 2rem;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface);
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

	.radical-card .subject-type {
		color: #00aaff;
	}

	.radical-card .answer-accent {
		color: #00aaff;
	}

	.kanji-card .subject-type {
		color: #f100a1;
	}

	.kanji-card .answer-accent {
		color: #f100a1;
	}

	.vocabulary-card .subject-type {
		color: #a100f1;
	}

	.vocabulary-card .answer-accent {
		color: #a100f1;
	}

	.subject-type {
		color: var(--muted);
		font-weight: 700;
		text-transform: capitalize;
		margin-top: 0.25rem;
	}

	.answers h2 {
		margin: 0 0 0.35rem;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}

	.characters {
		font-size: 4rem;
		line-height: 1.2;
	}

	.answers {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin: 1.5rem auto 0;
		max-width: 480px;
		text-align: left;
	}

	.answers p {
		margin: 0;
	}

	.answers > section:not(.mnemonic) {
		text-align: center;
	}

	.answers .subject-classification {
		margin: 0.75rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
		text-transform: capitalize;
	}

	.mnemonic p {
		line-height: 1.5;
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

	.grade-buttons {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		width: 100%;
	}

	.grade-buttons button {
		flex: 1;
		max-width: 200px;
		padding: 0.6rem 0.5rem;
		font-weight: 600;
	}

	.wrong-button {
		border-color: var(--bad);
		background: var(--bad);
		color: #fff;
	}

	.correct-button {
		border-color: var(--good);
		background: var(--good);
		color: #fff;
	}

	.radical-button {
		background: #00aaff;
		border-color: #00aaff;
		color: #fff;
	}

	.kanji-button {
		background: #f100a1;
		border-color: #f100a1;
		color: #fff;
	}

	.vocabulary-button {
		background: #a100f1;
		border-color: #a100f1;
		color: #fff;
	}

	.answer-accent {
		color: var(--accent);
		font-weight: 700;
	}

	@media (hover: hover) {
		.radical-button:hover:not(:disabled) {
			background: transparent;
			color: #00aaff;
		}

		.kanji-button:hover:not(:disabled) {
			background: transparent;
			color: #f100a1;
		}

		.vocabulary-button:hover:not(:disabled) {
			background: transparent;
			color: #a100f1;
		}

		.correct-button:hover:not(:disabled) {
			background: transparent;
			color: var(--good);
		}

		.wrong-button:hover:not(:disabled) {
			background: transparent;
			color: var(--bad);
		}
	}

	@media (min-width: 768px) {
		.lesson-card {
			display: flex;
			flex-direction: column;
			min-height: 340px;
		}

		.answers {
			flex: initial;
			width: 100%;
			max-width: 480px;
			min-height: auto;
			margin: 1rem auto 0;
			overflow: visible;
		}
	}

	.shortcut {
		opacity: 0.8;
	}

	@media (max-width: 520px) {
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

		.lesson-card {
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

		.shortcut {
			display: none;
		}
	}
</style>
