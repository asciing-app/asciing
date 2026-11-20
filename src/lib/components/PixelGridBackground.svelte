<script lang="ts">
	let canvasEl: HTMLCanvasElement | null = $state(null);

	$effect(() => {
		if (!canvasEl) return;
		const canvas = canvasEl;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const CONFIG = {
			cellSize: 7, // 7px square pixels
			gap: 0, // no space between pixels
			randomGlowChance: 0.06, // chance per frame to spark a random glow cluster
			backgroundColor: '#000000', // base black
			ambientColor: { r: 165, g: 38, b: 38 } // deep darker #FF605C
		};

		let cols = 0;
		let rows = 0;
		interface Cell {
			ambient: number;
			ambientTarget: number;
			ambientSpeed: number;
			baseAlpha: number;
		}
		let cells: Cell[] = [];
		let activeSet = new Set<number>();
		let width = 0;
		let height = 0;
		let baseCanvas: HTMLCanvasElement | null = null;

		function setupGrid() {
			const dpr = window.devicePixelRatio || 1;
			width = window.innerWidth;
			height = window.innerHeight;

			canvas.width = Math.floor(width * dpr);
			canvas.height = Math.floor(height * dpr);
			ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

			const step = CONFIG.cellSize + CONFIG.gap;
			cols = Math.ceil(width / step);
			rows = Math.ceil(height / step);

			cells = Array.from({ length: cols * rows }, () => ({
				ambient: 0,
				ambientTarget: 0,
				ambientSpeed: 0.02,
				baseAlpha: 0.006 + Math.random() * 0.014
			}));

			activeSet.clear();

			// Pre-render static base pixel matrix with glowing red to black gradient (left to right)
			baseCanvas = document.createElement('canvas');
			baseCanvas.width = canvas.width;
			baseCanvas.height = canvas.height;
			const baseCtx = baseCanvas.getContext('2d');
			if (baseCtx) {
				baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

				// Base solid black across entire canvas
				baseCtx.fillStyle = CONFIG.backgroundColor;
				baseCtx.fillRect(0, 0, width, height);

				const halfW = width * 0.5;
				const halfH = height * 0.5;

				// Horizontal gradient: saturated glowing red, stopping at half width and half height
				const bgGrad = baseCtx.createLinearGradient(0, 0, halfW, 0);
				bgGrad.addColorStop(0, '#5c0d0b'); // saturated glowing red on the far left
				bgGrad.addColorStop(0.2, '#3d0807');
				bgGrad.addColorStop(0.5, '#180303');
				bgGrad.addColorStop(1, '#000000'); // stops at half the page

				baseCtx.fillStyle = bgGrad;
				baseCtx.fillRect(0, 0, halfW, halfH);

				// Vertical fade down to black: cuts off gradient at lower half
				const fadeDownGrad = baseCtx.createLinearGradient(0, 0, 0, halfH);
				fadeDownGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
				fadeDownGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
				fadeDownGrad.addColorStop(1, 'rgba(0, 0, 0, 1)');

				baseCtx.fillStyle = fadeDownGrad;
				baseCtx.fillRect(0, 0, halfW, halfH);

				// Saturated glowing atmospheric aura in top-left, strictly within upper half
				const auraGrad = baseCtx.createRadialGradient(0, 0, 0, 0, 0, Math.min(halfW, halfH) * 1.15);
				auraGrad.addColorStop(0, 'rgba(255, 65, 60, 0.42)'); // vibrant saturated glow
				auraGrad.addColorStop(0.35, 'rgba(255, 65, 60, 0.18)');
				auraGrad.addColorStop(0.75, 'rgba(255, 65, 60, 0.03)');
				auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

				baseCtx.fillStyle = auraGrad;
				baseCtx.fillRect(0, 0, halfW, halfH);

				for (let row = 0; row < rows; row++) {
					for (let col = 0; col < cols; col++) {
						const cell = cells[row * cols + col];
						const x = col * step;
						const y = row * step;
						baseCtx.fillStyle = `rgba(255, 96, 92, ${cell.baseAlpha.toFixed(4)})`;
						baseCtx.fillRect(x, y, CONFIG.cellSize, CONFIG.cellSize);
					}
				}
			}
		}

		function triggerRandomGlow() {
			if (cells.length === 0 || Math.random() > CONFIG.randomGlowChance) return;

			// Pick random center for glow cluster
			const centerCol = Math.floor(Math.random() * cols);
			const centerRow = Math.floor(Math.random() * rows);
			// Bigger glow: 2 to 5 cells radius
			const radius = 2 + Math.floor(Math.random() * 4);
			const peakIntensity = 0.45 + Math.random() * 0.5;
			const speed = 0.012 + Math.random() * 0.014;

			const minC = Math.max(0, centerCol - radius);
			const maxC = Math.min(cols - 1, centerCol + radius);
			const minR = Math.max(0, centerRow - radius);
			const maxR = Math.min(rows - 1, centerRow + radius);

			for (let r = minR; r <= maxR; r++) {
				for (let c = minC; c <= maxC; c++) {
					const dist = Math.hypot(c - centerCol, r - centerRow);
					if (dist <= radius) {
						// Edge fadeout: outer pixels fade out smoothly
						const falloff = Math.pow(1 - dist / radius, 1.4);
						const target = peakIntensity * falloff;
						if (target > 0.03) {
							const idx = r * cols + c;
							const cell = cells[idx];
							if (target > cell.ambientTarget) {
								cell.ambientTarget = target;
								cell.ambientSpeed = speed;
								activeSet.add(idx);
							}
						}
					}
				}
			}
		}

		let rafId: number | null = null;

		function animate() {
			if (!ctx) return;

			if (baseCanvas) {
				ctx.drawImage(baseCanvas, 0, 0, width, height);
			} else {
				ctx.fillStyle = CONFIG.backgroundColor;
				ctx.fillRect(0, 0, width, height);
			}

			triggerRandomGlow();

			const step = CONFIG.cellSize + CONFIG.gap;
			const ac = CONFIG.ambientColor;
			const toRemove: number[] = [];

			for (const idx of activeSet) {
				const cell = cells[idx];

				// Pulse ambient glows smoothly in, then out
				if (cell.ambientTarget > 0) {
					cell.ambient += cell.ambientSpeed;
					if (cell.ambient >= cell.ambientTarget) {
						cell.ambient = cell.ambientTarget;
						cell.ambientTarget = 0;
					}
				} else if (cell.ambient > 0) {
					cell.ambient = Math.max(0, cell.ambient - cell.ambientSpeed * 0.45);
				}

				if (cell.ambient > 0.01) {
					const col = idx % cols;
					const row = Math.floor(idx / cols);
					const x = col * step;
					const y = row * step;

					// Glow only the actual pixel squares within bounds
					ctx.fillStyle = `rgba(${ac.r}, ${ac.g}, ${ac.b}, ${(cell.ambient * 0.85).toFixed(3)})`;
					ctx.fillRect(x, y, CONFIG.cellSize, CONFIG.cellSize);
				} else if (cell.ambientTarget === 0 && cell.ambient <= 0.01) {
					cell.ambient = 0;
					toRemove.push(idx);
				}
			}

			for (const idx of toRemove) {
				activeSet.delete(idx);
			}

			rafId = requestAnimationFrame(animate);
		}

		window.addEventListener('resize', setupGrid);

		setupGrid();
		animate();

		return () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
			window.removeEventListener('resize', setupGrid);
		};
	});
</script>

<canvas
	bind:this={canvasEl}
	class="fixed inset-0 w-full h-full pointer-events-none select-none z-0"
></canvas>