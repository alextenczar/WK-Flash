<script lang="ts">
	import { onMount } from 'svelte';
	import jlptKanji from '$lib/data/jlpt-kanji.json';
	import { apiKey } from '$lib/storage';
	import { getJLPTKanjiProgressData, WaniKaniError } from '$lib/wanikani/api';
	import type { WKAssignment, WKSubject } from '$lib/wanikani/types';

	type JLPTLevel = keyof typeof jlptKanji;
	type JLPTProgressData = { subjects: WKSubject[]; assignments: WKAssignment[] };
	type KanjiRow = {
		character: string;
		meaning: string;
		status: 'Learned' | 'In progress' | 'Not started' | 'Not available';
		statusClass: 'learned' | 'in-progress' | 'not-started' | 'unavailable';
		srsStage: number | null;
	};

	const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
	let selectedLevel = $state<JLPTLevel>('N5');
	let search = $state('');
	let expanded = $state(false);
	let progress = $state<JLPTProgressData | null>(null);
	let loading = $state(true);
	let error = $state('');

	const subjectsByCharacter = $derived.by(() => {
		const subjects = new Map<string, WKSubject>();
		for (const subject of progress?.subjects ?? []) {
			if (subject.data.characters) subjects.set(subject.data.characters, subject);
		}
		return subjects;
	});

	const assignmentsBySubjectId = $derived.by(() => {
		const assignments = new Map<number, WKAssignment>();
		for (const assignment of progress?.assignments ?? []) {
			if (assignment.data.subject_type === 'kanji') {
				assignments.set(assignment.data.subject_id, assignment);
			}
		}
		return assignments;
	});

	const levelCounts = $derived.by(() =>
		levels.map((level) => {
			const characters = Array.from(jlptKanji[level]);
			const learned = characters.filter((character) => {
				const subject = subjectsByCharacter.get(character);
				const assignment = subject ? assignmentsBySubjectId.get(subject.id) : undefined;
				return assignment && assignment.data.srs_stage >= 5;
			}).length;
			return { level, learned, total: characters.length };
		})
	);

	const kanjiRows = $derived.by((): KanjiRow[] =>
		Array.from(jlptKanji[selectedLevel]).map((character) => {
			const subject = subjectsByCharacter.get(character);
			const assignment = subject ? assignmentsBySubjectId.get(subject.id) : undefined;
			const meaning = subject?.data.meanings.find((item) => item.primary)?.meaning ?? '';

			if (!subject) {
				return { character, meaning: '', status: 'Not available', statusClass: 'unavailable', srsStage: null };
			}
			if (!assignment) {
				return { character, meaning, status: 'Not started', statusClass: 'not-started', srsStage: null };
			}
			if (assignment.data.srs_stage >= 5) {
				return { character, meaning, status: 'Learned', statusClass: 'learned', srsStage: assignment.data.srs_stage };
			}
			return { character, meaning, status: 'In progress', statusClass: 'in-progress', srsStage: assignment.data.srs_stage };
		})
	);

	const visibleKanji = $derived.by(() => {
		const normalizedSearch = search.trim();
		return normalizedSearch
			? kanjiRows.filter((row) => row.character.includes(normalizedSearch))
			: kanjiRows;
	});
	const displayedKanji = $derived(expanded ? visibleKanji : visibleKanji.slice(0, 10));

	async function refreshProgress() {
		if (!$apiKey) {
			progress = null;
			error = 'Connect a WaniKani API key to see your kanji progress.';
			loading = false;
			return;
		}

		loading = true;
		error = '';
		try {
			progress = await getJLPTKanjiProgressData($apiKey);
		} catch (cause) {
			error = cause instanceof WaniKaniError ? cause.message : 'Could not load JLPT kanji progress.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void refreshProgress();
	});
</script>

<svelte:head>
	<title>Analytics | WK Flash</title>
	<meta name="description" content="Track your WaniKani kanji progress across JLPT levels." />
</svelte:head>

<div class="container analytics-page">
	<div class="page-heading">
		<h1>Analytics</h1>
		<button type="button" onclick={refreshProgress} disabled={loading || !$apiKey} aria-label="Refresh JLPT progress">
			Refresh
		</button>
	</div>

	{#if error}
		<p class="message" role="alert">
			{error}
			{#if !$apiKey}
				<a href="/settings">Connect WaniKani</a>
			{/if}
		</p>
	{/if}

	<section class="jlpt-section" aria-labelledby="jlpt-heading">
		<h2 id="jlpt-heading">JLPT Kanji</h2>
		<p class="method-note">
			Guru (SRS 5) or higher counts as learned. Characters without an accessible WaniKani subject are marked Not available.
		</p>

		<section class="level-tabs" role="tablist" aria-label="JLPT levels" aria-busy={loading}>
			{#each levelCounts as count (count.level)}
				<button
					type="button"
					role="tab"
					id={`tab-${count.level}`}
					aria-controls="kanji-panel"
					aria-selected={selectedLevel === count.level}
					class:active={selectedLevel === count.level}
					onclick={() => { selectedLevel = count.level; search = ''; expanded = false; }}
				>
					<span class="level-name">{count.level}</span>
					<span class="level-count">
						{loading ? '...' : progress ? `${count.learned} / ${count.total}` : `— / ${count.total}`}
					</span>
					<span class="progress-track" aria-hidden="true">
						<span style={`width: ${count.total ? (count.learned / count.total) * 100 : 0}%`}></span>
					</span>
				</button>
			{/each}
		</section>

		<section id="kanji-panel" class="kanji-panel" role="tabpanel" aria-labelledby={`tab-${selectedLevel}`}>
			<div class="list-heading">
				<div>
					<h2>{selectedLevel}</h2>
					<p>
						{#if progress}
							{levelCounts.find((count) => count.level === selectedLevel)?.learned ?? 0} of {Array.from(jlptKanji[selectedLevel]).length} learned
						{:else}
							{Array.from(jlptKanji[selectedLevel]).length} kanji
						{/if}
					</p>
				</div>
				<label class="search-label">
					<span class="visually-hidden">Search {selectedLevel} kanji</span>
					<input type="search" placeholder="Find kanji" bind:value={search} disabled={!progress} />
				</label>
			</div>

			{#if loading}
				<p class="empty-state" role="status">Loading kanji progress...</p>
			{:else if progress}
				{#if visibleKanji.length}
					<ul class="kanji-list">
						{#each displayedKanji as row (row.character)}
							<li>
								<span class="character" lang="ja">{row.character}</span>
								<span class="meaning">{row.meaning || ' '}</span>
								<span class={`status status--${row.statusClass}`}>{row.status}</span>
								<span class="stage">{row.srsStage === null ? '' : `SRS ${row.srsStage}`}</span>
							</li>
						{/each}
					</ul>
					{#if visibleKanji.length > 10}
						<button
							type="button"
							class="expand-button"
							aria-expanded={expanded}
							onclick={() => { expanded = !expanded; }}
						>
							{expanded ? 'Show less' : `Show ${visibleKanji.length - 10} more`}
						</button>
					{/if}
				{:else}
					<p class="empty-state">No kanji match “{search}”.</p>
				{/if}
			{:else}
				<p class="empty-state">Connect WaniKani to view progress.</p>
			{/if}
		</section>
	</section>
</div>

<style>
	.page-heading,
	.list-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.page-heading h1,
	.list-heading h2 {
		margin: 0;
	}

	.jlpt-section {
		margin-top: 1.5rem;
	}

	.jlpt-section > h2 {
		margin: 0;
		font-size: 1.2rem;
	}

	.summary-hint {
		color: var(--muted);
		font-size: 0.85rem;
		font-weight: 400;
	}

	.method-note {
		margin: 0.35rem 0 1.5rem;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.message {
		margin: 0 0 1rem;
		color: var(--bad);
	}

	.message a {
		margin-left: 0.5rem;
	}

	.level-tabs {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.level-tabs button {
		display: grid;
		min-width: 0;
		min-height: 96px;
		grid-template-rows: auto auto 4px;
		align-content: center;
		gap: 0.45rem;
		padding: 0.75rem;
		text-align: left;
	}

	.level-tabs button.active {
		border-color: var(--accent);
		background: var(--surface);
	}

	.level-name {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.level-count {
		color: var(--muted);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.progress-track,
	.progress-track span {
		display: block;
		height: 4px;
		border-radius: 2px;
	}

	.progress-track {
		overflow: hidden;
		background: var(--border);
	}

	.progress-track span {
		background: var(--good);
	}

	.kanji-panel {
		margin-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.list-heading {
		padding: 1rem 0;
	}

	.list-heading p {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.search-label input {
		width: min(12rem, 40vw);
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
	}

	.search-label input:focus {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.kanji-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.expand-button {
		margin-top: 1rem;
	}

	.kanji-list li {
		display: grid;
		grid-template-columns: 3.5rem minmax(0, 1fr) minmax(7.5rem, auto) 3.5rem;
		align-items: center;
		gap: 0.75rem;
		min-height: 56px;
		border-top: 1px solid var(--border);
	}

	.character {
		font-size: 1.75rem;
		line-height: 1;
	}

	.meaning {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.status {
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.status--learned {
		color: var(--good);
	}

	.status--in-progress {
		color: var(--accent-hover);
	}

	.status--not-started,
	.status--unavailable {
		color: var(--muted);
	}

	.stage {
		color: var(--muted);
		font-size: 0.75rem;
		text-align: right;
		white-space: nowrap;
	}

	.empty-state {
		padding: 1rem 0;
		color: var(--muted);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 560px) {
		.level-tabs {
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 0.3rem;
		}

		.level-tabs button {
			min-height: 84px;
			padding: 0.55rem 0.45rem;
		}

		.level-count {
			font-size: 0.7rem;
		}

		.kanji-list li {
			grid-template-columns: 2.75rem minmax(0, 1fr) auto;
			gap: 0.5rem;
		}

		.stage {
			display: none;
		}
	}

	@media (max-width: 380px) {
		.status {
			font-size: 0.7rem;
		}
	}
</style>