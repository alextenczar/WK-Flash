<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import type { PageData } from './$types';
	import type { LayoutData } from '../$types';

	let { data }: { data: PageData & LayoutData } = $props();
	const level = $derived(data.level);
	const kanjiWithPages = $derived(data.kanji.filter((kanji) => kanji.hasPage).length);
	const description = $derived(
		`All ${data.kanji.length} JLPT ${level} kanji with meanings, on'yomi, kun'yomi, and WaniKani levels.`
	);
</script>

<Seo title={`JLPT ${level} kanji · WK Flash`} {description} />

<header class="page-heading">
	<h1>JLPT {level} kanji</h1>
	<p>{description}</p>
</header>

<section class="content" aria-label="Kanji list">
	<p class="note">Kanji with a link have a detail page. {kanjiWithPages} of {data.kanji.length} are listed with meanings.</p>
	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					<th scope="col">Kanji</th>
					<th scope="col">Meaning</th>
					<th scope="col">On'yomi</th>
					<th scope="col">Kun'yomi</th>
					<th scope="col">WaniKani level</th>
				</tr>
			</thead>
			<tbody>
				{#each data.kanji as kanji (kanji.character)}
					<tr>
						<td class="glyph" lang="ja">
							{#if kanji.hasPage}
								<a href={`/jlpt/kanji/${encodeURIComponent(kanji.character)}`}>{kanji.character}</a>
							{:else}
								{kanji.character}
							{/if}
						</td>
						<td>{kanji.meaning ?? '—'}</td>
						<td lang="ja">{kanji.onyomi ?? '—'}</td>
						<td lang="ja">{kanji.kunyomi ?? '—'}</td>
						<td>{kanji.wkLevel ? `Level ${kanji.wkLevel}` : 'Not on WaniKani'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
