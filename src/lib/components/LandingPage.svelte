<script lang="ts">
	const features = [
		{
			icon: 'cards',
			title: 'One card, both answers',
			text: 'Give the meaning and the reading together in one pass. Half the reviews, one result sent to WaniKani.',
			wide: true
		},
		{
			icon: 'offline',
			title: 'Works offline',
			text: 'Resume an in-progress session without a connection. Answers sync when you are back online.'
		},
		{
			icon: 'related',
			title: 'Related items',
			text: 'Look up similar kanji, radical components, and vocabulary grouped by reading while you review.'
		},
		{
			icon: 'sort',
			title: 'Sort your reviews',
			text: 'Order by SRS stage, WaniKani level, or item type. Shuffle, or put your current level first.'
		},
		{
			icon: 'controller',
			title: 'Keyboard and controller',
			text: 'Xbox and PlayStation controllers work out of the box. Plug one in, press a button, and start grading. Keys and buttons are remappable in Settings.'
		},
		{
			icon: 'progress',
			title: 'JLPT analytics',
			text: 'Coverage by JLPT level, weakest items from your review stats, search across kanji and vocabulary, and a level-up forecast.'
		},
		{
			icon: 'theme',
			title: 'Dark and light mode',
			text: 'Dark mode is the default and easy on the eyes at night. Turn on light mode in Settings if you study in a bright room.'
		}
	] as const;

	const steps = [
		{
			title: 'Create a WaniKani token',
			text: 'Generate a personal access token with the default scopes from your WaniKani settings.'
		},
		{
			title: 'Paste it in Settings',
			text: 'The token stays in this browser. Nothing is sent anywhere except WaniKani’s own API.'
		},
		{
			title: 'Start reviewing',
			text: 'Your due reviews appear on the home page, ready to flip through one card at a time.'
		}
	];

	const floaters = ['火', '水', '木', '金', '土', '日', '月', '人', '大', '心', '言', '学'];
	const coverage = [
		{ level: 'N5', value: 92 },
		{ level: 'N4', value: 78 },
		{ level: 'N3', value: 54 },
		{ level: 'N2', value: 31 },
		{ level: 'N1', value: 12 }
	];
	const weakestSample = [
		{ glyph: '氏', meaning: 'Family name', rate: 58 },
		{ glyph: '未', meaning: 'Not yet', rate: 64 },
		{ glyph: '予', meaning: 'Beforehand', rate: 71 }
	];
</script>

<div class="landing">
	<section class="hero">
		<div class="aurora" aria-hidden="true">
			<span class="orb orb-a"></span>
			<span class="orb orb-b"></span>
			<span class="orb orb-c"></span>
		</div>
		<div class="floater-field" aria-hidden="true">
			{#each floaters as glyph, index (glyph)}
				<span class="floater" style="--i: {index}">{glyph}</span>
			{/each}
		</div>

		<div class="container hero-grid">
			<div class="hero-copy">
				<p class="eyebrow">Faster reviews · Clearer progress</p>
				<h1>
					Cut your reviews
					<span class="gradient-text">in half.</span>
				</h1>
				<p class="lede">
					WK Flash is built for speed. You get meaning and reading on one card, keyboard-first grading, and
					analytics that show your JLPT coverage, your weakest items, and when you’ll level up.
				</p>
				<div class="cta-row">
					<a class="button primary" href="/settings">Connect WaniKani</a>
					<a class="button" href="/how-it-works">How it works</a>
				</div>
				<p class="fine-print">Your API token is stored only in this browser. No password, no account.</p>
				<dl class="stat-row">
					<div>
						<dt>Half the reviews</dt>
						<dd>Meaning and reading in one pass</dd>
					</div>
					<div>
						<dt>Keyboard-fast</dt>
						<dd>Flip and grade without leaving home row</dd>
					</div>
					<div>
						<dt>Live analytics</dt>
						<dd>JLPT coverage, weakest items, level-up forecast</dd>
					</div>
				</dl>
			</div>

			<div class="hero-stage" aria-hidden="true">
				<div class="stack-card radical">
					<span class="kind">Radical</span>
					<strong>火</strong>
				</div>
				<div class="stack-card vocab">
					<span class="kind">Vocabulary</span>
					<strong>火山</strong>
				</div>
				<div class="demo-card">
					<div class="demo-inner">
						<div class="demo-face front">
							<div class="demo-meta">
								<span class="kind kanji">Kanji · Level 12</span>
								<span class="pips"><i></i><i></i><i></i><i class="off"></i><i class="off"></i></span>
							</div>
							<div class="glyph">火</div>
							<div class="prompt">Meaning + reading</div>
						</div>
						<div class="demo-face back">
							<div class="demo-meta">
								<span class="kind kanji">Kanji · Level 12</span>
								<span class="pips"><i></i><i></i><i></i><i class="off"></i><i class="off"></i></span>
							</div>
							<div class="answers">
								<div>
									<span>Meaning</span>
									<strong>Fire</strong>
								</div>
								<div>
									<span>Reading</span>
									<strong>ひ · か</strong>
								</div>
							</div>
							<div class="chips">
								<span class="chip bad">Wrong</span>
								<span class="chip good">Correct</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="compare" aria-labelledby="compare-heading">
		<div class="container">
			<p class="section-eyebrow">Speed</p>
			<h2 id="compare-heading">Two reviews become one</h2>
			<p class="section-lede">
				WaniKani asks for meaning and reading as separate reviews. WK Flash asks for both on the same
				card, so you move through the queue once and get time back.
			</p>
			<div class="compare-grid">
				<figure class="compare-col faded">
					<figcaption>WaniKani</figcaption>
					<div class="mini-card">
						<span class="kind kanji">Meaning</span>
						<strong>火</strong>
						<em>Fire</em>
					</div>
					<div class="mini-card">
						<span class="kind kanji">Reading</span>
						<strong>火</strong>
						<em>ひ · か</em>
					</div>
				</figure>
				<div class="compare-plus" aria-hidden="true">→</div>
				<figure class="compare-col">
					<figcaption>WK Flash</figcaption>
					<div class="mini-card highlight">
						<span class="kind kanji">Meaning + reading</span>
						<strong>火</strong>
						<em>Fire · ひ · か</em>
					</div>
				</figure>
			</div>
		</div>
	</section>

	<section class="container features" aria-labelledby="features-heading">
		<p class="section-eyebrow">What you get</p>
		<h2 id="features-heading">Built for speed and insight</h2>
		<div class="feature-grid">
			{#each features as feature (feature.title)}
				<article class="feature-card" class:wide={'wide' in feature && feature.wide}>
					<span class="feature-icon" aria-hidden="true">
						{#if feature.icon === 'cards'}
							<svg viewBox="0 0 24 24" fill="none">
								<rect x="3" y="6" width="14" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8" />
								<rect x="7" y="4" width="14" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8" />
							</svg>
						{:else if feature.icon === 'offline'}
							<svg viewBox="0 0 24 24" fill="none">
								<path
									d="M5 12.5c2.2-2.3 5-3.5 7-3.5s4.8 1.2 7 3.5M8.2 15.4A6.6 6.6 0 0 1 12 14.2c1.4 0 2.7.4 3.8 1.2M12 19.2v.01"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
								<path d="M4 20 20 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
							</svg>
						{:else if feature.icon === 'related'}
							<svg viewBox="0 0 24 24" fill="none">
								<circle cx="6.5" cy="6.5" r="2.4" stroke="currentColor" stroke-width="1.8" />
								<circle cx="17.5" cy="8.5" r="2.4" stroke="currentColor" stroke-width="1.8" />
								<circle cx="10.5" cy="17.5" r="2.4" stroke="currentColor" stroke-width="1.8" />
								<path
									d="M8.4 8.1 15.4 9.8M8.2 15.6 15.6 10.4"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
							</svg>
						{:else if feature.icon === 'sort'}
							<svg viewBox="0 0 24 24" fill="none">
								<path
									d="M8 5v14M8 5 5.5 8M8 5l2.5 3M16 19V5M16 19l-2.5-3M16 19l2.5-3"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						{:else if feature.icon === 'controller'}
							<svg viewBox="0 0 24 24" fill="none">
								<path
									d="M7.2 9.2h9.6A4.2 4.2 0 0 1 21 13.8c0 .7-.2 1.5-.7 2.1l-1.1 1.3a1.8 1.8 0 0 1-2.4.3l-2.2-1.6H9.4l-2.2 1.6a1.8 1.8 0 0 1-2.4-.3l-1.1-1.3A3.8 3.8 0 0 1 3 13.8 4.2 4.2 0 0 1 7.2 9.2Z"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linejoin="round"
								/>
								<path
									d="M8 12.2v2.4M6.8 13.4h2.4M15.2 12.8h.01M17.2 14.2h.01"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
							</svg>
						{:else if feature.icon === 'theme'}
							<svg viewBox="0 0 24 24" fill="none">
								<path
									d="M20 14.2A8 8 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2Z"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linejoin="round"
								/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none">
								<path
									d="M4 19V9.5M10 19V5M16 19v-7.5M22 19V8"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
								/>
							</svg>
						{/if}
					</span>
					<h3>{feature.title}</h3>
					<p>{feature.text}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="analytics" aria-labelledby="analytics-heading">
		<div class="container">
			<p class="section-eyebrow">Analytics</p>
			<h2 id="analytics-heading">Know exactly where you stand</h2>
			<p class="section-lede">
				Track JLPT kanji and vocabulary by level, search across your progress, see your weakest items, and
				see a level-up forecast based on your current reviews.
			</p>
			<div class="analytics-grid" aria-hidden="true">
				<article class="analytics-panel">
					<h3>JLPT coverage <em>Sample</em></h3>
					<ul class="coverage-list">
						{#each coverage as row (row.level)}
							<li>
								<span>{row.level}</span>
								<span class="coverage-track">
									<span class="coverage-fill" style="width: {row.value}%"></span>
								</span>
								<strong>{row.value}%</strong>
							</li>
						{/each}
					</ul>
				</article>
				<article class="analytics-panel">
					<h3>Weakest items <em>Sample</em></h3>
					<ul class="weakest-sample">
						{#each weakestSample as item (item.glyph)}
							<li>
								<strong lang="ja">{item.glyph}</strong>
								<span>{item.meaning}</span>
								<b>{item.rate}%</b>
							</li>
						{/each}
					</ul>
					<p>Lowest lifetime accuracy from your WaniKani stats.</p>
				</article>
				<article class="analytics-panel forecast">
					<h3>Level-up forecast <em>Sample</em></h3>
					<p class="forecast-label">Level 12 → 13</p>
					<strong>About 6 days</strong>
					<p>Based on current-level kanji and your recent review pace.</p>
				</article>
			</div>
		</div>
	</section>

	<section class="container steps" aria-labelledby="steps-heading">
		<p class="section-eyebrow">Getting started</p>
		<h2 id="steps-heading">Up and running in a minute</h2>
		<ol class="step-list">
			{#each steps as step, index (step.title)}
				<li class="step">
					<span class="step-number">{index + 1}</span>
					<div>
						<h3>{step.title}</h3>
						<p>{step.text}</p>
					</div>
				</li>
			{/each}
		</ol>
		<div class="cta-row centered">
			<a class="button primary" href="/settings">Get started</a>
		</div>
		<p class="token-link">
			Need a token? Create one at
			<a href="https://www.wanikani.com/settings/personal_access_tokens" target="_blank" rel="noopener noreferrer"
				>WaniKani’s personal access tokens page</a
			>.
		</p>
	</section>

</div>

<style>
	.landing {
		display: flex;
		flex-direction: column;
		width: 100%;
		overflow: hidden;
	}

	.hero {
		position: relative;
		isolation: isolate;
		padding: clamp(3.5rem, 9vw, 7rem) 0 clamp(3rem, 7vw, 5.5rem);
	}

	.aurora,
	.floater-field {
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		overflow: hidden;
	}

	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(90px);
		opacity: 0.55;
	}

	:global(:root[data-theme='light']) .orb {
		opacity: 0.3;
	}

	.orb-a {
		width: 32rem;
		height: 32rem;
		top: -12rem;
		left: -10rem;
		background: #1d4ed8;
	}

	.orb-b {
		width: 26rem;
		height: 26rem;
		top: 4rem;
		right: -8rem;
		background: #7c3aed;
	}

	.orb-c {
		width: 18rem;
		height: 18rem;
		bottom: -4rem;
		left: 35%;
		background: #db2777;
		opacity: 0.28;
	}

	.floater {
		position: absolute;
		color: rgb(var(--contrast) / 7%);
		font-size: clamp(2.4rem, 6vw, 4.5rem);
		font-weight: 700;
		line-height: 1;
		animation: drift 18s ease-in-out infinite;
		animation-delay: calc(var(--i) * -1.4s);
	}

	.floater:nth-child(1) { top: 8%; left: 6%; }
	.floater:nth-child(2) { top: 18%; left: 22%; }
	.floater:nth-child(3) { top: 6%; left: 48%; }
	.floater:nth-child(4) { top: 22%; left: 72%; }
	.floater:nth-child(5) { top: 42%; left: 8%; }
	.floater:nth-child(6) { top: 58%; left: 28%; }
	.floater:nth-child(7) { top: 48%; left: 58%; }
	.floater:nth-child(8) { top: 62%; left: 80%; }
	.floater:nth-child(9) { top: 78%; left: 12%; }
	.floater:nth-child(10) { top: 82%; left: 40%; }
	.floater:nth-child(11) { top: 76%; left: 66%; }
	.floater:nth-child(12) { top: 36%; left: 88%; }

	.hero-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.95fr);
		align-items: center;
		gap: clamp(2rem, 5vw, 4rem);
	}

	.eyebrow,
	.section-eyebrow {
		margin: 0 0 1rem;
		color: var(--accent-hover);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.8rem, 7vw, 5.2rem);
		line-height: 0.96;
		letter-spacing: -0.045em;
	}

	.gradient-text {
		display: block;
		background: linear-gradient(120deg, #60a5fa 0%, #c084fc 45%, #fb7185 100%);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.lede,
	.section-lede {
		margin: 1.35rem 0 0;
		max-width: 36rem;
		color: var(--muted);
		font-size: 1.15rem;
		line-height: 1.65;
	}

	.cta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 2.1rem;
	}

	.cta-row.centered {
		justify-content: center;
	}

	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.85rem 1.45rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface-alt) 70%, transparent);
		color: var(--text);
		font-weight: 600;
		backdrop-filter: blur(8px);
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			border-color 0.15s ease;
	}

	.button:hover,
	.button:focus-visible {
		text-decoration: none;
		transform: translateY(-1px);
		border-color: var(--accent-hover);
	}

	.button.primary {
		border-color: transparent;
		background: linear-gradient(120deg, #2563eb, #7c3aed);
		box-shadow: 0 14px 36px -12px rgb(59 130 246 / 80%);
		color: #fff;
	}

	.fine-print {
		margin: 1rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.stat-row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		margin: 2rem 0 0;
	}

	.stat-row div {
		padding-top: 0.85rem;
		border-top: 1px solid rgb(var(--contrast) / 10%);
	}

	.stat-row dt {
		color: var(--text);
		font-size: 0.95rem;
		font-weight: 700;
	}

	.stat-row dd {
		margin: 0.25rem 0 0;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.hero-stage {
		position: relative;
		min-height: 28rem;
	}

	.stack-card,
	.demo-card {
		position: absolute;
	}

	.stack-card {
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 0.35rem;
		width: 9.5rem;
		aspect-ratio: 18.5 / 22.5;
		padding: 1rem;
		border: 1px solid rgb(var(--contrast) / 10%);
		border-radius: 22px;
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--card-start) 92%, transparent),
			color-mix(in srgb, var(--card-end) 96%, transparent)
		);
		box-shadow: 0 24px 50px -24px rgb(0 0 0 / 80%);
	}

	.stack-card.radical {
		--kind: #00aaff;
		border-color: color-mix(in srgb, var(--kind) 72%, transparent);
		top: 1.2rem;
		left: 0;
		transform: rotate(-14deg);
	}

	.stack-card.vocab {
		--kind: #a100f1;
		border-color: color-mix(in srgb, var(--kind) 72%, transparent);
		right: 0.4rem;
		bottom: 1.4rem;
		transform: rotate(12deg);
	}

	.stack-card strong {
		align-self: center;
		justify-self: center;
		font-size: 2.6rem;
		line-height: 1;
	}

	.kind {
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.kind.kanji {
		color: #f100a1;
	}

	.stack-card.radical .kind {
		color: #00aaff;
	}

	.stack-card.vocab .kind {
		color: #a100f1;
	}

	.demo-card {
		top: 50%;
		left: 50%;
		width: min(100%, 18.5rem);
		height: 22.5rem;
		perspective: 1100px;
		transform: translate(-50%, -52%) rotate(-2deg);
		animation: float 7s ease-in-out infinite;
	}

	.demo-inner {
		--kind: #f100a1;
		position: relative;
		width: 100%;
		height: 100%;
		border: 1px solid color-mix(in srgb, var(--kind) 72%, transparent);
		border-radius: 22px;
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--card-start) 98%, transparent),
			color-mix(in srgb, var(--card-end) 98%, transparent)
		);
		box-shadow: 0 24px 50px -24px rgb(0 0 0 / 80%);
		transform-style: preserve-3d;
		animation: flip 7.5s ease-in-out infinite;
	}

	.demo-face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		padding: 1.3rem;
		border-radius: 22px;
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--card-start) 98%, transparent),
			color-mix(in srgb, var(--card-end) 98%, transparent)
		);
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	.demo-face.back {
		transform: rotateY(180deg);
	}

	.demo-meta,
	.pips,
	.chips {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.pips {
		width: 5.4rem;
	}

	.pips i {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: #f100a1;
	}

	.pips i.off {
		background: var(--border);
	}

	.glyph {
		flex: 1;
		display: grid;
		place-items: center;
		font-size: 7rem;
		line-height: 1;
		text-shadow: 0 0 48px rgb(241 0 161 / 28%);
	}

	.prompt {
		color: var(--muted);
		font-size: 0.92rem;
		text-align: center;
	}

	.answers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin: auto 0;
	}

	.answers div,
	.mini-card {
		display: grid;
		gap: 0.2rem;
		padding: 0.85rem;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
	}

	.answers span {
		color: var(--muted);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.answers strong {
		font-size: 1.15rem;
	}

	.chip {
		flex: 1;
		padding: 0.5rem;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 700;
		text-align: center;
	}

	.chip.good {
		background: rgb(63 191 106 / 18%);
		color: var(--good);
	}

	.chip.bad {
		background: rgb(229 72 77 / 18%);
		color: var(--bad);
	}

	.compare {
		padding: clamp(2.5rem, 6vw, 4.5rem) 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		background:
			linear-gradient(180deg, rgb(var(--contrast) / 2%), transparent 40%),
			var(--surface);
	}

	.compare h2,
	.features h2,
	.analytics h2,
	.steps h2 {
		margin: 0;
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		letter-spacing: -0.03em;
	}

	.compare-grid {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1.25rem;
		margin-top: 2rem;
	}

	.compare-col {
		display: grid;
		gap: 0.75rem;
		margin: 0;
	}

	.compare-col.faded {
		opacity: 0.72;
	}

	:global(:root[data-theme='light']) .compare-col.faded {
		opacity: 0.9;
	}

	.compare-col figcaption {
		color: var(--muted);
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.mini-card {
		justify-items: start;
	}

	.mini-card strong {
		font-size: 2.4rem;
		line-height: 1;
	}

	.mini-card em {
		color: var(--muted);
		font-style: normal;
	}

	.mini-card.highlight {
		border-color: rgb(241 0 161 / 40%);
		box-shadow: 0 0 0 1px rgb(241 0 161 / 18%);
	}

	.compare-plus {
		color: var(--accent-hover);
		font-size: 1.8rem;
		font-weight: 700;
	}

	.analytics {
		padding: clamp(3rem, 6vw, 5rem) 0;
		border-top: 1px solid var(--border);
		background:
			radial-gradient(circle at 0% 0%, rgb(124 58 237 / 12%), transparent 36%),
			var(--surface);
	}

	.analytics-grid {
		display: grid;
		grid-template-columns: 1.15fr 1fr 0.9fr;
		gap: 1rem;
		margin-top: 2rem;
	}

	.analytics-panel {
		padding: 1.35rem;
		border: 1px solid var(--border);
		border-radius: 18px;
		background: var(--bg);
	}

	.analytics-panel h3 {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 0 0 1rem;
		font-size: 0.95rem;
	}

	.analytics-panel h3 em,
	.analytics-panel p {
		color: var(--muted);
		font-size: 0.75rem;
		font-style: normal;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.analytics-panel p {
		margin: 0.85rem 0 0;
		font-weight: 400;
		letter-spacing: 0;
		text-transform: none;
		line-height: 1.45;
	}

	.coverage-list {
		display: grid;
		gap: 0.7rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.coverage-list li {
		display: grid;
		grid-template-columns: 1.6rem 1fr 2.4rem;
		align-items: center;
		gap: 0.65rem;
		font-size: 0.85rem;
	}

	.coverage-list strong {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.coverage-track {
		height: 0.45rem;
		border-radius: 999px;
		background: var(--border);
		overflow: hidden;
	}

	.coverage-fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #2563eb, #7c3aed);
	}

	.weakest-sample {
		display: grid;
		gap: 0.55rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.weakest-sample li {
		display: grid;
		grid-template-columns: 1.6rem 1fr auto;
		align-items: center;
		gap: 0.65rem;
		font-size: 0.85rem;
	}

	.weakest-sample strong {
		font-size: 1.15rem;
	}

	.weakest-sample span {
		color: var(--muted);
	}

	.weakest-sample b {
		color: #c084fc;
		font-variant-numeric: tabular-nums;
	}

	.forecast strong {
		display: block;
		font-size: 2rem;
		letter-spacing: -0.03em;
	}

	.forecast .forecast-label {
		margin: 0 0 0.35rem;
		color: #c084fc;
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.features,
	.steps {
		padding-top: clamp(3rem, 6vw, 5rem);
		padding-bottom: clamp(2rem, 4vw, 3rem);
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 2rem;
	}

	.feature-icon {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		margin-bottom: 0.9rem;
		border: 1px solid rgb(96 165 250 / 22%);
		border-radius: 12px;
		background: rgb(59 130 246 / 12%);
		color: var(--accent-hover);
	}

	.feature-icon svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	.feature-card {
		padding: 1.45rem;
		border: 1px solid var(--border);
		border-radius: 18px;
		background: var(--surface);
		transition:
			transform 0.2s ease,
			border-color 0.2s ease;
	}

	.feature-card.wide {
		grid-column: span 2;
		background:
			radial-gradient(circle at 100% 0%, rgb(59 130 246 / 16%), transparent 42%),
			var(--surface);
	}

	.feature-card:hover {
		transform: translateY(-3px);
		border-color: rgb(96 165 250 / 45%);
	}

	.feature-card h3,
	.step h3 {
		margin: 0 0 0.4rem;
		font-size: 1.05rem;
	}

	.feature-card p,
	.step p {
		margin: 0;
		color: var(--muted);
		line-height: 1.55;
	}

	.step-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.25rem;
		margin: 2rem 0 0;
		padding: 0;
		list-style: none;
	}

	.step {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.step-number {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 50%;
		background: linear-gradient(120deg, #2563eb, #7c3aed);
		color: #fff;
		font-weight: 800;
	}

	.token-link {
		margin: 1.25rem 0 0;
		color: var(--muted);
		font-size: 0.9rem;
		text-align: center;
	}

	@keyframes drift {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-16px);
		}
	}

	@keyframes float {
		0%,
		100% {
			transform: translate(-50%, -52%) rotate(-2deg);
		}
		50% {
			transform: translate(-50%, -56%) rotate(-0.5deg);
		}
	}

	@keyframes flip {
		0%,
		38% {
			transform: rotateY(0deg);
		}
		50%,
		88% {
			transform: rotateY(180deg);
		}
		100% {
			transform: rotateY(360deg);
		}
	}

	@media (max-width: 900px) {
		.hero-grid,
		.feature-grid,
		.step-list,
		.compare-grid,
		.stat-row,
		.analytics-grid {
			grid-template-columns: 1fr;
		}

		.feature-card.wide {
			grid-column: auto;
		}

		.compare-plus {
			justify-self: center;
			transform: rotate(90deg);
		}

		.hero-stage {
			min-height: 24rem;
		}

		.glyph {
			font-size: 5.4rem;
		}
	}

	@media (max-width: 560px) {
		.stack-card {
			display: none;
		}

		.demo-card {
			width: min(100%, 17rem);
			height: 21rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.floater,
		.demo-card,
		.demo-inner,
		.feature-card,
		.button {
			animation: none;
			transition: none;
		}

		.demo-face.back {
			display: none;
		}
	}
</style>
