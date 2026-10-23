<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<Seo
	title="JLPT kanji and vocabulary by level · WK Flash"
	description="Browse JLPT N5 to N1 kanji and vocabulary with meanings and readings. Free, no account needed."
/>

<div class="container jlpt-page">
	<header class="page-heading">
		<h1>JLPT kanji and vocabulary by level</h1>
		<p>
			Browse every kanji and vocabulary word in each JLPT level, with meanings and readings. Or see how these kanji
			map onto <a href="/jlpt-coverage">WaniKani levels</a>.
		</p>
	</header>

	<ul class="level-list">
		{#each data.levels as item (item.level)}
			<li class="level-card">
				<!-- Covers the whole card so a click anywhere opens the kanji page. Kept out of the tab order; the inner links are the keyboard targets. -->
				<a class="card-link" href={`/jlpt/${item.slug}/kanji`} tabindex="-1">
					<strong>JLPT {item.level}</strong>
				</a>
				<a class="inner-link" href={`/jlpt/${item.slug}/kanji`}>{item.kanjiCount} kanji</a>
				<a class="inner-link" href={`/jlpt/${item.slug}/vocabulary`}>{item.vocabularyCount} vocabulary words</a>
			</li>
		{/each}
	</ul>

	<p class="coverage-link">
		<a href="/jlpt-coverage">See how JLPT kanji map onto WaniKani levels →</a>
	</p>
</div>

<style>
	.jlpt-page { max-width: 1100px; }
	.page-heading h1 { margin: 0; }
	.page-heading p { margin: .35rem 0 0; color: var(--muted); }
	.level-list { list-style: none; padding: 0; margin: 1.5rem 0; display: grid; gap: .75rem; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
	.level-card { position: relative; display: grid; gap: .35rem; justify-items: start; padding: .9rem 1rem; border: 1px solid var(--border); border-radius: 8px; }
	.level-card:hover, .level-card:focus-within { border-color: var(--accent); }
	.card-link { position: static; color: var(--text); text-decoration: none; }
	.card-link::after { content: ''; position: absolute; inset: 0; border-radius: 8px; }
	.card-link strong { font-size: 1rem; }
	.level-card:hover .card-link strong { color: var(--accent); }
	.inner-link { position: relative; z-index: 1; color: var(--text); font-size: .85rem; text-decoration: none; }
	.inner-link:hover, .inner-link:focus-visible { color: var(--accent); text-decoration: underline; }
	.coverage-link { margin: 0 0 1.5rem; }
	.coverage-link a { color: var(--accent); font-weight: 700; }
</style>
