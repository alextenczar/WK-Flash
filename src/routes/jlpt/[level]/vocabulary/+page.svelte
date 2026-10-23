<script lang="ts">
	import type { PageData } from './$types';
	import type { LayoutData } from '../$types';

	let { data }: { data: PageData & LayoutData } = $props();
	const level = $derived(data.level);
	const description = $derived(
		`All ${data.vocabulary.length} JLPT ${level} vocabulary words, with meanings and readings, ordered by WaniKani level.`
	);
</script>

<svelte:head>
	<title>JLPT {level} vocabulary · WK Flash</title>
	<meta name="description" content={description} />
</svelte:head>

<header class="page-heading">
	<h1>JLPT {level} vocabulary</h1>
	<p>{description}</p>
</header>

<section class="content" aria-label="Vocabulary list">
	<p class="note">
		Some words appear in more than one JLPT level. WaniKani levels are estimated from each word's kanji, so they may differ
		from WaniKani's own vocabulary levels.
	</p>
	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					<th scope="col">Word</th>
					<th scope="col">Reading</th>
					<th scope="col">Meaning</th>
					<th scope="col">Levels</th>
					<th scope="col">Estimated WaniKani level</th>
				</tr>
			</thead>
			<tbody>
				{#each data.vocabulary as word (word.expression + word.reading)}
					<tr>
						<td class="glyph" lang="ja">{word.expression}</td>
						<td lang="ja">{word.reading}</td>
						<td>{word.meaning}</td>
						<td>{word.levels.join(', ')}</td>
						<td>{word.wkLevel ? `Level ${word.wkLevel}` : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
