import jlptKanji from '$lib/data/jlpt-kanji.json';
import jlptVocabulary from '$lib/data/jlpt-vocabulary.json';
import kanjiVerbose from '$lib/data/kanji-verbose.json';
import wkLevels from '$lib/data/wk-levels.json';

// Static, public JLPT pages. Everything here is derived from bundled data files,
// so these pages never call the WaniKani API.

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type JLPTLevel = (typeof JLPT_LEVELS)[number];

export interface VocabularyItem {
	expression: string;
	reading: string;
	meaning: string;
	levels: JLPTLevel[];
}

export interface KanjiListItem {
	character: string;
	meaning: string | null;
	onyomi: string | null;
	kunyomi: string | null;
	wkLevel: number | null;
	/** True when a detail page exists for this kanji. */
	hasPage: boolean;
}

export interface KanjiDetail extends KanjiListItem {
	level: JLPTLevel;
	meaning: string;
	examples: VocabularyItem[];
}

interface VerboseKanji {
	category: string;
	character: string;
	onyomi: string;
	kunyomi: string;
	meaning: string;
}

const verboseByCharacter = new Map<string, VerboseKanji>(
	(kanjiVerbose.kanji as VerboseKanji[]).map((kanji) => [kanji.character, kanji])
);
const wkLevelByCharacter = new Map<string, number>(wkLevels.map((entry) => [entry.kanji, entry.level]));

const kanjiSetByLevel = new Map<JLPTLevel, string[]>(
	JLPT_LEVELS.map((level) => [level, [...new Set(Array.from(jlptKanji[level]))]])
);

const levelByCharacter = new Map<string, JLPTLevel>();
for (const level of JLPT_LEVELS) {
	for (const character of kanjiSetByLevel.get(level)!) levelByCharacter.set(character, level);
}

const vocabulary = jlptVocabulary.entries as VocabularyItem[];

const vocabularyByCharacter = new Map<string, VocabularyItem[]>();
for (const entry of vocabulary) {
	for (const character of new Set(Array.from(entry.expression))) {
		if (!levelByCharacter.has(character)) continue;
		const list = vocabularyByCharacter.get(character) ?? [];
		list.push(entry);
		vocabularyByCharacter.set(character, list);
	}
}

function cleanText(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function kanjiListItem(character: string): KanjiListItem {
	const verbose = verboseByCharacter.get(character);
	const meaning = cleanText(verbose?.meaning);
	return {
		character,
		meaning,
		onyomi: cleanText(verbose?.onyomi),
		kunyomi: cleanText(verbose?.kunyomi),
		wkLevel: wkLevelByCharacter.get(character) ?? null,
		hasPage: levelByCharacter.has(character) && meaning !== null
	};
}

const kanjiPageCharacterList = [...levelByCharacter.keys()].filter((character) => kanjiListItem(character).hasPage);

/** Only the lowercase slugs (`n5` … `n1`) are valid, so each level has one URL. */
export function levelFromSlug(slug: string): JLPTLevel | null {
	return JLPT_LEVELS.find((level) => levelSlug(level) === slug) ?? null;
}

export function levelSlug(level: JLPTLevel): string {
	return level.toLowerCase();
}

export function kanjiSetSize(level: JLPTLevel): number {
	return kanjiSetByLevel.get(level)!.length;
}

/** WaniKani levels sort ascending, with items that have no level last. */
function byWkLevel<T extends { wkLevel: number | null }>(a: T, b: T): number {
	if (a.wkLevel === b.wkLevel) return 0;
	if (a.wkLevel === null) return 1;
	if (b.wkLevel === null) return -1;
	return a.wkLevel - b.wkLevel;
}

export function kanjiForLevel(level: JLPTLevel): KanjiListItem[] {
	return kanjiSetByLevel.get(level)!.map(kanjiListItem).sort(byWkLevel);
}

export function vocabularyForLevel(level: JLPTLevel): VocabularyItem[] {
	return vocabulary.filter((entry) => entry.levels.includes(level));
}

export interface VocabularyListItem extends VocabularyItem {
	/** Highest WaniKani level among the word's kanji. An estimate, since the word list has no WaniKani vocabulary levels. */
	wkLevel: number | null;
}

/** Highest WaniKani level among a word's kanji, or null when none of its kanji are on WaniKani (for example, kana-only words). */
function vocabularyWkLevel(entry: VocabularyItem): number | null {
	let highest: number | null = null;
	for (const character of Array.from(entry.expression)) {
		const level = wkLevelByCharacter.get(character);
		if (level !== undefined && (highest === null || level > highest)) highest = level;
	}
	return highest;
}

export function vocabularyListForLevel(level: JLPTLevel): VocabularyListItem[] {
	return vocabularyForLevel(level)
		.map((entry) => ({ ...entry, wkLevel: vocabularyWkLevel(entry) }))
		.sort(byWkLevel);
}

export function kanjiPageCharacters(): string[] {
	return kanjiPageCharacterList;
}

export function kanjiDetail(character: string): KanjiDetail | null {
	const level = levelByCharacter.get(character);
	const item = kanjiListItem(character);
	if (!level || !item.hasPage || item.meaning === null) return null;
	return {
		...item,
		level,
		meaning: item.meaning,
		examples: (vocabularyByCharacter.get(character) ?? []).slice(0, 12)
	};
}

/** Paths for the static JLPT pages, used by the sitemap. */
export function jlptSitemapPaths(): string[] {
	return [
		'/jlpt',
		...JLPT_LEVELS.flatMap((level) => [
			`/jlpt/${levelSlug(level)}/kanji`,
			`/jlpt/${levelSlug(level)}/vocabulary`
		]),
		...kanjiPageCharacterList.map((character) => `/jlpt/kanji/${encodeURIComponent(character)}`)
	];
}
