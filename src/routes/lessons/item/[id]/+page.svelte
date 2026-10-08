<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { apiKey } from '$lib/storage';
	import { getStaticLocalN1Subject } from '$lib/local-n1-reviews';
	import { playPronunciation, reviewAudioSettings } from '$lib/review-audio';
	import { getSubjectBySlug, getSubjectsByIds, WaniKaniError } from '$lib/wanikani/api';
	import { allMeanings, primaryMeaning, readingsForDisplay, vocabularyByReading } from '$lib/wanikani/matching';
	import type { WKSubject } from '$lib/wanikani/types';

	let subject = $state<WKSubject | null>(null);
	let isLocalSubject = $state(false);
	let componentSubjects = $state<WKSubject[]>([]);
	let similarSubjects = $state<WKSubject[]>([]);
	let amalgamationSubjects = $state<WKSubject[]>([]);
	let loading = $state(true);
	let error = $state('');
	const similarKanji = $derived(similarSubjects.filter((item) => item.object === 'kanji'));
	const vocabularyGroups = $derived(vocabularyByReading(amalgamationSubjects));
	const cameFromHome = $derived(page.url.searchParams.get('from') === 'home');
	const cameFromAnalytics = $derived(page.url.searchParams.get('from') === 'analytics');
	const cameFromLessons = $derived(page.url.searchParams.get('from') === 'lessons');

	function subjectPath(item: WKSubject): string {
		const type = item.object === 'vocabulary' || item.object === 'kana_vocabulary' ? 'vocab' : item.object;
		return `/${type}/${encodeURIComponent(item.data.characters ?? item.data.slug)}`;
	}

	function playAudio() {
		void playPronunciation(subject?.data.pronunciation_audios?.[0]?.url, $reviewAudioSettings.volume);
	}

	onMount(() => {
		if (!$apiKey) {
			void goto('/settings');
			return;
		}
		const slug = page.params.id;
		const subjectType = page.params.type === 'vocab'
			? 'vocabulary,kana_vocabulary'
			: page.params.type === 'kanji' || page.params.type === 'radical'
				? page.params.type
				: undefined;
		if (!slug || !subjectType) {
			void goto('/lessons');
			return;
		}
		void (async () => {
			try {
				const loaded = await getSubjectBySlug($apiKey, slug, subjectType);
				const localSubject = !loaded
					? getStaticLocalN1Subject(
						page.params.type === 'vocab' ? 'vocab' : 'kanji',
						slug,
						page.url.searchParams.get('reading')
					)
					: null;
				if (!loaded && !localSubject) {
					error = 'This WaniKani item is not available.';
					return;
				}
				subject = loaded ?? localSubject;
				isLocalSubject = localSubject !== null;
				if (!loaded) return;
				const componentIds = loaded.data.component_subject_ids ?? [];
				const similarIds = loaded.data.visually_similar_subject_ids ?? [];
				const amalgamationIds = loaded.data.amalgamation_subject_ids ?? [];
				const ids = [...new Set([...componentIds, ...similarIds, ...amalgamationIds])]
					.filter((relatedId) => relatedId !== loaded.id);
				const related = ids.length ? await getSubjectsByIds($apiKey, ids) : [];
				const relatedById = new Map(related.map((item) => [item.id, item]));
				componentSubjects = componentIds.flatMap((relatedId) => {
					const item = relatedById.get(relatedId);
					return item ? [item] : [];
				});
				similarSubjects = similarIds.flatMap((relatedId) => {
					const item = relatedById.get(relatedId);
					return item ? [item] : [];
				});
				amalgamationSubjects = amalgamationIds.flatMap((relatedId) => {
					const item = relatedById.get(relatedId);
					return item ? [item] : [];
				});
			} catch (cause) {
				error = cause instanceof WaniKaniError ? cause.message : 'Unable to load this item.';
			} finally {
				loading = false;
			}
		})();
	});
</script>

<svelte:head>
	<title>{subject ? `${subject.data.characters ?? subject.data.slug} · WK Flash` : 'Item · WK Flash'}</title>
</svelte:head>

<div class="container item-container">
	{#if cameFromAnalytics}
		<a class="back-link" href="/analytics">← Back to analytics</a>
	{:else if cameFromHome}
		<a class="back-link" href="/">← Back home</a>
	{:else if cameFromLessons}
		<a class="back-link" href="/lessons">← Back to lessons</a>
	{/if}
	{#if loading}
		<p>Loading item…</p>
	{:else if error}
		<p class="error" role="alert">{error}</p>
	{:else if subject}
		<article
			class="item-page"
			class:radical-card={subject.object === 'radical'}
			class:kanji-card={subject.object === 'kanji'}
			class:vocabulary-card={subject.object === 'vocabulary' || subject.object === 'kana_vocabulary'}
		>
			<header class="item-header">
				<div class="characters">{subject.data.characters ?? subject.data.slug}</div>
				<p class="subject-type">
					{isLocalSubject ? 'Local JLPT N1 · ' : `Level ${subject.data.level} · `}
					{subject.object.replace('_', ' ')}
				</p>
			</header>

			<div class="details">
				{#if isLocalSubject}
					<p class="local-note">This item is not available in WaniKani. Its details come from the bundled JLPT datasets and it is never submitted to WaniKani.</p>
				{/if}
				{#if componentSubjects.length}
					<section>
						<h2>{subject.object === 'kanji' ? 'Radical combination' : 'Components'}</h2>
						<div class="related-items">
							{#each componentSubjects as item (item.id)}
								<a href={subjectPath(item)} class="related-item">
									<strong>{item.data.characters ?? item.data.slug}</strong>{primaryMeaning(item)}
								</a>
							{/each}
						</div>
					</section>
				{/if}
				{#if subject.data.pronunciation_audios?.length}
					<button type="button" onclick={playAudio}>Play audio</button>
				{/if}
				{#if subject.data.readings?.length}
					<section>
						<h2>Readings</h2>
						{#each readingsForDisplay(subject) as group (group.type)}
							<p class="answer-accent">
								{#if group.type !== 'Reading'}<span class="reading-type">{group.type}:</span> {/if}
								{group.readings.map((reading) => reading.reading).join(', ')}
							</p>
						{/each}
						{#if subject.data.auxiliary_readings?.length}
							<p class="auxiliary">Also accepted: {subject.data.auxiliary_readings.filter((item) => item.type === 'whitelist').map((item) => item.reading).join(', ')}</p>
						{/if}
					</section>
				{/if}
				<section>
					<h2>Meaning</h2>
					<p class="answer-accent">{primaryMeaning(subject)}</p>
					{#if allMeanings(subject).slice(1).length}
						<p class="alternative">Alternative: {allMeanings(subject).slice(1).join(', ')}</p>
					{/if}
					{#if subject.data.auxiliary_meanings?.length}
						<p class="auxiliary">Also accepted: {subject.data.auxiliary_meanings.filter((item) => item.type === 'whitelist').map((item) => item.meaning).join(', ')}</p>
					{/if}
					{#if subject.data.parts_of_speech?.length}
						<p class="classification">{subject.data.parts_of_speech.join(' · ')}</p>
					{/if}
				</section>
				{#if subject.data.meaning_mnemonic}
					<section class="mnemonic">
						<h2>Meaning mnemonic</h2>
						<p>{subject.data.meaning_mnemonic.replace(/<\/?(?:radical|kanji|vocabulary|meaning|reading|ja)>/gi, '')}</p>
						{#if subject.data.meaning_hint}<p class="hint"><strong>Hint:</strong> {subject.data.meaning_hint}</p>{/if}
					</section>
				{/if}
				{#if subject.data.reading_mnemonic}
					<section class="mnemonic">
						<h2>Reading mnemonic</h2>
						<p>{subject.data.reading_mnemonic.replace(/<\/?(?:radical|kanji|vocabulary|meaning|reading|ja)>/gi, '')}</p>
						{#if subject.data.reading_hint}<p class="hint"><strong>Hint:</strong> {subject.data.reading_hint}</p>{/if}
					</section>
				{/if}
				{#if subject.object === 'kanji' && similarKanji.length}
					<section>
						<h2>Similar kanji</h2>
						<div class="related-items">
							{#each similarKanji as item (item.id)}
								<a href={subjectPath(item)} class="related-item"><strong>{item.data.characters ?? item.data.slug}</strong>{primaryMeaning(item)}</a>
							{/each}
						</div>
					</section>
				{/if}
				{#if subject.object === 'kanji' && vocabularyGroups.length}
					<section>
						<h2>Found in vocabulary</h2>
						<div class="found-vocabulary-grid">
							{#each vocabularyGroups as group (group.reading)}
								{#each group.subjects as item (item.id)}
									<a href={subjectPath(item)} class="found-vocabulary-item">
										<strong lang="ja">{item.data.characters ?? item.data.slug}</strong>
										<span>{group.reading}</span>
										<small>{primaryMeaning(item)}</small>
									</a>
								{/each}
							{/each}
						</div>
					</section>
				{/if}
				{#if subject.object === 'radical' && amalgamationSubjects.length}
					<section>
						<h2>Found in kanji</h2>
						<div class="related-items">
							{#each amalgamationSubjects as item (item.id)}
								<a href={subjectPath(item)} class="related-item">
									<strong>{item.data.characters ?? item.data.slug}</strong>{primaryMeaning(item)}
								</a>
							{/each}
						</div>
					</section>
				{/if}
				{#if subject.data.context_sentences?.length}
					<section>
						<h2>Example sentences</h2>
						{#each subject.data.context_sentences as sentence, index (`${sentence.ja}-${index}`)}
							<div class="context-sentence"><p lang="ja">{sentence.ja}</p><p>{sentence.en}</p></div>
						{/each}
					</section>
				{/if}
				<a class="source-link" href={subject.data.document_url} target="_blank" rel="noreferrer">
					{isLocalSubject ? 'View on Jisho' : 'View on WaniKani'}
				</a>
			</div>
		</article>
	{/if}
</div>

<style>
	.item-container { max-width: 1100px; }
	.back-link { display: inline-block; margin-bottom: 1rem; }
	.error { color: var(--bad); }
	.item-page { width: 100%; }
	.item-header { margin-bottom: 2rem; padding: 1.5rem 0 2rem; border-bottom: 1px solid var(--border); text-align: center; }
	.characters { font-size: 4rem; line-height: 1.2; }
	.subject-type { margin-top: .25rem; color: var(--muted); font-weight: 700; text-transform: capitalize; }
	.radical-card .subject-type, .radical-card .answer-accent { color: #00aaff; }
	.kanji-card .subject-type, .kanji-card .answer-accent { color: #f100a1; }
	.vocabulary-card .subject-type, .vocabulary-card .answer-accent { color: #a100f1; }
	.details { display: flex; flex-direction: column; max-width: 760px; margin: 0 auto; text-align: left; }
	.local-note { margin: 0; padding: .75rem; border: 1px solid var(--border); border-radius: 8px; color: var(--muted); font-size: .9rem; }
	.details > section { padding: 1.5rem 0; border-top: 1px solid var(--border); }
	.details > section:first-of-type { border-top: 0; padding-top: 0; }
	.details > button { align-self: flex-start; margin-bottom: .5rem; }
	.details h2 { margin: 0 0 .65rem; color: var(--muted); font-size: .85rem; text-transform: uppercase; letter-spacing: .04em; }
	.details p { margin: 0; }
	.answer-accent { font-weight: 700; }
	.alternative, .auxiliary { margin-top: .45rem !important; color: var(--muted); font-size: .9rem; }
	.classification { margin-top: .75rem !important; color: var(--muted); font-size: .85rem; text-transform: capitalize; }
	.mnemonic p { line-height: 1.5; }
	.mnemonic .hint { margin-top: .75rem; color: var(--muted); }
	.reading-type { color: var(--muted); text-transform: capitalize; }
	.related-items { display: flex; flex-wrap: wrap; gap: .5rem; }
	.related-item { display: inline-flex; align-items: baseline; gap: .4rem; border: 1px solid var(--border); border-radius: 6px; padding: .35rem .55rem; color: var(--text); }
	.found-vocabulary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: .65rem; }
	.found-vocabulary-item { display: flex; flex-direction: column; gap: .15rem; min-width: 0; padding: .75rem; border: 1px solid var(--border); border-radius: 8px; color: var(--text); text-decoration: none; }
	.found-vocabulary-item:hover, .found-vocabulary-item:focus-visible { border-color: var(--accent); text-decoration: none; }
	.found-vocabulary-item strong { font-size: 1.25rem; }
	.found-vocabulary-item span, .found-vocabulary-item small { overflow: hidden; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
	.context-sentence { padding: .75rem 0; border-bottom: 1px solid var(--border); }
	.context-sentence p + p { margin-top: .3rem; color: var(--muted); }
	.source-link { align-self: center; margin: 1.5rem 0; }
	@media (max-width: 520px) {
		.item-header { margin-bottom: 1.25rem; padding: .5rem 0 1.5rem; }
		.details > section { padding: 1.25rem 0; }
		.characters { font-size: 3.25rem; }
	}
</style>
