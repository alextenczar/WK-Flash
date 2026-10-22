import type { WKReviewStatistic, WKSubject } from './types';

export const WEAKEST_ITEMS_LIMIT = 12;
export const WEAKEST_MIN_ANSWERS = 8;
/** WaniKani filter: only fetch items below this lifetime percentage. */
export const WEAKEST_PERCENTAGE_LESS_THAN = 90;

export type WeakestItem = {
	subjectId: number;
	subject: WKSubject;
	incorrect: number;
	total: number;
	accuracyPercent: number;
};

export function statisticAnswerCounts(statistic: WKReviewStatistic): {
	correct: number;
	incorrect: number;
	total: number;
} {
	const data = statistic.data;
	const correct = (data.meaning_correct ?? 0) + (data.reading_correct ?? 0);
	const incorrect = (data.meaning_incorrect ?? 0) + (data.reading_incorrect ?? 0);
	return {
		correct: Number.isFinite(correct) ? correct : 0,
		incorrect: Number.isFinite(incorrect) ? incorrect : 0,
		total: (Number.isFinite(correct) ? correct : 0) + (Number.isFinite(incorrect) ? incorrect : 0)
	};
}

export function rankWeakestStatistics(
	statistics: WKReviewStatistic[],
	limit = WEAKEST_ITEMS_LIMIT
): WKReviewStatistic[] {
	return statistics
		.filter((statistic) => statistic.data.hidden !== true)
		.map((statistic) => ({ statistic, ...statisticAnswerCounts(statistic) }))
		.filter((row) => row.total >= WEAKEST_MIN_ANSWERS && row.incorrect > 0)
		.sort((left, right) => {
			const leftRate = left.incorrect / left.total;
			const rightRate = right.incorrect / right.total;
			return rightRate - leftRate || right.incorrect - left.incorrect || right.total - left.total;
		})
		.slice(0, limit)
		.map((row) => row.statistic);
}

export function weakestItemsFromStatistics(
	statistics: WKReviewStatistic[],
	subjects: WKSubject[],
	limit = WEAKEST_ITEMS_LIMIT
): WeakestItem[] {
	const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
	return rankWeakestStatistics(statistics, limit).flatMap((statistic) => {
		const subject = subjectById.get(statistic.data.subject_id);
		if (!subject) return [];
		const { incorrect, total } = statisticAnswerCounts(statistic);
		return [
			{
				subjectId: subject.id,
				subject,
				incorrect,
				total,
				accuracyPercent: total > 0 ? Math.round(((total - incorrect) / total) * 100) : 100
			}
		];
	});
}
