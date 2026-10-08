<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiKey } from '$lib/storage';
	import { getLessonQueue, WaniKaniError, type LessonCard } from '$lib/wanikani/api';
	import { primaryMeaning } from '$lib/wanikani/matching';

	const SELECTED_LESSONS_KEY = 'wk-flash:selected-lessons';

	let lessons = $state<LessonCard[]>([]);
	let selectedIds = $state(new Set<number>());
	let loading = $state(true);
	let error = $state('');
	let loadingRequest = false;

	const selectedCount = $derived(selectedIds.size);
	const allSelected = $derived(lessons.length > 0 && selectedIds.size === lessons.length);
	const lessonsByLevel = $derived.by(() => {
		const groups = new Map<number, LessonCard[]>();
		for (const lesson of lessons) {
			const level = lesson.subject.data.level;
			const group = groups.get(level) ?? [];
			group.push(lesson);
			groups.set(level, group);
		}
		return [...groups].sort(([left], [right]) => left - right);
	});

	function primaryReading(lesson: LessonCard): string | null {
		const readings = lesson.subject.data.readings ?? [];
		return readings.find((reading) => reading.primary)?.reading ?? readings[0]?.reading ?? null;
	}

	function subjectPath(lesson: LessonCard): string {
		const type = lesson.subject.object === 'vocabulary' || lesson.subject.object === 'kana_vocabulary'
			? 'vocab'
			: lesson.subject.object;
		return `/${type}/${encodeURIComponent(lesson.subject.data.characters ?? lesson.subject.data.slug)}?from=lessons`;
	}

	function toggleLesson(assignmentId: number) {
		const next = new Set(selectedIds);
		if (next.has(assignmentId)) next.delete(assignmentId);
		else next.add(assignmentId);
		selectedIds = next;
	}

	function handleLessonKeydown(event: KeyboardEvent, assignmentId: number) {
		if (event.key !== ' ' && event.key !== 'Enter') return;
		event.preventDefault();
		toggleLesson(assignmentId);
	}

	function toggleAll() {
		selectedIds = allSelected ? new Set() : new Set(lessons.map((lesson) => lesson.assignmentId));
	}

	function startLessons() {
		try {
			sessionStorage.setItem(SELECTED_LESSONS_KEY, JSON.stringify([...selectedIds]));
		} catch {
			error = 'Unable to save your selection on this device.';
			return;
		}
		void goto('/lessons/study');
	}

	async function load(_forceRefresh = false) {
		if (loadingRequest) return;
		loadingRequest = true;
		loading = true;
		error = '';
		try {
			lessons = await getLessonQueue($apiKey);
			selectedIds = new Set();
		} catch (e) {
			error = e instanceof WaniKaniError ? e.message : 'Unable to load lessons.';
		} finally {
			loading = false;
			loadingRequest = false;
		}
	}

	onMount(() => {
		if (!$apiKey) {
			void goto('/settings');
			return;
		}
		void load();
	});
</script>

<svelte:head>
	<title>Lessons · WK Flash</title>
</svelte:head>

<div class="container lessons-container">
	<div class="page-heading">
		<div>
			<h1>Lessons</h1>
			<p class="muted">Choose the items you want to learn. You can select one, several, or everything available.</p>
		</div>
	</div>

	{#if loading}
		<p>Loading available lessons...</p>
	{:else if error}
		<p class="error" role="alert">{error}</p>
		<button type="button" onclick={() => void load(true)}>Try again</button>
	{:else if lessons.length === 0}
		<section class="empty-state">
			<h2>You're caught up</h2>
			<p class="muted">There are no unlocked lessons waiting to be started.</p>
		</section>
	{:else}
		<div class="selection-toolbar">
			<label class="select-all">
				<input type="checkbox" checked={allSelected} onchange={toggleAll} />
				<span>Select all</span>
			</label>
			<span class="muted" aria-live="polite">{selectedCount} of {lessons.length} selected</span>
		</div>

		{#each lessonsByLevel as [level, levelLessons]}
			<section class="level-section" aria-labelledby={`level-${level}`}>
				<h2 id={`level-${level}`}>Level {level}</h2>
				<div class="lesson-list">
					{#each levelLessons as lesson (lesson.assignmentId)}
						<div
							class="lesson-row"
							role="checkbox"
							tabindex="0"
							aria-checked={selectedIds.has(lesson.assignmentId)}
							class:selected={selectedIds.has(lesson.assignmentId)}
							class:radical-row={lesson.subject.object === 'radical'}
							class:kanji-row={lesson.subject.object === 'kanji'}
							class:vocabulary-row={lesson.subject.object === 'vocabulary' || lesson.subject.object === 'kana_vocabulary'}
							onclick={() => toggleLesson(lesson.assignmentId)}
							onkeydown={(event) => handleLessonKeydown(event, lesson.assignmentId)}
						>
							<input
								class="lesson-checkbox"
								type="checkbox"
								checked={selectedIds.has(lesson.assignmentId)}
								aria-hidden="true"
								tabindex="-1"
								onclick={(event) => event.preventDefault()}
							/>
							<span class="lesson-character" class:small={!lesson.subject.data.characters}>
								{lesson.subject.data.characters ?? lesson.subject.data.slug}
							</span>
							<span class="lesson-details">
								<strong>{primaryMeaning(lesson.subject)}</strong>
								{#if primaryReading(lesson)}
									<span class="lesson-reading">{primaryReading(lesson)}</span>
								{/if}
								<span>{lesson.subject.object.replace('_', ' ')}</span>
							</span>
							<a
								class="lesson-info"
								href={subjectPath(lesson)}
								onclick={(event) => event.stopPropagation()}
							>
								Info
							</a>
						</div>
					{/each}
				</div>
			</section>
		{/each}

		<div class="start-bar">
			<button class="primary" type="button" disabled={selectedCount === 0} onclick={startLessons}>
				Learn {selectedCount} {selectedCount === 1 ? 'lesson' : 'lessons'}
			</button>
		</div>
	{/if}
</div>

<style>
	.lessons-container {
		max-width: 1100px;
	}

	.page-heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	h1, h2, p {
		margin-top: 0;
	}

	.muted {
		color: var(--muted);
	}

	.error {
		color: var(--bad);
	}

	.selection-toolbar,
	.start-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.start-bar {
		justify-content: flex-end;
		margin-top: 1rem;
		border-top: 0;
	}

	.start-bar button {
		white-space: nowrap;
	}

	.select-all {
		display: flex;
		align-items: center;
		cursor: pointer;
	}

	input[type='checkbox'] {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--accent);
	}

	.lesson-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.65rem;
		margin-top: 1rem;
	}

	.level-section {
		margin-top: 1.5rem;
	}

	.level-section h2 {
		margin: 0;
		font-size: 1rem;
	}

	.lesson-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		min-height: 5rem;
		padding: 0.8rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
	}

	.lesson-row:hover,
	.lesson-row.selected {
		border-color: var(--accent);
	}

	.lesson-row:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.lesson-row.radical-row {
		border-color: rgba(0, 170, 255, 0.72);
	}

	.lesson-row.kanji-row {
		border-color: rgba(241, 0, 161, 0.72);
	}

	.lesson-row.vocabulary-row {
		border-color: rgba(161, 0, 241, 0.72);
	}

	.lesson-character {
		display: grid;
		place-items: center;
		min-width: 2.5rem;
		height: 2.5rem;
		flex: 0 0 auto;
		padding: 0 0.2rem;
		font-size: 1.45rem;
		white-space: nowrap;
	}

	.lesson-character.small {
		font-size: 0.8rem;
	}

	.lesson-details {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		flex: 1;
	}

	.lesson-details strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lesson-details span {
		color: var(--muted);
		font-size: 0.8rem;
		text-transform: capitalize;
	}

	.lesson-details .lesson-reading {
		color: var(--text);
		font-size: 0.9rem;
		text-transform: none;
	}

	.lesson-info {
		flex: 0 0 auto;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--muted);
		font-size: 0.8rem;
		text-decoration: none;
	}

	.lesson-info:hover,
	.lesson-info:focus-visible {
		border-color: var(--accent);
		color: var(--accent);
		text-decoration: none;
	}

	.empty-state {
		padding: 2rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		text-align: center;
	}

	@media (max-width: 520px) {
		.page-heading {
			align-items: flex-start;
			flex-direction: column;
		}

		.start-bar button {
			width: 100%;
		}
	}
</style>
