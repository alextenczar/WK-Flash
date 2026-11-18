import { browser } from '$app/environment';
import { readPersistent, removePersistent, writePersistent } from '$lib/persistent-storage';
import type { ReviewCard } from '$lib/wanikani/types';
import type { PendingReviewSubmission } from '$lib/review-outbox';
import type { LocalReviewProgress } from '$lib/local-n1-reviews';

const STORAGE_KEY = 'wk-flash:active-review';

/** A saved review that started longer ago than this is not resumed while the user is online. */
export const MAX_REVIEW_SESSION_AGE_MS = 4 * 60 * 60 * 1000;

export interface ReviewUndoSnapshot {
	queue: ReviewCard[];
	pendingIds: number[];
	missedIds: number[];
	seenAssignments: number[];
	completedCount: number;
	correctFirstTry: number;
	responseTimeTotalMs: number;
	responseTimeSamples: number;
	wrongAnswerCount: number;
	flipped: boolean;
	localProgressBefore?: { localId: string; progress: LocalReviewProgress | null };
}

export interface ReviewSessionSnapshot {
	version: 1;
	/** When the review began (ms since epoch). Missing in sessions saved earlier. */
	startedAt?: number;
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
	undoSnapshot?: ReviewUndoSnapshot | null;
	pendingReviewSubmission?: PendingReviewSubmission | null;
	/** `reviewSortKey` of the settings the queue was ordered with. Missing in sessions saved earlier. */
	sortKey?: string;
}

export function readReviewSession(): ReviewSessionSnapshot | null {
	if (!browser) return null;
	try {
		const stored = readPersistent(STORAGE_KEY);
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

/**
 * True when the saved review should be scrapped instead of resumed: it started more than
 * `MAX_REVIEW_SESSION_AGE_MS` ago and the device is online. Offline, the saved review is kept,
 * since it may hold answers that have not synced yet.
 */
export function isReviewSessionStale(session: { startedAt?: number }, now = Date.now()): boolean {
	if (!browser || !navigator.onLine) return false;
	return session.startedAt !== undefined && now - session.startedAt > MAX_REVIEW_SESSION_AGE_MS;
}

export function hasSavedReviewSession(): boolean {
	const stored = readPersistent(STORAGE_KEY);
	if (!stored) return false;
	try {
		if (isReviewSessionStale(JSON.parse(stored) as { startedAt?: number })) return false;
	} catch {
		// Unreadable data is handled when the review page opens it.
	}
	return true;
}

export function saveReviewSession(session: ReviewSessionSnapshot): void {
	if (!browser) return;
	writePersistent(STORAGE_KEY, JSON.stringify(session));
}

export function clearReviewSession(): void {
	removePersistent(STORAGE_KEY);
}
