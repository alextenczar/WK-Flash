import { browser } from '$app/environment';
import type { ReviewCard } from '$lib/wanikani/types';

const STORAGE_KEY = 'wk-flash:active-review';

export interface ReviewSessionSnapshot {
	version: 1;
	queue: ReviewCard[];
	totalUnique: number;
	knownAssignmentIds?: number[];
	pendingIds: number[];
	missedIds: number[];
	seenAssignments: number[];
	completedCount: number;
	correctFirstTry: number;
	responseTimeTotalMs?: number;
	responseTimeSamples?: number;
	wrongAnswerCount?: number;
	wrapUp: boolean;
	flipped: boolean;
}

export function readReviewSession(): ReviewSessionSnapshot | null {
	if (!browser) return null;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return null;
		const session = JSON.parse(stored) as ReviewSessionSnapshot;
		if (
			session.version !== 1 ||
			!Array.isArray(session.queue) ||
			!Array.isArray(session.pendingIds) ||
			!Array.isArray(session.missedIds) ||
			!Array.isArray(session.seenAssignments) ||
			!session.queue.every((card) => card?.subject?.data && typeof card.assignmentId === 'number')
		) {
			clearReviewSession();
			return null;
		}
		return session;
	} catch {
		clearReviewSession();
		return null;
	}
}

export function hasSavedReviewSession(): boolean {
	if (!browser) return false;
	try {
		return localStorage.getItem(STORAGE_KEY) !== null;
	} catch {
		return false;
	}
}

export function saveReviewSession(session: ReviewSessionSnapshot): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
	} catch {
		// Storage may be unavailable or full; the in-memory review can still continue.
	}
}

export function clearReviewSession(): void {
	if (!browser) return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Storage may be unavailable in private browsing.
	}
}
