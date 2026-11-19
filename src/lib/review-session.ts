import { browser } from '$app/environment';
import { readPersistent, removePersistent, writePersistent } from '$lib/persistent-storage';
import type { ReviewCard } from '$lib/wanikani/types';
import { releaseReviewSubmission, type PendingReviewSubmission } from '$lib/review-outbox';
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
 * True when the saved review must be discarded rather than resumed: the device is online and the
 * review started more than `MAX_REVIEW_SESSION_AGE_MS` ago. A session with no start time (saved before
 * start times were recorded) cannot be shown to be recent, so it is treated as stale too.
 *
 * Offline, the saved review is always kept. The queue for an offline session comes from the saved
 * review, so discarding it would leave the user unable to complete reviews until they reconnect.
 */
export function isReviewSessionStale(session: { startedAt?: number }, now = Date.now()): boolean {
	if (!browser || !navigator.onLine) return false;
	if (session.startedAt === undefined) return true;
	return now - session.startedAt > MAX_REVIEW_SESSION_AGE_MS;
}

/**
 * Decides whether the homepage should offer to resume the saved review. While online, a stale review
 * is cleared here so it is removed from storage. Offline it is kept and remains resumable.
 */
export function hasResumableReviewSession(apiToken: string): boolean {
	const stored = readPersistent(STORAGE_KEY);
	if (!stored) return false;
	try {
		const session = JSON.parse(stored) as { startedAt?: number; pendingReviewSubmission?: PendingReviewSubmission | null };
		if (!isReviewSessionStale(session)) return true;
		// An answer still held for undo would otherwise stay held. Releasing it lets it sync.
		if (session.pendingReviewSubmission) {
			void releaseReviewSubmission(apiToken, session.pendingReviewSubmission.assignmentId);
		}
		clearReviewSession();
		return false;
	} catch {
		// Unreadable data is cleared when the review page opens it.
		return true;
	}
}

export function saveReviewSession(session: ReviewSessionSnapshot): void {
	if (!browser) return;
	writePersistent(STORAGE_KEY, JSON.stringify(session));
}

export function clearReviewSession(): void {
	removePersistent(STORAGE_KEY);
}
