<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiKey } from '$lib/storage';
	import { hasSavedReviewSession } from '$lib/review-session';
	import { getUser, getReviewAssignments, WaniKaniError } from '$lib/wanikani/api';
	import type { WKUser } from '$lib/wanikani/types';

	const REVIEW_COUNT_KEY = 'wk-flash:last-due-count';
	const hour = new Date().getHours();
	const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

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
			try {
				localStorage.setItem(REVIEW_COUNT_KEY, String(reviewCount));
			} catch {
				// The live count remains available if local storage is disabled.
			}
		} catch (e) {
			error = e instanceof WaniKaniError ? e.message : 'Something went wrong.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		hasSavedReview = hasSavedReviewSession();
		try {
			const storedCount = localStorage.getItem(REVIEW_COUNT_KEY);
			if (storedCount !== null) {
				const cachedCount = Number(storedCount);
				if (Number.isInteger(cachedCount) && cachedCount >= 0) reviewCount = cachedCount;
			}
		} catch {
			// Continue loading the live count if local storage is disabled.
		}
		if (!$apiKey) {
			goto('/settings');
			return;
		}
		load();
	});
</script>

<div class="container">
	{#if loading}
		<p>
			{reviewCount === null
				? 'Loading your review count...'
				: `Last known count: ${reviewCount} review${reviewCount === 1 ? '' : 's'} due.`}
		</p>
		{#if hasSavedReview}
			<a href="/review"><button class="primary">Continue Review</button></a>
		{/if}
	{:else if error}
		<p class="error">{error}</p>
		<p>
			{reviewCount === null
				? 'Unable to load your review count.'
				: `Last known count: ${reviewCount} review${reviewCount === 1 ? '' : 's'} due.`}
		</p>
		{#if hasSavedReview}
			<p class="muted">Your in-progress review is saved on this device.</p>
			<a href="/review"><button class="primary">Continue Review</button></a>
		{:else}
			<a href="/settings">Check your API key in Settings</a>
		{/if}
	{:else}
		<h1>{greeting}, {user?.username}!</h1>
		<p>You have <strong>{reviewCount}</strong> review{reviewCount === 1 ? '' : 's'} due.</p>

		{#if reviewCount === 0}
			<p>No reviews are available right now. Check back later.</p>
		{/if}
		{#if hasSavedReview}
			<p>You have a review in progress. Pick up where you left off.</p>
			<a href="/review"><button class="primary">Continue Review</button></a>
		{:else if reviewCount > 0}
			<p class="muted">
				Each card asks for the meaning and reading together, then submits one combined result back
				to WaniKani.
			</p>
			<a href="/review"><button class="primary">Start Review</button></a>
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
