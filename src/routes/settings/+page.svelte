<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		gamepadBindings,
		gamepadButtonLabel,
		keyboardKeyLabel,
		keybindings,
		type Keybindings
	} from '$lib/keybindings';
	import { gamepadConnected, startGamepadPolling } from '$lib/gamepad';
	import { apiKey } from '$lib/storage';
	import {
		prioritizeCurrentLevel,
		interweaveLocalN1Reviews,
		reviewSort,
		sortDirectionLabel,
		sortFieldOptions,
		showMnemonics,
		showPartsOfSpeech,
		showSrsChanges,
		showTimeEstimate,
		showUndoButton,
		type PrimarySortChoice,
		type SortDirection,
		type SortField
	} from '$lib/review-preferences';
	import { clearReviewSession } from '$lib/review-session';
	import { reviewAudioSettings } from '$lib/review-audio';
	import { theme, type ThemeMode } from '$lib/theme';
	import { clearCachedReviewQueue, getUser, WaniKaniError } from '$lib/wanikani/api';

	const primaryField = $derived<SortField | null>(
		typeof $reviewSort.primary === 'string' ? null : $reviewSort.primary.field
	);
	const primaryChoice = $derived<PrimarySortChoice>(
		typeof $reviewSort.primary === 'string' ? $reviewSort.primary : $reviewSort.primary.field
	);
	const primaryDirection = $derived<SortDirection>(
		typeof $reviewSort.primary === 'string' ? 'ascending' : $reviewSort.primary.direction
	);
	const secondaryField = $derived<SortField | null>($reviewSort.secondary?.field ?? null);
	const secondaryDirection = $derived<SortDirection>($reviewSort.secondary?.direction ?? 'ascending');
	/** "Then by" only applies when there is a field to sort by first. */
	const secondaryEnabled = $derived(primaryField !== null);
	const secondaryOptions = $derived(sortFieldOptions.filter((option) => option.value !== primaryField));

	let input = $state($apiKey);
	let checking = $state(false);
	let error = $state('');
	let success = $state('');
	/** Which binding is waiting for input: a keyboard key or a controller button. */
	let listening = $state<{ kind: 'key' | 'pad'; action: keyof Keybindings } | null>(null);

	const keybindingActions: { key: keyof Keybindings; label: string; hint: string }[] = [
		{ key: 'flip', label: 'Flip card', hint: 'Reveals the meaning and reading.' },
		{ key: 'correct', label: 'Mark correct', hint: 'Only active once the card is flipped.' },
		{ key: 'wrong', label: 'Mark wrong', hint: 'Only active once the card is flipped; requeues the card.' },
		{ key: 'moreInfo', label: 'More information', hint: 'Shows related items. Only active once the card is flipped.' },
		{ key: 'undo', label: 'Undo', hint: 'Returns to the previous question. Needs the undo button option turned on.' }
	];

	function isListening(kind: 'key' | 'pad', action: keyof Keybindings) {
		return listening?.kind === kind && listening.action === action;
	}

	function toggleListening(kind: 'key' | 'pad', action: keyof Keybindings) {
		listening = isListening(kind, action) ? null : { kind, action };
	}

	function handleKeydown(event: KeyboardEvent, action: keyof Keybindings) {
		event.preventDefault();
		if (event.key === 'Escape') {
			listening = null;
			return;
		}
		keybindings.setBinding(action, event.key.length === 1 ? event.key.toLowerCase() : event.key);
		listening = null;
	}

	function handlePadEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		listening = null;
	}

	/** Called on each controller button press; only used while a controller binding is being set. */
	function captureButton(button: number) {
		if (listening?.kind !== 'pad') return;
		gamepadBindings.setBinding(listening.action, button);
		listening = null;
	}

	function resetKeybindings() {
		keybindings.reset();
		gamepadBindings.reset();
		listening = null;
	}

	onMount(() => startGamepadPolling(captureButton));

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

<svelte:head>
	<title>Settings · WK Flash</title>
</svelte:head>

<div class="container">
	<h1>Settings</h1>
	<p>
		Enter a WaniKani personal access token. You can generate one from your
		<a href="https://www.wanikani.com/settings/personal_access_tokens" target="_blank" rel="noopener noreferrer"
			>WaniKani account settings</a
		>. It needs the default scopes, including starting assignments and creating reviews.
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

	<section class="preferences" aria-labelledby="appearance-heading">
		<h2 id="appearance-heading">Appearance</h2>
		<label class="toggle">
			<input
				type="checkbox"
				checked={$theme === 'light'}
				onchange={(event) => theme.set((event.currentTarget.checked ? 'light' : 'dark') as ThemeMode)}
			/>
			Use light mode
		</label>
		<p class="muted">Dark mode is the default. The choice applies across the whole app.</p>
	</section>

	<section class="preferences" aria-labelledby="review-sort-heading">
		<h2 id="review-sort-heading">Review order</h2>
		<div class="sort-rules">
			<div class="sort-rule">
				<span class="sort-rule-label" id="primary-sort-label">Primary sort</span>
				<div class="sort-rule-controls">
					<select
						aria-labelledby="primary-sort-label"
						value={primaryChoice}
						onchange={(event) => reviewSort.setPrimary(event.currentTarget.value as PrimarySortChoice)}
					>
						<option value="default">Default (WaniKani order)</option>
						{#each sortFieldOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
						<option value="random">Random</option>
					</select>
					<select
						class="sort-direction"
						aria-label="Primary sort direction"
						value={primaryDirection}
						disabled={primaryField === null}
						onchange={(event) => reviewSort.setPrimaryDirection(event.currentTarget.value as SortDirection)}
					>
						<option value="ascending">{sortDirectionLabel(primaryField, 'ascending')}</option>
						<option value="descending">{sortDirectionLabel(primaryField, 'descending')}</option>
					</select>
				</div>
			</div>
			<div class="sort-rule">
				<span class="sort-rule-label" id="secondary-sort-label">Secondary sort</span>
				<div class="sort-rule-controls">
					<select
						aria-labelledby="secondary-sort-label"
						value={secondaryField ?? 'none'}
						disabled={!secondaryEnabled}
						onchange={(event) => {
							const value = event.currentTarget.value;
							reviewSort.setSecondaryField(value === 'none' ? null : (value as SortField));
						}}
					>
						<option value="none">None</option>
						{#each secondaryOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
					<select
						class="sort-direction"
						aria-label="Secondary sort direction"
						value={secondaryDirection}
						disabled={!secondaryEnabled || secondaryField === null}
						onchange={(event) => reviewSort.setSecondaryDirection(event.currentTarget.value as SortDirection)}
					>
						<option value="ascending">{sortDirectionLabel(secondaryField, 'ascending')}</option>
						<option value="descending">{sortDirectionLabel(secondaryField, 'descending')}</option>
					</select>
				</div>
			</div>
		</div>
		{#if !secondaryEnabled}
			<p class="muted sort-hint">A secondary sort is available when the primary sort is SRS stage, WaniKani level, or review type.</p>
		{/if}
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
		<p class="muted">When prioritization is on, current-level items appear first, and the sort applies within each group. The secondary sort orders cards that tie on the primary sort. Changes apply to new queues and newly due items; saved sessions keep their current order.</p>
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
		<p class="muted">
			Select a keyboard or controller binding, then press the key or controller button you want. Press
			Escape to cancel.
		</p>
		<p class="muted">
			{$gamepadConnected
				? `Controller connected: ${$gamepadConnected}`
				: 'No controller detected. Press a button on it to connect.'}
		</p>
		<div class="keybinding-list">
			<div class="keybinding-header">
				<div class="keybinding-inputs">
					<span>Keyboard</span>
					<span>Controller</span>
				</div>
			</div>
			{#each keybindingActions as action (action.key)}
				<div class="keybinding-row">
					<div>
						<div class="keybinding-label">{action.label}</div>
						<div class="keybinding-hint">{action.hint}</div>
					</div>
					<div class="keybinding-inputs">
						<button
							type="button"
							class="keybinding-key"
							class:listening={isListening('key', action.key)}
							onclick={() => toggleListening('key', action.key)}
							onkeydown={(event) => isListening('key', action.key) && handleKeydown(event, action.key)}
						>
							{isListening('key', action.key) ? 'Press a key...' : keyboardKeyLabel($keybindings[action.key])}
						</button>
						<button
							type="button"
							class="keybinding-key gamepad-key"
							class:listening={isListening('pad', action.key)}
							onclick={() => toggleListening('pad', action.key)}
							onkeydown={(event) => isListening('pad', action.key) && handlePadEscape(event)}
						>
							{isListening('pad', action.key)
								? 'Press a button...'
								: gamepadButtonLabel($gamepadBindings[action.key])}
						</button>
					</div>
				</div>
			{/each}
		</div>
		<button type="button" onclick={resetKeybindings}>Reset to defaults</button>
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

	.keybinding-header {
		display: flex;
		justify-content: flex-end;
		color: var(--muted);
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.keybinding-inputs {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	/* Keyboard and controller columns share a width so headers line up with their buttons. */
	.keybinding-inputs > * {
		width: 7.5rem;
		text-align: center;
	}

	.gamepad-key {
		text-transform: none;
		font-family: inherit;
		min-width: 7.5rem;
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

	.sort-rules {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.sort-rule {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr);
		align-items: center;
		gap: 0.5rem 0.75rem;
	}

	.sort-rule-label {
		font-weight: 600;
	}

	.sort-rule-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.sort-rule-controls select {
		flex: 1 1 10rem;
		min-width: 0;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
	}

	.sort-rule-controls select.sort-direction {
		flex: 0 1 11rem;
	}

	.sort-rule-controls select:disabled {
		opacity: 0.5;
	}

	.sort-hint {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
	}

	.sort-rules + .toggle,
	.sort-hint + .toggle {
		margin-top: 1rem;
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
