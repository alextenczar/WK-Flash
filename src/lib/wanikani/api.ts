import type { ReviewCard, WKAssignment, WKSubject, WKUser } from './types';

const BASE_URL = 'https://api.wanikani.com/v2';

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

async function wkFetch<T>(path: string, apiToken: string): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Wanikani-Revision': '20170710'
		}
	});
	if (!res.ok) {
		if (res.status === 401) throw new WaniKaniError('Invalid API key.', 401);
		throw new WaniKaniError(`WaniKani API error (${res.status}).`, res.status);
	}
	return res.json() as Promise<T>;
}

/** Follows the `pages.next_url` field WaniKani uses for pagination, collecting all `data` entries. */
async function wkFetchAllPages<T>(path: string, apiToken: string): Promise<T[]> {
	const results: T[] = [];
	let nextUrl: string | null = `${BASE_URL}${path}`;

	while (nextUrl) {
		const res: Response = await fetch(nextUrl, {
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Wanikani-Revision': '20170710'
			}
		});
		if (!res.ok) {
			if (res.status === 401) throw new WaniKaniError('Invalid API key.', 401);
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

export async function getReviewAssignments(apiToken: string): Promise<WKAssignment[]> {
	return wkFetchAllPages<WKAssignment>(
		'/assignments?immediately_available_for_review=true',
		apiToken
	);
}

export async function getSubjectsByIds(
	apiToken: string,
	ids: number[]
): Promise<WKSubject[]> {
	if (ids.length === 0) return [];
	const subjects: WKSubject[] = [];
	// WaniKani limits URL length, so chunk large ID lists.
	const chunkSize = 500;
	for (let i = 0; i < ids.length; i += chunkSize) {
		const chunk = ids.slice(i, i + chunkSize);
		const chunkSubjects = await wkFetchAllPages<WKSubject>(
			`/subjects?ids=${chunk.join(',')}`,
			apiToken
		);
		subjects.push(...chunkSubjects);
	}
	return subjects;
}

/** Builds the combined meaning+reading review queue for every currently available review. */
export async function buildReviewQueue(apiToken: string): Promise<ReviewCard[]> {
	const assignments = await getReviewAssignments(apiToken);
	const subjectIds = assignments.map((a) => a.data.subject_id);
	const subjects = await getSubjectsByIds(apiToken, subjectIds);
	const subjectById = new Map(subjects.map((s) => [s.id, s]));

	const cards: ReviewCard[] = [];
	for (const assignment of assignments) {
		const subject = subjectById.get(assignment.data.subject_id);
		if (!subject) continue;
		cards.push({
			assignmentId: assignment.id,
			srsStage: assignment.data.srs_stage,
			subject,
			// Radicals have no reading, and kana vocabulary is tested on meaning only.
			needsReading: subject.object !== 'radical' && subject.object !== 'kana_vocabulary',
			incorrectCount: 0
		});
	}
	return cards;
}

/** Submits the final result for an assignment once its combined card has been graded correct. */
export async function submitReview(
	apiToken: string,
	assignmentId: number,
	incorrectCount: number,
	needsReading: boolean
): Promise<ReviewStageResult> {
	const res = await fetch(`${BASE_URL}/reviews`, {
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
