<script lang="ts">
	// Decorative illustrations for the how-it-works timeline. Drawn inline so they need no image assets.
	// `visible` turns true once the step first scrolls into view. The drawing settles in once and stays still.
	export type ArtKind = 'connect' | 'queue' | 'answer' | 'sync' | 'track';

	let { kind, visible = false }: { kind: ArtKind; visible?: boolean } = $props();
</script>

<svg class="art" class:visible viewBox="0 0 320 150" aria-hidden="true" focusable="false">
	<defs>
		<linearGradient id={`g-${kind}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="320" y2="150">
			<stop offset="0" stop-color="#60a5fa" />
			<stop offset="1" stop-color="#c084fc" />
		</linearGradient>
	</defs>

	{#if kind === 'connect'}
		<rect x="36" y="28" width="184" height="100" rx="12" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5" />
		<circle cx="54" cy="44" r="4" fill="#fb7185" />
		<circle cx="68" cy="44" r="4" fill="#fbbf24" />
		<circle cx="82" cy="44" r="4" fill="#3fbf6a" />
		<rect x="56" y="62" width="112" height="10" rx="5" fill="var(--border)" />
		<rect x="56" y="80" width="86" height="10" rx="5" fill="var(--border)" />
		<rect x="56" y="100" width="62" height="16" rx="8" fill={`url(#g-${kind})`} />
		<circle cx="250" cy="75" r="15" fill="none" stroke={`url(#g-${kind})`} stroke-width="6" />
		<path d="M265 75H300M286 75v12M298 75v10" fill="none" stroke={`url(#g-${kind})`} stroke-width="6" stroke-linecap="round" />
	{:else if kind === 'queue'}
		{#each [0, 1, 2, 3] as row (row)}
			<g class="row" style="--i: {row}">
				<rect
					x="40"
					y={18 + row * 30}
					width="240"
					height="24"
					rx="8"
					fill="var(--surface)"
					stroke={row === 0 ? `url(#g-${kind})` : 'var(--border)'}
					stroke-width={row === 0 ? 1.5 : 1}
				/>
				<circle cx="56" cy={30 + row * 30} r="5" fill={row === 0 ? `url(#g-${kind})` : 'var(--border)'} />
				<rect x="70" y={26 + row * 30} width={[150, 110, 176, 92][row]} height="8" rx="4" fill="var(--muted)" opacity="0.45" />
			</g>
		{/each}
		<rect x="206" y="20" width="62" height="18" rx="9" fill={`url(#g-${kind})`} />
		<text x="237" y="33" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">due now</text>
		<path d="M292 40v64M286 98l6 6 6-6" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6" />
	{:else if kind === 'answer'}
		<rect x="40" y="36" width="92" height="76" rx="12" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5" transform="rotate(-8 86 74)" />
		<rect x="110" y="20" width="100" height="108" rx="14" fill="var(--surface)" stroke={`url(#g-${kind})`} stroke-width="2" />
		<text x="160" y="92" text-anchor="middle" font-size="46" font-family="'Noto Sans JP', sans-serif" fill="var(--text)">日</text>
		<path d="M226 40C270 44 274 98 236 112" fill="none" stroke={`url(#g-${kind})`} stroke-width="3" stroke-linecap="round" />
		<polygon points="228,108 224,96 240,102" fill={`url(#g-${kind})`} />
		<g class="mark wrong-mark">
			<circle cx="56" cy="122" r="13" fill="none" stroke="var(--bad)" stroke-width="2.5" />
			<path d="M51 117l10 10M61 117l-10 10" stroke="var(--bad)" stroke-width="2.5" stroke-linecap="round" />
		</g>
		<g class="mark right-mark">
			<circle cx="264" cy="122" r="13" fill="none" stroke="var(--good)" stroke-width="2.5" />
			<path d="M258 122l4 4 8-8" fill="none" stroke="var(--good)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
		</g>
	{:else if kind === 'sync'}
		<rect x="36" y="28" width="54" height="96" rx="10" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5" />
		<rect x="46" y="44" width="34" height="6" rx="3" fill="var(--border)" />
		<rect x="46" y="58" width="24" height="6" rx="3" fill="var(--border)" />
		<rect x="46" y="72" width="30" height="6" rx="3" fill="var(--border)" />
		<circle cx="84" cy="30" r="11" fill={`url(#g-${kind})`} />
		<text x="84" y="34" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">3</text>
		<path d="M104 76H206" fill="none" stroke={`url(#g-${kind})`} stroke-width="2.5" stroke-dasharray="6 6" stroke-linecap="round" />
		<polygon points="206,68 218,76 206,84" fill={`url(#g-${kind})`} />
		<path d="M226 104H292A20 20 0 0 0 292 64A26 26 0 0 0 246 56A18 18 0 0 0 226 104Z" fill="var(--surface)" stroke={`url(#g-${kind})`} stroke-width="2" />
		<path class="check" pathLength="1" d="M250 84l8 8 14-16" fill="none" stroke="var(--good)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
	{:else if kind === 'track'}
		<path d="M40 122H282" stroke="var(--border)" stroke-width="1.5" />
		{#each [20, 36, 50, 64, 78] as height, index (index)}
			<rect
				class="bar"
				style="--i: {index}"
				x={58 + index * 40}
				y={122 - height}
				width="22"
				height={height}
				rx="5"
				fill={`url(#g-${kind})`}
				opacity={0.35 + index * 0.13}
			/>
		{/each}
		<polyline class="trend" pathLength="1" points="69,96 109,86 149,72 189,58 229,44 262,28" fill="none" stroke={`url(#g-${kind})`} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
		<circle cx="262" cy="28" r="5" fill="#fb7185" />
	{/if}
</svg>

<style>
	.art {
		display: block;
		width: 100%;
		max-width: 360px;
		height: auto;
		margin: 0 auto;
	}

	/* Each drawing settles in once, when its step first appears. Nothing loops. */
	.art.visible {
		animation: settle 0.5s ease-out both;
	}

	.art.visible .row {
		animation: fade-in 0.4s ease-out both;
		animation-delay: calc(var(--i) * 60ms + 120ms);
	}

	.art.visible .mark {
		animation: fade-in 0.4s ease-out 0.3s both;
	}

	.art.visible .right-mark {
		animation-delay: 0.45s;
	}

	.art.visible .bar {
		transform-box: fill-box;
		transform-origin: bottom;
		animation: grow 0.6s ease-out both;
		animation-delay: calc(var(--i) * 70ms + 100ms);
	}

	.art.visible .trend,
	.art.visible .check {
		animation: draw 0.8s ease-out 0.25s both;
	}

	.trend,
	.check {
		stroke-dasharray: 1 1;
	}

	@keyframes settle {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}

	@keyframes grow {
		from {
			transform: scaleY(0);
		}
	}

	@keyframes draw {
		from {
			stroke-dashoffset: 1;
		}
		to {
			stroke-dashoffset: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.art,
		.art * {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
