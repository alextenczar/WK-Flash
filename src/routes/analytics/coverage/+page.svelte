<script lang="ts">
	import { onMount } from 'svelte';
	import jlptKanji from '$lib/data/jlpt-kanji.json';
	import { apiKey } from '$lib/storage';
	import { getJLPTProgressData, WaniKaniError } from '$lib/wanikani/api';
	import type { WKSubject } from '$lib/wanikani/types';

	type JLPTLevel = keyof typeof jlptKanji;
	type CoverageRow = { level: number; percentages: Record<JLPTLevel, number> };

	const jlptLevels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
	const jlptCharacters = new Map(jlptLevels.map((level) => [level, new Set(Array.from(jlptKanji[level]))]));
	let subjects = $state<WKSubject[]>([]);
	let maxLevel = $state(60);
	let currentLevel = $state<number | null>(null);
	let loading = $state(true);
	let error = $state('');

	const subjectByCharacter = $derived.by(() => {
		const byCharacter = new Map<string, WKSubject>();
		for (const subject of subjects) {
			if (subject.object === 'kanji' && subject.data.characters) byCharacter.set(subject.data.characters, subject);
		}
		return byCharacter;
	});
	const rows = $derived.by((): CoverageRow[] => {
		const counts = Object.fromEntries(jlptLevels.map((level) => [level, 0])) as Record<JLPTLevel, number>;
		const subjectsByLevel = new Map<number, WKSubject[]>();
		for (const subject of subjects) {
			if (subject.object !== 'kanji' || !subject.data.characters) continue;
			const group = subjectsByLevel.get(subject.data.level) ?? [];
			group.push(subject);
			subjectsByLevel.set(subject.data.level, group);
		}

		const result: CoverageRow[] = [];
		for (let level = 1; level <= maxLevel; level += 1) {
			for (const subject of subjectsByLevel.get(level) ?? []) {
				for (const jlptLevel of jlptLevels) {
					if (jlptCharacters.get(jlptLevel)!.has(subject.data.characters!)) counts[jlptLevel] += 1;
				}
			}
			result.push({
				level,
				percentages: Object.fromEntries(
					jlptLevels.map((jlptLevel) => [
						jlptLevel,
						(counts[jlptLevel] / jlptCharacters.get(jlptLevel)!.size) * 100
					])
				) as Record<JLPTLevel, number>
			});
		}
		return result;
	});
	const missingKanjiByLevel = $derived.by(() =>
		jlptLevels.map((level) => ({
			level,
			total: jlptCharacters.get(level)!.size,
			characters: Array.from(jlptCharacters.get(level)!).filter((character) => !subjectByCharacter.has(character))
		}))
	);

	function formatPercentage(value: number): string {
		return `${value.toFixed(2)}%`;
	}

	onMount(() => {
		if (!$apiKey) {
			error = 'Connect a WaniKani API key to view JLPT coverage.';
			loading = false;
			return;
		}
		void (async () => {
			try {
				const data = await getJLPTProgressData($apiKey, { includeForecastData: false });
				subjects = data.kanji.subjects;
				maxLevel = data.maxSubjectLevel;
				currentLevel = data.currentLevel;
			} catch (cause) {
				error = cause instanceof WaniKaniError ? cause.message : 'Could not load JLPT coverage.';
			} finally {
				loading = false;
			}
		})();
	});
</script>

<svelte:head>
	<title>JLPT Coverage · WK Flash</title>
	<meta name="description" content="See how JLPT kanji are distributed across WaniKani levels." />
</svelte:head>

<div class="container coverage-page">
	<a class="back-link" href="/analytics">← Back to analytics</a>
	<header class="page-heading">
		<h1>JLPT coverage by WaniKani level</h1>
		<p>Each value is the cumulative share of a JLPT kanji set introduced by that WaniKani level.</p>
	</header>

	{#if loading}
		<p class="message">Loading WaniKani curriculum coverage…</p>
	{:else if error}
		<p class="message error" role="alert">{error}</p>
	{:else}
		<p class="method-note">
			This shows curriculum coverage, not your personal SRS progress. It is limited to the WaniKani levels available to your account.
		</p>
		<div class="coverage-scroll" role="region" aria-label="JLPT coverage table">
			<table>
				<thead>
					<tr>
						<th scope="col">WaniKani level</th>
						{#each jlptLevels as level}
							<th scope="col">{level}<small>/{jlptCharacters.get(level)!.size}</small></th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.level)}
						<tr class:current-level={row.level === currentLevel}>
							<th scope="row">{row.level}</th>
							{#each jlptLevels as level}
								<td aria-label={`Level ${row.level}, ${level}: ${formatPercentage(row.percentages[level])}`}>
									{formatPercentage(row.percentages[level])}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<section class="missing-kanji" aria-labelledby="missing-kanji-heading">
			<h2 id="missing-kanji-heading">Kanji not on WaniKani</h2>
			{#each missingKanjiByLevel as group (group.level)}
				{#if group.characters.length}
					<section>
						<h3>{group.level}</h3>
						<p class="missing-count">{group.characters.length}/{group.total}</p>
						<p class="missing-characters" lang="ja">
							{#each group.characters as character}
								<a href={`https://jisho.org/search/${encodeURIComponent(`${character} #kanji`)}`} target="_blank" rel="noreferrer">{character}</a>
							{/each}
						</p>
					</section>
				{/if}
			{/each}
		</section>
	{/if}
</div>

<style>
	.coverage-page { max-width: 1100px; }
	.back-link { display: inline-block; margin-bottom: 1rem; }
	.page-heading h1 { margin: 0; }
	.page-heading p, .method-note, .message { color: var(--muted); }
	.page-heading p { margin: .35rem 0 0; }
	.method-note { margin: 1.5rem 0 1rem; font-size: .9rem; }
	.error { color: var(--bad); }
	.coverage-scroll { border: 1px solid var(--border); border-radius: 8px; }
	table { width: 100%; min-width: 540px; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: .85rem; }
	th, td { padding: .45rem .6rem; border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap; }
	thead th { position: sticky; top: 0; z-index: 1; background: var(--surface); color: var(--muted); font-size: .75rem; box-shadow: 0 1px 0 var(--border); }
	thead th:first-child, tbody th { text-align: left; }
	th small { display: block; margin-top: .1rem; color: var(--muted); font-size: .7rem; font-weight: 400; }
	tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
	tbody tr.current-level th, tbody tr.current-level td { background: rgb(59 130 246 / 16%); color: var(--text); font-weight: 700; }
	.missing-kanji { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
	.missing-kanji h2 { margin: 0; font-size: 1.1rem; }
	.missing-kanji section { margin-top: 1.25rem; }
	.missing-kanji h3, .missing-count { display: inline; margin: 0; }
	.missing-count { margin-left: .5rem; color: var(--muted); font-size: .9rem; }
	.missing-characters { display: flex; flex-wrap: wrap; gap: .35rem; margin: .5rem 0 0; }
	.missing-characters a { display: grid; place-items: center; width: 2.15rem; aspect-ratio: 1; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--text); text-decoration: none; }
	.missing-characters a:hover, .missing-characters a:focus-visible { border-color: var(--accent); color: var(--accent); background: transparent; text-decoration: none; }
	@media (max-width: 560px) {
		.coverage-scroll { overflow-x: auto; }
	}
</style>
