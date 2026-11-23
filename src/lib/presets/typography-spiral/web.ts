import { createCanvasLoop } from '../../engine/canvas.js';
import type { MountContext } from '../../types/preset.js';
import { ATLAS_CELL_SIZE, ATLAS_FONT_SIZE, GlyphAtlas, ASCII_RAMP } from './atlas.js';
import { LuminanceSampler } from './luminance.js';
import { SpiralGeometryCache } from './spiral.js';

export function mountWeb(ctx: MountContext): () => void {
	const { canvas, container, getParams, getAssets } = ctx;

	const luminanceSampler = new LuminanceSampler();
	const spiralCache = new SpiralGeometryCache();
	const glyphAtlas = new GlyphAtlas();

	let orbitAngle = 0.0;
	let lastAlpha = -1.0;

	// Cap DPR at 1.5 for ultra-high-density spiral performance
	const loop = createCanvasLoop(
		canvas,
		container,
		({ ctx: c, width, height, dt, dpr }) => {
			const params = getParams();
			const assets = getAssets();

			// Sync image asset reference (rebuilds Float32Array strictly when reference changes)
			luminanceSampler.syncAsset(assets['image'] as ImageData | HTMLCanvasElement | undefined);

			const ringSpacing = Math.max(10, Number(params.ringSpacing ?? 14));
			const orbitSpeed = Number(params.speed ?? 0.15);
			const contrast = Number(params.contrast ?? 1.25);
			const invert = Boolean(params.invert ?? false);
			const mode = String(params.mode ?? 'flowing');
			const phrase = String(params.text ?? 'ASCIING // ARCHIMEDEAN SPIRAL // ');
			const textColor = String(params.textColor ?? '#fafafa');
			const bgColor = String(params.bgColor ?? '#09090b');

			// Get or update pre-baked glyph sprite atlas
			const atlasData = glyphAtlas.getAtlas(phrase, mode, textColor);
			if (!atlasData) return;

			const { canvas: atlasCanvas, sprites, phraseIndices, halftoneIndices } = atlasData;

			// Reset transform to DPR coordinate system before clear
			c.setTransform(dpr, 0, 0, dpr, 0, 0);
			c.globalAlpha = 1.0;
			c.fillStyle = bgColor;
			c.fillRect(0, 0, width, height);

			// Fast image smoothing for sprite downscaling
			c.imageSmoothingEnabled = true;
			c.imageSmoothingQuality = 'low';

			// Smooth orbital angle accumulation clamped against long pause jumps
			const safeDt = Math.min(dt, 0.05);
			orbitAngle += orbitSpeed * safeDt;

			// Single trig evaluation per frame
			const cosOrbit = Math.cos(orbitAngle);
			const sinOrbit = Math.sin(orbitAngle);

			const nominalCharSpacing = ringSpacing * 0.62;
			const geometry = spiralCache.getGeometry(width, height, ringSpacing, nominalCharSpacing);
			const count = geometry.count;
			if (count === 0) return;

			const cx = width / 2.0;
			const cy = height / 2.0;
			const portraitRadius = geometry.maxRadius;
			const portraitDiameter = portraitRadius * 2.0;

			const maxFontSize = ringSpacing * 1.08;
			const minFontSize = Math.max(4.0, ringSpacing * 0.25);
			const fontRange = maxFontSize - minFontSize;

			const rArr = geometry.r;
			const cosThetaArr = geometry.cosTheta;
			const sinThetaArr = geometry.sinTheta;
			const cosTanArr = geometry.cosTan;
			const sinTanArr = geometry.sinTan;

			const phraseLen = phraseIndices.length;
			const rampLen = halftoneIndices.length;
			const halfCell = ATLAS_CELL_SIZE / 2; // 32
			const invAtlasFontSize = 1.0 / ATLAS_FONT_SIZE;

			lastAlpha = -1.0;

			for (let i = 0; i < count; i++) {
				const r = rArr[i];

				// 2. Strict outer-radius cutoff: skip points at or beyond the sphere radius
				if (r >= portraitRadius) continue;

				// Angle-addition identity: zero per-node Math.sin / Math.cos
				// a = theta + orbitAngle
				const cosA = cosThetaArr[i] * cosOrbit - sinThetaArr[i] * sinOrbit;
				const sinA = sinThetaArr[i] * cosOrbit + cosThetaArr[i] * sinOrbit;

				const x = cx + r * cosA;
				const y = cy + r * sinA;

				// Sample stationary portrait buffer
				const normX = (x - (cx - portraitRadius)) / portraitDiameter;
				const normY = (y - (cy - portraitRadius)) / portraitDiameter;

				const lum = luminanceSampler.sampleLuminance(normX, normY, contrast, invert);

				// 3. Hard visibility cull threshold after contrast: skip drawing completely
				if (lum < 0.04) continue;

				// Fast sprite lookup
				let spriteIdx = 0;
				if (mode === 'halftone') {
					const rampIdx = Math.min(rampLen - 1, Math.floor(lum * rampLen));
					spriteIdx = halftoneIndices[rampIdx];
				} else {
					spriteIdx = phraseIndices[i % phraseLen];
				}

				const sprite = sprites[spriteIdx];
				if (!sprite || sprite.char === ' ') continue;

				// Smooth alpha scaling starting from threshold up to 1.0 (no stale minimum opacity)
				const rawAlpha = Math.min(1.0, ((lum - 0.04) / (1.0 - 0.04)) * 0.85 + 0.15);
				const qAlpha = Math.round(rawAlpha * 10) / 10;
				if (qAlpha !== lastAlpha) {
					c.globalAlpha = qAlpha;
					lastAlpha = qAlpha;
				}

				// Angle-addition identity for local tangent angle:
				// phi = alpha_tan + orbitAngle
				const cosPhi = cosTanArr[i] * cosOrbit - sinTanArr[i] * sinOrbit;
				const sinPhi = sinTanArr[i] * cosOrbit + cosTanArr[i] * sinOrbit;

				// Midtone lift curve so midtones don't look overly thin
				const lCurve = Math.pow(lum, 0.8);
				const fontSize = minFontSize + lCurve * fontRange;
				const scale = dpr * fontSize * invAtlasFontSize;

				// Direct affine transform matrix (incorporating DPR, scale, rotation, and translation)
				// Zero ctx.save() or ctx.restore() calls
				c.setTransform(
					scale * cosPhi,
					scale * sinPhi,
					-scale * sinPhi,
					scale * cosPhi,
					dpr * x,
					dpr * y
				);

				c.drawImage(
					atlasCanvas,
					sprite.sx,
					sprite.sy,
					ATLAS_CELL_SIZE,
					ATLAS_CELL_SIZE,
					-halfCell,
					-halfCell,
					ATLAS_CELL_SIZE,
					ATLAS_CELL_SIZE
				);
			}

			// Restore standard DPR transform at end of frame
			c.setTransform(dpr, 0, 0, dpr, 0, 0);
		},
		{ maxDpr: 1.5 }
	);

	return () => {
		loop.destroy();
	};
}
