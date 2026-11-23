import type { AsciiFrameGrid, AsciiSettings } from './types.js';

export interface GlyphRenderOptions {
	bgColor?: string;
	fontSize?: number;
	fontFamily?: string;
}

/**
 * 2. Clear the preview canvas every frame in glyphRenderer.ts:
 * At the start of every render call, clear and repaint the full background
 * (ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height))
 * before drawing any characters so empty cells never leave stale glyphs behind.
 */
export function renderGlyphFrame(
	canvas: HTMLCanvasElement,
	grid: AsciiFrameGrid,
	settings: AsciiSettings,
	options?: GlyphRenderOptions
): void {
	if (!canvas || !grid || !grid.cells) return;

	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const bgColor = options?.bgColor ?? '#09090b';
	const fontSize = options?.fontSize ?? 11;
	const fontFamily = options?.fontFamily ?? '"JetBrains Mono", "Geist Mono", monospace';
	const chars = settings.charset || ' .:-=+*#%@';

	const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
	const charWidth = fontSize * 0.6;
	const charHeight = fontSize;

	const targetCssW = Math.round(grid.cols * charWidth);
	const targetCssH = Math.round(grid.rows * charHeight);

	const backingW = Math.round(targetCssW * dpr);
	const backingH = Math.round(targetCssH * dpr);

	if (canvas.width !== backingW || canvas.height !== backingH) {
		canvas.width = backingW;
		canvas.height = backingH;
	}

	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	// Mandatory: Clear and repaint full background before drawing any characters
	ctx.fillStyle = bgColor;
	ctx.fillRect(0, 0, targetCssW, targetCssH);

	ctx.font = `${fontSize}px ${fontFamily}`;
	ctx.textBaseline = 'top';
	ctx.textAlign = 'left';

	const { cols, rows, cells } = grid;
	let lastFill = '';

	for (let r = 0; r < rows; r++) {
		const py = r * charHeight;

		for (let c = 0; c < cols; c++) {
			const idx = (r * cols + c) * 4;
			const charIdx = cells[idx];

			// Sentinel 255 represents empty space / transparent cell
			if (charIdx === 255) {
				continue;
			}

			const char = chars[charIdx] || ' ';
			if (char === ' ') {
				continue;
			}

			const red = cells[idx + 1];
			const green = cells[idx + 2];
			const blue = cells[idx + 3];

			const fill = `rgb(${red},${green},${blue})`;
			if (fill !== lastFill) {
				ctx.fillStyle = fill;
				lastFill = fill;
			}

			ctx.fillText(char, c * charWidth, py);
		}
	}
}
