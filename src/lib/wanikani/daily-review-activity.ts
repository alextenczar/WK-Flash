import type { WKAssignment, WKReviewStatistic } from './types';

export type DailyReviewActivity = {
	count: number;
	reviewStatisticsCount: number;
	assignmentUpdateEstimate: number;
	source: 'review_statistics' | 'assignment_updates' | 'none';
};

function localDayKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isToday(value: string | null | undefined, today: string): boolean {
	if (!value) return false;
	const date = new Date(value);
	return Number.isFinite(date.getTime()) && localDayKey(date) === today;
}

function hasRecordedAnswers(statistic: WKReviewStatistic): boolean {
	const data = statistic.data;
	return [
		data.meaning_correct,
		data.meaning_incorrect,
		data.reading_correct,
		data.reading_incorrect
	].some((count) => typeof count === 'number' && Number.isFinite(count) && count > 0);
}

export function calculateDailyReviewActivity(
	assignments: WKAssignment[],
	reviewStatistics: WKReviewStatistic[] | null,
	now = new Date()
): DailyReviewActivity {
	const today = localDayKey(now);
	const reviewedSubjects = new Set<number>();
	for (const statistic of reviewStatistics ?? []) {
		if (statistic.data.hidden || !hasRecordedAnswers(statistic) || !isToday(statistic.data_updated_at, today)) continue;
		reviewedSubjects.add(statistic.data.subject_id);
	}

	const updatedAssignments = new Set<number>();
	for (const assignment of assignments) {
		const data = assignment.data;
		if (!data.started_at || data.hidden || !isToday(assignment.data_updated_at, today)) continue;

		const updatedAt = Date.parse(assignment.data_updated_at ?? '');
		const startedAt = Date.parse(data.started_at);
		const updatedAfterLessonStart = Number.isFinite(updatedAt) && Number.isFinite(startedAt) && updatedAt - startedAt > 60_000;
		const likelyReviewEvent =
			(data.srs_stage > 1 && updatedAfterLessonStart) ||
			isToday(data.passed_at, today) ||
			isToday(data.burned_at, today);
		if (likelyReviewEvent) updatedAssignments.add(assignment.id);
	}

	const reviewStatisticsCount = reviewedSubjects.size;
	const assignmentUpdateEstimate = updatedAssignments.size;
	const count = Math.max(reviewStatisticsCount, assignmentUpdateEstimate);
	const source = count === 0
		? 'none'
		: reviewStatisticsCount >= assignmentUpdateEstimate
			? 'review_statistics'
			: 'assignment_updates';

	return { count, reviewStatisticsCount, assignmentUpdateEstimate, source };
}