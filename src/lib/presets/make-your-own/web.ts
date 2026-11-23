import { createCanvasLoop } from '../../engine/canvas.js';
import type { MountContext } from '../../types/preset.js';

const CHAR_SETS: Record<string, string> = {
	standard: ' .:-=+*#%@',
	blocks: ' ░▒▓█',
	minimal: ' .oO@',
	binary: ' 01',
	detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
};

// Offscreen buffer for downsampling
let sampleCanvas: HTMLCanvasElement | null = null;
let sampleCtx: CanvasRenderingContext2D | null = null;

function getSampleContext(w: number, h: number) {
	if (typeof document === 'undefined') return null;
	if (!sampleCanvas) {
		sampleCanvas = document.createElement('canvas');
		sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
	}
	if (sampleCanvas.width !== w || sampleCanvas.height !== h) {
		sampleCanvas.width = Math.max(1, w);
		sampleCanvas.height = Math.max(1, h);
		sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
	}
	return sampleCtx;
}

export function mountWeb(ctx: MountContext): () => void {
	const { canvas, container, getParams, getAssets } = ctx;

	const loop = createCanvasLoop(canvas, container, ({ ctx: c, width, height, time, dpr }) => {
		const params = getParams();
		const assets = getAssets();

		const speed = Math.max(0.05, Number(params.speed ?? 1.0));
		const cols = Math.max(20, Math.min(240, Number(params.cols ?? 90)));
		const fontSize = Math.max(8, Math.min(32, Number(params.fontSize ?? 11)));
		const charsetKey = String(params.charset ?? 'standard');
		const customCharset = String(params.customCharset ?? '').trim();
		const colorMode = String(params.colorMode ?? 'truecolor');
		const brightness = Number(params.brightness ?? 0);
		const contrast = Number(params.contrast ?? 0);
		const dither = Boolean(params.dither ?? false);
		const invert = Boolean(params.invert ?? false);

		const chars = customCharset.length > 0 ? customCharset : CHAR_SETS[charsetKey] || CHAR_SETS.standard;
		const charLen = chars.length;

		// Clear background
		c.fillStyle = '#09090b';
		c.fillRect(0, 0, width, height);

		c.font = `${fontSize}px "JetBrains Mono", "Geist Mono", monospace`;
		c.textBaseline = 'top';
		c.textAlign = 'left';

		let charWidth = fontSize * 0.6;
		let charHeight = fontSize;

		const gifFrames = (assets['gifFrames'] || assets['videoFrames']) as
			| { bitmap: ImageBitmap | HTMLCanvasElement; delayMs: number }[]
			| undefined;

		let sourceMedia: CanvasImageSource | undefined = undefined;

		if (gifFrames && gifFrames.length > 0) {
			const totalDuration = gifFrames.reduce((acc, f) => acc + (f.delayMs || 100), 0);
			const elapsedMs = (time * speed * 1000) % Math.max(10, totalDuration);
			let accumulated = 0;
			let activeFrame = gifFrames[0];
			for (const f of gifFrames) {
				accumulated += f.delayMs || 100;
				if (elapsedMs < accumulated) {
					activeFrame = f;
					break;
				}
			}
			sourceMedia = activeFrame.bitmap as CanvasImageSource;
		} else if (assets['video']) {
			const vid = assets['video'] as HTMLVideoElement;
			if (vid.playbackRate !== speed && !isNaN(speed)) {
				try {
					vid.playbackRate = speed;
				} catch {}
			}
			sourceMedia = vid;
		} else if (assets['image']) {
			sourceMedia = assets['image'] as HTMLCanvasElement;
		}

		if (!sourceMedia) {
			// ULTRA-OPTIMIZED ASCII ART MARQUEE
			const rows = Math.max(6, Math.floor(height / charHeight));
			const demoCols = Math.max(20, Math.ceil(width / charWidth) + 2);

			const BANNER = [
				' __  __    _    _  _______   __   _____  _   _ ____     _____        ___   _ ',
				'|  \\/  |  / \\  | |/ / ____|  \\ \\ / / _ \\| | | |  _ \\   / _ \\ \\      / / \\ | |',
				'| |\\/| | / _ \\ | \' /|  _|     \\ V / | | | | | | |_) | | | | \\ \\ /\\ / /|  \\| |',
				'| |  | |/ ___ \\| . \\| |___     | || |_| | |_| |  _ <  | |_| |\\ V  V / | |\\  |',
				'|_|  |_/_/   \\_\\_|\\_\\_____|    |_| \\___/ \\___/|_| \\_\\  \\___/  \\_/\\_/  |_| \\_|'
			];
			const BANNER_SPACER = '          ///          ';
			const BANNER_FULL = BANNER.map((line) => line + BANNER_SPACER);
			const BANNER_LEN = BANNER_FULL[0].length;

			const TOP_TICKER = '>>> MAKE YOUR OWN ASCII ART >>> DROP OR SELECT MEDIA IN CONTROLS >>> REALTIME LUMINANCE SAMPLING >>> ';
			const BOTTOM_TICKER = '*** ZERO BACKEND *** CLIENT-SIDE PRIVACY *** PYTHON 3 TERMINAL EXPORT *** ANSI 256 / TRUECOLOR *** ';

			const bannerStartRow = Math.max(1, Math.floor((rows - BANNER.length) / 2));
			const bannerCharShift = Math.floor(time * speed * 14) % BANNER_LEN;
			const bannerSubPixel = (((time * speed * 14) % 1) + 1) % 1 * charWidth;

			// Marquee Center Banner
			for (let r = 0; r < BANNER.length; r++) {
				const line = BANNER_FULL[r];
				const py = (bannerStartRow + r) * charHeight;

				for (let col = 0; col < demoCols; col++) {
					const charIdx = (col + bannerCharShift) % BANNER_LEN;
					const ch = line[charIdx];
					if (ch === ' ') continue;

					if (colorMode === 'green') {
						c.fillStyle = '#22c55e';
					} else if (colorMode === 'mono') {
						c.fillStyle = '#f4f4f5';
					} else {
						const norm = (col / demoCols + time * speed * 0.15) % 1;
						c.fillStyle = norm < 0.35 ? '#ff605c' : norm < 0.7 ? '#c084fc' : '#38bdf8';
					}

					c.fillText(ch, col * charWidth - bannerSubPixel, py);
				}
			}

			// Top Ticker (if height allows)
			if (bannerStartRow >= 2) {
				const topShift = Math.floor(time * speed * 10) % TOP_TICKER.length;
				const topSub = (((time * speed * 10) % 1) + 1) % 1 * charWidth;
				c.fillStyle = '#52525b';
				for (let col = 0; col < demoCols; col++) {
					const ch = TOP_TICKER[(col + topShift) % TOP_TICKER.length];
					c.fillText(ch, col * charWidth - topSub, (bannerStartRow - 2) * charHeight);
				}
			}

			// Bottom Ticker (if height allows)
			if (bannerStartRow + 6 < rows) {
				const btmShift = Math.floor(time * speed * 9) % BOTTOM_TICKER.length;
				const btmSub = (((time * speed * 9) % 1) + 1) % 1 * charWidth;
				c.fillStyle = '#52525b';
				for (let col = 0; col < demoCols; col++) {
					const ch = BOTTOM_TICKER[(col + btmShift) % BOTTOM_TICKER.length];
					c.fillText(ch, col * charWidth - btmSub, (bannerStartRow + 6) * charHeight);
				}
			}

			return;
		}

		// ACTIVE MEDIA MODE: Convert image/video frame
		let sourceW = 320;
		let sourceH = 240;
		if (sourceMedia instanceof HTMLVideoElement) {
			sourceW = sourceMedia.videoWidth || 320;
			sourceH = sourceMedia.videoHeight || 240;
		} else if (sourceMedia instanceof HTMLCanvasElement) {
			sourceW = sourceMedia.width || 320;
			sourceH = sourceMedia.height || 240;
		} else if (typeof ImageBitmap !== 'undefined' && sourceMedia instanceof ImageBitmap) {
			sourceW = sourceMedia.width || 320;
			sourceH = sourceMedia.height || 240;
		}

		const aspectCorrection = 0.55;
		const rows = Math.max(1, Math.round(cols * (sourceH / Math.max(1, sourceW)) * aspectCorrection));

		const sCtx = getSampleContext(cols, rows);
		if (!sCtx) return;

		sCtx.clearRect(0, 0, cols, rows);
		sCtx.drawImage(sourceMedia as CanvasImageSource, 0, 0, cols, rows);
		const imgData = sCtx.getImageData(0, 0, cols, rows);
		const data = imgData.data;

		// Compute luminance and apply brightness/contrast with alpha-awareness
		const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
		const lumGrid = new Float32Array(cols * rows);
		const isTransparent = new Uint8Array(cols * rows);

		for (let i = 0; i < cols * rows; i++) {
			const idx = i * 4;
			const a = data[idx + 3];

			if (a < 32) {
				isTransparent[i] = 1;
				lumGrid[i] = 0;
				continue;
			}

			const r = data[idx];
			const g = data[idx + 1];
			const b = data[idx + 2];

			let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
			lum = contrastFactor * (lum - 128) + 128 + brightness * 1.28;
			if (invert) lum = 255 - lum;
			lumGrid[i] = Math.max(0, Math.min(255, lum));
		}

		// Floyd-Steinberg error diffusion dithering if enabled (skip transparent cells)
		if (dither) {
			const step = 255 / (charLen - 1);
			for (let y = 0; y < rows; y++) {
				for (let x = 0; x < cols; x++) {
					const idx = y * cols + x;
					if (isTransparent[idx]) continue;

					const oldVal = lumGrid[idx];
					const newVal = Math.round(oldVal / step) * step;
					lumGrid[idx] = newVal;
					const err = oldVal - newVal;

					if (x + 1 < cols && !isTransparent[idx + 1]) lumGrid[idx + 1] += err * (7 / 16);
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

		// Auto-fit font scaling for responsive / mobile viewports so grid is never clipped
		const unscaledGridW = cols * (fontSize * 0.6);
		const unscaledGridH = rows * fontSize;
		const maxAvailableW = Math.max(20, width - 16);
		const maxAvailableH = Math.max(20, height - 16);
		const autoFitScale = Math.min(1.0, Math.min(maxAvailableW / Math.max(1, unscaledGridW), maxAvailableH / Math.max(1, unscaledGridH)));

		const effectiveFontSize = Math.max(4, fontSize * autoFitScale);
		charWidth = effectiveFontSize * 0.6;
		charHeight = effectiveFontSize;

		c.font = `${effectiveFontSize}px "JetBrains Mono", "Geist Mono", monospace`;

		// Render ASCII grid centered in canvas viewport
		const totalGridW = cols * charWidth;
		const totalGridH = rows * charHeight;
		const offsetX = Math.max(0, (width - totalGridW) / 2);
		const offsetY = Math.max(0, (height - totalGridH) / 2);

		let lastFillStyle = '';

		for (let y = 0; y < rows; y++) {
			const py = offsetY + y * charHeight;
			if (py < -charHeight || py > height) continue;

			for (let x = 0; x < cols; x++) {
				const px = offsetX + x * charWidth;
				if (px < -charWidth || px > width) continue;

				const cellIdx = y * cols + x;
				if (isTransparent[cellIdx]) continue;
				const norm = Math.max(0, Math.min(1, lumGrid[cellIdx] / 255));
				const charIdx = Math.floor(norm * (charLen - 1));
				const char = chars[charIdx];
				if (char === ' ') continue;

				const pixelIdx = cellIdx * 4;
				let r = data[pixelIdx];
				let g = data[pixelIdx + 1];
				let b = data[pixelIdx + 2];

				let fill = '#ffffff';

				if (colorMode === 'truecolor') {
					fill = `rgb(${r},${g},${b})`;
				} else if (colorMode === 'ansi256') {
					// Snap to 6x6x6 color cube
					r = Math.round(r / 51) * 51;
					g = Math.round(g / 51) * 51;
					b = Math.round(b / 51) * 51;
					fill = `rgb(${r},${g},${b})`;
				} else if (colorMode === 'green') {
					fill = `rgb(34, ${Math.round(120 + norm * 135)}, 94)`;
				} else {
					fill = '#fafafa';
				}

				if (fill !== lastFillStyle) {
					c.fillStyle = fill;
					lastFillStyle = fill;
				}

				c.fillText(char, px, py);
			}
		}
	});

	return () => {
		loop.destroy();
	};
}
