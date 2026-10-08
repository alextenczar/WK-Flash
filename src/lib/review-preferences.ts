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

	if (!prioritizeLevel) return sorted;
	const currentLevel = sorted.filter(
		(card) => card.currentUserLevel !== undefined && card.subject.data.level === card.currentUserLevel
	);
	const otherLevels = sorted.filter(
		(card) => card.currentUserLevel === undefined || card.subject.data.level !== card.currentUserLevel
	);
	return [...currentLevel, ...otherLevels];
}
