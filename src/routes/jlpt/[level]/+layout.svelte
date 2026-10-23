<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { JLPT_LEVELS, levelSlug, type JLPTLevel } from '$lib/jlpt-pages';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	const level = $derived(data.level as JLPTLevel);
	const section = $derived(page.url.pathname.endsWith('/vocabulary') ? 'vocabulary' : 'kanji');
</script>

<div class="container jlpt-page">
	<a class="back-link" href="/jlpt">← All JLPT levels</a>

	<nav class="level-nav" aria-label="JLPT levels">
		{#each JLPT_LEVELS as item}
			<a href={`/jlpt/${levelSlug(item)}/${section}`} aria-current={item === level ? 'page' : undefined}>{item}</a>
		{/each}
	</nav>

	<nav class="section-toggle" aria-label={`JLPT ${level} section`}>
		<a href={`/jlpt/${data.slug}/kanji`} aria-current={section === 'kanji' ? 'page' : undefined}>
			Kanji <span class="count">{data.kanjiCount}</span>
		</a>
		<a href={`/jlpt/${data.slug}/vocabulary`} aria-current={section === 'vocabulary' ? 'page' : undefined}>
			Vocabulary <span class="count">{data.vocabularyCount}</span>
		</a>
	</nav>

	{@render children()}
</div>

<style>
	.back-link { display: inline-block; margin-bottom: 1rem; }
	.level-nav, .section-toggle { display: flex; flex-wrap: wrap; gap: .75rem; margin: 1.25rem 0 0; }
	.level-nav a, .section-toggle a {
		padding: .5rem 1rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		color: var(--text);
		text-decoration: none;
	}
	.level-nav a[aria-current='page'], .section-toggle a[aria-current='page'] {
		border-color: var(--accent);
		color: var(--accent);
		font-weight: 700;
	}
	.section-toggle { gap: 1rem; margin-bottom: 2.25rem; }
	.section-toggle a { border-radius: 8px; padding: .6rem 1.25rem; }
	.section-toggle .count { color: var(--muted); font-weight: 400; font-size: .85rem; margin-left: .25rem; }

	/* The kanji and vocabulary pages render their tables inside this layout, so these rules are global under .jlpt-page. */
	:global(.jlpt-page .page-heading h1) { margin: 0; }
	:global(.jlpt-page .page-heading p) { margin: .35rem 0 0; color: var(--muted); }
	:global(.jlpt-page .note) { margin: .25rem 0 .75rem; color: var(--muted); font-size: .85rem; }
	:global(.jlpt-page .content) { margin-top: 1.5rem; }
	:global(.jlpt-page .table-scroll) { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
	:global(.jlpt-page table) { width: 100%; border-collapse: collapse; font-size: .85rem; }
	:global(.jlpt-page th), :global(.jlpt-page td) { padding: .45rem .6rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
	:global(.jlpt-page thead th) { color: var(--muted); font-size: .75rem; background: var(--surface); }
	:global(.jlpt-page tbody tr:last-child td) { border-bottom: 0; }
	:global(.jlpt-page .glyph) { font-size: 1.1rem; white-space: nowrap; }
	:global(.jlpt-page .glyph a) { color: var(--text); }
</style>
