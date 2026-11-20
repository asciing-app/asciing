import { createCanvasLoop } from '../../engine/canvas.js';
import type { MountContext } from '../../types/preset.js';

const CHAR_SETS: Record<string, string> = {
	standard: ' .:-=+*#%@',
	blocks: ' ░▒▓█',
	minimal: ' .oO@',
	binary: ' 01',
	detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
};

export function mountWeb(ctx: MountContext): () => void {
	const { canvas, container, getParams } = ctx;

	const loop = createCanvasLoop(canvas, container, ({ ctx: c, width, height, time }) => {
		const params = getParams();
		const speed = Number(params.speed ?? 1.0);
		const scale = Number(params.scale ?? 2.5);
		const fontSize = Number(params.fontSize ?? 13);
		const charSetKey = String(params.charSet ?? 'standard');
		const colorMode = String(params.colorMode ?? 'cyan-magenta');

		const chars = CHAR_SETS[charSetKey] || CHAR_SETS.standard;
		const charLen = chars.length;

		// Clear background
		c.fillStyle = '#09090b';
		c.fillRect(0, 0, width, height);

		c.font = `${fontSize}px "JetBrains Mono", monospace`;
		c.textBaseline = 'top';
		c.textAlign = 'left';

		const charWidth = fontSize * 0.6;
		const charHeight = fontSize;

		const cols = Math.floor(width / charWidth);
		const rows = Math.floor(height / charHeight);

		const t = time * speed;
		const aspect = cols / Math.max(1, rows);

		for (let r = 0; r < rows; r++) {
			const y = (r / rows) * 2 - 1;

			for (let col = 0; col < cols; col++) {
				const x = ((col / cols) * 2 - 1) * aspect;

				const v1 = Math.sin(x * scale + t);
				const v2 = Math.sin(y * scale + t * 0.8);
				const v3 = Math.sin((x + y) * scale + t * 1.2);
				const cx = x + 0.5 * Math.sin(t / 3);
				const cy = y + 0.5 * Math.cos(t / 2);
				const v4 = Math.sin(Math.sqrt(cx * cx + cy * cy + 1) * scale * 1.5 - t);

				const val = (v1 + v2 + v3 + v4) / 4;
				const norm = Math.max(0, Math.min(1, (val + 1) * 0.5));

				const charIdx = Math.floor(norm * (charLen - 1));
				const char = chars[charIdx];

				let color = '#fafafa';
				if (colorMode === 'cyan-magenta') {
					const red = Math.floor(norm * 240 + 15);
					const green = Math.floor((1 - norm) * 180 + 30);
					color = `rgb(${red}, ${green}, 255)`;
				} else if (colorMode === 'green-phosphor') {
					const green = Math.floor(norm * 220 + 35);
					color = `rgb(${Math.floor(norm * 40)}, ${green}, ${Math.floor(norm * 60)})`;
				} else if (colorMode === 'amber-crt') {
					const red = Math.floor(norm * 230 + 25);
					const green = Math.floor(norm * 140 + 15);
					color = `rgb(${red}, ${green}, ${Math.floor(norm * 20)})`;
				} else if (colorMode === 'fire') {
					const red = Math.min(255, Math.floor(norm * 2.5 * 255));
					const green = Math.max(0, Math.floor((norm - 0.3) * 1.8 * 255));
					const blue = Math.max(0, Math.floor((norm - 0.7) * 3.0 * 255));
					color = `rgb(${red}, ${green}, ${blue})`;
				} else {
					const lum = Math.floor(norm * 240 + 15);
					color = `rgb(${lum}, ${lum}, ${lum})`;
				}

				c.fillStyle = color;
				c.fillText(char, col * charWidth, r * charHeight);
			}
		}
	});

	return () => {
		loop.destroy();
	};
}
