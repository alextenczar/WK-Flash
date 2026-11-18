<script lang="ts">
	import { onMount } from 'svelte';
	import jlptKanji from '$lib/data/jlpt-kanji.json';
	import { buildLocalN1ReviewCards } from '$lib/local-n1-reviews';
	import { interweaveLocalN1Reviews } from '$lib/review-preferences';
	import { apiKey } from '$lib/storage';
	import { getJLPTProgressData, WaniKaniError } from '$lib/wanikani/api';
	import type { WKAssignment, WKSubject } from '$lib/wanikani/types';

	type JLPTLevel = keyof typeof jlptKanji;
	type HeatmapLevel = JLPTLevel | 'All';
	type SortMode = 'level' | 'srs';
	type HeatmapItem = {
		character: string;
		subject: WKSubject | null;
		assignment: WKAssignment | null;
		isLocal: boolean;
	};

	const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
	let selectedLevel = $state<HeatmapLevel>('All');
	let sortBy = $state<SortMode>('srs');
	let showLocalKanji = $state(false);
	let subjects = $state<WKSubject[]>([]);
	let assignments = $state<WKAssignment[]>([]);
	let loading = $state(true);
	let error = $state('');

	const subjectByCharacter = $derived.by(() => {
		const byCharacter = new Map<string, WKSubject>();
		for (const subject of subjects) {
			if (subject.object === 'kanji' && subject.data.characters) byCharacter.set(subject.data.characters, subject);
		}
		return byCharacter;
	});
	const assignmentBySubjectId = $derived.by(() =>
		new Map(assignments.filter((item) => item.data.subject_type === 'kanji').map((item) => [item.data.subject_id, item]))
	);
	const localKanjiByCharacter = $derived.by(() => {
		if (!$interweaveLocalN1Reviews) return new Map<string, WKSubject>();
		return new Map(
			buildLocalN1ReviewCards()
				.filter((card) => card.subject.object === 'kanji')
				.map((card) => [card.subject.data.characters!, card.subject])
		);
	});
	const items = $derived.by((): HeatmapItem[] => {
		const baseItems = selectedLevel === 'All'
			? subjects
				.filter((subject) => subject.object === 'kanji' && subject.data.characters)
				.sort((left, right) => left.data.level - right.data.level || left.id - right.id)
				.map((subject) => ({
					character: subject.data.characters!,
					subject,
					assignment: assignmentBySubjectId.get(subject.id) ?? null,
					isLocal: false
				}))
			: Array.from(jlptKanji[selectedLevel]).map((character) => {
				const subject = subjectByCharacter.get(character) ?? null;
				return {
					character,
					subject,
					assignment: subject ? assignmentBySubjectId.get(subject.id) ?? null : null,
					isLocal: false
				};
			});
		const unsorted = showLocalKanji && $interweaveLocalN1Reviews
			? selectedLevel === 'All'
				? [
					...baseItems,
					...Array.from(localKanjiByCharacter)
						.filter(([character]) => !baseItems.some((item) => item.character === character))
						.map(([character, subject]) => ({
							character,
							subject,
							assignment: null,
							isLocal: true
						}))
				]
				: baseItems.map((item) => {
					const localSubject = !item.subject ? localKanjiByCharacter.get(item.character) : null;
					return localSubject
						? { ...item, subject: localSubject, isLocal: true }
						: item;
				})
			: baseItems;

		return [...unsorted].sort((left, right) => {
			if (sortBy === 'srs') {
				return (right.assignment?.data.srs_stage ?? -1) - (left.assignment?.data.srs_stage ?? -1)
					|| (left.subject?.data.level ?? Number.MAX_SAFE_INTEGER) - (right.subject?.data.level ?? Number.MAX_SAFE_INTEGER)
					|| left.character.localeCompare(right.character, 'ja');
			}
			return (left.subject?.data.level ?? Number.MAX_SAFE_INTEGER) - (right.subject?.data.level ?? Number.MAX_SAFE_INTEGER)
				|| (left.subject?.id ?? Number.MAX_SAFE_INTEGER) - (right.subject?.id ?? Number.MAX_SAFE_INTEGER)
				|| left.character.localeCompare(right.character, 'ja');
		});
	});
	const summary = $derived.by(() => ({
		available: items.filter((item) => item.subject && !item.isLocal).length,
		local: items.filter((item) => item.isLocal).length,
		started: items.filter((item) => (item.assignment?.data.srs_stage ?? 0) > 0).length,
		learned: items.filter((item) => (item.assignment?.data.srs_stage ?? 0) >= 5).length
	}));

	function itemClass(item: HeatmapItem): string {
		if (!item.subject) return 'unavailable';
		const stage = item.assignment?.data.srs_stage ?? 0;
		if (stage === 0) return 'not-started';
		if (stage >= 9) return 'burned';
		if (stage >= 5) return 'guru';
		if (stage >= 3) return 'apprentice-high';
		return 'apprentice-low';
	}

	onMount(() => {
		if (!$apiKey) {
			error = 'Connect a WaniKani API key to view the kanji heatmap.';
			loading = false;
			return;
		}
		void (async () => {
			try {
				const data = await getJLPTProgressData($apiKey, { includeForecastData: false });
				subjects = data.kanji.subjects;
				assignments = data.kanji.assignments;
			} catch (cause) {
				error = cause instanceof WaniKaniError ? cause.message : 'Could not load kanji progress.';
			} finally {
				loading = false;
			}
		})();
	});
</script>

<svelte:head>
	<title>Kanji Heatmap · WK Flash</title>
	<meta name="description" content="Explore JLPT kanji progress as an ordered heatmap." />
</svelte:head>

<div class="container heatmap-page">
	<a class="back-link" href="/analytics">← Back to analytics</a>
	<div class="page-heading">
		<div>
			<h1>Kanji heatmap</h1>
			<p>
				{selectedLevel === 'All'
					? 'All WaniKani kanji are ordered by level and WaniKani subject order.'
					: 'Kanji are ordered by JLPT list position.'}
				Select a tile to open its details.
			</p>
		</div>
	</div>

	<div class="level-tabs" role="tablist" aria-label="JLPT kanji levels">
		{#each [...levels, 'All'] as level}
			<button
				type="button"
				role="tab"
				aria-selected={selectedLevel === level}
				class:active={selectedLevel === level}
				onclick={() => (selectedLevel = level as HeatmapLevel)}
			>{level}</button>
		{/each}
	</div>
	<label class="sort-control" for="heatmap-sort">
		Sort by
		<select id="heatmap-sort" bind:value={sortBy}>
			<option value="level">WaniKani level</option>
			<option value="srs">SRS stage</option>
		</select>
	</label>
	{#if $interweaveLocalN1Reviews && (selectedLevel === 'All' || selectedLevel === 'N1')}
		<button class="local-kanji-toggle" type="button" aria-pressed={showLocalKanji} onclick={() => (showLocalKanji = !showLocalKanji)}>
			{showLocalKanji ? 'Hide local non-WaniKani N1 kanji' : 'Add local non-WaniKani N1 kanji'}
		</button>
	{/if}

	{#if loading}
		<p class="message">Loading kanji progress…</p>
	{:else if error}
		<p class="message error" role="alert">{error}</p>
	{:else}
		<div class="summary" aria-live="polite">
			<span><strong>{items.length}</strong> kanji</span>
			<span><strong>{summary.available}</strong> available</span>
			<span><strong>{summary.started}</strong> started</span>
			<span><strong>{summary.learned}</strong> Guru+</span>
			{#if summary.local}<span><strong>{summary.local}</strong> local N1</span>{/if}
		</div>
		<div class="legend" aria-label="Heatmap legend">
			<span><i class="unavailable"></i>Unavailable</span>
			<span><i class="not-started"></i>Not started</span>
			<span><i class="apprentice-low"></i>Apprentice</span>
			<span><i class="apprentice-high"></i>Apprentice III–IV</span>
			<span><i class="guru"></i>Guru+</span>
			<span><i class="burned"></i>Burned</span>
		</div>
		<div class="heatmap" aria-label={`${selectedLevel} kanji heatmap`}>
			{#each items as item (item.character)}
				{#if item.subject}
					<a
						class={`tile ${itemClass(item)} ${item.isLocal ? 'local' : ''}`}
						href={`/kanji/${encodeURIComponent(item.character)}?from=analytics`}
						title={`${item.character}: ${item.subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? item.subject.data.slug}`}
						aria-label={`${item.character}: ${item.subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? item.subject.data.slug}`}
					>{item.character}</a>
				{:else}
					<span class={`tile ${itemClass(item)}`} title={`${item.character}: unavailable in WaniKani`}>{item.character}</span>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.heatmap-page { max-width: 1100px; }
	.back-link { display: inline-block; margin-bottom: 1rem; }
	.page-heading h1 { margin: 0; }
	.page-heading p { margin: .35rem 0 0; color: var(--muted); }
	.level-tabs { display: flex; gap: .5rem; margin: 1.5rem 0; }
	.level-tabs button { min-width: 4rem; }
	.level-tabs button.active { border-color: var(--accent); background: var(--surface); }
	.sort-control { display: inline-flex; align-items: center; gap: .5rem; margin: 0 0 1.25rem; color: var(--muted); font-size: .9rem; }
	.sort-control select { padding: .45rem .6rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; }
	.local-kanji-toggle { margin: 0 0 1.25rem 0.75rem; font-size: .875rem; }
	.local-kanji-toggle[aria-pressed='true'] { border-color: var(--accent); background: var(--surface); }
	.message { color: var(--muted); }
	.error { color: var(--bad); }
	.summary { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; color: var(--muted); font-size: .9rem; }
	.summary strong { color: var(--text); }
	.legend { display: flex; flex-wrap: wrap; gap: .75rem 1rem; margin-bottom: 1.25rem; color: var(--muted); font-size: .8rem; }
	.legend span { display: inline-flex; align-items: center; gap: .35rem; }
	.legend i { width: .75rem; height: .75rem; border-radius: 2px; }
	.heatmap { display: grid; grid-template-columns: repeat(auto-fill, minmax(2.15rem, 1fr)); gap: .2rem; }
	.tile { display: grid; place-items: center; min-width: 0; aspect-ratio: 1; border: 1px solid transparent; border-radius: 3px; color: #fff; font-size: 1rem; line-height: 1; text-decoration: none; }
	a.tile:hover, a.tile:focus-visible { border-color: #fff; outline: 2px solid var(--accent); outline-offset: 1px; text-decoration: none; }
	.unavailable { background: #26262a; color: #71717a; }
	.not-started { background: #3f3f46; }
	.apprentice-low { background: #7c3aed; }
	.apprentice-high { background: #2563eb; }
	.guru { background: #d97706; }
	.burned { background: #22a06b; }
	.tile.local { border-style: dashed; border-color: rgb(255 255 255 / 65%); }
	@media (max-width: 520px) {
		.level-tabs { justify-content: space-between; gap: .35rem; }
		.level-tabs button { min-width: 0; flex: 1; padding-inline: .5rem; }
		.heatmap { grid-template-columns: repeat(auto-fill, minmax(1.85rem, 1fr)); gap: .15rem; }
		.local-kanji-toggle { display: block; margin-left: 0; }
	}
</style>
