<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import jlptKanji from '$lib/data/jlpt-kanji.json';
	import jlptVocabulary from '$lib/data/jlpt-vocabulary.json';
	import { apiKey } from '$lib/storage';
	import { getJLPTProgressData, WaniKaniError } from '$lib/wanikani/api';
	import type { WKAssignment, WKSubject } from '$lib/wanikani/types';

	type JLPTLevel = keyof typeof jlptKanji;
	type ResultType = 'kanji' | 'vocabulary';
	type JLPTProgressData = { subjects: WKSubject[]; assignments: WKAssignment[] };
	type VocabularyEntry = { expression: string; reading: string; meaning: string; levels: JLPTLevel[] };
	type ResultRow = {
		key: string;
		expression: string;
		reading: string;
		meaning: string;
		levels: JLPTLevel[];
		wanikaniLevel: number | null;
		status: 'Learned' | 'In progress' | 'Not started' | 'Not available';
		statusClass: 'learned' | 'in-progress' | 'not-started' | 'unavailable';
		detail: string;
	};

	const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
	const kanjiLevelsByCharacter = new Map<string, JLPTLevel[]>();
	for (const level of levels) {
		for (const character of Array.from(jlptKanji[level])) {
			const memberships = kanjiLevelsByCharacter.get(character) ?? [];
			memberships.push(level);
			kanjiLevelsByCharacter.set(character, memberships);
		}
	}
	const resultType: ResultType = page.url.searchParams.get('type') === 'vocabulary' ? 'vocabulary' : 'kanji';
	const requestedLevel = page.url.searchParams.get('level') as JLPTLevel | null;
	const selectedLevel: JLPTLevel = requestedLevel && levels.includes(requestedLevel) ? requestedLevel : 'N5';
	const isAllLevels = $derived(Boolean(page.url.searchParams.get('q')?.trim()) || page.url.searchParams.get('scope') === 'all');
	let search = $state(page.url.searchParams.get('q') ?? '');
	let progress = $state<{ kanji: JLPTProgressData; vocabulary: JLPTProgressData } | null>(null);
	let loading = $state(true);
	let error = $state('');

	const subjectsByCharacter = $derived.by(() => {
		const subjects = new Map<string, WKSubject>();
		for (const subject of progress?.kanji.subjects ?? []) {
			if (subject.data.characters) subjects.set(subject.data.characters, subject);
		}
		return subjects;
	});
	const kanjiAssignments = $derived.by(() =>
		new Map((progress?.kanji.assignments ?? []).map((assignment) => [assignment.data.subject_id, assignment]))
	);
	const vocabularySubjectsByKey = $derived.by(() => {
		const subjects = new Map<string, WKSubject[]>();
		for (const subject of progress?.vocabulary.subjects ?? []) {
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
	const vocabularyAssignments = $derived.by(() =>
		new Map((progress?.vocabulary.assignments ?? []).map((assignment) => [assignment.data.subject_id, assignment]))
	);

	function vocabularyMatchKeys(entry: VocabularyEntry): string[] {
		const expressions = entry.expression.split('、').map((value) => value.normalize('NFKC'));
		const readings = entry.reading.split('、').map((value) => value.normalize('NFKC'));
		if (expressions.length > 1 && expressions.length === readings.length) {
			return expressions.map((expression, index) => `${expression}\t${readings[index]}`);
		}
		return expressions.flatMap((expression) => readings.map((reading) => `${expression}\t${reading}`));
	}

	function vocabularySubjects(entry: VocabularyEntry): WKSubject[] {
		const matches = new Map<number, WKSubject>();
		for (const key of vocabularyMatchKeys(entry)) {
			for (const subject of vocabularySubjectsByKey.get(key) ?? []) matches.set(subject.id, subject);
		}
		return [...matches.values()];
	}

	const allRows = $derived.by((): ResultRow[] => {
		if (resultType === 'kanji') {
			return [...kanjiLevelsByCharacter.keys()]
				.filter((character) => isAllLevels || kanjiLevelsByCharacter.get(character)?.includes(selectedLevel))
				.map((character) => {
				const subject = subjectsByCharacter.get(character);
				const assignment = subject ? kanjiAssignments.get(subject.id) : undefined;
				const stage = assignment?.data.srs_stage;
				const learned = stage !== undefined && stage >= 5;
				const inProgress = stage !== undefined && stage > 0 && !learned;
				return {
					key: character,
					expression: character,
					reading: '',
					meaning: subject?.data.meanings.find((item) => item.primary)?.meaning ?? '',
					levels: kanjiLevelsByCharacter.get(character) ?? [],
					wanikaniLevel: subject?.data.level ?? null,
					status: learned ? 'Learned' : inProgress ? 'In progress' : subject ? 'Not started' : 'Not available',
					statusClass: learned ? 'learned' : inProgress ? 'in-progress' : subject ? 'not-started' : 'unavailable',
					detail: stage === undefined ? '' : `SRS ${stage}`
				};
				});
		}

		return (jlptVocabulary.entries as VocabularyEntry[])
			.filter((entry) => isAllLevels || entry.levels.includes(selectedLevel))
			.map((entry) => {
				const matches = vocabularySubjects(entry);
				const assignments = matches
					.map((subject) => vocabularyAssignments.get(subject.id))
					.filter((assignment): assignment is WKAssignment => assignment !== undefined)
					.sort((first, second) => second.data.srs_stage - first.data.srs_stage);
				const assignment = assignments[0];
				const subject = assignment
					? matches.find((item) => item.id === assignment.data.subject_id)
					: matches[0];
				const stage = assignment?.data.srs_stage;
				const learned = stage !== undefined && stage >= 5;
				const inProgress = stage !== undefined && stage > 0 && !learned;
				return {
					key: `${entry.expression}-${entry.reading}`,
					expression: entry.expression,
					reading: entry.reading,
					meaning: entry.meaning,
					levels: entry.levels,
					wanikaniLevel: subject?.data.level ?? null,
					status: learned ? 'Learned' : inProgress ? 'In progress' : subject ? 'Not started' : 'Not available',
					statusClass: learned ? 'learned' : inProgress ? 'in-progress' : subject ? 'not-started' : 'unavailable',
					detail: stage === undefined ? '' : `SRS ${stage}`
				};
			});
	});
	const visibleRows = $derived.by(() => {
		const normalizedSearch = search.trim().normalize('NFKC').toLocaleLowerCase();
		if (!normalizedSearch) return allRows;
		return allRows.filter((row) =>
			[row.expression, row.reading, row.meaning].some((value) =>
				value.normalize('NFKC').toLocaleLowerCase().includes(normalizedSearch)
			)
		);
	});

	function updateSearch(value: string) {
		search = value;
		const url = new URL(page.url);
		if (value) url.searchParams.set('q', value);
		else url.searchParams.delete('q');
		if (value.trim()) url.searchParams.set('scope', 'all');
		void goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function refreshProgress() {
		if (!$apiKey) {
			progress = null;
			error = 'Connect a WaniKani API key to see your JLPT progress.';
			loading = false;
			return;
		}
		loading = true;
		error = '';
		try {
			progress = await getJLPTProgressData($apiKey, { includeForecastData: false });
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
	<title>{isAllLevels ? `${resultType === 'kanji' ? 'Kanji' : 'Vocabulary'} · All JLPT Levels` : `JLPT ${selectedLevel} ${resultType === 'kanji' ? 'Kanji' : 'Vocabulary'}`} | WK Flash</title>
	<meta name="description" content={isAllLevels ? `${resultType} progress results across all JLPT levels.` : `JLPT ${selectedLevel} ${resultType} progress results.`} />
</svelte:head>

<div class="container analytics-page results-page">
	<div class="page-heading">
		<div>
			<a href="/analytics" class="back-link">Back to Analytics</a>
			<h1>{isAllLevels ? `${resultType === 'kanji' ? 'Kanji' : 'Vocabulary'} · All JLPT Levels` : `JLPT ${selectedLevel} ${resultType === 'kanji' ? 'Kanji' : 'Vocabulary'}`}</h1>
		</div>
		<button type="button" onclick={refreshProgress} disabled={loading || !$apiKey} aria-label="Refresh JLPT results">Refresh</button>
	</div>

	<label class="search-label results-search">
		<span class="visually-hidden">Search {resultType} across all JLPT levels</span>
		<input
			type="search"
			placeholder={resultType === 'kanji' ? 'Find kanji' : 'Find vocabulary'}
			value={search}
			oninput={(event) => updateSearch(event.currentTarget.value)}
			disabled={!progress}
		/>
	</label>

	<p class="result-count">
		{#if isAllLevels}
			{visibleRows.length} of {allRows.length} results across all JLPT levels
		{:else}
			{visibleRows.length} of {allRows.length} JLPT {selectedLevel} results
		{/if}
	</p>

	{#if error}
		<p class="message" role="alert">
			{error}
			{#if !$apiKey}<a href="/settings">Connect WaniKani</a>{/if}
		</p>
	{:else if loading}
		<p class="empty-state" role="status">Loading JLPT progress...</p>
	{:else if visibleRows.length}
		<div class="list-scroll" role="region" aria-label="Scrollable JLPT progress results">
		<ul class="results-list" class:vocabulary-list={resultType === 'vocabulary'}>
			<li class="column-headings" aria-hidden="true">
				<span>Item</span><span>JLPT</span><span>WK level</span><span>Meaning</span><span>Status</span><span>SRS</span>
			</li>
			{#each visibleRows as row (row.key)}
				<li>
					<span class:character={resultType === 'kanji'} class:vocabulary-expression={resultType === 'vocabulary'} lang="ja">
						{row.expression}
						{#if row.reading}<small>{row.reading}</small>{/if}
					</span>
					<span class="jlpt-level">{row.levels.join(', ')}</span>
					<span class="wk-level">{row.wanikaniLevel === null ? '—' : row.wanikaniLevel}</span>
					<span class="meaning">{row.meaning || ' '}</span>
					<span class={`status status--${row.statusClass}`}>{row.status}</span>
					<span class="stage">{row.detail}</span>
				</li>
			{/each}
		</ul>
		</div>
	{:else}
		<p class="empty-state">No results match “{search}”.</p>
	{/if}
</div>

<style>
	.page-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.page-heading h1 {
		margin: 0.25rem 0 0;
	}

	.back-link {
		font-size: 0.875rem;
	}

	.results-search {
		display: block;
		margin-top: 1.5rem;
	}

	.results-search input {
		width: min(24rem, 100%);
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
	}

	.results-search input:focus {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.result-count {
		margin: 0.75rem 0;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.list-scroll {
		max-width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.results-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.results-list li {
		display: grid;
		grid-template-columns: 3.5rem 5rem 4rem minmax(0, 1fr) minmax(7.5rem, auto) 3.5rem;
		align-items: center;
		gap: 0.75rem;
		min-height: 56px;
		border-top: 1px solid var(--border);
	}

	.results-list.vocabulary-list li {
		grid-template-columns: minmax(8rem, 12rem) 5rem 4rem minmax(0, 1fr) minmax(7.5rem, auto) 3.5rem;
	}

	.results-list li.column-headings {
		min-height: 36px;
		color: var(--muted);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.character {
		display: grid;
		gap: 0.15rem;
		font-size: 1.75rem;
		line-height: 1;
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

	.jlpt-level {
		color: var(--muted);
		font-size: 0.8rem;
		line-height: 1.2;
	}

	.wk-level {
		color: var(--muted);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.meaning {
		color: var(--muted);
		font-size: 0.9rem;
	}

	.status {
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.status--learned { color: var(--good); }
	.status--in-progress { color: var(--accent-hover); }
	.status--not-started,
	.status--unavailable { color: var(--muted); }

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

	.message {
		margin: 0 0 1rem;
		color: var(--bad);
	}

	.message a {
		margin-left: 0.5rem;
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
		.results-list {
			min-width: 680px;
		}

		.vocabulary-expression {
			font-size: 1rem;
		}
	}
</style>