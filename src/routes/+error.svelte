<script lang="ts">
	import { page } from '$app/state';

	const notFound = $derived(page.status === 404);
	const heading = $derived(notFound ? 'This page drifted off the map' : 'Something went wrong');
	const message = $derived(
		notFound
			? "The page you're looking for doesn't exist, or it may have moved."
			: (page.error?.message ?? 'An unexpected error occurred. Try again in a moment.')
	);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Error'} · WK Flash</title>
</svelte:head>

<section class="error-page" aria-labelledby="error-heading">
	<div class="container">
		<div class="code-wrap" aria-hidden="true">
			<p class="code">{page.status}</p>
			<span class="glyph">迷</span>
		</div>
		<h1 id="error-heading">{heading}</h1>
		<p class="message">{message}</p>

		<div class="cta-row">
			<a class="button primary" href="/">Back to home</a>
			<a class="button" href="/how-it-works">How it works</a>
			<a class="button" href="/jlpt">JLPT levels</a>
		</div>
	</div>
</section>

<style>
	.error-page {
		position: relative;
		overflow: hidden;
		display: grid;
		min-height: 62vh;
		place-items: center;
		padding: 4rem 0;
		text-align: center;
		isolation: isolate;
	}

	.error-page::before {
		content: '';
		position: absolute;
		inset: -20% -10% auto;
		height: 70%;
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--accent) 22%, transparent),
			transparent 70%
		);
		z-index: -1;
		pointer-events: none;
	}

	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.code-wrap {
		position: relative;
		display: grid;
		place-items: center;
	}

	.code {
		margin: 0;
		font-size: clamp(6rem, 22vw, 11rem);
		font-weight: 800;
		line-height: 0.9;
		letter-spacing: -0.04em;
		background: linear-gradient(120deg, #2563eb, #7c3aed);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.glyph {
		position: absolute;
		font-size: clamp(3rem, 9vw, 4.5rem);
		font-weight: 700;
		color: color-mix(in srgb, var(--text) 9%, transparent);
		user-select: none;
		pointer-events: none;
	}

	h1 {
		margin: 1.5rem 0 0;
		font-size: clamp(1.6rem, 4vw, 2.25rem);
		line-height: 1.2;
	}

	.message {
		max-width: 34rem;
		margin: 0.9rem 0 0;
		color: var(--muted);
		line-height: 1.6;
	}

	.cta-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 2rem;
	}

	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.8rem 1.35rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface-alt) 70%, transparent);
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
		transition:
			transform 0.15s ease,
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

	.button.primary:hover,
	.button.primary:focus-visible {
		color: #fff;
	}

	@media (prefers-reduced-motion: reduce) {
		.button {
			transition: none;
		}

		.button:hover,
		.button:focus-visible {
			transform: none;
		}
	}
</style>
