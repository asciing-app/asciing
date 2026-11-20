import { createCanvasLoop } from '../../engine/canvas.js';
import type { MountContext } from '../../types/preset.js';

export function mountWeb(ctx: MountContext): () => void {
	const { canvas, container, getParams, getAssets } = ctx;

	const loop = createCanvasLoop(canvas, container, ({ ctx: c, width, height, time }) => {
		const params = getParams();
		const assets = getAssets();

		const speed = Number(params.speed ?? 0.5);
		const baseFontSize = Number(params.fontSize ?? 14);
		const spiralGap = Number(params.spiralDensity ?? 18);
		const phrase = String(params.text ?? 'ASCIING APP CREATIVE STUDIO ZERO BACKEND PRIVACY FIRST ');
		const textColor = String(params.textColor ?? '#38bdf8');
		const invert = Boolean(params.invert ?? false);

		// Dark canvas background
		c.fillStyle = '#09090b';
		c.fillRect(0, 0, width, height);

		const centerX = width / 2;
		const centerY = height / 2;
		const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

		// Get offscreen image or procedural sample source
		const userImageCanvas = assets['image'] as HTMLCanvasElement | undefined;
		let imgCtx: CanvasRenderingContext2D | null = null;
		let imgWidth = 0;
		let imgHeight = 0;

		if (userImageCanvas && userImageCanvas.width > 0 && userImageCanvas.height > 0) {
			imgCtx = userImageCanvas.getContext('2d');
			imgWidth = userImageCanvas.width;
			imgHeight = userImageCanvas.height;
		}

		c.textAlign = 'center';
		c.textBaseline = 'middle';

		const rotationOffset = time * speed;
		let currentAngle = rotationOffset;
		let charIndex = 0;
		const phraseLength = phrase.length || 1;

		// Archimedean spiral r = b * theta
		const b = spiralGap / (2 * Math.PI);
		let currentRadius = 12;

		while (currentRadius < maxRadius) {
			const x = centerX + currentRadius * Math.cos(currentAngle);
			const y = centerY + currentRadius * Math.sin(currentAngle);

			// Sample luminance from uploaded image or procedural fallback
			let luminance = 0.5;

			if (imgCtx && imgWidth > 0 && imgHeight > 0) {
				// Map canvas (x, y) to image coordinates
				const imgX = Math.floor((x / width) * imgWidth);
				const imgY = Math.floor((y / height) * imgHeight);

				if (imgX >= 0 && imgX < imgWidth && imgY >= 0 && imgY < imgHeight) {
					try {
						const pixel = imgCtx.getImageData(imgX, imgY, 1, 1).data;
						luminance = (pixel[0] * 0.299 + pixel[1] * 0.587 + pixel[2] * 0.114) / 255;
					} catch {
						luminance = 0.5;
					}
				}
			} else {
				// Procedural harmonic fallback pattern
				const dx = (x - centerX) / 80;
				const dy = (y - centerY) / 80;
				const wave = Math.sin(Math.sqrt(dx * dx + dy * dy) - time * 2) * Math.cos(currentAngle * 3);
				luminance = (wave + 1) * 0.5;
			}

			if (invert) {
				luminance = 1 - luminance;
			}

			const char = phrase[charIndex % phraseLength];
			charIndex++;

			// Scale character font size and opacity based on sampled luminance
			const effectiveFontSize = Math.max(7, Math.floor(baseFontSize * (0.4 + luminance * 1.2)));
			c.font = `600 ${effectiveFontSize}px "JetBrains Mono", monospace`;

			c.save();
			c.translate(x, y);
			c.rotate(currentAngle + Math.PI / 2);

			const alpha = Math.max(0.15, Math.min(1.0, luminance * 1.3));
			c.globalAlpha = alpha;
			c.fillStyle = textColor;
			c.fillText(char, 0, 0);
			c.restore();

			// Advance theta so characters don't overlap as radius expands
			// arc length s = r * dTheta => dTheta = charWidth / r
			const charSpacing = effectiveFontSize * 0.9;
			const deltaAngle = Math.max(0.04, charSpacing / Math.max(10, currentRadius));
			currentAngle += deltaAngle;
			currentRadius = b * (currentAngle - rotationOffset);
		}
	});

	return () => {
		loop.destroy();
	};
}
