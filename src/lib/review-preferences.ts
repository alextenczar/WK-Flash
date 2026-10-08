import { writable } from 'svelte/store';
import { readLocalStorage, writeLocalStorage } from '$lib/safe-storage';
import type { ReviewCard } from '$lib/wanikani/types';

const STORAGE_KEY = 'wk-flash:show-mnemonics';
const initial = readLocalStorage(STORAGE_KEY) !== 'false';
const store = writable(initial);
const SHOW_SRS_CHANGES_KEY = 'wk-flash:show-srs-changes';
const showSrsChangesStore = writable(readLocalStorage(SHOW_SRS_CHANGES_KEY) !== 'false');
const SHOW_PARTS_OF_SPEECH_KEY = 'wk-flash:show-parts-of-speech';
const showPartsOfSpeechStore = writable(readLocalStorage(SHOW_PARTS_OF_SPEECH_KEY) !== 'false');

export const showMnemonics = {
	subscribe: store.subscribe,
	set(value: boolean) {
		writeLocalStorage(STORAGE_KEY, String(value));
		store.set(value);
	}
};

export const showSrsChanges = {
	subscribe: showSrsChangesStore.subscribe,
	set(value: boolean) {
		writeLocalStorage(SHOW_SRS_CHANGES_KEY, String(value));
		showSrsChangesStore.set(value);
	}
};

export const showPartsOfSpeech = {
	subscribe: showPartsOfSpeechStore.subscribe,
	set(value: boolean) {
		writeLocalStorage(SHOW_PARTS_OF_SPEECH_KEY, String(value));
		showPartsOfSpeechStore.set(value);
	}
};

const SHOW_TIME_ESTIMATE_KEY = 'wk-flash:show-time-estimate';
const showTimeEstimateStore = writable(readLocalStorage(SHOW_TIME_ESTIMATE_KEY) !== 'false');

export const showTimeEstimate = {
	subscribe: showTimeEstimateStore.subscribe,
	set(value: boolean) {
		writeLocalStorage(SHOW_TIME_ESTIMATE_KEY, String(value));
		showTimeEstimateStore.set(value);
	}
};

const SHOW_UNDO_BUTTON_KEY = 'wk-flash:show-undo-button';
const showUndoButtonStore = writable(readLocalStorage(SHOW_UNDO_BUTTON_KEY) === 'true');

export const showUndoButton = {
	subscribe: showUndoButtonStore.subscribe,
	set(value: boolean) {
		writeLocalStorage(SHOW_UNDO_BUTTON_KEY, String(value));
		showUndoButtonStore.set(value);
	}
};

const INTERWEAVE_LOCAL_N1_REVIEWS_KEY = 'wk-flash:interweave-local-n1-reviews';
const interweaveLocalN1ReviewsStore = writable(
	readLocalStorage(INTERWEAVE_LOCAL_N1_REVIEWS_KEY) === 'true'
);

export const interweaveLocalN1Reviews = {
	subscribe: interweaveLocalN1ReviewsStore.subscribe,
	set(value: boolean) {
		writeLocalStorage(INTERWEAVE_LOCAL_N1_REVIEWS_KEY, String(value));
		interweaveLocalN1ReviewsStore.set(value);
	}
};

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
const savedReviewSort = readLocalStorage(REVIEW_SORT_KEY);
const initialReviewSort = reviewSortOptions.some((option) => option.value === savedReviewSort)
	? (savedReviewSort as ReviewSortOrder)
	: 'default';
const reviewSortStore = writable<ReviewSortOrder>(initialReviewSort);

export const reviewSort = {
	subscribe: reviewSortStore.subscribe,
	set(value: ReviewSortOrder) {
		writeLocalStorage(REVIEW_SORT_KEY, value);
		reviewSortStore.set(value);
	}
};

const PRIORITIZE_CURRENT_LEVEL_KEY = 'wk-flash:prioritize-current-level';
const prioritizeCurrentLevelStore = writable(readLocalStorage(PRIORITIZE_CURRENT_LEVEL_KEY) === 'true');

export const prioritizeCurrentLevel = {
	subscribe: prioritizeCurrentLevelStore.subscribe,
	set(value: boolean) {
		writeLocalStorage(PRIORITIZE_CURRENT_LEVEL_KEY, String(value));
		prioritizeCurrentLevelStore.set(value);
	}
};

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
