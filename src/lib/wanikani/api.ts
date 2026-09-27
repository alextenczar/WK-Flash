import { browser } from '$app/environment';
import type { ReviewCard, WKAssignment, WKSubject, WKUser } from './types';

const BASE_URL = 'https://api.wanikani.com/v2';
const SUBJECT_CACHE_NAME = 'wk-flash-wanikani-subjects-v1';
const SUBJECT_CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_RATE_LIMIT_RETRIES = 2;
const REVIEW_QUEUE_CACHE_PATH = '/__wk-flash-cache/review-queue';
export const REVIEW_QUEUE_FRESH_MS = 60 * 1000;

export interface NextReviewBatch {
	availableAt: string;
	count: number;
}

export interface CachedReviewQueue {
	fetchedAt: number;
	cards: ReviewCard[];
	reviewCount?: number;
	nextReviewBatch?: NextReviewBatch | null;
	user: WKUser;
}

export class WaniKaniError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
		this.name = 'WaniKaniError';
	}
}

export interface ReviewStageResult {
	startingSrsStage: number | null;
	endingSrsStage: number | null;
}

function retryDelay(response: Response, retryCount: number): number {
	const retryAfter = response.headers.get('Retry-After');
	if (retryAfter) {
		const seconds = Number(retryAfter);
		if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
		const retryAt = Date.parse(retryAfter);
		if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());
	}

	const resetAt = Number(response.headers.get('RateLimit-Reset'));
	if (Number.isFinite(resetAt) && resetAt > 0) {
		return Math.max(0, resetAt * 1000 - Date.now());
	}
	return 1000 * 2 ** retryCount;
}

async function wkFetchResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	for (let retryCount = 0; ; retryCount++) {
		const response = await fetch(input, init);
		if (response.status !== 429 || retryCount >= MAX_RATE_LIMIT_RETRIES) return response;
		await new Promise((resolve) => setTimeout(resolve, retryDelay(response, retryCount)));
	}
}

async function openSubjectCache(): Promise<Cache | null> {
	if (!browser || !('caches' in globalThis)) return null;
	try {
		return await caches.open(SUBJECT_CACHE_NAME);
	} catch {
		return null;
	}
}

function subjectCacheRequest(subjectId: number): Request {
	return new Request(new URL(`/__wk-flash-cache/subjects/${subjectId}`, location.origin));
}

function reviewQueueCacheRequest(): Request {
	return new Request(new URL(REVIEW_QUEUE_CACHE_PATH, location.origin));
}

export async function getCachedReviewQueue(): Promise<CachedReviewQueue | null> {
	const cache = await openSubjectCache();
	if (!cache) return null;
	try {
		const response = await cache.match(reviewQueueCacheRequest());
		if (!response) return null;
		const snapshot = (await response.json()) as CachedReviewQueue;
		if (
			!Number.isFinite(snapshot.fetchedAt) ||
			typeof snapshot.user?.username !== 'string' ||
			!Array.isArray(snapshot.cards) ||
			!snapshot.cards.every(
				(card) => typeof card?.assignmentId === 'number' && typeof card.subject?.data === 'object'
			) ||
			(snapshot.nextReviewBatch !== undefined &&
				snapshot.nextReviewBatch !== null &&
				(typeof snapshot.nextReviewBatch.availableAt !== 'string' ||
					!Number.isFinite(Date.parse(snapshot.nextReviewBatch.availableAt)) ||
					!Number.isInteger(snapshot.nextReviewBatch.count) ||
					snapshot.nextReviewBatch.count < 0))
		) {
			return null;
		}
		return snapshot;
	} catch {
		return null;
	}
}

async function cacheReviewQueue(
	cards: ReviewCard[],
	user: WKUser,
	reviewCount: number,
	nextReviewBatch?: NextReviewBatch | null
): Promise<void> {
	const cache = await openSubjectCache();
	if (!cache) return;
	try {
		const previous = nextReviewBatch === undefined ? await getCachedReviewQueue() : null;
		const cachedNextReviewBatch = nextReviewBatch === undefined ? previous?.nextReviewBatch : nextReviewBatch;
		await cache.put(
			reviewQueueCacheRequest(),
			new Response(JSON.stringify({
				fetchedAt: Date.now(),
				cards,
				reviewCount,
				user,
				...(cachedNextReviewBatch !== undefined ? { nextReviewBatch: cachedNextReviewBatch } : {})
			} satisfies CachedReviewQueue), {
				headers: { 'Content-Type': 'application/json' }
			})
		);
	} catch {
		// A full cache should not prevent online reviews.
	}
}

export async function removeCachedReviewCard(assignmentId: number): Promise<void> {
	const cache = await openSubjectCache();
	if (!cache) return;
	try {
		const request = reviewQueueCacheRequest();
		const response = await cache.match(request);
		if (!response) return;
		const snapshot = (await response.json()) as CachedReviewQueue;
		if (!Array.isArray(snapshot.cards)) return;
		await cache.put(
			request,
			new Response(
				JSON.stringify({
					...snapshot,
					cards: snapshot.cards.filter((card) => card.assignmentId !== assignmentId)
				}),
				{ headers: { 'Content-Type': 'application/json' } }
			)
		);
	} catch {
		// A cache failure should not interrupt review submission.
	}
}

async function cacheSubject(cache: Cache | null, subject: WKSubject): Promise<void> {
	if (!cache) return;
	try {
		await cache.put(
			subjectCacheRequest(subject.id),
			new Response(JSON.stringify(subject), {
				headers: {
					'Content-Type': 'application/json',
					'X-WK-Flash-Cached-At': String(Date.now())
				}
			})
		);
	} catch {
		// Reviews continue to work when browser caching is unavailable or full.
	}
}

async function wkFetch<T>(path: string, apiToken: string): Promise<T> {
	const res = await wkFetchResponse(`${BASE_URL}${path}`, {
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Wanikani-Revision': '20170710'
		}
	});
	if (!res.ok) {
		if (res.status === 401) throw new WaniKaniError('Invalid API key.', 401);
		if (res.status === 429) throw new WaniKaniError('WaniKani rate limit reached. Please try again shortly.', 429);
		throw new WaniKaniError(`WaniKani API error (${res.status}).`, res.status);
	}
	return res.json() as Promise<T>;
}

/** Follows the `pages.next_url` field WaniKani uses for pagination, collecting all `data` entries. */
async function wkFetchAllPages<T>(path: string, apiToken: string): Promise<T[]> {
	const results: T[] = [];
	let nextUrl: string | null = `${BASE_URL}${path}`;

	while (nextUrl) {
		const res: Response = await wkFetchResponse(nextUrl, {
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Wanikani-Revision': '20170710'
			}
		});
		if (!res.ok) {
			if (res.status === 401) throw new WaniKaniError('Invalid API key.', 401);
			if (res.status === 429) throw new WaniKaniError('WaniKani rate limit reached. Please try again shortly.', 429);
			throw new WaniKaniError(`WaniKani API error (${res.status}).`, res.status);
		}
		const json: { data: T[]; pages: { next_url: string | null } } = await res.json();
		results.push(...json.data);
		nextUrl = json.pages?.next_url ?? null;
	}

	return results;
}

export async function getUser(apiToken: string): Promise<WKUser> {
	const json = await wkFetch<{ data: WKUser }>('/user', apiToken);
	return json.data;
}

function accessibleLevels(maxAccessibleLevel: number): string {
	return Array.from({ length: maxAccessibleLevel }, (_, index) => index + 1).join(',');
}

function reviewAssignmentsPath(maxAccessibleLevel: number): string {
	return `/assignments?immediately_available_for_review=true&levels=${accessibleLevels(maxAccessibleLevel)}`;
}

export async function getReviewAssignments(
	apiToken: string,
	maxAccessibleLevel: number
): Promise<WKAssignment[]> {
	return wkFetchAllPages<WKAssignment>(reviewAssignmentsPath(maxAccessibleLevel), apiToken);
}

export async function getJLPTKanjiProgressData(apiToken: string): Promise<{
	subjects: WKSubject[];
	assignments: WKAssignment[];
}> {
	const user = await getUser(apiToken);
	const maxAccessibleLevel = Math.min(user.level, user.subscription.max_level_granted);
	const levels = accessibleLevels(maxAccessibleLevel);
	const [subjects, assignments] = await Promise.all([
		wkFetchAllPages<WKSubject>(`/subjects?types=kanji&levels=${levels}`, apiToken),
		wkFetchAllPages<WKAssignment>(`/assignments?subject_types=kanji&levels=${levels}`, apiToken)
	]);
	return { subjects, assignments };
}

export async function getSubjectsByIds(
	apiToken: string,
	ids: number[],
	maxAccessibleLevel?: number
): Promise<WKSubject[]> {
	if (ids.length === 0) return [];
	const uniqueIds = [...new Set(ids)];
	const cache = await openSubjectCache();
	const subjectById = new Map<number, WKSubject>();
	const idsToFetch: number[] = [];
	if (cache) {
		await Promise.all(
			uniqueIds.map(async (id) => {
				try {
					const response = await cache.match(subjectCacheRequest(id));
					if (!response) {
						idsToFetch.push(id);
						return;
					}
					const cachedAt = Number(response.headers.get('X-WK-Flash-Cached-At'));
					if (!cachedAt || Date.now() - cachedAt >= SUBJECT_CACHE_TTL) {
						idsToFetch.push(id);
						return;
					}
					const subject = (await response.json()) as WKSubject;
					if (maxAccessibleLevel === undefined || subject.data.level <= maxAccessibleLevel) {
						subjectById.set(id, subject);
					}
				} catch {
					idsToFetch.push(id);
				}
			})
		);
	} else {
		idsToFetch.push(...uniqueIds);
	}

	// WaniKani limits URL length, so chunk large ID lists.
	const chunkSize = 500;
	for (let i = 0; i < idsToFetch.length; i += chunkSize) {
		const chunk = idsToFetch.slice(i, i + chunkSize);
		const levelFilter = maxAccessibleLevel === undefined
			? ''
			: `&levels=${accessibleLevels(maxAccessibleLevel)}`;
		const chunkSubjects = await wkFetchAllPages<WKSubject>(
			`/subjects?ids=${chunk.join(',')}${levelFilter}`,
			apiToken
		);
		for (const subject of chunkSubjects) {
			if (maxAccessibleLevel !== undefined && subject.data.level > maxAccessibleLevel) continue;
			subjectById.set(subject.id, subject);
			await cacheSubject(cache, subject);
		}
	}
	return uniqueIds.flatMap((id) => {
		const subject = subjectById.get(id);
		return subject ? [subject] : [];
	});
}

async function getAccessibleAssignments(apiToken: string): Promise<{
	user: WKUser;
	assignments: WKAssignment[];
	maxAccessibleLevel: number;
}> {
	const user = await getUser(apiToken);
	const maxAccessibleLevel = Math.min(user.level, user.subscription.max_level_granted);
	const assignments = await getReviewAssignments(apiToken, maxAccessibleLevel);
	return { user, assignments, maxAccessibleLevel };
}

async function getAccessibleReviewData(apiToken: string): Promise<{
	user: WKUser;
	assignments: WKAssignment[];
	reviewCount: number;
	subjectById: Map<number, WKSubject>;
	maxAccessibleLevel: number;
}> {
	const { user, assignments, maxAccessibleLevel } = await getAccessibleAssignments(apiToken);
	const subjects = await getSubjectsByIds(
		apiToken,
		assignments.map((assignment) => assignment.data.subject_id),
		maxAccessibleLevel
	);
	const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
	return {
		user,
		reviewCount: assignments.length,
		assignments: assignments.filter((assignment) => subjectById.has(assignment.data.subject_id)),
		subjectById,
		maxAccessibleLevel
	};
}

function reviewCardsFromData(
	assignments: WKAssignment[],
	subjectById: Map<number, WKSubject>,
	maxAccessibleLevel: number
): ReviewCard[] {
	return assignments.flatMap((assignment) => {
		const subject = subjectById.get(assignment.data.subject_id);
		if (!subject) return [];
		return [{
			assignmentId: assignment.id,
			srsStage: assignment.data.srs_stage,
			maxAccessibleLevel,
			subject,
			needsReading: subject.object !== 'radical' && subject.object !== 'kana_vocabulary',
			incorrectCount: 0
		}];
	});
}

export async function getReviewOverview(apiToken: string): Promise<{
	user: WKUser;
	reviewCount: number;
	cards: ReviewCard[];
	nextReviewBatch: NextReviewBatch | null | undefined;
}> {
	const [reviewData, nextBatch] = await Promise.all([
		getAccessibleReviewData(apiToken),
		getNextReviewBatch(apiToken)
	]);
	const { user, assignments, reviewCount, subjectById, maxAccessibleLevel } = reviewData;
	const nextReviewBatch = nextBatch === undefined
		? (await getCachedReviewQueue())?.nextReviewBatch
		: nextBatch;
	const cards = reviewCardsFromData(assignments, subjectById, maxAccessibleLevel);
	await cacheReviewQueue(cards, user, reviewCount, nextReviewBatch);
	return { user, reviewCount, cards, nextReviewBatch };
}

async function getNextReviewBatch(apiToken: string): Promise<NextReviewBatch | null | undefined> {
	try {
		const summary = await wkFetch<{
			data: { reviews: { available_at: string; subject_ids: number[] }[] };
		}>('/summary', apiToken);
		const now = Date.now();
		const nextBatch = summary.data.reviews
			.filter((batch) => batch.subject_ids.length > 0 && Date.parse(batch.available_at) > now)
			.sort((left, right) => Date.parse(left.available_at) - Date.parse(right.available_at))[0];
		return nextBatch
			? { availableAt: nextBatch.available_at, count: nextBatch.subject_ids.length }
			: null;
	} catch {
		return undefined;
	}
}

/** Builds the combined meaning+reading review queue for every currently available review. */
export async function buildReviewQueue(apiToken: string): Promise<ReviewCard[]> {
	const { user, assignments, reviewCount, subjectById, maxAccessibleLevel } = await getAccessibleReviewData(apiToken);
	const cards = reviewCardsFromData(assignments, subjectById, maxAccessibleLevel);
	await cacheReviewQueue(cards, user, reviewCount);
	return cards;
}

/** Submits the final result for an assignment once its combined card has been graded correct. */
export async function submitReview(
	apiToken: string,
	assignmentId: number,
	incorrectCount: number,
	needsReading: boolean
): Promise<ReviewStageResult> {
	const res = await wkFetchResponse(`${BASE_URL}/reviews`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Wanikani-Revision': '20170710',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			review: {
				assignment_id: assignmentId,
				incorrect_meaning_answers: incorrectCount,
				// WaniKani rejects a non-zero reading count for subjects that have no reading.
				incorrect_reading_answers: needsReading ? incorrectCount : 0
			}
		})
	});
	if (!res.ok) {
		if (res.status === 401) throw new WaniKaniError('Invalid API key.', 401);
		if (res.status === 429) throw new WaniKaniError('WaniKani rate limit reached. Please try again shortly.', 429);
		const body = await res.text();
		throw new WaniKaniError(`Failed to submit review (${res.status}): ${body}`, res.status);
	}
	const response = (await res.json().catch(() => null)) as {
		data?: { starting_srs_stage?: number; ending_srs_stage?: number };
		resources_updated?: { assignment?: { data?: { srs_stage?: number } } };
	} | null;
	return {
		startingSrsStage: response?.data?.starting_srs_stage ?? null,
		endingSrsStage:
			response?.resources_updated?.assignment?.data?.srs_stage ?? response?.data?.ending_srs_stage ?? null
	};
}
