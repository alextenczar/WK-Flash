<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { levelSlug } from '$lib/jlpt-pages';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const detail = $derived(data.detail);
	const wkText = $derived(detail.wkLevel ? `WaniKani level ${detail.wkLevel}` : 'not on WaniKani');
	const description = $derived(
		`Kanji ${detail.character} means ${detail.meaning}. JLPT ${detail.level}, ${wkText}. On'yomi, kun'yomi, and example JLPT vocabulary.`
	);
</script>

<Seo title={`${detail.character} · ${detail.meaning} · JLPT ${detail.level} kanji · WK Flash`} {description} />

<div class="container jlpt-page">
	<a class="back-link" href={`/jlpt/${levelSlug(detail.level)}/kanji`}>← JLPT {detail.level} kanji</a>
	<header class="page-heading">
		<p class="glyph" lang="ja">{detail.character}</p>
		<h1>{detail.meaning}</h1>
		<p class="summary">{description}</p>
	</header>

	<dl class="facts">
		<div>
			<dt>JLPT level</dt>
			<dd><a href={`/jlpt/${levelSlug(detail.level)}/kanji`}>{detail.level}</a></dd>
		</div>
		<div>
			<dt>WaniKani level</dt>
			<dd>{detail.wkLevel ? `Level ${detail.wkLevel}` : 'Not on WaniKani'}</dd>
		</div>
		<div>
			<dt>On'yomi</dt>
			<dd lang="ja">{detail.onyomi ?? '—'}</dd>
		</div>
		<div>
			<dt>Kun'yomi</dt>
			<dd lang="ja">{detail.kunyomi ?? '—'}</dd>
		</div>
	</dl>

	<section aria-labelledby="examples-heading">
		<h2 id="examples-heading">Example JLPT vocabulary</h2>
		{#if detail.examples.length}
			<div class="table-scroll">
				<table>
					<thead>
						<tr>
							<th scope="col">Word</th>
							<th scope="col">Reading</th>
							<th scope="col">Meaning</th>
						</tr>
					</thead>
					<tbody>
						{#each detail.examples as word (word.expression + word.reading)}
							<tr>
								<td class="glyph" lang="ja">{word.expression}</td>
								<td lang="ja">{word.reading}</td>
								<td>{word.meaning}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="note">No JLPT vocabulary words containing this kanji were found in the list.</p>
		{/if}
	</section>
</div>

<style>
	.jlpt-page { max-width: 900px; }
	.back-link { display: inline-block; margin-bottom: 1rem; }
	.page-heading h1 { margin: .25rem 0 0; font-size: 1.6rem; }
	.glyph { font-size: 3rem; line-height: 1; margin: 0; }
	.summary, .note { color: var(--muted); }
	.summary { margin: .5rem 0 0; font-size: .95rem; }
	.note { font-size: .9rem; }
	.facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: .75rem; margin: 1.5rem 0 0; }
	.facts div { padding: .75rem .9rem; border: 1px solid var(--border); border-radius: 8px; }
	.facts dt { color: var(--muted); font-size: .75rem; }
	.facts dd { margin: .2rem 0 0; }
	section { margin-top: 2rem; }
	h2 { margin: 0 0 .5rem; font-size: 1.1rem; }
	.table-scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
	table { width: 100%; border-collapse: collapse; font-size: .9rem; }
	th, td { padding: .45rem .6rem; border-bottom: 1px solid var(--border); text-align: left; }
	thead th { color: var(--muted); font-size: .75rem; background: var(--surface); }
	tbody tr:last-child td { border-bottom: 0; }
	.glyph { font-size: 1.1rem; }
</style>
