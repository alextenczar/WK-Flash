import { writable } from 'svelte/store';

/** Name of the connected controller, or null when none is detected. */
export const gamepadConnected = writable<string | null>(null);

/**
 * Polls connected gamepads each frame and calls `onPress` once per button press
 * (rising edge, so holding a button does not repeat). Button indices follow the
 * W3C "standard" mapping: 0 = A / Cross, 1 = B / Circle, 2 = X / Square, 3 = Y / Triangle.
 *
 * Returns a cleanup function that stops polling.
 */
export function startGamepadPolling(onPress: (button: number) => void): () => void {
	if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
		return () => {};
	}

	const previous = new Map<number, boolean[]>();
	let frame = 0;
	let running = true;

	function poll() {
		if (!running) return;

		let connectedName: string | null = null;
		for (const pad of navigator.getGamepads()) {
			if (!pad || !pad.connected) continue;
			connectedName ??= pad.id;

			const prev = previous.get(pad.index) ?? [];
			const now = pad.buttons.map((button) => button.pressed);
			now.forEach((pressed, i) => {
				if (pressed && !prev[i]) onPress(i);
			});
			previous.set(pad.index, now);
		}

		gamepadConnected.set(connectedName);
		frame = requestAnimationFrame(poll);
	}

	// Chrome only exposes a pad after its first button press; the poll loop picks it up then.
	frame = requestAnimationFrame(poll);

	return () => {
		running = false;
		cancelAnimationFrame(frame);
		gamepadConnected.set(null);
	};
}
