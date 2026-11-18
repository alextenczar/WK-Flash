<script lang="ts">
	import { onMount } from 'svelte';
	import HowItWorksArt, { type ArtKind } from '$lib/components/HowItWorksArt.svelte';
	import Seo from '$lib/components/Seo.svelte';

	type Phase = {
		art: ArtKind;
		title: string;
		summary: string;
		points: string[];
		underTheHood: string[];
	};

	const phases: Phase[] = [
		{
			art: 'connect',
			title: 'Connect your account',
			summary: 'Paste a WaniKani token into Settings. WK Flash checks it with WaniKani and keeps it in this browser.',
			points: [
				'Use a token with the default scopes.',
				'No password, no account, no server.',
				'Remove the key in Settings to clear it from this browser.'
			],
			underTheHood: [
				'Requests go straight from your browser to the WaniKani API.',
				'Keep the token private. Anyone who has it can access your account.'
			]
		},
		{
			art: 'queue',
			title: 'Build your queue',
			summary: 'The home page shows what is due now, what is coming next, and how far you are through your level.',
			points: [
				'Sort by SRS stage, WaniKani level, or review type, in ascending or descending order, with an optional secondary sort for ties.',
				'Prioritize your current level to see it first.',
				'Lessons start here, and starting one moves it into your reviews.'
			],
			underTheHood: [
				'Items that come due mid-review are merged into your queue using the same sort order.',
				'Your weakest items are listed on the home page.'
			]
		},
		{
			art: 'answer',
			title: 'Answer each card',
			summary: 'Think of the meaning and the reading together, flip the card, then mark it right or wrong.',
			points: [
				'One card covers both answers, so you make one decision.',
				'Keyboard and controller both work, and every key is remappable.',
				'Wrong cards come back in a final round.'
			],
			underTheHood: [
				'Toggle mnemonics and parts of speech, and see the SRS stage change predicted after each answer.',
				'Play audio, and browse similar kanji, vocabulary, and example sentences.',
				'Undo is optional and off by default.'
			]
		},
		{
			art: 'sync',
			title: 'Sync with WaniKani',
			summary: 'Each graded card becomes one review on WaniKani. A miss counts for both meaning and reading.',
			points: [
				'Offline answers are queued on your device and sent when you reconnect.',
				'Leave mid-review and your session is saved.',
				'Loading new reviews and audio still need a connection.'
			],
			underTheHood: [
				'Pending answers are retried when the app comes back online or regains focus.',
				'The in-progress review, including the current card, is restored from browser storage.'
			]
		},
		{
			art: 'track',
			title: 'Track your progress',
			summary: 'Analytics show where your reviews are taking you.',
			points: [
				'JLPT progress for each level.',
				'A level-up forecast based on your pace and your target days per level.',
				'Weakest items show what needs attention.'
			],
			underTheHood: [
				'JLPT lists and WaniKani coverage are public and need no token.',
				'Your personal progress, forecast, and weakest items need your token.'
			]
		}
	];

	const quickFacts = ['Runs in your browser', 'No account or server', 'Works offline for answers', 'Keyboard and controller'];

	let openPanels = $state<Record<number, boolean>>({});
	let flipped = $state(false);
	let verdict = $state<'correct' | 'wrong' | null>(null);

	/** Set once the script runs, so steps stay visible if JavaScript never loads. */
	let ready = $state(false);
	/** Steps that have scrolled into view at least once. */
	let seen = $state<boolean[]>(phases.map(() => false));
	/** The step closest to the middle of the screen. */
	let activeIndex = $state(0);
	/** How far the reader has scrolled through the timeline, from 0 to 1. */
	let progress = $state(0);
	let timelineEl = $state<HTMLElement | null>(null);
	let phaseEls: (HTMLElement | undefined)[] = [];
	let tiltX = $state(0);
	let tiltY = $state(0);

	const verdictText = $derived(
		verdict === 'correct'
			? 'Correct. WaniKani gets one review with no misses for meaning or reading. The card is done.'
			: verdict === 'wrong'
				? 'Wrong. WaniKani gets one review with a miss for both meaning and reading. The card returns in the final round.'
				: ''
	);

	onMount(() => {
		ready = true;
		updateProgress();

		const seenObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					seen[Number((entry.target as HTMLElement).dataset.index)] = true;
					seenObserver.unobserve(entry.target);
				}
			},
			{ threshold: 0.15 }
		);
		// A narrow band across the middle of the screen decides which step is in focus.
		const focusObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) activeIndex = Number((entry.target as HTMLElement).dataset.index);
				}
			},
			{ rootMargin: '-40% 0px -40% 0px' }
		);

		for (const el of phaseEls) {
			if (!el) continue;
			seenObserver.observe(el);
			focusObserver.observe(el);
		}

		return () => {
			seenObserver.disconnect();
			focusObserver.disconnect();
		};
	});

	function updateProgress() {
		if (!timelineEl) return;
		const { top, height } = timelineEl.getBoundingClientRect();
		const anchor = window.innerHeight * 0.6;
		progress = Math.min(1, Math.max(0, (anchor - top) / height));
	}

	function tiltCard(event: PointerEvent) {
		if (event.pointerType !== 'mouse') return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = (event.clientX - rect.left) / rect.width - 0.5;
		const y = (event.clientY - rect.top) / rect.height - 0.5;
		tiltY = x * 10;
		tiltX = -y * 10;
	}

	function resetTilt() {
		tiltX = 0;
		tiltY = 0;
	}

	function phaseNumber(index: number): string {
		return String(index + 1).padStart(2, '0');
	}

	function togglePanel(index: number) {
		openPanels = { ...openPanels, [index]: !openPanels[index] };
	}

	function grade(result: 'correct' | 'wrong') {
		verdict = result;
	}

	function resetDemo() {
		flipped = false;
		verdict = null;
	}
</script>

<svelte:window onscroll={updateProgress} onresize={updateProgress} />

<Seo
	title="How WK Flash works · Unofficial WaniKani study app"
	description="How WK Flash works, step by step: connect your WaniKani token, build your review queue, answer one card for meaning and reading, sync results, and track JLPT progress."
/>

<div class="how">
	<div class="container layout">
		<aside class="intro" aria-labelledby="intro-heading">
			<p class="eyebrow">How it works</p>
			<h1 id="intro-heading">From token to graded review</h1>
			<p class="lede">Five steps from your WaniKani account to a finished review. Open any step to see more.</p>
			<ul class="facts" aria-label="Key facts">
				{#each quickFacts as fact, i (fact)}
					<li style="--i: {i}">{fact}</li>
				{/each}
			</ul>
			<p class="intro-links">
				<a class="pill primary" href="/settings">Connect WaniKani</a>
				<a class="pill" href="/jlpt">Browse JLPT lists</a>
			</p>
		</aside>

		<div class="timeline-wrap" bind:this={timelineEl}>
			<div class="timeline-progress" aria-hidden="true" style:transform="scaleY({progress})"></div>
			<ol class="timeline" class:ready>
				{#each phases as phase, index (phase.title)}
					<li
						class="phase"
						class:seen={seen[index]}
						class:active={activeIndex === index}
						data-index={index}
						bind:this={phaseEls[index]}
					>
						<span class="node" aria-hidden="true">{phaseNumber(index)}</span>
						<div class="phase-body">
							<div class="art-frame">
								<HowItWorksArt kind={phase.art} visible={seen[index]} />
							</div>
							<div class="phase-content">
								<h2>{phase.title}</h2>
								<p class="summary">{phase.summary}</p>
								<ul class="points">
									{#each phase.points as point, i (point)}
										<li style="--i: {i}">
											<svg class="tick" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
												<path pathLength="1" d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
											</svg>
											<span>{point}</span>
										</li>
									{/each}
								</ul>

								<button
									type="button"
									class="toggle"
									aria-expanded={openPanels[index] ? 'true' : 'false'}
									aria-controls={`under-the-hood-${index}`}
									onclick={() => togglePanel(index)}
								>
									<span>Under the hood</span>
									<svg class="chevron" class:open={openPanels[index]} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
										<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</button>
								<div id={`under-the-hood-${index}`} class="panel" class:open={openPanels[index]}>
									<div class="panel-inner">
										<ul>
											{#each phase.underTheHood as item, i (item)}
												<li style="--i: {i}">{item}</li>
											{/each}
										</ul>
									</div>
								</div>
							</div>
						</div>
					</li>
				{/each}
			</ol>
		</div>
	</div>

	<section class="container try" aria-labelledby="try-heading">
		<div class="try-head">
			<p class="eyebrow">Try it</p>
			<h2 id="try-heading">Grade a sample card</h2>
			<p>This card is a sample, not your data. Flip it, then grade it to see what gets sent.</p>
		</div>

		<div class="demo">
			<div class="scene">
				<div
					class="tilt"
					role="presentation"
					style="transform: rotateX({tiltX}deg) rotateY({tiltY}deg)"
					onpointermove={tiltCard}
					onpointerleave={resetTilt}
				>
					<div class="card" class:flipped>
						<div class="face front">
							<span class="glyph" lang="ja">日</span>
							{#if !flipped}
								<button type="button" class="pill primary" onclick={() => (flipped = true)}>Flip to reveal</button>
							{/if}
						</div>
						<div class="face back">
							<p class="answer">Day, sun, Japan</p>
							<p class="reading" lang="ja">にち</p>
						</div>
					</div>
				</div>
			</div>

			{#if flipped && verdict === null}
				<div class="grade" aria-label="Grade this card">
					<button type="button" class="pill wrong" onclick={() => grade('wrong')}>Wrong</button>
					<button type="button" class="pill right" onclick={() => grade('correct')}>Correct</button>
				</div>
			{/if}

			{#if verdict}
				<p class="result" role="status">{verdictText}</p>
				<button type="button" class="pill" onclick={resetDemo}>Try again</button>
			{/if}
		</div>
	</section>

	<footer class="container footnote">
		<p>
			WK Flash is an independent project, not made, owned, approved, or endorsed by WaniKani or Tofugu.
			WaniKani and its content, names, and artwork belong to their respective owners.
		</p>
	</footer>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
		gap: clamp(2rem, 5vw, 4.5rem);
		padding-top: clamp(2.5rem, 6vw, 4.5rem);
		padding-bottom: 2rem;
		align-items: start;
	}

	.intro {
		position: sticky;
		top: 2rem;
	}

	/* Intro lines fade up once on load. */
	.intro > * {
		animation: rise 0.5s ease-out backwards;
	}

	.intro > :nth-child(2) {
		animation-delay: 0.05s;
	}

	.intro > :nth-child(3) {
		animation-delay: 0.1s;
	}

	.intro > :nth-child(4) {
		animation-delay: 0.15s;
	}

	.intro > :nth-child(5) {
		animation-delay: 0.2s;
	}

	.eyebrow {
		margin: 0 0 0.9rem;
		color: var(--accent-hover);
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.2rem, 4.6vw, 3.3rem);
		line-height: 1.05;
		letter-spacing: -0.03em;
	}

	.lede {
		margin: 1.2rem 0 0;
		max-width: 28rem;
		color: var(--muted);
		font-size: 1.1rem;
		line-height: 1.7;
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1.5rem 0 0;
		padding: 0;
		list-style: none;
	}

	.facts li {
		padding: 0.4rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		color: var(--muted);
		font-size: 0.9rem;
		animation: rise 0.4s ease-out backwards;
		animation-delay: calc(var(--i, 0) * 50ms + 300ms);
	}

	.intro-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 1.75rem 0 0;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.6rem;
		padding: 0.55rem 1.2rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-alt);
		color: var(--text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease;
	}

	.pill:hover,
	.pill:focus-visible {
		text-decoration: none;
		transform: translateY(-1px);
		border-color: var(--accent-hover);
	}

	/* Pressing a pill gives a small squash, overriding the hover lift while held. */
	.pill:active {
		transform: scale(0.98);
	}

	.pill.primary {
		border-color: transparent;
		background: linear-gradient(120deg, #2563eb, #7c3aed);
		color: #fff;
	}

	.pill.right {
		border-color: var(--good);
	}

	.pill.wrong {
		border-color: var(--bad);
	}

	/* Timeline */
	.timeline-wrap {
		position: relative;
	}

	/* Fills as the reader scrolls through the steps. Its height is set from scroll position in the script. */
	.timeline-progress {
		position: absolute;
		top: 1.1rem;
		bottom: 1.1rem;
		left: 1.1rem;
		width: 2px;
		border-radius: 2px;
		background: linear-gradient(180deg, #2563eb, #7c3aed 60%, #fb7185);
		transform-origin: top;
		transform: scaleY(0);
		pointer-events: none;
	}

	.timeline {
		position: relative;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.timeline::before {
		content: '';
		position: absolute;
		top: 1.1rem;
		bottom: 1.1rem;
		left: 1.1rem;
		width: 2px;
		border-radius: 2px;
		background: linear-gradient(180deg, #2563eb, #7c3aed 60%, #fb7185);
		opacity: 0.45;
	}

	.phase {
		position: relative;
		display: grid;
		grid-template-columns: 2.25rem minmax(0, 1fr);
		gap: 1.25rem;
		padding-bottom: 2.5rem;
	}

	.phase:last-child {
		padding-bottom: 0;
	}

	.node {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 2px solid var(--bg);
		border-radius: 50%;
		background: linear-gradient(120deg, #2563eb, #7c3aed);
		color: #fff;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		transition: box-shadow 0.4s ease;
	}

	/* The step in focus gets a thin ring around its node. */
	.phase.active .node {
		box-shadow: 0 0 0 4px var(--surface), 0 0 0 5px rgb(124 58 237 / 45%);
	}

	.phase-body {
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface);
		transition:
			border-color 0.2s ease,
			opacity 0.5s ease-out,
			transform 0.5s ease-out;
	}

	/* Steps fade up as they scroll into view. Only applied once JavaScript has run. */
	.timeline.ready .phase:not(.seen) .phase-body {
		opacity: 0;
		transform: translateY(12px);
	}

	.phase-body:hover {
		border-color: rgb(96 165 250 / 40%);
	}

	.art-frame {
		padding: 1.25rem 1.5rem 1rem;
		border-bottom: 1px solid var(--border);
		background:
			radial-gradient(circle at 85% 0%, rgb(59 130 246 / 16%), transparent 60%),
			radial-gradient(circle at 10% 100%, rgb(192 132 252 / 12%), transparent 55%),
			var(--surface-alt);
		color: var(--accent-hover);
	}

	.phase-content {
		padding: 1.3rem 1.5rem 1.4rem;
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
		line-height: 1.25;
	}

	.summary {
		margin: 0.6rem 0 0;
		color: var(--muted);
		font-size: 1.02rem;
		line-height: 1.7;
	}

	.points {
		display: grid;
		gap: 0.55rem;
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
		font-size: 1rem;
		line-height: 1.6;
	}

	.points li {
		display: grid;
		grid-template-columns: 1.1rem 1fr;
		gap: 0.6rem;
		align-items: start;
	}

	/* Each tick draws itself in, one after another, when its step appears. */
	.tick {
		width: 1.1rem;
		height: 1.1rem;
		margin-top: 0.2rem;
		color: var(--good);
	}

	.tick path {
		stroke-dasharray: 1 1;
		stroke-dashoffset: 0;
		transition: stroke-dashoffset 0.5s ease;
		transition-delay: calc(var(--i, 0) * 60ms + 150ms);
	}

	.timeline.ready .phase:not(.seen) .tick path {
		stroke-dashoffset: 1;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 1.1rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent-hover);
		font: inherit;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}

	.toggle:focus-visible {
		outline: 2px solid var(--accent-hover);
		outline-offset: 4px;
		border-radius: 4px;
	}

	.chevron {
		width: 1rem;
		height: 1rem;
		transition: transform 0.25s ease;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	/* Animated panel: the grid-rows trick lets height animate to its content. */
	.panel {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.3s ease;
	}

	.panel.open {
		grid-template-rows: 1fr;
	}

	.panel-inner {
		min-height: 0;
		overflow: hidden;
	}

	.panel ul {
		margin: 0.9rem 0 0;
		padding: 0.9rem 0 0 1.1rem;
		border-top: 1px dashed var(--border);
		color: var(--muted);
		font-size: 0.98rem;
		line-height: 1.7;
	}

	.panel li + li {
		margin-top: 0.4rem;
	}

	/* Items in an opened panel fade in one after another. */
	.panel.open li {
		animation: rise 0.3s ease-out backwards;
		animation-delay: calc(var(--i, 0) * 40ms + 60ms);
	}

	/* Demo */
	.try {
		padding-top: clamp(2.5rem, 6vw, 4rem);
		padding-bottom: 2rem;
	}

	.try-head {
		max-width: 40rem;
	}

	.try-head h2 {
		font-size: clamp(1.6rem, 3.2vw, 2.1rem);
	}

	.try-head p:last-child {
		margin: 0.7rem 0 0;
		color: var(--muted);
		font-size: 1.02rem;
		line-height: 1.7;
	}

	.demo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
		margin-top: 2.25rem;
	}

	.scene {
		perspective: 1100px;
	}

	/* Follows the pointer so the card tilts toward it. */
	.tilt {
		width: min(320px, 86vw);
		transform-style: preserve-3d;
		transition: transform 0.5s ease-out;
	}

	.card {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
		transform-style: preserve-3d;
		transition: transform 0.6s cubic-bezier(0.3, 0.7, 0.2, 1);
	}

	.card.flipped {
		transform: rotateY(180deg);
	}

	.face {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.9rem;
		padding: 1.5rem;
		border: 1px solid var(--border);
		border-radius: 20px;
		background:
			radial-gradient(circle at 100% 0%, rgb(59 130 246 / 14%), transparent 45%),
			var(--surface);
		text-align: center;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	.face.back {
		transform: rotateY(180deg);
	}

	.glyph {
		font-size: 5rem;
		line-height: 1;
	}

	.answer {
		margin: 0;
		font-size: 1.3rem;
		font-weight: 700;
	}

	.reading {
		margin: 0;
		color: var(--muted);
		font-size: 1.1rem;
	}

	.grade {
		display: flex;
		gap: 0.75rem;
	}

	/* The two grade buttons fade in together. */
	.grade .pill {
		animation: rise 0.35s ease-out backwards;
	}

	.grade .pill:nth-child(2) {
		animation-delay: 0.06s;
	}

	.result {
		max-width: 36rem;
		margin: 0;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		font-size: 1rem;
		line-height: 1.6;
		text-align: center;
		animation: rise 0.35s ease-out backwards;
	}

	.footnote {
		padding-top: 1.5rem;
		padding-bottom: 3rem;
		border-top: 1px solid var(--border);
	}

	.footnote p {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
		line-height: 1.6;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}

	@media (max-width: 800px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.intro {
			position: static;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.how *,
		.how *::before,
		.how *::after {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
