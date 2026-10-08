<script lang="ts">
	import { goto } from '$app/navigation';
	import { keybindings, type Keybindings } from '$lib/keybindings';
	import { apiKey } from '$lib/storage';
	import {
		prioritizeCurrentLevel,
		interweaveLocalN1Reviews,
		reviewSort,
		reviewSortOptions,
		showMnemonics,
		showPartsOfSpeech,
		showSrsChanges,
		showTimeEstimate,
		showUndoButton,
		type ReviewSortOrder
	} from '$lib/review-preferences';
	import { clearReviewSession } from '$lib/review-session';
	import { reviewAudioSettings } from '$lib/review-audio';
	import { clearCachedReviewQueue, getUser, WaniKaniError } from '$lib/wanikani/api';

	let input = $state($apiKey);
	let checking = $state(false);
	let error = $state('');
	let success = $state('');
	let listeningFor = $state<keyof Keybindings | null>(null);

	const keybindingActions: { key: keyof Keybindings; label: string; hint: string }[] = [
		{ key: 'flip', label: 'Flip card', hint: 'Reveals the meaning and reading.' },
		{ key: 'correct', label: 'Mark correct', hint: 'Only active once the card is flipped.' },
		{ key: 'wrong', label: 'Mark wrong', hint: 'Only active once the card is flipped; requeues the card.' }
	];

	function startListening(action: keyof Keybindings) {
		listeningFor = action;
	}

	function handleKeydown(event: KeyboardEvent, action: keyof Keybindings) {
		event.preventDefault();
		if (event.key === 'Escape') {
			listeningFor = null;
			return;
		}
		keybindings.setBinding(action, event.key.length === 1 ? event.key.toLowerCase() : event.key);
		listeningFor = null;
	}

	async function save() {
		error = '';
		success = '';
		const value = input.trim();
		if (!value) {
			error = 'Please enter an API key.';
			return;
		}

		checking = true;
		try {
			const user = await getUser(value);
			if ($apiKey !== value) {
				clearReviewSession();
				await clearCachedReviewQueue();
			}
			apiKey.set(value);
			success = `Connected as ${user.username}. Redirecting...`;
			setTimeout(() => goto('/'), 800);
		} catch (e) {
			error = e instanceof WaniKaniError ? e.message : 'Could not verify this API key.';
		} finally {
			checking = false;
		}
	}

	function clear() {
		clearReviewSession();
		void clearCachedReviewQueue();
		apiKey.clear();
		input = '';
		success = '';
		error = '';
	}
</script>

<div class="container">
	<h1>Settings</h1>
	<p>
		Enter a WaniKani personal access token. You can generate one from your
		<a href="https://www.wanikani.com/settings/personal_access_tokens" target="_blank" rel="noopener noreferrer"
			>WaniKani account settings</a
		>. It only needs the default read/write review scopes.
	</p>
	<p class="muted">The key is stored only in this browser and never sent anywhere but WaniKani's API.</p>

	<form onsubmit={(e) => { e.preventDefault(); save(); }}>
		<label for="api-key">API key</label>
		<input
			id="api-key"
			type="password"
			autocomplete="off"
			bind:value={input}
			placeholder="00000000-0000-0000-0000-000000000000"
		/>
		<div class="actions">
			<button type="submit" class="primary" disabled={checking}>
				{checking ? 'Checking...' : 'Save & Connect'}
			</button>
			{#if $apiKey}
				<button type="button" onclick={clear}>Remove key</button>
			{/if}
		</div>
	</form>

	<section class="preferences" aria-labelledby="review-sort-heading">
		<h2 id="review-sort-heading">Review order</h2>
		<label class="review-sort-setting" for="review-sort">
			<span>Sort due reviews</span>
			<select id="review-sort" value={$reviewSort} onchange={(event) => reviewSort.set(event.currentTarget.value as ReviewSortOrder)}>
				{#each reviewSortOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</label>
		<label class="toggle">
			<input
				type="checkbox"
				checked={$prioritizeCurrentLevel}
				onchange={(event) => prioritizeCurrentLevel.set(event.currentTarget.checked)}
			/>
			Prioritize items from my current WaniKani level
		</label>
		<label class="toggle">
			<input
				type="checkbox"
				checked={$interweaveLocalN1Reviews}
				onchange={(event) => interweaveLocalN1Reviews.set(event.currentTarget.checked)}
			/>
			Interweave additional non-WaniKani N1 kanji and vocabulary into reviews
		</label>
		<p class="muted">
			Local JLPT cards are stored and scheduled only on this device. They are never submitted to WaniKani.
		</p>
		<p class="muted">Current-level items come first; the selected sort applies within each group. New queues and newly due items use these settings; saved sessions keep their current order.</p>
	</section>

	<section class="preferences">
		<h2>Review preferences</h2>
		<label class="toggle">
			<input
				type="checkbox"
				checked={$showMnemonics}
				onchange={(event) => showMnemonics.set(event.currentTarget.checked)}
			/>
			Show mnemonics on card backs
		</label>
		<label class="toggle">
			<input
				type="checkbox"
				checked={$showPartsOfSpeech}
				onchange={(event) => showPartsOfSpeech.set(event.currentTarget.checked)}
			/>
			Show part-of-speech labels on card backs
		</label>
		<label class="toggle">
			<input
				type="checkbox"
				checked={$showSrsChanges}
				onchange={(event) => showSrsChanges.set(event.currentTarget.checked)}
			/>
			Show SRS level changes after answering
		</label>
		<label class="toggle">
			<input
				type="checkbox"
				checked={$showTimeEstimate}
				onchange={(event) => showTimeEstimate.set(event.currentTarget.checked)}
			/>
			Show estimated time remaining on the review progress bar
		</label>
		<label class="toggle">
			<input
				type="checkbox"
				checked={$showUndoButton}
				onchange={(event) => showUndoButton.set(event.currentTarget.checked)}
			/>
			Show an undo button for the previous review question
		</label>
		<label class="toggle">
			<input
				type="checkbox"
				checked={$reviewAudioSettings.autoplayAfterAnswer}
				onchange={(event) => reviewAudioSettings.update({ autoplayAfterAnswer: event.currentTarget.checked })}
			/>
			Play pronunciation after answering a review or revealing a lesson
		</label>
		<label class="volume-setting" for="audio-volume">
			<span>Pronunciation volume</span>
			<span class="volume-value">{Math.round($reviewAudioSettings.volume * 100)}%</span>
			<input
				id="audio-volume"
				type="range"
				min="0"
				max="1"
				step="0.05"
				value={$reviewAudioSettings.volume}
				oninput={(event) => reviewAudioSettings.update({ volume: Number(event.currentTarget.value) })}
			/>
		</label>
		<p class="muted audio-note">On iPhone, audio may not play while Silent mode is on.</p>
	</section>

	<section class="preferences" id="keybindings">
		<h2>Keybindings</h2>
		<p class="muted">Select a binding, then press the key you want. Press Escape to cancel.</p>
		<div class="keybinding-list">
			{#each keybindingActions as action (action.key)}
				<div class="keybinding-row">
					<div>
						<div class="keybinding-label">{action.label}</div>
						<div class="keybinding-hint">{action.hint}</div>
					</div>
					<button
						type="button"
						class="keybinding-key"
						class:listening={listeningFor === action.key}
						onclick={() => startListening(action.key)}
						onkeydown={(event) => listeningFor === action.key && handleKeydown(event, action.key)}
					>
						{listeningFor === action.key ? 'Press a key...' : $keybindings[action.key]}
					</button>
				</div>
			{/each}
		</div>
		<button type="button" onclick={() => keybindings.reset()}>Reset to defaults</button>
	</section>

	{#if error}<p class="error">{error}</p>{/if}
	{#if success}<p class="success">{success}</p>{/if}
</div>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 480px;
		margin-top: 1rem;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
	}

	.preferences {
		margin-top: 2rem;
		max-width: 480px;
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	.preferences h2 {
		font-size: 1.1rem;
	}

	.keybinding-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1.25rem 0;
	}

	.keybinding-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--border);
	}

	.keybinding-label {
		font-weight: 600;
	}

	.keybinding-hint {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.keybinding-key {
		min-width: 6rem;
		text-transform: uppercase;
		font-family: monospace;
	}

	.keybinding-key.listening {
		border-color: var(--accent);
		color: var(--accent);
		text-transform: none;
		font-family: inherit;
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.toggle input {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--accent);
	}

	.review-sort-setting {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.review-sort-setting + .toggle {
		margin-top: 1rem;
	}

	.review-sort-setting select {
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
	}

	.volume-setting {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.5rem 1rem;
		margin-top: 1rem;
	}

	.volume-setting input {
		grid-column: 1 / -1;
		width: 100%;
		accent-color: var(--accent);
	}

	.volume-value {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.audio-note {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
	}

	.muted {
		color: var(--muted);
	}

	.error {
		color: var(--bad);
	}

	.success {
		color: var(--good);
	}
</style>
