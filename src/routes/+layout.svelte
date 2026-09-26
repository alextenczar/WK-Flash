<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<nav class="container">
		<a href="/" class="brand">WK Flash</a>
		<div class="links">
			<a href="/keybindings">Keybindings</a>
			<a href="/settings">Settings</a>
		</div>
	</nav>
</header>

<main>
	{@render children()}
</main>

<style>
	header {
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}

	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 1rem;
		padding-bottom: 1rem;
	}

	.links {
		display: flex;
		gap: 1.25rem;
	}

	.brand {
		font-weight: 700;
		font-size: 1.1rem;
		text-decoration: none;
		color: var(--text);
	}
</style>
