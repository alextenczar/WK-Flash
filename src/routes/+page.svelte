<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiKey } from '$lib/storage';
	import { hasSavedReviewSession } from '$lib/review-session';
	import { getUser, getReviewAssignments, WaniKaniError } from '$lib/wanikani/api';
	import type { WKUser } from '$lib/wanikani/types';

	let user = $state<WKUser | null>(null);
	let reviewCount = $state<number | null>(null);
	let hasSavedReview = $state(false);
	let loading = $state(true);
	let error = $state('');

	async function load() {
		loading = true;
		error = '';
		try {
			const [u, assignments] = await Promise.all([
				getUser($apiKey),
				getReviewAssignments($apiKey)
			]);
			user = u;
			reviewCount = assignments.length;
		} catch (e) {
			error = e instanceof WaniKaniError ? e.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		hasSavedReview = hasSavedReviewSession();
		if (!$apiKey) {
			goto('/settings');
			return;
		}
		load();
	});
</script>

<div class="container">
	{#if loading}
		<p>Loading your review queue...</p>
		{#if hasSavedReview}
			<a href="/review"><button class="primary">Continue Review</button></a>
		{/if}
	{:else if error}
		<p class="error">{error}</p>
		{#if hasSavedReview}
			<p class="muted">Your in-progress review is saved on this device.</p>
			<a href="/review"><button class="primary">Continue Review</button></a>
		{:else}
			<a href="/settings">Check your API key in Settings</a>
		{/if}
	{:else}
		<h1>Aloha, {user?.username}!</h1>

		{#if reviewCount === 0 && !hasSavedReview}
			<p>No reviews are available right now. Check back later.</p>
		{:else}
			{#if hasSavedReview}
				<p>You have a review in progress. Pick up where you left off.</p>
			{:else}
				<p>You have <strong>{reviewCount}</strong> item{reviewCount === 1 ? '' : 's'} ready to review.</p>
				<p class="muted">
					Each card asks for the meaning and reading together, then submits one combined result back
					to WaniKani.
				</p>
			{/if}
			<a href="/review"><button class="primary">{hasSavedReview ? 'Continue Review' : 'Start Review'}</button></a>
		{/if}
	{/if}
</div>

<style>
	.error {
		color: var(--bad);
	}

	.muted {
		color: var(--muted);
	}
</style>
