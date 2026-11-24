import { createCanvasLoop } from '../../engine/canvas.js';
import type { MountContext } from '../../types/preset.js';
import {
	createBouquetState,
	updateBouquetSimulation,
	buildFlowerItemsFromCounts
} from './simulation.js';
import {
	drawThickFilledStem,
	evalBezier,
	drawThickLeaf,
	drawFlowerBloom,
	drawBouquetWrappingPaper
} from './flowers.js';
import type { BouquetState, FlowerConfigItem } from './types.js';

const RAMPS: Record<string, string> = {
	standard: ' .:-=+*#%@',
	detailed: ' `.-":;!+*?%S#@$',
	floral: ' .·:;*✿❀❁#@',
	minimal: ' .·:*#',
	braille: ' ⠂⠅⠖⠦⠯⠿'
};

export function mountWeb(ctx: MountContext): () => void {
	const { canvas, container, getParams } = ctx;

	let bouquetState: BouquetState | null = null;
	let lastWidth = 0;
	let lastHeight = 0;
	let lastConfigKey = '';

	let offscreenCanvas: HTMLCanvasElement | null = null;
	let offscreenCtx: CanvasRenderingContext2D | null = null;

	const loop = createCanvasLoop(canvas, container, ({ ctx: c, width, height, time }) => {
		const params = getParams();

		// Read flower counts from the + / - counter buttons
		const lilies = Math.max(0, Number(params.lilies ?? 5));
		const roses = Math.max(0, Number(params.roses ?? 2));
		const tulips = Math.max(0, Number(params.tulips ?? 1));
		const daisies = Math.max(0, Number(params.daisies ?? 0));
		const orchids = Math.max(0, Number(params.orchids ?? 0));
		const colorPalette = String(params.colorPalette ?? 'sunset');

		const flowerItems = buildFlowerItemsFromCounts(
			{ lilies, roses, tulips, daisies, orchids },
			colorPalette
		);

		const speed = Number(params.bloomSpeed ?? 1.0);
		const holdDuration = Math.max(2, Number(params.holdDuration ?? 20));
		const fontSize = Math.max(6, Math.min(11, Number(params.fontSize ?? 7.2)));

		// Character ramp & custom charset
		const rampType = String(params.charRamp ?? 'standard');
		const customInput = params.customCharset !== undefined ? String(params.customCharset) : '';
		
		let activeRamp: string;
		if (rampType === 'custom') {
			activeRamp = customInput.length >= 1 ? customInput : ' .:-=+*#%@';
		} else if (customInput.trim().length >= 2 && customInput !== ' .:-=+*#%@') {
			// If user typed into custom charset input directly, immediately honor it
			activeRamp = customInput;
		} else {
			activeRamp = RAMPS[rampType] || RAMPS.standard;
		}

		const showWrapping = params.wrappingPaper !== false;
		const showSparkles = params.sparkles !== false;
		const butterflyCount = Number(params.butterflies ?? 2);
		const overlayText = String(params.overlayText ?? 'Who needs flowers when you can code them?');

		const configKey = `${width}_${height}_${lilies}_${roses}_${tulips}_${daisies}_${orchids}_${colorPalette}_${butterflyCount}`;

		// Rebuild state if size or counts change
		if (!bouquetState || Math.abs(width - lastWidth) > 30 || Math.abs(height - lastHeight) > 30 || configKey !== lastConfigKey) {
			lastWidth = width;
			lastHeight = height;
			lastConfigKey = configKey;

			bouquetState = createBouquetState(width, height, {
				flowerItems,
				butterfliesCount: butterflyCount,
				sparklesCount: 65
			});
		}

		if (!offscreenCanvas || offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
			offscreenCanvas = document.createElement('canvas');
			offscreenCanvas.width = width;
			offscreenCanvas.height = height;
			offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
		}

		if (!offscreenCtx) return;

		// Growth animation takes ~6.5s (scaled by bloomSpeed), then holds full bloom for holdDuration seconds (default 20s)
		const growDuration = 6.5 / Math.max(0.2, speed);
		const cycleDuration = growDuration + holdDuration;
		const cycleTime = time % cycleDuration;
		const progress = Math.min(1.0, cycleTime / growDuration);

		updateBouquetSimulation(bouquetState, time, progress, width, height);

		// 1. Offscreen Vector Render Pass
		offscreenCtx.fillStyle = '#050505';
		offscreenCtx.fillRect(0, 0, width, height);

		const breeze = progress > 0.55 ? Math.sin(time * 1.8) * 0.04 * (progress - 0.55) * 2.5 : 0;
		const stemProgress = Math.min(1.0, progress / 0.42);

		// Thick base foliage cluster hugging the shorter stems
		for (const leaf of bouquetState.foliageLeaves) {
			if (stemProgress > leaf.growthDelay) {
				const g = Math.min(1.0, (stemProgress - leaf.growthDelay) / 0.35);
				offscreenCtx.strokeStyle = leaf.color;
				offscreenCtx.lineWidth = 10;
				offscreenCtx.lineCap = 'round';
				offscreenCtx.beginPath();
				offscreenCtx.moveTo(leaf.p0[0], leaf.p0[1]);
				const steps = Math.floor(25 * g);
				for (let st = 1; st <= steps; st++) {
					const u = (st / 25) * g;
					const [lx, ly] = evalBezier(leaf.p0, leaf.p1, leaf.p2, leaf.p3, u);
					offscreenCtx.lineTo(lx, ly);
				}
				offscreenCtx.stroke();
			}
		}

		// Thick filled stems (18px tapering to 11px)
		for (const flower of bouquetState.flowers) {
			const tip = drawThickFilledStem(
				offscreenCtx,
				flower.stemP0,
				flower.stemP1,
				flower.stemP2,
				flower.stemP3,
				stemProgress,
				18,
				11
			);

			for (const leaf of flower.leaves) {
				if (stemProgress >= leaf.t) {
					const leafGrowth = Math.min(1.0, (stemProgress - leaf.t) / 0.28);
					const leafOrigin = evalBezier(
						flower.stemP0,
						flower.stemP1,
						flower.stemP2,
						flower.stemP3,
						leaf.t
					);
					drawThickLeaf(offscreenCtx, leafOrigin, leafGrowth, leaf.side, leaf.length, leaf.angle + breeze);
				}
			}

			// Buds at stem tips before opening
			if (stemProgress >= 0.95 && progress < flower.bloomDelay + 0.1) {
				offscreenCtx.beginPath();
				offscreenCtx.ellipse(tip[0], tip[1] - 8, 8, 16, flower.tiltAngle + breeze, 0, Math.PI * 2);
				offscreenCtx.fillStyle = '#2e7d32';
				offscreenCtx.fill();
			}
		}

		// Draw Blooming Flowers
		for (const flower of bouquetState.flowers) {
			drawFlowerBloom(offscreenCtx, flower, progress, breeze);
		}

		// Draw Florist Kraft Wrapping Paper & Satin Bow around the stem bunch (always present)
		if (showWrapping) {
			drawBouquetWrappingPaper(offscreenCtx, width / 2, height * 0.90);
		}

		// Draw Butterflies
		if (progress > 0.55 && bouquetState.butterflies.length > 0) {
			for (const b of bouquetState.butterflies) {
				const bAlpha = Math.min(1.0, (progress - 0.55) / 0.25);
				offscreenCtx.save();
				offscreenCtx.globalAlpha = bAlpha;
				offscreenCtx.translate(b.x, b.y);

				const wingW = 20 * b.scale * Math.max(0.12, b.wingAngle);
				const wingH = 18 * b.scale;

				offscreenCtx.beginPath();
				offscreenCtx.ellipse(-wingW * 0.6, -wingH * 0.2, wingW * 0.6, wingH * 0.7, -0.2, 0, Math.PI * 2);
				offscreenCtx.fillStyle = b.color;
				offscreenCtx.fill();

				offscreenCtx.beginPath();
				offscreenCtx.ellipse(wingW * 0.6, -wingH * 0.2, wingW * 0.6, wingH * 0.7, 0.2, 0, Math.PI * 2);
				offscreenCtx.fillStyle = b.color;
				offscreenCtx.fill();

				offscreenCtx.beginPath();
				offscreenCtx.ellipse(0, 0, 2.5 * b.scale, 10 * b.scale, 0, 0, Math.PI * 2);
				offscreenCtx.fillStyle = '#ffffff';
				offscreenCtx.fill();

				offscreenCtx.restore();
			}
			offscreenCtx.globalAlpha = 1.0;
		}

		// 2. High-Density ASCII Rasterization Pass
		const imgData = offscreenCtx.getImageData(0, 0, width, height);
		const pixels = imgData.data;

		c.fillStyle = '#050505';
		c.fillRect(0, 0, width, height);

		c.font = `600 ${fontSize}px "JetBrains Mono", "Courier New", monospace`;
		c.textBaseline = 'top';
		c.textAlign = 'left';

		const charWidth = fontSize * 0.58;
		const charHeight = fontSize * 0.86;
		const cols = Math.floor(width / charWidth);
		const rows = Math.floor(height / charHeight);
		const rampLen = activeRamp.length;

		for (let r = 0; r < rows; r++) {
			const py = Math.floor(r * charHeight);
			if (py >= height) break;

			for (let col = 0; col < cols; col++) {
				const px = Math.floor(col * charWidth);
				if (px >= width) break;

				const idx = (py * width + px) * 4;
				const red = pixels[idx];
				const green = pixels[idx + 1];
				const blue = pixels[idx + 2];

				const lum = 0.299 * red + 0.587 * green + 0.114 * blue;
				if (lum < 12) continue;

				const charIdx = Math.min(rampLen - 1, Math.floor((lum / 255) * rampLen));
				const char = activeRamp[charIdx];

				const boost = 1.2;
				const outR = Math.min(255, Math.floor(red * boost));
				const outG = Math.min(255, Math.floor(green * boost));
				const outB = Math.min(255, Math.floor(blue * boost));

				c.fillStyle = `rgb(${outR},${outG},${outB})`;
				c.fillText(char, col * charWidth, r * charHeight);
			}
		}

		// 3. Sparkling Particles
		if (showSparkles && progress > 0.55) {
			const sparkleAlpha = Math.min(1.0, (progress - 0.55) / 0.35);
			for (const p of bouquetState.particles) {
				const twinkle = (Math.sin(time * p.twinkleSpeed + p.phase) + 1) * 0.5;
				if (twinkle > 0.3) {
					c.fillStyle = p.color;
					c.globalAlpha = sparkleAlpha * twinkle;
					c.fillText(p.char, p.x, p.y + Math.sin(time + p.phase) * 6);
				}
			}
			c.globalAlpha = 1.0;
		}

		// 4. White Serif Overlay Text
		if (overlayText.trim().length > 0) {
			c.save();
			const textY = Math.max(26, height * 0.08);
			const titleSize = Math.max(18, Math.min(34, width * 0.042));

			c.textAlign = 'center';
			c.font = `italic 400 ${titleSize}px "Playfair Display", "Georgia", "Times New Roman", serif`;
			c.fillStyle = '#ffffff';
			c.shadowColor = 'rgba(255, 255, 255, 0.45)';
			c.shadowBlur = 10;
			c.fillText(overlayText, width / 2, textY);
			c.restore();
		}
	});

	return () => {
		loop.destroy();
	};
}
