import localN1Kanji from '$lib/data/local-n1-kanji.json';
import jlptVocabulary from '$lib/data/jlpt-vocabulary.json';
import verboseKanji from '$lib/data/kanji-verbose.json';
import { readPersistent, writePersistent } from '$lib/persistent-storage';
import type { ReviewCard, WKSubject, WKSubjectData } from '$lib/wanikani/types';

const STORAGE_KEY = 'wk-flash:local-n1-review-progress';
const LOCAL_CARD_RATIO = 20;
const LOCAL_SRS_INTERVALS_MS = [
	4 * 60 * 60 * 1000,
	8 * 60 * 60 * 1000,
	24 * 60 * 60 * 1000,
	2 * 24 * 60 * 60 * 1000,
	7 * 24 * 60 * 60 * 1000,
	14 * 24 * 60 * 60 * 1000,
	30 * 24 * 60 * 60 * 1000,
	120 * 24 * 60 * 60 * 1000,
	365 * 24 * 60 * 60 * 1000
];

type VerboseKanji = {
	category: string;
	character: string;
	onyomi: string;
	kunyomi: string;
	meaning: string;
};

type VocabularyEntry = {
	expression: string;
	reading: string;
	meaning: string;
	levels: string[];
};

export interface LocalReviewProgress {
	stage: number;
	availableAt: string;
}

export interface LocalReviewCard extends ReviewCard {
	origin: 'local';
	localId: string;
}

function readProgress(): Record<string, LocalReviewProgress> {
	try {
		const stored = readPersistent(STORAGE_KEY);
		if (!stored) return {};
		const parsed = JSON.parse(stored) as Record<string, Partial<LocalReviewProgress>>;
		return Object.fromEntries(
			Object.entries(parsed).flatMap(([id, value]) =>
				Number.isInteger(value.stage) &&
				typeof value.availableAt === 'string' &&
				Number.isFinite(Date.parse(value.availableAt))
					? [[id, { stage: Math.max(0, Math.min(9, value.stage!)), availableAt: value.availableAt }]]
					: []
			)
		);
	} catch {
		return {};
	}
}

function writeProgress(progress: Record<string, LocalReviewProgress>): void {
	writePersistent(STORAGE_KEY, JSON.stringify(progress));
}

function normalizedReadings(value: string): string[] {
	return [...new Set(
		value
			.split(/[\s、]+/)
			.map((reading) => reading.replace(/[.-]/g, '').trim())
			.filter((reading) => reading && reading !== '−')
	)];
}

function subjectData(
	characters: string,
	meanings: string[],
	readings: string[],
	level: number
): WKSubjectData {
	return {
		characters,
		level,
		meanings: meanings.map((meaning, index) => ({
			meaning,
			primary: index === 0,
			accepted_answer: true
		})),
		readings: readings.map((reading, index) => ({
			reading,
			primary: index === 0,
			accepted_answer: true
		})),
		meaning_mnemonic: '',
		slug: characters,
		document_url: `https://jisho.org/search/${encodeURIComponent(`${characters} #kanji`)}`
	};
}

function stableAssignmentIds(localIds: string[]): Map<string, number> {
	const ids = new Map<string, number>();
	for (const [index, localId] of localIds.sort().entries()) ids.set(localId, -(index + 1));
	return ids;
}

function stableLocalSubjectId(value: string): number {
	let hash = 0;
	for (const character of value) hash = (hash * 31 + character.codePointAt(0)!) | 0;
	return -(Math.abs(hash) || 1);
}

const canonicalLocalN1Kanji = new Set(Array.from(localN1Kanji.characters));

/**
 * Builds the local-only N1 cards. Their content is bundled with the app and never enters a WaniKani API payload.
 */
export function buildLocalN1ReviewCards(): LocalReviewCard[] {
	const missingCharacters = canonicalLocalN1Kanji;
	const verboseByCharacter = new Map(
		(verboseKanji.kanji as VerboseKanji[]).map((item) => [item.character, item])
	);
	const definitions: {
		localId: string;
		characters: string;
		object: 'kanji' | 'vocabulary';
		meanings: string[];
		readings: string[];
	}[] = [];

	for (const character of [...missingCharacters].sort()) {
		const item = verboseByCharacter.get(character);
		if (!item) continue;
		definitions.push({
			localId: `local-kanji:${character}`,
			characters: character,
			object: 'kanji',
			meanings: item.meaning.split(',').map((meaning) => meaning.trim()).filter(Boolean),
			readings: [...normalizedReadings(item.onyomi), ...normalizedReadings(item.kunyomi)]
		});
	}

	for (const item of jlptVocabulary.entries as VocabularyEntry[]) {
		if (!item.levels.includes('N1') || !Array.from(item.expression).some((character) => missingCharacters.has(character))) {
			continue;
		}
		definitions.push({
			localId: `local-vocab:${item.expression}\t${item.reading}`,
			characters: item.expression,
			object: 'vocabulary',
			meanings: item.meaning.split(/[;,]/).map((meaning) => meaning.trim()).filter(Boolean),
			readings: normalizedReadings(item.reading)
		});
	}

	const assignmentIds = stableAssignmentIds(definitions.map((item) => item.localId));
	const progress = readProgress();
	return definitions.map((item) => {
		const state = progress[item.localId];
		const subject: WKSubject = {
			id: assignmentIds.get(item.localId)!,
			object: item.object,
			data: subjectData(item.characters, item.meanings, item.readings, 0)
		};
		return {
			assignmentId: subject.id,
			origin: 'local',
			localId: item.localId,
			availableAt: state?.availableAt ?? null,
			srsStage: state?.stage ?? 0,
			subject,
			needsReading: item.readings.length > 0,
			incorrectCount: 0
		};
	});
}

/** Returns bundled N1 data for a subject WaniKani does not provide. */
export function getStaticLocalN1Subject(
	type: 'kanji' | 'vocab',
	slug: string,
	reading?: string | null
): WKSubject | null {
	if (type === 'kanji') {
		if (!canonicalLocalN1Kanji.has(slug)) return null;
		const item = (verboseKanji.kanji as VerboseKanji[]).find(
			(candidate) => candidate.character === slug && candidate.category === 'jlptn1'
		);
		if (!item) return null;
		return {
			id: stableLocalSubjectId(`local-kanji:${slug}`),
			object: 'kanji',
			data: subjectData(
				slug,
				item.meaning.split(',').map((meaning) => meaning.trim()).filter(Boolean),
				[...normalizedReadings(item.onyomi), ...normalizedReadings(item.kunyomi)],
				0
			)
		};
	}

	const item = (jlptVocabulary.entries as VocabularyEntry[]).find(
		(candidate) =>
			candidate.levels.includes('N1') &&
			candidate.expression === slug &&
			(!reading || candidate.reading === reading)
	);
	if (!item) return null;
	return {
		id: stableLocalSubjectId(`local-vocab:${item.expression}\t${item.reading}`),
		object: 'vocabulary',
		data: subjectData(
			item.expression,
			item.meaning.split(/[;,]/).map((meaning) => meaning.trim()).filter(Boolean),
			normalizedReadings(item.reading),
			0
		)
	};
}

/**
 * Selects due local cards plus a paced number of unseen cards, without mutating local progress.
 */
export function selectPacedLocalCards(cards: LocalReviewCard[], waniKaniReviewCount: number): LocalReviewCard[] {
	if (waniKaniReviewCount <= 0) return [];
	const progress = readProgress();
	const now = Date.now();
	const maxCards = Math.max(1, Math.ceil(waniKaniReviewCount / LOCAL_CARD_RATIO));
	const due = cards.filter((card) => {
		const state = progress[card.localId];
		return state && Date.parse(state.availableAt) <= now;
	});
	const unseen = cards.filter((card) => !progress[card.localId]);
	return [...due, ...unseen].slice(0, maxCards);
}

export function applyLocalCorrectAnswer(localId: string): LocalReviewProgress | null {
	const progress = readProgress();
	const previous = progress[localId] ?? null;
	const stage = Math.min(9, (previous?.stage ?? 0) + 1);
	progress[localId] = {
		stage,
		availableAt: new Date(Date.now() + LOCAL_SRS_INTERVALS_MS[stage - 1]).toISOString()
	};
	writeProgress(progress);
	return previous;
}

export function restoreLocalReviewProgress(localId: string, previous: LocalReviewProgress | null): void {
	const progress = readProgress();
	if (previous) progress[localId] = previous;
	else delete progress[localId];
	writeProgress(progress);
}

export function isLocalReviewCard(card: ReviewCard): card is LocalReviewCard {
	return card.origin === 'local' && typeof card.localId === 'string';
}
