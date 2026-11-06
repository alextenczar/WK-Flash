import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { onPersistentHydrate, readPersistent, removePersistent, writePersistent } from '$lib/persistent-storage';
import {
	getAssignment,
	getImmediatelyAvailableReviewAssignments,
	removeCachedReviewCard,
	submitReview,
	WaniKaniError
} from '$lib/wanikani/api';

const STORAGE_KEY = 'wk-flash:pending-reviews';

export interface PendingReviewSubmission {
	assignmentId: number;
	availableAt?: string | null;
	incorrectCount: number;
	needsReading: boolean;
	startingSrsStage?: number;
	subjectLabel?: string;
}

export interface SrsStageUpdate {
	subjectLabel: string;
	startingStage: number;
	endingStage: number;
}

const SRS_STAGE_LABELS: Record<number, string> = {
	1: 'Apprentice 1',
	2: 'Apprentice 2',
	3: 'Apprentice 3',
	4: 'Apprentice 4',
	5: 'Guru 1',
	6: 'Guru 2',
	7: 'Master',
	8: 'Enlightened',
	9: 'Burned'
};

function srsStageLabel(stage: number): string {
	return SRS_STAGE_LABELS[stage] ?? `Stage ${stage}`;
}

export const latestSrsStageUpdate = writable<SrsStageUpdate | null>(null);

export function recordSrsStageUpdate(update: SrsStageUpdate): void {
	latestSrsStageUpdate.set(update);
	setTimeout(() => {
		if (get(latestSrsStageUpdate) === update) latestSrsStageUpdate.set(null);
	}, 4000);
}

export function formatSrsStageUpdate(update: SrsStageUpdate): string {
	if (update.endingStage < update.startingStage) {
		return `${update.subjectLabel}: SRS stage decreased from ${srsStageLabel(update.startingStage)} to ${srsStageLabel(update.endingStage)}.`;
	}
	if (update.endingStage > update.startingStage) {
		return `${update.subjectLabel}: SRS stage increased from ${srsStageLabel(update.startingStage)} to ${srsStageLabel(update.endingStage)}.`;
	}
	return `${update.subjectLabel}: SRS stage stayed at ${srsStageLabel(update.endingStage)}.`;
}

function isPendingReview(value: unknown): value is PendingReviewSubmission {
	if (!value || typeof value !== 'object') return false;
	const review = value as Partial<PendingReviewSubmission>;
	return (
		typeof review.assignmentId === 'number' &&
		typeof review.incorrectCount === 'number' &&
		typeof review.needsReading === 'boolean'
	);
}

function loadPendingReviews(): PendingReviewSubmission[] {
	if (!browser) return [];
	try {
		const stored = readPersistent(STORAGE_KEY);
		if (!stored) return [];
		const parsed: unknown = JSON.parse(stored);
		return Array.isArray(parsed) ? parsed.filter(isPendingReview) : [];
	} catch {
		return [];
	}
}

export const pendingReviews = writable<PendingReviewSubmission[]>(loadPendingReviews());

if (browser) {
	let persistWrites = true;
	pendingReviews.subscribe((reviews) => {
		if (!persistWrites) return;
		if (reviews.length) writePersistent(STORAGE_KEY, JSON.stringify(reviews));
		else removePersistent(STORAGE_KEY);
	});
	onPersistentHydrate(() => {
		persistWrites = false;
		pendingReviews.set(loadPendingReviews());
		persistWrites = true;
	});
}

/** Answers held for undo. They stay queued but are not sent until released. */
const heldAssignmentIds = new Set<number>();

export function queueReviewSubmission(review: PendingReviewSubmission, options: { hold?: boolean } = {}): void {
	pendingReviews.update((reviews) =>
		reviews.some((item) => item.assignmentId === review.assignmentId) ? reviews : [...reviews, review]
	);
	if (options.hold) heldAssignmentIds.add(review.assignmentId);
	void removeCachedReviewCard(review.assignmentId);
}

export function removeQueuedReviewSubmission(assignmentId: number): void {
	heldAssignmentIds.delete(assignmentId);
	pendingReviews.update((reviews) => reviews.filter((item) => item.assignmentId !== assignmentId));
}

function isNotYetAvailable(availableAt: string | null | undefined): boolean {
	const timestamp = availableAt ? Date.parse(availableAt) : Number.NaN;
	return Number.isFinite(timestamp) && timestamp > Date.now();
}

function isCreatedAtError(error: unknown): error is WaniKaniError {
	return error instanceof WaniKaniError && error.status === 422 && error.message.includes('created_at');
}

async function deferIfReviewIsNotAvailable(
	apiToken: string,
	review: PendingReviewSubmission
): Promise<boolean> {
	const availableAssignments = await getImmediatelyAvailableReviewAssignments(apiToken, [review.assignmentId]);
	if (availableAssignments.some((assignment) => assignment.id === review.assignmentId)) return false;

	// The card may have become unavailable because another device submitted it,
	// or because the local clock was ahead of WaniKani's clock. Keep it queued
	// in the latter case and discard it in the former.
	try {
		const assignment = await getAssignment(apiToken, review.assignmentId);
		const stageChanged = review.startingSrsStage !== undefined &&
			assignment.data.srs_stage !== review.startingSrsStage;
		const dueTimeAdvanced = review.availableAt && assignment.data.available_at &&
			Date.parse(assignment.data.available_at) > Date.parse(review.availableAt);
		if (stageChanged || dueTimeAdvanced) {
			removeQueuedReviewSubmission(review.assignmentId);
			console.warn(`Discarded stale queued review for assignment ${review.assignmentId}.`);
		}
	} catch (refreshError: unknown) {
		console.warn(`Could not refresh WaniKani assignment ${review.assignmentId}.`, refreshError);
	}
	return true;
}

const inFlightAssignmentIds = new Set<number>();

export async function submitQueuedReview(apiToken: string, review: PendingReviewSubmission) {
	queueReviewSubmission(review);
	if (isNotYetAvailable(review.availableAt)) {
		return { startingSrsStage: review.startingSrsStage ?? null, endingSrsStage: null };
	}
	inFlightAssignmentIds.add(review.assignmentId);
	try {
		let result: Awaited<ReturnType<typeof submitReview>>;
		try {
			result = await submitReview(
				apiToken,
				review.assignmentId,
				review.incorrectCount,
				review.needsReading
			);
		} catch (error: unknown) {
			if (!isCreatedAtError(error)) throw error;
			// WaniKani validates its own current time when created_at is omitted.
			// A just-due card can therefore fail while the device clock says it is
			// ready. Leave it queued without showing a permanent submission error.
			try {
				await deferIfReviewIsNotAvailable(apiToken, review);
			} catch (availabilityError: unknown) {
				console.warn(`Could not verify WaniKani availability for assignment ${review.assignmentId}.`, availabilityError);
			}
			return { startingSrsStage: review.startingSrsStage ?? null, endingSrsStage: null };
		}
		removeQueuedReviewSubmission(review.assignmentId);
		return result;
	} finally {
		inFlightAssignmentIds.delete(review.assignmentId);
	}
}

/**
 * WaniKani allows 60 requests a minute per token. Review submissions are capped below that, so
 * the other requests the app makes still have room.
 */
const SUBMISSION_WINDOW_MS = 60_000;
const MAX_SUBMISSIONS_PER_WINDOW = 50;
const RETRY_DELAY_MS = 30_000;

const recentSubmissionTimes: number[] = [];
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let activeQueue: Promise<void> | null = null;

/** Waits until sending one more submission keeps the last minute under the cap. */
async function reserveSubmissionSlot(): Promise<void> {
	for (;;) {
		const now = Date.now();
		while (recentSubmissionTimes.length > 0 && now - recentSubmissionTimes[0] >= SUBMISSION_WINDOW_MS) {
			recentSubmissionTimes.shift();
		}
		if (recentSubmissionTimes.length < MAX_SUBMISSIONS_PER_WINDOW) {
			recentSubmissionTimes.push(now);
			return;
		}
		const waitMs = recentSubmissionTimes[0] + SUBMISSION_WINDOW_MS - now;
		await new Promise((resolve) => setTimeout(resolve, waitMs));
	}
}

async function runSubmissionQueue(apiToken: string): Promise<void> {
	// Reviews WaniKani has not accepted yet are skipped for this run and tried again later.
	const deferred = new Set<number>();
	while (navigator.onLine) {
		const next = get(pendingReviews).find(
			(review) => !heldAssignmentIds.has(review.assignmentId) && !deferred.has(review.assignmentId)
		);
		if (!next) break;
		await reserveSubmissionSlot();
		try {
			await submitQueuedReview(apiToken, next);
		} catch (error: unknown) {
			console.warn(`Could not submit WaniKani review for assignment ${next.assignmentId}. It will retry.`, error);
			break;
		}
		if (get(pendingReviews).some((review) => review.assignmentId === next.assignmentId)) {
			deferred.add(next.assignmentId);
		}
	}

	const hasUnheldReviews = get(pendingReviews).some((review) => !heldAssignmentIds.has(review.assignmentId));
	if (hasUnheldReviews && navigator.onLine) {
		retryTimer = setTimeout(() => {
			retryTimer = undefined;
			void scheduleReviewSubmissions(apiToken);
		}, RETRY_DELAY_MS);
	}
}

/**
 * Sends queued answers in the background, within the request cap. Callers do not wait for the
 * network. Returns the running queue so it can be awaited when needed.
 */
export function scheduleReviewSubmissions(apiToken: string): Promise<void> {
	if (!browser || !apiToken) return Promise.resolve();
	if (retryTimer !== undefined) {
		clearTimeout(retryTimer);
		retryTimer = undefined;
	}
	activeQueue ??= runSubmissionQueue(apiToken).finally(() => {
		activeQueue = null;
	});
	return activeQueue;
}

/** Lets a held answer send, now that its undo window has closed. */
export function releaseReviewSubmission(apiToken: string, assignmentId: number): Promise<void> {
	heldAssignmentIds.delete(assignmentId);
	return scheduleReviewSubmissions(apiToken);
}

export function syncPendingReviews(apiToken: string): Promise<void> {
	return scheduleReviewSubmissions(apiToken);
}
