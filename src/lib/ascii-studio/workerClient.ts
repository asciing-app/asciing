import type { AsciiSettings, AsciiFrameGrid } from './types.js';
import type { WorkerProcessRequest, WorkerProcessResponse } from './ascii.worker.js';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (res: AsciiFrameGrid) => void; reject: (err: unknown) => void }>();

function getWorker(): Worker | null {
	if (typeof window === 'undefined') return null;
	if (!worker) {
		try {
			worker = new Worker(new URL('./ascii.worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = (e: MessageEvent<WorkerProcessResponse>) => {
				const { id, cols, rows, delayMs, cells } = e.data;
				const handler = pending.get(id);
				if (handler) {
					pending.delete(id);
					handler.resolve({
						cols,
						rows,
						delayMs,
						lines: [],
						ansiText: '',
						cells
					});
				}
			};
			worker.onerror = (err) => {
				console.error('[workerClient] Worker error:', err);
			};
		} catch (err) {
			console.warn('[workerClient] Web Worker initialization failed, using main thread fallback:', err);
			worker = null;
		}
	}
	return worker;
}

/**
 * Process an ImageBitmap via Web Worker (or main thread fallback if SSR / unsupported).
 */
export async function processFrameWithWorker(
	bitmap: ImageBitmap,
	settings: AsciiSettings,
	delayMs = 100
): Promise<AsciiFrameGrid> {
	const w = getWorker();
	if (w) {
		const id = nextId++;
		return new Promise<AsciiFrameGrid>((resolve, reject) => {
			pending.set(id, { resolve, reject });
			const req: WorkerProcessRequest = { id, bitmap, settings, delayMs };
			w.postMessage(req, [bitmap]);
		});
	}

	// Main thread fallback
	return processFrameSync(bitmap, settings, delayMs);
}

/**
 * Main-thread synchronous processor (fallback and direct use).
 * Conforms strictly to:
 * 1. ctx.clearRect(0, 0, cols, rows) immediately before ctx.drawImage
 * 2. Alpha-aware: a < 32 forces cell to empty space (sentinel 255)
 */
export function processFrameSync(
	bitmap: ImageBitmap | HTMLCanvasElement,
	settings: AsciiSettings,
	delayMs = 100
): AsciiFrameGrid {
	const cols = Math.max(10, Math.floor(settings.cols || 80));
	const aspect = settings.aspectCorrection || 0.55;
	const sourceW = bitmap.width || 320;
	const sourceH = bitmap.height || 240;
	const rows = Math.max(1, Math.round(cols * (sourceH / Math.max(1, sourceW)) * aspect));

	if (typeof document === 'undefined') {
		return { cols, rows, delayMs, lines: [], ansiText: '', cells: new Uint8Array(cols * rows * 4) };
	}

	const canvas = document.createElement('canvas');
	canvas.width = cols;
	canvas.height = rows;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) {
		return { cols, rows, delayMs, lines: [], ansiText: '', cells: new Uint8Array(cols * rows * 4) };
	}

	ctx.clearRect(0, 0, cols, rows);
	ctx.drawImage(bitmap, 0, 0, cols, rows);

	const imgData = ctx.getImageData(0, 0, cols, rows);
	const data = imgData.data;
	const totalCells = cols * rows;
	const cells = new Uint8Array(totalCells * 4);
	const isTransparent = new Uint8Array(totalCells);
	const lumGrid = new Float32Array(totalCells);

	const contrastFactor =
		settings.contrast !== 259
			? (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast))
			: 1.0;

	for (let i = 0; i < totalCells; i++) {
		const pIdx = i * 4;
		const a = data[pIdx + 3];

		if (a < 32) {
			isTransparent[i] = 1;
			lumGrid[i] = 0;
			continue;
		}

		const r = data[pIdx];
		const g = data[pIdx + 1];
		const b = data[pIdx + 2];
		const rawLum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		let adjusted = contrastFactor * (rawLum - 128) + 128 + settings.brightness * 1.28;
		if (settings.invert) adjusted = 255 - adjusted;
		lumGrid[i] = Math.max(0, Math.min(255, adjusted));
	}

	const chars = settings.charset || ' .:-=+*#%@';
	const charLen = chars.length;

	if (settings.dither) {
		const step = 255 / Math.max(1, charLen - 1);
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const idx = y * cols + x;
				if (isTransparent[idx]) continue;
				const oldVal = lumGrid[idx];
				const newVal = Math.round(oldVal / step) * step;
				lumGrid[idx] = newVal;
				const err = oldVal - newVal;

				if (x + 1 < cols && !isTransparent[idx + 1]) {
					lumGrid[idx + 1] += err * (7 / 16);
				}
				if (y + 1 < rows) {
					if (x - 1 >= 0 && !isTransparent[(y + 1) * cols + (x - 1)]) {
						lumGrid[(y + 1) * cols + (x - 1)] += err * (3 / 16);
					}
					if (!isTransparent[(y + 1) * cols + x]) {
						lumGrid[(y + 1) * cols + x] += err * (5 / 16);
					}
					if (x + 1 < cols && !isTransparent[(y + 1) * cols + (x + 1)]) {
						lumGrid[(y + 1) * cols + (x + 1)] += err * (1 / 16);
					}
				}
			}
		}
	}

	for (let i = 0; i < totalCells; i++) {
		const cellOffset = i * 4;
		const pIdx = i * 4;

		if (isTransparent[i]) {
			cells[cellOffset] = 255; // Sentinel: space ' '
			cells[cellOffset + 1] = 0;
			cells[cellOffset + 2] = 0;
			cells[cellOffset + 3] = 0;
			continue;
		}

		const norm = Math.max(0, Math.min(1, lumGrid[i] / 255));
		const charIndex = Math.min(charLen - 1, Math.floor(norm * charLen));
		cells[cellOffset] = charIndex;

		const r = data[pIdx];
		const g = data[pIdx + 1];
		const b = data[pIdx + 2];

		if (settings.colorMode === 'mono') {
			cells[cellOffset + 1] = 250;
			cells[cellOffset + 2] = 250;
			cells[cellOffset + 3] = 250;
		} else if (settings.colorMode === 'green') {
			cells[cellOffset + 1] = 34;
			cells[cellOffset + 2] = Math.round(120 + norm * 135);
			cells[cellOffset + 3] = 94;
		} else if (settings.colorMode === 'ansi256') {
			cells[cellOffset + 1] = Math.round(r / 51) * 51;
			cells[cellOffset + 2] = Math.round(g / 51) * 51;
			cells[cellOffset + 3] = Math.round(b / 51) * 51;
		} else {
			cells[cellOffset + 1] = r;
			cells[cellOffset + 2] = g;
			cells[cellOffset + 3] = b;
		}
	}

	return {
		cols,
		rows,
		delayMs,
		lines: [],
		ansiText: '',
		cells
	};
}
