<script lang="ts">
	import { goto } from '$app/navigation';
	import { apiKey } from '$lib/storage';
	import { showMnemonics } from '$lib/review-preferences';
	import { clearReviewSession } from '$lib/review-session';
	import { getUser, WaniKaniError } from '$lib/wanikani/api';

	let input = $state($apiKey);
	let checking = $state(false);
	let error = $state('');
	let success = $state('');

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
			if ($apiKey !== value) clearReviewSession();
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
		<a href="https://www.wanikani.com/settings/personal_access_tokens" target="_blank" rel="noreferrer"
			>WaniKani account settings</a
		>. It only needs the default read/write review scopes.
	</p>
	<p class="muted">The key is stored only in this browser's local storage and never sent anywhere but WaniKani's API.</p>

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
