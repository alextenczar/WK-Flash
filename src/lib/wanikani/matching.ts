import type { WKSubject } from './types';

export function primaryMeaning(subject: WKSubject): string {
	return (
		subject.data.meanings.find((m) => m.primary)?.meaning ??
		subject.data.meanings[0]?.meaning ??
		''
	);
}

export function allMeanings(subject: WKSubject): string[] {
	return subject.data.meanings.map((m) => m.meaning);
}

export function acceptedReadings(subject: WKSubject): string[] {
	return (subject.data.readings ?? []).filter((r) => r.accepted_answer).map((r) => r.reading);
}

export function readingsForDisplay(
	subject: WKSubject
): { type: string; readings: { reading: string; primary: boolean; accepted: boolean }[] }[] {
	const groups = new Map<
		string,
		{ reading: string; primary: boolean; accepted: boolean }[]
	>();

	for (const reading of subject.data.readings ?? []) {
		const type = reading.type ?? 'Reading';
		const group = groups.get(type) ?? [];
		group.push({
			reading: reading.reading,
			primary: reading.primary,
			accepted: reading.accepted_answer
		});
		groups.set(type, group);
	}

	return [...groups].map(([type, readings]) => ({ type, readings }));
}

export function vocabularyByReading(
	subjects: WKSubject[]
): { reading: string; subjects: WKSubject[] }[] {
	const groups = new Map<string, WKSubject[]>();

	for (const subject of subjects) {
		if (subject.object !== 'vocabulary' && subject.object !== 'kana_vocabulary') continue;
		const readings = new Set((subject.data.readings ?? []).map((item) => item.reading));
		for (const reading of readings) {
			const group = groups.get(reading) ?? [];
			group.push(subject);
			groups.set(reading, group);
		}
	}

	return [...groups]
		.sort(([first], [second]) => first.localeCompare(second, 'ja'))
		.map(([reading, groupedSubjects]) => ({ reading, subjects: groupedSubjects }));
}
