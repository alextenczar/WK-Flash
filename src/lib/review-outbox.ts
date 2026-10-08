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

export function queueReviewSubmission(review: PendingReviewSubmission): void {
	pendingReviews.update((reviews) =>
		reviews.some((item) => item.assignmentId === review.assignmentId) ? reviews : [...reviews, review]
	);
	void removeCachedReviewCard(review.assignmentId);
}

export function removeQueuedReviewSubmission(assignmentId: number): void {
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

let syncing = false;
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

export async function syncPendingReviews(apiToken: string): Promise<void> {
	if (!browser || !navigator.onLine || !apiToken || syncing) return;
	syncing = true;
	try {
		const queuedReviews = get(pendingReviews);
		if (queuedReviews.length === 0) return;

		for (const review of queuedReviews) {
			if (!navigator.onLine) break;
			if (inFlightAssignmentIds.has(review.assignmentId)) continue;
			inFlightAssignmentIds.add(review.assignmentId);
			try {
				await submitReview(
					apiToken,
					review.assignmentId,
					review.incorrectCount,
					review.needsReading
				);
			} catch (error: unknown) {
				if (isCreatedAtError(error)) {
					try {
						if (await deferIfReviewIsNotAvailable(apiToken, review)) continue;
					} catch (refreshError: unknown) {
						console.warn(`Could not refresh WaniKani assignment ${review.assignmentId}.`, refreshError);
					}
				}
				console.warn(`Could not sync queued WaniKani review for assignment ${review.assignmentId}.`, error);
				break;
			} finally {
				inFlightAssignmentIds.delete(review.assignmentId);
			}
			removeQueuedReviewSubmission(review.assignmentId);
		}
	} finally {
		syncing = false;
	}
}