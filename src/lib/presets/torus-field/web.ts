import { createCanvasLoop } from '../../engine/canvas.js';
import type { MountContext } from '../../types/preset.js';

const CHARS = '.,-~:;=!*#$@';
const CHAR_LEN = CHARS.length;

export function mountWeb(ctx: MountContext): () => void {
	const { canvas, container, getParams } = ctx;

	const loop = createCanvasLoop(canvas, container, ({ ctx: c, width, height, time }) => {
		const params = getParams();
		const rotSpeedA = Number(params.speedX ?? 0.8);
		const rotSpeedB = Number(params.speedY ?? 0.5);
		const r1 = Number(params.innerRadius ?? 1.0);
		const r2 = Number(params.outerRadius ?? 2.0);
		const fontSize = Number(params.fontSize ?? 14);
		const colorMode = String(params.colorMode ?? 'emerald');

		// Clear obsidian background
		c.fillStyle = '#09090b';
		c.fillRect(0, 0, width, height);

		c.font = `${fontSize}px "JetBrains Mono", monospace`;
		c.textBaseline = 'top';
		c.textAlign = 'left';

		const charW = fontSize * 0.6;
		const charH = fontSize;

		const cols = Math.floor(width / charW);
		const rows = Math.floor(height / charH);

		if (cols <= 0 || rows <= 0) return;

		const output = new Array(rows * cols).fill(' ');
		const zbuffer = new Float32Array(rows * cols);
		const colorBuf = new Float32Array(rows * cols);

		const A = time * rotSpeedA;
		const B = time * rotSpeedB;

		const cosA = Math.cos(A);
		const sinA = Math.sin(A);
		const cosB = Math.cos(B);
		const sinB = Math.sin(B);

		const K2 = 5.0;
		const K1 = (cols * K2 * 3.0) / (8.0 * (r1 + r2));

		const thetaStep = 0.07;
		const phiStep = 0.02;

		for (let phi = 0; phi < 6.28318; phi += phiStep) {
			const cosphi = Math.cos(phi);
			const sinphi = Math.sin(phi);

			for (let theta = 0; theta < 6.28318; theta += thetaStep) {
				const costheta = Math.cos(theta);
				const sintheta = Math.sin(theta);

				const circlex = r2 + r1 * costheta;
				const circley = r1 * sintheta;

				const x = circlex * (cosB * cosphi + sinA * sinB * sinphi) - circley * cosA * sinB;
				const y = circlex * (sinB * cosphi - sinA * cosB * sinphi) + circley * cosA * cosB;
				const z = K2 + cosA * circlex * sinphi + circley * sinA;
				const ooz = 1.0 / z;

				const xp = Math.floor(cols / 2 + K1 * ooz * x);
				const yp = Math.floor(rows / 2 - K1 * ooz * y * 0.5);

				const L =
					cosphi * costheta * sinB -
					cosA * costheta * sinphi -
					sinA * sintheta +
					cosB * (cosA * sintheta - costheta * sinA * sinphi);

				if (xp >= 0 && xp < cols && yp >= 0 && yp < rows) {
					const idx = yp * cols + xp;
					if (ooz > zbuffer[idx]) {
						zbuffer[idx] = ooz;
						const normLum = Math.max(0, Math.min(1, (L + 1.414) / 2.828));
						const charIdx = Math.floor(normLum * (CHAR_LEN - 1));
						output[idx] = CHARS[charIdx];
						colorBuf[idx] = normLum;
					}
				}
			}
		}

		// Render glyphs to canvas
		for (let r = 0; r < rows; r++) {
			for (let col = 0; col < cols; col++) {
				const idx = r * cols + col;
				const ch = output[idx];
				if (ch === ' ') continue;

				const lum = colorBuf[idx];
				let color = '#fafafa';

				if (colorMode === 'emerald') {
					const red = Math.floor(lum * 60);
					const green = Math.floor(lum * 220 + 35);
					const blue = Math.floor(lum * 140 + 20);
					color = `rgb(${red}, ${green}, ${blue})`;
				} else if (colorMode === 'amber') {
					const red = Math.floor(lum * 240 + 15);
					const green = Math.floor(lum * 150 + 10);
					const blue = Math.floor(lum * 30);
					color = `rgb(${red}, ${green}, ${blue})`;
				} else if (colorMode === 'electric-blue') {
					const red = Math.floor(lum * 50);
					const green = Math.floor(lum * 160 + 30);
					const blue = Math.floor(lum * 230 + 25);
					color = `rgb(${red}, ${green}, ${blue})`;
				} else {
					const val = Math.floor(lum * 240 + 15);
					color = `rgb(${val}, ${val}, ${val})`;
				}

				c.fillStyle = color;
				c.fillText(ch, col * charW, r * charH);
			}
		}
	});

	return () => {
		loop.destroy();
	};
}
