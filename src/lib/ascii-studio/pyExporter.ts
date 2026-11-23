import type { DecodedMediaFrame, AsciiSettings } from './types.js';

const CHAR_SETS: Record<string, string> = {
	standard: ' .:-=+*#%@',
	blocks: ' ░▒▓█',
	minimal: ' .oO@',
	binary: ' 01',
	detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
};

/**
 * Converts an RGB color to the closest xterm-256 color code.
 */
function rgbToAnsi256(r: number, g: number, b: number): number {
	if (r === g && g === b) {
		if (r < 8) return 16;
		if (r > 248) return 231;
		return Math.round(((r - 8) / 247) * 23) + 232;
	}
	const toStep = (val: number) => {
		if (val < 48) return 0;
		if (val < 115) return 1;
		return Math.min(5, Math.floor((val - 35) / 40));
	};
	return 16 + 36 * toStep(r) + 6 * toStep(g) + toStep(b);
}

interface CellData {
	char: string;
	colorCode: string;
	isTransparent: boolean;
}

/**
 * Extract 2D cell grid for a frame, ensuring:
 * 1. ctx.clearRect(0, 0, cols, rows) immediately BEFORE ctx.drawImage
 * 2. Alpha-aware: a < 32 forces cell to space ' ', ignoring brightness/contrast/dither/invert
 */
function extractCellGrid(
	bitmap: ImageBitmap | HTMLCanvasElement,
	settings: AsciiSettings
): { cols: number; rows: number; grid: CellData[][] } {
	const cols = Math.max(10, Math.floor(settings.cols || 80));
	const aspectCorrection = settings.aspectCorrection || 0.55;
	const sourceW = bitmap.width || 320;
	const sourceH = bitmap.height || 240;
	const rows = Math.max(1, Math.round(cols * (sourceH / Math.max(1, sourceW)) * aspectCorrection));

	if (typeof document === 'undefined') {
		const emptyRow: CellData[] = Array.from({ length: cols }, () => ({
			char: ' ',
			colorCode: '',
			isTransparent: true
		}));
		return { cols, rows, grid: Array.from({ length: rows }, () => [...emptyRow]) };
	}

	const canvas = document.createElement('canvas');
	canvas.width = cols;
	canvas.height = rows;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) {
		const emptyRow: CellData[] = Array.from({ length: cols }, () => ({
			char: ' ',
			colorCode: '',
			isTransparent: true
		}));
		return { cols, rows, grid: Array.from({ length: rows }, () => [...emptyRow]) };
	}

	// 1. Mandatory clear before drawImage
	ctx.clearRect(0, 0, cols, rows);
	ctx.drawImage(bitmap, 0, 0, cols, rows);

	const imgData = ctx.getImageData(0, 0, cols, rows);
	const data = imgData.data;

	const chars = settings.charset || CHAR_SETS.standard;
	const charLen = chars.length;
	const contrastFactor =
		settings.contrast !== 259
			? (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast))
			: 1.0;

	const totalCells = cols * rows;
	const isTransparent = new Uint8Array(totalCells);
	const lumGrid = new Float32Array(totalCells);

	// 2. Alpha-aware pixel analysis:
	// a < 32 forces empty space ' ', ignoring brightness/contrast/dither/invert
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

	// Floyd-Steinberg dithering on non-transparent cells only
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

	const grid: CellData[][] = [];
	for (let r = 0; r < rows; r++) {
		const rowCells: CellData[] = [];
		for (let c = 0; c < cols; c++) {
			const cellIdx = r * cols + c;
			const pIdx = cellIdx * 4;

			if (isTransparent[cellIdx]) {
				rowCells.push({
					char: ' ',
					colorCode: '',
					isTransparent: true
				});
				continue;
			}

			const norm = Math.max(0, Math.min(1, lumGrid[cellIdx] / 255));
			const charIdx = Math.min(charLen - 1, Math.floor(norm * charLen));
			const char = chars[charIdx] || ' ';

			let colorCode = '';
			const red = data[pIdx];
			const green = data[pIdx + 1];
			const blue = data[pIdx + 2];

			if (settings.colorMode === 'mono') {
				colorCode = '';
			} else if (settings.colorMode === 'green') {
				colorCode = `\x1b[38;2;34;${Math.round(140 + norm * 115)};94m`;
			} else if (settings.colorMode === 'ansi256') {
				const code = rgbToAnsi256(red, green, blue);
				colorCode = `\x1b[38;5;${code}m`;
			} else {
				// Truecolor
				colorCode = `\x1b[38;2;${red};${green};${blue}m`;
			}

			rowCells.push({
				char,
				colorCode,
				isTransparent: false
			});
		}
		grid.push(rowCells);
	}

	return { cols, rows, grid };
}

/**
 * Extracts full-frame ANSI line array from CellData grid.
 * Explicitly emits spaces for transparent cells so any prior character is overwritten.
 */
function extractFrameLines(grid: CellData[][], cols: number, rows: number): string[] {
	const lines: string[] = [];

	for (let r = 0; r < rows; r++) {
		let line = '';
		let lastColor = '';

		for (let c = 0; c < cols; c++) {
			const cell = grid[r][c];

			if (cell.char === ' ') {
				if (lastColor) {
					line += '\x1b[0m';
					lastColor = '';
				}
				line += ' ';
				continue;
			}

			if (cell.colorCode !== lastColor) {
				line += cell.colorCode;
				lastColor = cell.colorCode;
			}
			line += cell.char;
		}

		if (lastColor) {
			line += '\x1b[0m';
		}
		lines.push(line);
	}

	return lines;
}

/**
 * Builds full-frame ANSI string from CellData grid.
 */
function buildFullFrameAnsi(grid: CellData[][], cols: number, rows: number): string {
	return extractFrameLines(grid, cols, rows).join('\n');
}

/**
 * Converts a single frame to standalone ANSI string.
 */
export function convertFrameToAnsi(
	bitmap: ImageBitmap | HTMLCanvasElement,
	settings: AsciiSettings
): string {
	const { cols, rows, grid } = extractCellGrid(bitmap, settings);
	return buildFullFrameAnsi(grid, cols, rows);
}

/**
 * Multi-frame Python 3 Exporter:
 * Generates rock-solid, flicker-free, zero-scrolling terminal player.
 * Uses alternate screen buffer (\033[?1049h), clamps rows to terminal height - 1 to
 * prevent vertical scrolling jitter, and appends \033[K per line to wipe tracing.
 */
export function exportPythonScript(
	frames: DecodedMediaFrame[],
	settings: AsciiSettings
): string {
	if (!frames || frames.length === 0) {
		return '# No media frames available to export\n';
	}

	// Single static image
	if (frames.length === 1) {
		const { cols, rows, grid } = extractCellGrid(frames[0].bitmap, settings);
		const lines = extractFrameLines(grid, cols, rows);
		return `#!/usr/bin/env python3
"""
asciing.app — Standalone Terminal ASCII Artwork
Generated at: https://asciing.app
Zero dependencies. Pure Python 3 standard library.
"""
import os, sys

LINES = ${JSON.stringify(lines)}

def main():
    if os.name == 'nt':
        os.system('')

    sys.stdout.write("".join(l + "\\n" for l in LINES))
    sys.stdout.flush()

if __name__ == '__main__':
    main()
`;
	}

	// Multi-frame animated media export
	const grids = frames.map((f) => extractCellGrid(f.bitmap, settings));
	const cols = grids[0].cols;
	const rows = grids[0].rows;

	const framesLines = grids.map((g) => extractFrameLines(g.grid, cols, rows));
	const speed = Math.max(0.05, Number(settings.speed ?? 1.0));
	const delaysSec = frames.map((f) => Number((Math.max(10, f.delayMs) / (1000 * speed)).toFixed(4)));

	const framesLiteral = framesLines
		.map((fLines) => `    ${JSON.stringify(fLines)},`)
		.join('\n');
	const delaysLiteral = JSON.stringify(delaysSec);

	return `#!/usr/bin/env python3
"""
asciing.app — Standalone Animated ASCII Artwork
Generated at: https://asciing.app
Zero dependencies. Pure Python 3 standard library.
"""
import os, sys, time, shutil

FRAMES = [
${framesLiteral}
]

DELAYS = ${delaysLiteral}

def main():
    if os.name == 'nt':
        os.system('')

    # Switch to alternate screen buffer, hide cursor, and clear screen once
    sys.stdout.write("\\033[?1049h\\033[?25l\\033[2J")
    sys.stdout.flush()

    total_frames = len(FRAMES)
    idx = 0

    try:
        while True:
            t0 = time.perf_counter()
            term_cols, term_rows = shutil.get_terminal_size(fallback=(80, 24))
            frame_lines = FRAMES[idx]
            delay = DELAYS[idx]

            # Limit lines to terminal height - 1 to strictly prevent window scrolling
            max_r = min(len(frame_lines), max(1, term_rows - 1))

            buf = ["\\033[H"]
            for r in range(max_r):
                # \\033[K clears from cursor to end of line to eliminate tracing
                buf.append(frame_lines[r] + "\\033[K\\n")

            sys.stdout.write("".join(buf))
            sys.stdout.flush()

            idx = (idx + 1) % total_frames
            elapsed = time.perf_counter() - t0
            sleep_time = max(0.001, delay - elapsed)
            time.sleep(sleep_time)
    except KeyboardInterrupt:
        pass
    finally:
        # Restore main screen buffer, show cursor, and reset colors
        sys.stdout.write("\\033[0m\\033[?25h\\033[?1049l\\n")
        sys.stdout.flush()

if __name__ == '__main__':
    main()
`;
}
