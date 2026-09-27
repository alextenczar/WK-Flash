import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { removeCachedReviewCard, submitReview } from '$lib/wanikani/api';

const STORAGE_KEY = 'wk-flash:pending-reviews';

export interface PendingReviewSubmission {
	assignmentId: number;
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
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];
		const parsed: unknown = JSON.parse(stored);
		return Array.isArray(parsed) ? parsed.filter(isPendingReview) : [];
	} catch {
		return [];
	}
}

export const pendingReviews = writable<PendingReviewSubmission[]>(loadPendingReviews());

if (browser) {
	pendingReviews.subscribe((reviews) => {
		try {
			if (reviews.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
			else localStorage.removeItem(STORAGE_KEY);
		} catch {
			// Keep queued submissions in memory if browser storage is unavailable.
		}
	});
}

export function queueReviewSubmission(review: PendingReviewSubmission): void {
	pendingReviews.update((reviews) =>
		reviews.some((item) => item.assignmentId === review.assignmentId) ? reviews : [...reviews, review]
	);
	void removeCachedReviewCard(review.assignmentId);
}

function removeQueuedReviewSubmission(assignmentId: number): void {
	pendingReviews.update((reviews) => reviews.filter((item) => item.assignmentId !== assignmentId));
}

let syncing = false;
const inFlightAssignmentIds = new Set<number>();

export async function submitQueuedReview(apiToken: string, review: PendingReviewSubmission) {
	queueReviewSubmission(review);
	inFlightAssignmentIds.add(review.assignmentId);
	try {
		const result = await submitReview(
			apiToken,
			review.assignmentId,
			review.incorrectCount,
			review.needsReading
		);
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
		for (const review of get(pendingReviews)) {
			if (!navigator.onLine) break;
			if (inFlightAssignmentIds.has(review.assignmentId)) continue;
			inFlightAssignmentIds.add(review.assignmentId);
			try {
				const { startingSrsStage, endingSrsStage } = await submitReview(
					apiToken,
					review.assignmentId,
					review.incorrectCount,
					review.needsReading
				);
				const startingStage = startingSrsStage ?? review.startingSrsStage;
				if (startingStage !== undefined && endingSrsStage !== null) {
					recordSrsStageUpdate({
						subjectLabel: review.subjectLabel ?? 'Review',
						startingStage,
						endingStage: endingSrsStage
					});
				}
			} catch {
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