import type { WKAssignment, WKLevelProgression, WKReviewStatistic, WKSubject } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const GURU_STAGE = 5;
const NORMAL_INTERVAL_HOURS = [0, 4, 8, 23, 47, 167, 335, 719, 2879];
const ACCELERATED_INTERVAL_HOURS = [0, 2, 4, 8, 23, 167, 335, 719, 2879];

export type LevelUpForecast = {
	currentGuruKanji: number;
	requiredGuruKanji: number;
	totalCurrentKanji: number;
	newItemsPerLevel: number;
	estimatedReviewsPerLevel: number;
	scheduledReviews: number;
	averageReviewsPerNewItem: number;
	averageDailyReviews: number;
	forecastHorizonDays: number;
	accuracyPercent: number;
	assumedAccuracy: boolean;
	averageLevelDays: number | null;
	estimatedDaysToNextLevel: number | null;
	etaSource: 'srs_schedule' | 'historical_fallback' | 'srs_minimum' | 'unavailable';
};

type LevelUpForecastOptions = {
	currentLevel: number;
	maxSubjectLevel: number;
	targetDays: number;
	subjects: WKSubject[];
	assignments: WKAssignment[];
	reviewStatistics: WKReviewStatistic[] | null;
	levelProgressions: WKLevelProgression[] | null;
	now?: Date;
};

function timestamp(value: string | null | undefined): number | null {
	if (!value) return null;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function averageCompletedLevelDays(progressions: WKLevelProgression[] | null): number | null {
	if (!progressions) return null;
	const sorted = progressions
		.filter((progression) => !progression.data.abandoned_at)
		.sort((first, second) => first.data.level - second.data.level);
	const durations: number[] = [];

	for (let index = 0; index < sorted.length; index++) {
		const progression = sorted[index];
		const start = timestamp(progression.data.unlocked_at) ?? timestamp(progression.data.started_at);
		const next = sorted[index + 1];
		const nextLevelStart = next?.data.level === progression.data.level + 1
			? timestamp(next.data.unlocked_at) ?? timestamp(next.data.started_at)
			: null;
		const end = timestamp(progression.data.passed_at) ?? nextLevelStart;
		if (start === null || end === null || end <= start) continue;
		durations.push((end - start) / DAY_MS);
	}

	return durations.length ? durations.reduce((sum, days) => sum + days, 0) / durations.length : null;
}

function intervalHours(stage: number, level: number): number | null {
	const intervals = level <= 2 ? ACCELERATED_INTERVAL_HOURS : NORMAL_INTERVAL_HOURS;
	return intervals[stage] ?? null;
}

function guruDate(subject: WKSubject, assignment: WKAssignment | undefined, now: Date): number {
	if (!assignment || assignment.data.hidden || assignment.data.unlocked_at === null) return Number.POSITIVE_INFINITY;
	const stage = assignment.data.srs_stage;
	if (stage >= GURU_STAGE) return timestamp(assignment.data.passed_at) ?? now.getTime();

	const roundedNow = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
	const availableAt = timestamp(assignment.data.available_at);
	let projectedAt = Math.max(roundedNow, availableAt ?? roundedNow);
	const firstStage = stage <= 0 ? 1 : stage + 1;
	for (let nextStage = firstStage; nextStage <= GURU_STAGE - 1; nextStage++) {
		const interval = intervalHours(nextStage, subject.data.level);
		if (interval !== null) projectedAt += interval * HOUR_MS;
	}
	return projectedAt;
}

function minimumGuruHours(level: number): number {
	let hours = 0;
	for (let stage = 1; stage <= GURU_STAGE - 1; stage++) {
		hours += intervalHours(stage, level) ?? 0;
	}
	return hours;
}

function measuredAccuracy(reviewStatistics: WKReviewStatistic[] | null): number | null {
	let correct = 0;
	let answers = 0;
	for (const statistic of reviewStatistics ?? []) {
		if (statistic.data.hidden) continue;
		const meaningCorrect = statistic.data.meaning_correct ?? 0;
		const readingCorrect = statistic.data.reading_correct ?? 0;
		correct += meaningCorrect + readingCorrect;
		answers += meaningCorrect + (statistic.data.meaning_incorrect ?? 0) + readingCorrect +
			(statistic.data.reading_incorrect ?? 0);
	}
	const accuracy = answers > 0 ? (correct / answers) * 100 : 0;
	return answers >= 100 && accuracy >= 80 ? Math.min(99, accuracy) : null;
}

function expectedReviewsToGuru(passProbability: number): number {
	const probability = Math.max(0.01, Math.min(0.999, passProbability));
	return GURU_STAGE / probability;
}

function expectedScheduledReviews(
	assignments: WKAssignment[],
	subjectsById: Map<number, WKSubject>,
	perAnswerAccuracy: number,
	now: Date,
	horizonDays: number
): number {
	const horizonEnd = now.getTime() + horizonDays * DAY_MS;
	let total = 0;

	for (const assignment of assignments) {
		const { data } = assignment;
		if (data.hidden || data.srs_stage < 1 || data.srs_stage >= 9) continue;
		const subject = subjectsById.get(data.subject_id);
		const availableAt = timestamp(data.available_at);
		if (!subject || subject.data.hidden_at || availableAt === null) continue;

		const questionCount = subject.object === 'radical' || subject.object === 'kana_vocabulary' ? 1 : 2;
		const passProbability = perAnswerAccuracy ** questionCount;
		let stage = data.srs_stage;
		let dueAt = Math.max(now.getTime(), availableAt);
		while (stage < 9 && dueAt <= horizonEnd) {
			total += 1 / passProbability;
			stage++;
			if (stage >= 9) break;
			const interval = intervalHours(stage, subject.data.level);
			if (interval === null) break;
			dueAt += interval * HOUR_MS;
		}
	}
	return total;
}


export function calculateLevelUpForecast({
	currentLevel,
	maxSubjectLevel,
	targetDays,
	subjects,
	assignments,
	reviewStatistics,
	levelProgressions,
	now = new Date()
}: LevelUpForecastOptions): LevelUpForecast {
	const safeTargetDays = Number.isFinite(targetDays) ? Math.max(1, targetDays) : 30;
	const assignmentsBySubjectId = new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
	const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));
	const currentKanji = subjects
		.filter((subject) => subject.object === 'kanji' && subject.data.level === currentLevel)
		.filter((subject) => !subject.data.hidden_at && !assignmentsBySubjectId.get(subject.id)?.data.hidden);
	const totalCurrentKanji = currentKanji.length;
	const requiredGuruKanji = totalCurrentKanji ? Math.ceil(totalCurrentKanji * 0.9) : 0;
	const currentGuruKanji = currentKanji.filter((subject) =>
		(assignmentsBySubjectId.get(subject.id)?.data.srs_stage ?? 0) >= GURU_STAGE
	).length;
	const upcomingLevel = currentLevel < maxSubjectLevel ? currentLevel + 1 : null;
	const newSubjects = upcomingLevel === null ? [] : subjects.filter((subject) =>
		subject.data.level === upcomingLevel &&
		!subject.data.hidden_at &&
		!assignmentsBySubjectId.has(subject.id)
	);
	const newItemsPerLevel = newSubjects.length;
	const accuracy = measuredAccuracy(reviewStatistics);
	const perAnswerAccuracy = (accuracy ?? 90) / 100;
	const expectedReviews = newSubjects.reduce((total, subject) => {
		const questionCount = subject.object === 'radical' || subject.object === 'kana_vocabulary' ? 1 : 2;
		return total + expectedReviewsToGuru(perAnswerAccuracy ** questionCount);
	}, 0);
	const averageReviewsPerNewItem = newItemsPerLevel ? expectedReviews / newItemsPerLevel : 0;
	const estimatedReviewsPerLevel = Math.round(expectedReviews);
	const forecastHorizonDays = Math.max(1, safeTargetDays);
	const scheduledReviewsExpected = expectedScheduledReviews(
		assignments,
		subjectsById,
		perAnswerAccuracy,
		now,
		forecastHorizonDays
	);
	const scheduledReviews = Math.round(scheduledReviewsExpected);
	const averageDailyReviews = (expectedReviews + scheduledReviewsExpected) / forecastHorizonDays;
	const averageLevelDays = averageCompletedLevelDays(levelProgressions);
	const currentProgression = levelProgressions
		?.filter((progression) => progression.data.level === currentLevel && !progression.data.abandoned_at)
		.sort((first, second) => (timestamp(second.data.unlocked_at) ?? 0) - (timestamp(first.data.unlocked_at) ?? 0))
		.at(0);
	const currentLevelStart = timestamp(currentProgression?.data.unlocked_at) ?? timestamp(currentProgression?.data.started_at);
	const elapsedLevelDays = currentLevelStart === null ? null : Math.max(0, (now.getTime() - currentLevelStart) / DAY_MS);
	let estimatedDaysToNextLevel: number | null = null;
	let etaSource: LevelUpForecast['etaSource'] = 'unavailable';
	const guruDates = currentKanji
		.map((subject) => guruDate(subject, assignmentsBySubjectId.get(subject.id), now))
		.sort((first, second) => first - second);
	const gateDate = requiredGuruKanji ? guruDates[requiredGuruKanji - 1] : null;
	if (gateDate !== null && Number.isFinite(gateDate)) {
		estimatedDaysToNextLevel = Math.max(0, (gateDate - now.getTime()) / DAY_MS);
		etaSource = 'srs_schedule';
	} else if (requiredGuruKanji > 0) {
		const currentRadicalDates = subjects
			.filter((subject) => subject.object === 'radical' && subject.data.level === currentLevel && !subject.data.hidden_at)
			.map((subject) => guruDate(subject, assignmentsBySubjectId.get(subject.id), now))
			.filter(Number.isFinite);
		const lastRadicalDays = currentRadicalDates.length
			? Math.max(0, (Math.max(...currentRadicalDates) - now.getTime()) / DAY_MS)
			: 0;
		const freshKanjiDays = currentKanji.length ? minimumGuruHours(currentKanji[currentKanji.length - 1].data.level) / 24 : 0;
		const historicalRemaining = averageLevelDays === null
			? 0
			: Math.max(0, averageLevelDays - (elapsedLevelDays ?? 0));
		const fallbackDays = Math.max(historicalRemaining, freshKanjiDays + lastRadicalDays);
		if (fallbackDays > 0) {
			estimatedDaysToNextLevel = fallbackDays;
			etaSource = averageLevelDays === null ? 'srs_minimum' : 'historical_fallback';
		}
	}
	return {
		currentGuruKanji,
		requiredGuruKanji,
		totalCurrentKanji,
		newItemsPerLevel,
		estimatedReviewsPerLevel,
		scheduledReviews,
		averageReviewsPerNewItem: Math.round(averageReviewsPerNewItem * 10) / 10,
		averageDailyReviews: Math.round(averageDailyReviews),
		forecastHorizonDays,
		accuracyPercent: accuracy ?? 90,
		assumedAccuracy: accuracy === null,
		averageLevelDays,
		estimatedDaysToNextLevel,
		etaSource
	};
}