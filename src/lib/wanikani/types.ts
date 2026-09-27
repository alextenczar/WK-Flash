export interface WKUser {
	id: string;
	username: string;
	level: number;
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
	context_sentences?: { japanese: string; english: string }[];
}

export interface WKSubject {
	id: number;
	object: SubjectType;
	data: WKSubjectData;
}

export interface WKAssignment {
	id: number;
	data: {
		subject_id: number;
		subject_type: SubjectType;
		srs_stage: number;
		available_at: string | null;
	};
}

/** A single combined meaning+reading flashcard built from an assignment + its subject. */
export interface ReviewCard {
	assignmentId: number;
	subject: WKSubject;
	needsReading: boolean;
	incorrectCount: number;
}
