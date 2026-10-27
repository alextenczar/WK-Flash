import { get, writable } from 'svelte/store';
import { onPersistentHydrate, readPersistent, writePersistent } from '$lib/persistent-storage';
import type { ReviewCard, SubjectType } from '$lib/wanikani/types';

function persistentBoolean(key: string, defaultValue: boolean) {
	function current(): boolean {
		const stored = readPersistent(key);
		if (stored === null) return defaultValue;
		return defaultValue ? stored !== 'false' : stored === 'true';
	}

	const store = writable(current());
	onPersistentHydrate(() => store.set(current()));

	return {
		subscribe: store.subscribe,
		set(value: boolean) {
			writePersistent(key, String(value));
			store.set(value);
		}
	};
}

export const showMnemonics = persistentBoolean('wk-flash:show-mnemonics', true);
export const showSrsChanges = persistentBoolean('wk-flash:show-srs-changes', true);
export const showPartsOfSpeech = persistentBoolean('wk-flash:show-parts-of-speech', true);
export const showTimeEstimate = persistentBoolean('wk-flash:show-time-estimate', true);
export const showUndoButton = persistentBoolean('wk-flash:show-undo-button', false);
export const interweaveLocalN1Reviews = persistentBoolean(
	'wk-flash:interweave-local-n1-reviews',
	false
);

/** What a review can be sorted by. */
export type SortField = 'srs-stage' | 'wanikani-level' | 'review-type';
export type SortDirection = 'ascending' | 'descending';

export interface SortRule {
	field: SortField;
	direction: SortDirection;
}

export interface ReviewSortSettings {
	/** `default` keeps WaniKani's order, `random` shuffles, and a rule sorts by its field. */
	primary: SortRule | 'default' | 'random';
	/** Orders cards that tie on the primary rule. Ignored when the primary is `default` or `random`. */
	secondary: SortRule | null;
}

/** Choices offered by the "Sort by" dropdown. */
export type PrimarySortChoice = 'default' | 'random' | SortField;

export const sortFieldOptions = [
	{ value: 'srs-stage', label: 'SRS stage' },
	{ value: 'wanikani-level', label: 'WaniKani level' },
	{ value: 'review-type', label: 'Review type' }
] as const satisfies readonly { value: SortField; label: string }[];

const SORT_FIELDS: readonly SortField[] = sortFieldOptions.map((option) => option.value);

/** Radicals, then kanji, then vocabulary, as WaniKani lists them. */
const SUBJECT_TYPE_ORDER: Record<SubjectType, number> = {
	radical: 0,
	kanji: 1,
	vocabulary: 2,
	kana_vocabulary: 3
};

/** Labels a direction for the dropdowns. Review type reads as a sequence, so it gets its own wording. */
export function sortDirectionLabel(field: SortField | null, direction: SortDirection): string {
	if (field === 'review-type') {
		return direction === 'ascending' ? 'Radicals to vocabulary' : 'Vocabulary to radicals';
	}
	return direction === 'ascending' ? 'Ascending' : 'Descending';
}

const REVIEW_SORT_KEY = 'wk-flash:review-sort-v2';
const LEGACY_REVIEW_SORT_KEY = 'wk-flash:review-sort';

/** Values saved by the single-dropdown setting this replaced. */
const LEGACY_REVIEW_SORTS = new Map<string, ReviewSortSettings['primary']>([
	['default', 'default'],
	['random', 'random'],
	['srs-ascending', { field: 'srs-stage', direction: 'ascending' }],
	['srs-descending', { field: 'srs-stage', direction: 'descending' }],
	['level-ascending', { field: 'wanikani-level', direction: 'ascending' }],
	['level-descending', { field: 'wanikani-level', direction: 'descending' }],
	['subject-type', { field: 'review-type', direction: 'ascending' }]
]);

function isSortField(value: unknown): value is SortField {
	return SORT_FIELDS.includes(value as SortField);
}

function isSortRule(value: unknown): value is SortRule {
	if (typeof value !== 'object' || value === null) return false;
	const { field, direction } = value as Partial<SortRule>;
	return isSortField(field) && (direction === 'ascending' || direction === 'descending');
}

/** A secondary rule on the same field as the primary can never change the order, so it is dropped. */
function normalizeReviewSort(settings: ReviewSortSettings): ReviewSortSettings {
	const { primary, secondary } = settings;
	const repeatsPrimary = typeof primary !== 'string' && secondary?.field === primary.field;
	return { primary, secondary: repeatsPrimary ? null : secondary };
}

function parseReviewSort(raw: string): ReviewSortSettings | null {
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown> | null;
		if (typeof parsed !== 'object' || parsed === null) return null;
		const { primary, secondary } = parsed;
		const validPrimary: ReviewSortSettings['primary'] | null =
			primary === 'default' || primary === 'random' ? primary : isSortRule(primary) ? primary : null;
		if (validPrimary === null) return null;
		return normalizeReviewSort({
			primary: validPrimary,
			secondary: isSortRule(secondary) ? secondary : null
		});
	} catch {
		return null;
	}
}

function currentReviewSort(): ReviewSortSettings {
	const stored = readPersistent(REVIEW_SORT_KEY);
	const parsed = stored === null ? null : parseReviewSort(stored);
	if (parsed) return parsed;

	const legacy = readPersistent(LEGACY_REVIEW_SORT_KEY);
	const legacyPrimary = legacy === null ? undefined : LEGACY_REVIEW_SORTS.get(legacy);
	if (legacyPrimary !== undefined) return { primary: legacyPrimary, secondary: null };

	return { primary: 'default', secondary: null };
}

const reviewSortStore = writable<ReviewSortSettings>(currentReviewSort());
onPersistentHydrate(() => reviewSortStore.set(currentReviewSort()));

function saveReviewSort(settings: ReviewSortSettings): void {
	const normalized = normalizeReviewSort(settings);
	writePersistent(REVIEW_SORT_KEY, JSON.stringify(normalized));
	reviewSortStore.set(normalized);
}

export const reviewSort = {
	subscribe: reviewSortStore.subscribe,
	/**
	 * Picks the "Sort by" choice. Picking the field that is already under "Then by" swaps the two
	 * rules, so the combination stays valid instead of silently losing the second sort.
	 */
	setPrimary(choice: PrimarySortChoice): void {
		const current = get(reviewSortStore);
		if (choice === 'default' || choice === 'random') {
			saveReviewSort({ ...current, primary: choice });
			return;
		}
		const previous = typeof current.primary === 'string' ? null : current.primary;
		if (current.secondary?.field === choice) {
			saveReviewSort({ primary: current.secondary, secondary: previous });
			return;
		}
		saveReviewSort({
			primary: { field: choice, direction: 'ascending' },
			secondary: current.secondary
		});
	},
	setPrimaryDirection(direction: SortDirection): void {
		const current = get(reviewSortStore);
		if (typeof current.primary === 'string') return;
		saveReviewSort({ ...current, primary: { ...current.primary, direction } });
	},
	/** Sets the "Then by" field, or clears it with `null`. */
	setSecondaryField(field: SortField | null): void {
		const current = get(reviewSortStore);
		saveReviewSort({
			...current,
			secondary: field === null ? null : { field, direction: 'ascending' }
		});
	},
	setSecondaryDirection(direction: SortDirection): void {
		const current = get(reviewSortStore);
		if (!current.secondary) return;
		saveReviewSort({ ...current, secondary: { ...current.secondary, direction } });
	}
};

export const prioritizeCurrentLevel = persistentBoolean(
	'wk-flash:prioritize-current-level',
	false
);

function compareField(field: SortField, left: ReviewCard, right: ReviewCard): number {
	switch (field) {
		case 'srs-stage':
			return (left.srsStage ?? 0) - (right.srsStage ?? 0);
		case 'wanikani-level':
			return left.subject.data.level - right.subject.data.level;
		case 'review-type':
			return SUBJECT_TYPE_ORDER[left.subject.object] - SUBJECT_TYPE_ORDER[right.subject.object];
	}
}

function compareRule(rule: SortRule, left: ReviewCard, right: ReviewCard): number {
	const difference = compareField(rule.field, left, right);
	return rule.direction === 'descending' ? -difference : difference;
}

export function sortReviewCards(
	cards: ReviewCard[],
	settings: ReviewSortSettings,
	prioritizeLevel = false
): ReviewCard[] {
	let sorted: ReviewCard[];
	if (settings.primary === 'random') {
		sorted = [...cards];
		for (let index = sorted.length - 1; index > 0; index--) {
			const otherIndex = Math.floor(Math.random() * (index + 1));
			[sorted[index], sorted[otherIndex]] = [sorted[otherIndex], sorted[index]];
		}
	} else if (settings.primary === 'default') {
		sorted = [...cards];
	} else {
		const { primary, secondary } = settings;
		// Array.prototype.sort is stable, so cards that tie on every rule keep WaniKani's order.
		sorted = [...cards].sort((left, right) => {
			const difference = compareRule(primary, left, right);
			if (difference !== 0 || !secondary) return difference;
			return compareRule(secondary, left, right);
		});
	}

	return prioritizeLevel ? prioritizeCurrentLevelOrder(sorted) : sorted;
}

/**
 * Identifies the ordering `sortReviewCards` produces for these settings. Saved with a review
 * session so a resumed session can tell whether the order has to be rebuilt. A `random` or
 * `default` primary ignores the secondary rule, so changing it does not count as a change.
 */
export function reviewSortKey(settings: ReviewSortSettings, prioritizeLevel: boolean): string {
	const rule = (value: SortRule | null) => (value ? `${value.field}:${value.direction}` : 'none');
	const primary =
		typeof settings.primary === 'string' ? settings.primary : rule(settings.primary);
	const secondary = typeof settings.primary === 'string' ? 'none' : rule(settings.secondary);
	return `${primary}|${secondary}|${prioritizeLevel ? 'level-first' : 'level-any'}`;
}

export function isCurrentLevelCard(card: ReviewCard): boolean {
	return card.currentUserLevel !== undefined && card.subject.data.level === card.currentUserLevel;
}

/** Moves current-level cards ahead of the rest, keeping each group's relative order. */
export function prioritizeCurrentLevelOrder(cards: ReviewCard[]): ReviewCard[] {
	return [...cards.filter(isCurrentLevelCard), ...cards.filter((card) => !isCurrentLevelCard(card))];
}

/**
 * Where to re-insert a missed card in the rest of the queue: a few positions in, Anki-style.
 * With prioritization on, the card stays inside its own group so current-level cards keep
 * coming first.
 */
export function requeueOffset(
	rest: ReviewCard[],
	card: ReviewCard,
	prioritizeLevel: boolean,
	random: () => number = Math.random
): number {
	const jitter = 3 + Math.floor(random() * 4);
	let start = 0;
	let end = rest.length;
	if (prioritizeLevel) {
		const currentCount = rest.filter(isCurrentLevelCard).length;
		if (isCurrentLevelCard(card)) {
			// Keep a missed current-level card inside the current-level block. When no current-level
			// cards are left, it moves through the other levels instead of being shown again at once.
			if (currentCount > 0) end = currentCount;
		} else {
			start = currentCount;
		}
	}
	return start + Math.min(end - start, jitter);
}

/**
 * Adds newly due cards to the queue. The card at the front is the one on screen, so it stays
 * there; with prioritization on, the remaining cards keep current-level items first.
 */
export function appendToQueue(
	queue: ReviewCard[],
	incoming: ReviewCard[],
	prioritizeLevel: boolean
): ReviewCard[] {
	if (!prioritizeLevel) return [...queue, ...incoming];
	const [head, ...rest] = queue;
	const ordered = prioritizeCurrentLevelOrder([...rest, ...incoming]);
	return head ? [head, ...ordered] : ordered;
}
