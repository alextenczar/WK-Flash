export interface WKUser {
	id: string;
	username: string;
	level: number;
	subscription: {
		max_level_granted: number;
	};
}

export interface WKMeaning {
	meaning: string;
	primary: boolean;
	accepted_answer: boolean;
}

export interface WKReading {
	reading: string;
	primary: boolean;
	accepted_answer: boolean;
	type?: string;
}

export type SubjectType = 'radical' | 'kanji' | 'vocabulary' | 'kana_vocabulary';

export interface WKSubjectData {
	characters: string | null;
	level: number;
	hidden_at?: string | null;
	meanings: WKMeaning[];
	readings?: WKReading[];
	meaning_mnemonic: string;
	reading_mnemonic?: string;
	slug: string;
	document_url: string;
	character_images?: { url: string; content_type: string }[];
	pronunciation_audios?: { url: string; content_type: string }[];
	visually_similar_subject_ids?: number[];
	amalgamation_subject_ids?: number[];
	context_sentences?: { ja: string; en: string }[];
	parts_of_speech?: string[];
}

export interface WKSubject {
	id: number;
	object: SubjectType;
	data: WKSubjectData;
}

export interface WKAssignment {
	id: number;
	data_updated_at?: string | null;
	data: {
		subject_id: number;
		subject_type: SubjectType;
		srs_stage: number;
		available_at: string | null;
		unlocked_at?: string | null;
		started_at?: string | null;
		hidden?: boolean;
		passed_at?: string | null;
		burned_at?: string | null;
	};
}

export interface WKReviewStatistic {
	id: number;
	data_updated_at: string | null;
	data: {
		subject_id: number;
		hidden?: boolean;
		meaning_correct?: number | null;
		meaning_incorrect?: number | null;
		reading_correct?: number | null;
		reading_incorrect?: number | null;
	};
}


export interface WKLevelProgression {
	id: number;
	data: {
		level: number;
		unlocked_at: string | null;
		started_at?: string | null;
		passed_at: string | null;
		abandoned_at?: string | null;
	};
}
/** A single combined meaning+reading flashcard built from an assignment + its subject. */
export interface ReviewCard {
	assignmentId: number;
	availableAt?: string | null;
	srsStage?: number;
	maxAccessibleLevel?: number;
	currentUserLevel?: number;
	subject: WKSubject;
	needsReading: boolean;
	incorrectCount: number;
}
