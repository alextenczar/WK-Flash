import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { onPersistentHydrate, readPersistent, removePersistent, writePersistent } from '$lib/persistent-storage';
import { startAssignment, WaniKaniError } from '$lib/wanikani/api';

const STORAGE_KEY = 'wk-flash:pending-lesson-starts';

function loadPendingLessonStarts(): number[] {
	if (!browser) return [];
	try {
		const stored = readPersistent(STORAGE_KEY);
		if (!stored) return [];
		const parsed: unknown = JSON.parse(stored);
		return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id) && id > 0) : [];
	} catch {
		return [];
	}
}

export const pendingLessonStarts = writable<number[]>(loadPendingLessonStarts());

if (browser) {
	let persistWrites = true;
	pendingLessonStarts.subscribe((ids) => {
		if (!persistWrites) return;
		if (ids.length) writePersistent(STORAGE_KEY, JSON.stringify(ids));
		else removePersistent(STORAGE_KEY);
	});
	onPersistentHydrate(() => {
		persistWrites = false;
		pendingLessonStarts.set(loadPendingLessonStarts());
		persistWrites = true;
	});
}

export function queueLessonStart(assignmentId: number): void {
	pendingLessonStarts.update((ids) => (ids.includes(assignmentId) ? ids : [...ids, assignmentId]));
}

export function removeQueuedLessonStart(assignmentId: number): void {
	pendingLessonStarts.update((ids) => ids.filter((id) => id !== assignmentId));
}

let syncing = false;
const inFlightAssignmentIds = new Set<number>();

export async function startQueuedLesson(apiToken: string, assignmentId: number): Promise<void> {
	queueLessonStart(assignmentId);
	if (inFlightAssignmentIds.has(assignmentId)) return;
	inFlightAssignmentIds.add(assignmentId);
	try {
		await startAssignment(apiToken, assignmentId);
		removeQueuedLessonStart(assignmentId);
	} finally {
		inFlightAssignmentIds.delete(assignmentId);
	}
}

export async function syncPendingLessonStarts(apiToken: string): Promise<void> {
	if (!browser || !navigator.onLine || !apiToken || syncing) return;
	syncing = true;
	try {
		const queuedIds = get(pendingLessonStarts);
		for (const assignmentId of queuedIds) {
			if (!navigator.onLine) break;
			if (inFlightAssignmentIds.has(assignmentId)) continue;
			inFlightAssignmentIds.add(assignmentId);
			try {
				await startAssignment(apiToken, assignmentId);
			} catch (error: unknown) {
				if (error instanceof WaniKaniError && error.status === 401) throw error;
				console.warn(`Could not start queued WaniKani lesson for assignment ${assignmentId}.`, error);
				break;
			} finally {
				inFlightAssignmentIds.delete(assignmentId);
			}
			removeQueuedLessonStart(assignmentId);
		}
	} finally {
		syncing = false;
	}
}
