import { writable } from 'svelte/store';
import { onPersistentHydrate, readPersistent, writePersistent } from '$lib/persistent-storage';
import type { ReviewCard } from '$lib/wanikani/types';

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

export const reviewSortOptions = [
	{ value: 'default', label: 'Default (WaniKani order)' },
	{ value: 'srs-ascending', label: 'SRS stage (ascending)' },
	{ value: 'srs-descending', label: 'SRS stage (descending)' },
	{ value: 'level-ascending', label: 'WaniKani level (ascending)' },
	{ value: 'level-descending', label: 'WaniKani level (descending)' },
	{ value: 'subject-type', label: 'Subject type' },
	{ value: 'random', label: 'Random' }
] as const;

export type ReviewSortOrder = (typeof reviewSortOptions)[number]['value'];

const REVIEW_SORT_KEY = 'wk-flash:review-sort';

function currentReviewSort(): ReviewSortOrder {
	const savedReviewSort = readPersistent(REVIEW_SORT_KEY);
	return reviewSortOptions.some((option) => option.value === savedReviewSort)
		? (savedReviewSort as ReviewSortOrder)
		: 'default';
}

const reviewSortStore = writable<ReviewSortOrder>(currentReviewSort());
onPersistentHydrate(() => reviewSortStore.set(currentReviewSort()));

export const reviewSort = {
	subscribe: reviewSortStore.subscribe,
	set(value: ReviewSortOrder) {
		writePersistent(REVIEW_SORT_KEY, value);
		reviewSortStore.set(value);
	}
};

export const prioritizeCurrentLevel = persistentBoolean(
	'wk-flash:prioritize-current-level',
	false
);

export function sortReviewCards(
	cards: ReviewCard[],
	order: ReviewSortOrder,
	prioritizeLevel = false
): ReviewCard[] {
	let sorted: ReviewCard[];
	if (order === 'random') {
		sorted = [...cards];
		for (let index = sorted.length - 1; index > 0; index--) {
			const otherIndex = Math.floor(Math.random() * (index + 1));
			[sorted[index], sorted[otherIndex]] = [sorted[otherIndex], sorted[index]];
		}
	} else if (order === 'default') {
		sorted = [...cards];
	} else {
		const subjectTypeOrder = { radical: 0, kanji: 1, vocabulary: 2, kana_vocabulary: 3 } as const;
		sorted = [...cards].sort((left, right) => {
			switch (order) {
				case 'srs-ascending':
					return (left.srsStage ?? 0) - (right.srsStage ?? 0);
				case 'srs-descending':
					return (right.srsStage ?? 0) - (left.srsStage ?? 0);
				case 'level-ascending':
					return left.subject.data.level - right.subject.data.level;
				case 'level-descending':
					return right.subject.data.level - left.subject.data.level;
				case 'subject-type':
					return subjectTypeOrder[left.subject.object] - subjectTypeOrder[right.subject.object];
			}
		});
	}

	return prioritizeLevel ? prioritizeCurrentLevelOrder(sorted) : sorted;
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
			end = currentCount;
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
