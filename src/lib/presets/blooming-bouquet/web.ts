import { createCanvasLoop } from '../../engine/canvas.js';
import type { MountContext } from '../../types/preset.js';
import {
	createBouquetState,
	updateBouquetSimulation,
	buildFlowerItemsFromCounts,
	rotatePoint3D
} from './simulation.js';
import {
	drawThickFilledStem,
	evalBezier,
	drawThickLeaf,
	drawFlowerBloom,
	drawBouquetWrappingPaper
} from './flowers.js';
import type { BouquetState } from './types.js';

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

	// Mouse drag orbit interaction state
	let isDragging = false;
	let dragStartX = 0;
	let dragStartAngle = 0;
	let userOrbitAngle = 0;

	function onPointerDown(e: PointerEvent) {
		isDragging = true;
		dragStartX = e.clientX;
		dragStartAngle = userOrbitAngle;
		canvas.setPointerCapture?.(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!isDragging) return;
		const deltaX = e.clientX - dragStartX;
		userOrbitAngle = dragStartAngle + deltaX * 0.008;
	}

	function onPointerUp(e: PointerEvent) {
		if (isDragging) {
			isDragging = false;
			canvas.releasePointerCapture?.(e.pointerId);
		}
	}

	canvas.addEventListener('pointerdown', onPointerDown);
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerUp);

	const loop = createCanvasLoop(canvas, container, ({ ctx: c, width, height, time }) => {
		const params = getParams();

		// Read flower counts from the + / - counter buttons (default 2 of each flower)
		const lilies = Math.max(0, Number(params.lilies ?? 2));
		const roses = Math.max(0, Number(params.roses ?? 2));
		const tulips = Math.max(0, Number(params.tulips ?? 2));
		const daisies = Math.max(0, Number(params.daisies ?? 2));
		const orchids = Math.max(0, Number(params.orchids ?? 2));
		const colorPalette = String(params.colorPalette ?? 'sunset');

		const flowerItems = buildFlowerItemsFromCounts(
			{ lilies, roses, tulips, daisies, orchids },
			colorPalette
		);

		const fontSize = Math.max(6, Math.min(11, Number(params.fontSize ?? 7.2)));

		// 3D Controls - natural three-quarter 28 degree elevation
		const rotate3d = params.rotate3d !== false;
		const rotationSpeed = Number(params.rotationSpeed ?? 0.25);
		const cameraPitch = (28 * Math.PI) / 180;

		// Character ramp & custom charset
		const rampType = String(params.charRamp ?? 'standard');
		const customInput = params.customCharset !== undefined ? String(params.customCharset) : '';

		let activeRamp: string;
		if (rampType === 'custom') {
			activeRamp = customInput.length >= 1 ? customInput : ' .:-=+*#%@';
		} else if (customInput.trim().length >= 2 && customInput !== ' .:-=+*#%@') {
			activeRamp = customInput;
		} else {
			activeRamp = RAMPS[rampType] || RAMPS.standard;
		}

		const showWrapping = params.wrappingPaper !== false;
		const showSparkles = params.sparkles !== false;
		const butterflyCount = Number(params.butterflies ?? 10);
		const overlayText = String(params.overlayText ?? 'Who needs flowers when you can code them?');

		const configKey = `${width}_${height}_${lilies}_${roses}_${tulips}_${daisies}_${orchids}_${colorPalette}_${butterflyCount}`;

		// Rebuild state if size or counts change
		if (
			!bouquetState ||
			Math.abs(width - lastWidth) > 30 ||
			Math.abs(height - lastHeight) > 30 ||
			configKey !== lastConfigKey
		) {
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

		// Bouquet stays continuously in full bloom with gentle natural swaying breeze
		const progress = 1.0;
		const stemProgress = 1.0;
		const breeze = Math.sin(time * 1.8) * 0.035;

		updateBouquetSimulation(bouquetState, time, progress, width, height);

		// 1. Offscreen Vector Render Pass
		offscreenCtx.fillStyle = '#050505';
		offscreenCtx.fillRect(0, 0, width, height);

		// 3D Rotation angles
		const autoAngle = rotate3d ? time * rotationSpeed : 0;
		const currentAngleY = autoAngle + userOrbitAngle;

		const rootScreenX = width / 2;
		const rootScreenY = height * 0.78;
		const camDist = 650;
		const focalLen = 650;

		// Helper to project 3D point (world origin at root base) to screen coords
		function project3D(p: [number, number, number]): { x: number; y: number; z: number; scale: number } {
			const rotated = rotatePoint3D(p, currentAngleY, cameraPitch);
			// In camera space, distance increases as rotated z decreases
			const zView = camDist - rotated[2];
			const sc = focalLen / Math.max(100, zView);
			return {
				x: rootScreenX + rotated[0] * sc,
				y: rootScreenY + rotated[1] * sc,
				z: rotated[2],
				scale: sc
			};
		}

		// Project foliage leaves
		for (const leaf of bouquetState.foliageLeaves) {
			if (leaf.p0_3D && leaf.p1_3D && leaf.p2_3D && leaf.p3_3D) {
				const pr0 = project3D(leaf.p0_3D);
				const pr1 = project3D(leaf.p1_3D);
				const pr2 = project3D(leaf.p2_3D);
				const pr3 = project3D(leaf.p3_3D);
				leaf.p0 = [pr0.x, pr0.y];
				leaf.p1 = [pr1.x, pr1.y];
				leaf.p2 = [pr2.x, pr2.y];
				leaf.p3 = [pr3.x, pr3.y];
				leaf.currentZ = pr3.z;
			}
		}

		// Project flower stems, compute 3D normals and affine projection transforms
		for (const flower of bouquetState.flowers) {
			if (flower.stemP0_3D && flower.stemP1_3D && flower.stemP2_3D && flower.stemP3_3D) {
				const pr0 = project3D(flower.stemP0_3D);
				const pr1 = project3D(flower.stemP1_3D);
				const pr2 = project3D(flower.stemP2_3D);
				const pr3 = project3D(flower.stemP3_3D);

				flower.stemP0 = [pr0.x, pr0.y];
				flower.stemP1 = [pr1.x, pr1.y];
				flower.stemP2 = [pr2.x, pr2.y];
				flower.stemP3 = [pr3.x, pr3.y];
				flower.projectedX = pr3.x;
				flower.projectedY = pr3.y;
				flower.currentZ = pr3.z;
				flower.projectedScale = pr3.scale;
			} else {
				flower.currentZ = flower.depth * 50;
				flower.projectedX = flower.targetX;
				flower.projectedY = flower.targetY;
				flower.projectedScale = 1.0;
			}
		}

		// Sort flowers by Z-depth (Painter's algorithm: lowest z / farthest back drawn first)
		const sortedFlowers = [...bouquetState.flowers].sort((a, b) => (a.currentZ ?? 0) - (b.currentZ ?? 0));

		// 1. Draw Rear Kraft Wrapping Paper cavity (behind stems)
		if (showWrapping) {
			drawBouquetWrappingPaper(offscreenCtx, rootScreenX, rootScreenY, currentAngleY, cameraPitch, 'back');
		}

		// Draw Foliage Leaves
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

		// Draw Stems and Leaves in 3D depth-sorted order
		for (const flower of sortedFlowers) {
			const sc = flower.projectedScale ?? 1.0;
			const tip = drawThickFilledStem(
				offscreenCtx,
				flower.stemP0,
				flower.stemP1,
				flower.stemP2,
				flower.stemP3,
				stemProgress,
				18 * sc,
				11 * sc
			);

			for (const leaf of flower.leaves) {
				if (stemProgress >= leaf.t) {
					const leafGrowth = Math.min(1.0, (stemProgress - leaf.t) / 0.16);
					const leafOrigin = evalBezier(
						flower.stemP0,
						flower.stemP1,
						flower.stemP2,
						flower.stemP3,
						leaf.t
					);
					drawThickLeaf(
						offscreenCtx,
						leafOrigin,
						leafGrowth,
						leaf.side,
						leaf.length * sc,
						leaf.angle + breeze
					);
				}
			}

			// Buds at stem tips before opening
			if (stemProgress >= 0.88 && progress < flower.bloomDelay + 0.06) {
				offscreenCtx.beginPath();
				offscreenCtx.ellipse(
					tip[0],
					tip[1] - 8 * sc,
					8 * sc,
					16 * sc,
					flower.tiltAngle + breeze,
					0,
					Math.PI * 2
				);
				offscreenCtx.fillStyle = '#2e7d32';
				offscreenCtx.fill();
			}
		}

		// 2. Draw Front Kraft Wrapping Paper & Rotating Satin Ribbon Bow (wrapping over lower stems)
		if (showWrapping) {
			drawBouquetWrappingPaper(offscreenCtx, rootScreenX, rootScreenY, currentAngleY, cameraPitch, 'front');
		}

		// 3. Draw Blooming Flowers in 3D depth-sorted order with gentle perspective foreshortening
		for (const flower of sortedFlowers) {
			if (flower.normal3D && flower.tangentU && flower.tangentV) {
				const rotNorm = rotatePoint3D(flower.normal3D, currentAngleY, cameraPitch);
				const rotU = rotatePoint3D(flower.tangentU, currentAngleY, cameraPitch);
				const rotV = rotatePoint3D(flower.tangentV, currentAngleY, cameraPitch);
				const sc = flower.projectedScale ?? 1.0;

				// Foreshortened affine projection ensuring positive determinant orientation
				const uLen = Math.hypot(rotU[0], rotU[1]);
				const vLen = Math.hypot(rotV[0], rotV[1]);
				const safeULen = uLen < 1e-4 ? 1 : uLen;
				const safeVLen = vLen < 1e-4 ? 1 : vLen;

				const clampedU0 = (rotU[0] / safeULen) * Math.max(0.75, safeULen) * sc;
				const clampedU1 = (rotU[1] / safeULen) * Math.max(0.75, safeULen) * sc;
				let clampedV0 = (rotV[0] / safeVLen) * Math.max(0.75, safeVLen) * sc;
				let clampedV1 = (rotV[1] / safeVLen) * Math.max(0.75, safeVLen) * sc;

				// Ensure positive determinant so the flower face is always oriented correctly towards the camera
				const det = clampedU0 * clampedV1 - clampedU1 * clampedV0;
				if (det < 0) {
					clampedV0 = -clampedV0;
					clampedV1 = -clampedV1;
				}

				const affine: [number, number, number, number] = [
					clampedU0 || sc,
					clampedU1,
					clampedV0,
					clampedV1 || sc
				];

				drawFlowerBloom(offscreenCtx, flower, progress, breeze, affine, rotNorm[2]);
			} else {
				drawFlowerBloom(offscreenCtx, flower, progress, breeze);
			}
		}

		// Draw Butterflies
		if (bouquetState.butterflies.length > 0) {
			for (const b of bouquetState.butterflies) {
				offscreenCtx.save();
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
		if (showSparkles) {
			for (const p of bouquetState.particles) {
				const twinkle = (Math.sin(time * p.twinkleSpeed + p.phase) + 1) * 0.5;
				if (twinkle > 0.3) {
					c.fillStyle = p.color;
					c.globalAlpha = twinkle;
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
		canvas.removeEventListener('pointerdown', onPointerDown);
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerUp);
		loop.destroy();
	};
}
