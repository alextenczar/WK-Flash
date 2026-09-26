<script lang="ts">
	import { keybindings, type Keybindings } from '$lib/keybindings';

	const actions: { key: keyof Keybindings; label: string; hint: string }[] = [
		{ key: 'flip', label: 'Flip card', hint: 'Reveals the meaning and reading.' },
		{ key: 'correct', label: 'Mark correct', hint: 'Only active once the card is flipped.' },
		{ key: 'wrong', label: 'Mark wrong', hint: 'Only active once the card is flipped; requeues the card.' }
	];

	let listeningFor = $state<keyof Keybindings | null>(null);

	function startListening(action: keyof Keybindings) {
		listeningFor = action;
	}

	function handleKeydown(e: KeyboardEvent, action: keyof Keybindings) {
		e.preventDefault();
		if (e.key === 'Escape') {
			listeningFor = null;
			return;
		}
		keybindings.setBinding(action, e.key.length === 1 ? e.key.toLowerCase() : e.key);
		listeningFor = null;
	}
</script>

<div class="container">
	<h1>Keybindings</h1>
	<p class="muted">
		Click a binding, then press the key you want to use. Press Escape to cancel.
	</p>

	<div class="list">
		{#each actions as action (action.key)}
			<div class="row">
				<div>
					<div class="label">{action.label}</div>
					<div class="hint">{action.hint}</div>
				</div>
				<button
					class="key"
					class:listening={listeningFor === action.key}
					onclick={() => startListening(action.key)}
					onkeydown={(e) => listeningFor === action.key && handleKeydown(e, action.key)}
				>
					{listeningFor === action.key ? 'Press a key...' : $keybindings[action.key]}
				</button>
			</div>
		{/each}
	</div>

	<button onclick={() => keybindings.reset()}>Reset to defaults</button>
</div>

<style>
	.muted {
		color: var(--muted);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1.5rem 0;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.9rem 1.1rem;
	}

	.label {
		font-weight: 600;
	}

	.hint {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.key {
		min-width: 9rem;
		text-transform: uppercase;
		font-family: monospace;
	}

	.key.listening {
		border-color: var(--accent);
		color: var(--accent);
		text-transform: none;
		font-family: inherit;
	}
</style>
