import { browser } from '$app/environment';
import { readPersistent, removePersistent, writePersistent } from '$lib/persistent-storage';
import type { ReviewCard } from '$lib/wanikani/types';
import type { PendingReviewSubmission } from '$lib/review-outbox';
import type { LocalReviewProgress } from '$lib/local-n1-reviews';

const STORAGE_KEY = 'wk-flash:active-review';

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

export function hasSavedReviewSession(): boolean {
	return Boolean(readPersistent(STORAGE_KEY));
}

export function saveReviewSession(session: ReviewSessionSnapshot): void {
	if (!browser) return;
	writePersistent(STORAGE_KEY, JSON.stringify(session));
}

export function clearReviewSession(): void {
	removePersistent(STORAGE_KEY);
}
