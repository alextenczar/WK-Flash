<script lang="ts">
	import { onMount } from 'svelte';
	import jlptKanji from '$lib/data/jlpt-kanji.json';
	import jlptVocabulary from '$lib/data/jlpt-vocabulary.json';
	import { apiKey } from '$lib/storage';
	import { getJLPTProgressData, WaniKaniError } from '$lib/wanikani/api';
	import type { WKAssignment, WKSubject } from '$lib/wanikani/types';

	type JLPTLevel = keyof typeof jlptKanji;
	type JLPTProgressData = { subjects: WKSubject[]; assignments: WKAssignment[] };
	type VocabularyEntry = { expression: string; reading: string; meaning: string; levels: JLPTLevel[] };
	type VocabularyRow = {
		entry: VocabularyEntry;
		status: 'Learned' | 'In progress' | 'Not started' | 'Not available';
		statusClass: 'learned' | 'in-progress' | 'not-started' | 'unavailable';
		srsStage: number | null;
		subjectLevel: number | null;
	};
	type KanjiRow = {
		character: string;
		meaning: string;
		subjectLevel: number | null;
		status: 'Learned' | 'In progress' | 'Not started' | 'Not available';
		statusClass: 'learned' | 'in-progress' | 'not-started' | 'unavailable';
		srsStage: number | null;
	};

	function vocabularyMatchKeys(entry: VocabularyEntry): string[] {
		const expressions = entry.expression.split('、').map((value) => value.normalize('NFKC'));
		const readings = entry.reading.split('、').map((value) => value.normalize('NFKC'));
		if (expressions.length > 1 && expressions.length === readings.length) {
			return expressions.map((expression, index) => `${expression}\t${readings[index]}`);
		}
		return expressions.flatMap((expression) => readings.map((reading) => `${expression}\t${reading}`));
	}

	function matchingVocabularySubjects(
		entry: VocabularyEntry,
		subjectsByKey: Map<string, WKSubject[]>
	): WKSubject[] {
		const subjects = new Map<number, WKSubject>();
		for (const key of vocabularyMatchKeys(entry)) {
			for (const subject of subjectsByKey.get(key) ?? []) subjects.set(subject.id, subject);
		}
		return [...subjects.values()];
	}

	const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
	let selectedLevel = $state<JLPTLevel>('N5');
	let selectedVocabularyLevel = $state<JLPTLevel>('N5');
	let search = $state('');
	let vocabularySearch = $state('');
	let progress = $state<JLPTProgressData | null>(null);
	let vocabularyProgress = $state<JLPTProgressData | null>(null);
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
	const vocabularyEntries = jlptVocabulary.entries as VocabularyEntry[];
	const subjectsByHeadwordReading = $derived.by(() => {
		const subjects = new Map<string, WKSubject[]>();
		for (const subject of vocabularyProgress?.subjects ?? []) {
			if (subject.object !== 'vocabulary' && subject.object !== 'kana_vocabulary') continue;
			const expression = subject.data.characters?.normalize('NFKC');
			if (!expression) continue;
			for (const reading of new Set((subject.data.readings ?? []).map((item) => item.reading.normalize('NFKC')))) {
				const key = `${expression}\t${reading}`;
				const matches = subjects.get(key) ?? [];
				matches.push(subject);
				subjects.set(key, matches);
			}
		}
		return subjects;
	});
	const vocabularyAssignmentsBySubjectId = $derived.by(() =>
		new Map((vocabularyProgress?.assignments ?? []).map((assignment) => [assignment.data.subject_id, assignment]))
	);
	const levelCounts = $derived.by(() =>
		levels.map((level) => {
			const characters = Array.from(jlptKanji[level]);
			const unavailable = characters.filter((character) => !subjectsByCharacter.has(character)).length;
			const learned = characters.filter((character) => {
				const subject = subjectsByCharacter.get(character);
				const assignment = subject ? assignmentsBySubjectId.get(subject.id) : undefined;
				return assignment && assignment.data.srs_stage >= 5;
			}).length;
			return { level, learned, total: characters.length, unavailable };
		})
	);
	const vocabularyLevelCounts = $derived.by(() =>
		levels.map((level) => {
			const entries = vocabularyEntries.filter((entry) => entry.levels.includes(level));
			let unavailable = 0;
			let learned = 0;
			for (const entry of entries) {
				const matches = matchingVocabularySubjects(entry, subjectsByHeadwordReading);
				if (matches.length === 0) unavailable++;
				else if (matches.some((subject) => (vocabularyAssignmentsBySubjectId.get(subject.id)?.data.srs_stage ?? 0) >= 5)) learned++;
			}
			return { level, learned, total: entries.length, unavailable };
		})
	);

	const kanjiRows = $derived.by((): KanjiRow[] =>
		Array.from(jlptKanji[selectedLevel]).map((character) => {
			const subject = subjectsByCharacter.get(character);
			const assignment = subject ? assignmentsBySubjectId.get(subject.id) : undefined;
			const meaning = subject?.data.meanings.find((item) => item.primary)?.meaning ?? '';

			if (!subject) {
				return { character, meaning: '', subjectLevel: null, status: 'Not available', statusClass: 'unavailable', srsStage: null };
			}
			if (!assignment) {
				return { character, meaning, subjectLevel: subject.data.level, status: 'Not started', statusClass: 'not-started', srsStage: null };
			}
			if (assignment.data.srs_stage >= 5) {
				return { character, meaning, subjectLevel: subject.data.level, status: 'Learned', statusClass: 'learned', srsStage: assignment.data.srs_stage };
			}
			return { character, meaning, subjectLevel: subject.data.level, status: 'In progress', statusClass: 'in-progress', srsStage: assignment.data.srs_stage };
		})
	);

	const visibleKanji = $derived.by(() => {
		const normalizedSearch = search.trim();
		return normalizedSearch
			? kanjiRows.filter((row) => row.character.includes(normalizedSearch))
			: kanjiRows;
	});
	const displayedKanji = $derived(visibleKanji.slice(0, 5));
	const vocabularyRows = $derived.by((): VocabularyRow[] =>
		vocabularyEntries.filter((entry) => entry.levels.includes(selectedVocabularyLevel)).map((entry) => {
			const matches = matchingVocabularySubjects(entry, subjectsByHeadwordReading);
			const assignments = matches
				.map((subject) => vocabularyAssignmentsBySubjectId.get(subject.id))
				.filter((assignment): assignment is WKAssignment => assignment !== undefined)
				.sort((first, second) => second.data.srs_stage - first.data.srs_stage);
			const assignment = assignments[0];
			const subject = assignment
				? matches.find((item) => item.id === assignment.data.subject_id)
				: matches[0];
			const stage = assignment?.data.srs_stage ?? null;
			const learned = stage !== null && stage >= 5;
			const inProgress = stage !== null && stage > 0 && !learned;
			return {
				entry,
				status: learned ? 'Learned' : inProgress ? 'In progress' : subject ? 'Not started' : 'Not available',
				statusClass: learned ? 'learned' : inProgress ? 'in-progress' : subject ? 'not-started' : 'unavailable',
				srsStage: stage,
				subjectLevel: subject?.data.level ?? null
			};
		})
	);
	const visibleVocabulary = $derived.by(() => {
		const normalizedSearch = vocabularySearch.trim().normalize('NFKC').toLocaleLowerCase();
		return normalizedSearch
			? vocabularyRows.filter(({ entry }) =>
				[entry.expression, entry.reading, entry.meaning].some((value) =>
					value.normalize('NFKC').toLocaleLowerCase().includes(normalizedSearch)
				)
			)
			: vocabularyRows;
	});
	const displayedVocabulary = $derived(visibleVocabulary.slice(0, 5));

	function resultsHref(type: 'kanji' | 'vocabulary', level: JLPTLevel, query: string): string {
		const params = new URLSearchParams({ type, level });
		if (query.trim()) {
			params.set('q', query);
			params.set('scope', 'all');
		}
		return `/analytics/results?${params}`;
	}

	async function refreshProgress() {
		if (!$apiKey) {
			progress = null;
			vocabularyProgress = null;
			error = 'Connect a WaniKani API key to see your JLPT progress.';
			loading = false;
			return;
		}

		loading = true;
		error = '';
		try {
			const data = await getJLPTProgressData($apiKey);
			progress = data.kanji;
			vocabularyProgress = data.vocabulary;
		} catch (cause) {
			error = cause instanceof WaniKaniError ? cause.message : 'Could not load JLPT progress.';
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
	<meta name="description" content="Track your WaniKani kanji and vocabulary progress across JLPT levels." />
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
			Guru (SRS 5) or higher counts as learned. The yellow marker shows the share of JLPT items available on WaniKani.
		</p>

		<div class="level-tabs" role="tablist" aria-label="JLPT levels" aria-busy={loading}>
			{#each levelCounts as count (count.level)}
				<button
					type="button"
					role="tab"
					id={`tab-${count.level}`}
					aria-controls="kanji-panel"
					aria-selected={selectedLevel === count.level}
					class:active={selectedLevel === count.level}
					onclick={() => { selectedLevel = count.level; search = ''; }}
				>
					<span class="level-name">{count.level}</span>
					<span class="level-count">
						{loading ? '...' : progress ? `${count.learned} / ${count.total}` : `— / ${count.total}`}
					</span>
					<span class="progress-track" aria-hidden="true">
						<span class="progress-fill" style={`width: ${count.total ? (count.learned / count.total) * 100 : 0}%`}></span>
						{#if progress && count.total > count.unavailable}
							<span
								class="progress-marker"
								style={`left: ${((count.total - count.unavailable) / count.total) * 100}%`}
							></span>
						{/if}
					</span>
				</button>
			{/each}
		</div>

		<div id="kanji-panel" class="kanji-panel" role="tabpanel" aria-labelledby={`tab-${selectedLevel}`}>
			<div class="list-heading">
				<div>
					<h2>{selectedLevel}</h2>
					<p>
						{#if progress}
							{levelCounts.find((count) => count.level === selectedLevel)?.learned ?? 0} of {Array.from(jlptKanji[selectedLevel]).length} learned · {levelCounts.find((count) => count.level === selectedLevel)?.unavailable ?? 0} unavailable in WaniKani
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
						<li class="column-headings kanji-columns" aria-hidden="true">
							<span>Item</span><span>Meaning</span><span>WK level</span><span>Status</span><span>SRS</span>
						</li>
						{#each displayedKanji as row (row.character)}
							<li>
								<span class="character" lang="ja">{row.character}</span>
								<span class="meaning">{row.meaning || ' '}</span>
								<span class="wk-level">{row.subjectLevel === null ? '—' : `L${row.subjectLevel}`}</span>
								<span class={`status status--${row.statusClass}`}>{row.status}</span>
								<span class="stage">{row.srsStage === null ? '' : `SRS ${row.srsStage}`}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty-state">No kanji match “{search}”.</p>
				{/if}
				{#if visibleKanji.length > 5 || search.trim()}
					<a class="expand-button results-link" href={resultsHref('kanji', selectedLevel, search)}>
						{search.trim() ? 'Search all levels' : `View all ${selectedLevel} results`}
					</a>
				{/if}
			{:else}
				<p class="empty-state">Connect WaniKani to view progress.</p>
			{/if}
		</div>
	</section>

	<section class="jlpt-section" aria-labelledby="jlpt-vocabulary-heading">
		<h2 id="jlpt-vocabulary-heading">JLPT Vocabulary</h2>
		<p class="method-note">
			Guru (SRS 5) or higher counts as learned. The yellow marker shows the share of JLPT items available on WaniKani.
		</p>

		<div class="level-tabs" role="tablist" aria-label="JLPT vocabulary levels" aria-busy={loading}>
			{#each vocabularyLevelCounts as count (count.level)}
				<button
					type="button"
					role="tab"
					id={`vocabulary-tab-${count.level}`}
					aria-controls="vocabulary-panel"
					aria-selected={selectedVocabularyLevel === count.level}
					class:active={selectedVocabularyLevel === count.level}
					onclick={() => { selectedVocabularyLevel = count.level; vocabularySearch = ''; }}
				>
					<span class="level-name">{count.level}</span>
					<span class="level-count">
						{loading ? '...' : vocabularyProgress ? `${count.learned} / ${count.total}` : `— / ${count.total}`}
					</span>
					<span class="progress-track" aria-hidden="true">
						<span class="progress-fill" style={`width: ${count.total ? (count.learned / count.total) * 100 : 0}%`}></span>
						{#if vocabularyProgress && count.total > count.unavailable}
							<span
								class="progress-marker"
								style={`left: ${((count.total - count.unavailable) / count.total) * 100}%`}
							></span>
						{/if}
					</span>
				</button>
			{/each}
		</div>

		<div id="vocabulary-panel" class="kanji-panel" role="tabpanel" aria-labelledby={`vocabulary-tab-${selectedVocabularyLevel}`}>
			<div class="list-heading">
				<div>
					<h2>{selectedVocabularyLevel}</h2>
					<p>
						{#if vocabularyProgress}
							{vocabularyLevelCounts.find((count) => count.level === selectedVocabularyLevel)?.learned ?? 0} of {vocabularyLevelCounts.find((count) => count.level === selectedVocabularyLevel)?.total ?? 0} learned · {vocabularyLevelCounts.find((count) => count.level === selectedVocabularyLevel)?.unavailable ?? 0} unavailable in WaniKani
						{:else}
							{vocabularyLevelCounts.find((count) => count.level === selectedVocabularyLevel)?.total ?? 0} vocabulary items
						{/if}
					</p>
				</div>
				<label class="search-label">
					<span class="visually-hidden">Search {selectedVocabularyLevel} vocabulary</span>
					<input type="search" placeholder="Find vocabulary" bind:value={vocabularySearch} disabled={!vocabularyProgress} />
				</label>
			</div>

			{#if loading}
				<p class="empty-state" role="status">Loading vocabulary progress...</p>
			{:else if vocabularyProgress}
				{#if visibleVocabulary.length}
					<ul class="kanji-list">
						<li class="column-headings vocabulary-columns" aria-hidden="true">
							<span>Item</span><span>Meaning</span><span>WK level</span><span>Status</span><span>SRS</span>
						</li>
						{#each displayedVocabulary as row (`${row.entry.expression}-${row.entry.reading}`)}
							<li>
								<span class="vocabulary-expression" lang="ja">{row.entry.expression}<small>{row.entry.reading}</small></span>
								<span class="meaning">{row.entry.meaning}</span>
								<span class="wk-level">{row.subjectLevel === null ? '—' : `L${row.subjectLevel}`}</span>
								<span class={`status status--${row.statusClass}`}>{row.status}</span>
								<span class="stage">{row.srsStage === null ? '' : `SRS ${row.srsStage}`}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty-state">No vocabulary matches “{vocabularySearch}”.</p>
				{/if}
				{#if visibleVocabulary.length > 5 || vocabularySearch.trim()}
					<a class="expand-button results-link" href={resultsHref('vocabulary', selectedVocabularyLevel, vocabularySearch)}>
						{vocabularySearch.trim() ? 'Search all levels' : `View all ${selectedVocabularyLevel} results`}
					</a>
				{/if}
			{:else}
				<p class="empty-state">Connect WaniKani to view progress.</p>
			{/if}
		</div>
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

	.progress-track {
		display: block;
		position: relative;
		height: 4px;
		border-radius: 2px;
		background: var(--border);
	}

	.progress-fill {
		position: absolute;
		top: 0;
		left: 0;
		height: 4px;
		border-radius: 2px;
		background: var(--good);
	}

	.progress-marker {
		position: absolute;
		top: -3px;
		width: 2px;
		height: 10px;
		border-radius: 1px;
		background: #facc15;
		transform: translateX(-50%);
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

	.results-link {
		display: inline-block;
	}

	.kanji-list li {
		display: grid;
		grid-template-columns: 3.5rem minmax(0, 1fr) 4rem minmax(7.5rem, auto) 3.5rem;
		align-items: center;
		gap: 0.75rem;
		min-height: 56px;
		border-top: 1px solid var(--border);
	}

	.kanji-list li.vocabulary-columns {
		grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr) 4rem minmax(7.5rem, auto) 3.5rem;
	}

	.kanji-list li.column-headings {
		min-height: 36px;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.vocabulary-expression {
		display: grid;
		gap: 0.15rem;
		font-size: 1.2rem;
		line-height: 1.2;
	}

	.vocabulary-expression small {
		color: var(--muted);
		font-size: 0.72rem;
	}

	.character {
		font-size: 1.75rem;
		line-height: 1;
	}

	.meaning {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.wk-level {
		color: var(--muted);
		font-size: 0.8rem;
		white-space: nowrap;
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
			min-width: 0;
			min-height: 84px;
			grid-template-rows: auto auto 3px;
			padding: 0.55rem 0.45rem;
		}

		.level-count {
			font-size: 0.62rem;
		}

		.progress-track,
		.progress-fill {
			height: 3px;
		}

		.progress-marker {
			top: -2px;
			height: 8px;
		}

		.kanji-list li {
			grid-template-columns: 2.75rem minmax(0, 1fr) 3.5rem auto;
			gap: 0.5rem;
		}

		.kanji-list li.vocabulary-columns {
			grid-template-columns: minmax(4.5rem, 6rem) minmax(0, 1fr) 3.5rem auto;
		}

		.vocabulary-expression {
			font-size: 1rem;
		}

		.column-headings span:last-child {
			display: none;
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