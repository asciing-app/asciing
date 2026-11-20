<script lang="ts">
	const COMMAND = 'python3 ascii_plasma.py';
	const CHARS = ' .:-=+*#%@';
	const CHAR_LEN = CHARS.length;
	const SCALE = 2.5;

	// Authentic Obsidian terminal palette (muted zinc to soft cyan/emerald phosphor)
	const PALETTE = Array.from({ length: 10 }, (_, i) => {
		const norm = i / 9;
		const red = Math.round(35 + norm * 45);
		const green = Math.round(110 + norm * 135);
		const blue = Math.round(130 + (1.0 - norm) * 70 + norm * 30);
		return `rgb(${red},${green},${blue})`;
	});

	let simState: 'prompt' | 'typing' | 'running' | 'stopped' = $state('prompt');
	let typedCommand = $state('');
	let cols = $state(56);
	let rows = $state(14);

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let containerEl: HTMLDivElement | null = $state(null);

	let charWidth = 6.6;
	let charHeight = 15;
	let t = 0;
	let lastFrameTime = 0;
	let rafId = 0;
	let timerId: ReturnType<typeof setTimeout> | undefined;
	let isVisible = true;

	function clearTimers() {
		if (timerId !== undefined) {
			clearTimeout(timerId);
			timerId = undefined;
		}
	}

	function resizeCanvas() {
		if (!canvasEl || !containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const cssW = rect.width;
		const cssH = rect.height;

		canvasEl.width = Math.round(cssW * dpr);
		canvasEl.height = Math.round(cssH * dpr);

		const ctx = canvasEl.getContext('2d');
		if (ctx) {
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.font = '11px "JetBrains Mono", "Geist Mono", monospace';
			const measured = ctx.measureText('M').width;
			charWidth = measured > 0 ? measured : 6.6;
			charHeight = 15;
			cols = Math.max(10, Math.floor((cssW - 24) / charWidth));
			rows = Math.max(5, Math.floor((cssH - 20) / charHeight));
		}
	}

	function drawFrame(time: number) {
		if (!canvasEl || !containerEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const rect = containerEl.getBoundingClientRect();
		const cssW = rect.width;
		const cssH = rect.height;

		ctx.clearRect(0, 0, cssW, cssH);

		ctx.font = '11px "JetBrains Mono", "Geist Mono", monospace';
		ctx.textBaseline = 'top';

		const paddingX = 12;
		const paddingY = 10;
		const currentCols = cols;
		const currentRows = rows;
		const t_scaled = time;

		for (let r = 0; r < currentRows; r++) {
			const y = (r / Math.max(1, currentRows)) * 2.0 - 1.0;
			const py = paddingY + r * charHeight;

			for (let c = 0; c < currentCols; c++) {
				const x = ((c / Math.max(1, currentCols)) * 2.0 - 1.0) * (currentCols / (currentRows * 2.0));

				const v1 = Math.sin(x * SCALE + t_scaled);
				const v2 = Math.sin(y * SCALE + t_scaled * 0.8);
				const v3 = Math.sin((x + y) * SCALE + t_scaled * 1.2);
				const cx = x + 0.5 * Math.sin(t_scaled / 3.0);
				const cy = y + 0.5 * Math.cos(t_scaled / 2.0);
				const v4 = Math.sin(Math.sqrt(cx * cx + cy * cy + 1.0) * SCALE * 1.5 - t_scaled);

				const val = (v1 + v2 + v3 + v4) / 4.0;
				let norm = (val + 1.0) * 0.5;
				if (norm < 0.0) norm = 0.0;
				else if (norm > 1.0) norm = 1.0;

				const idx = Math.floor(norm * (CHAR_LEN - 1));
				if (idx === 0) continue; // Skip space glyph

				ctx.fillStyle = PALETTE[idx];
				ctx.fillText(CHARS[idx], paddingX + c * charWidth, py);
			}
		}
	}

	function startRenderLoop() {
		if (rafId) return;

		function render(now: number) {
			if (!isVisible || simState !== 'running') {
				rafId = 0;
				return;
			}

			const elapsed = now - lastFrameTime;
			if (elapsed >= 48) {
				// 20 FPS (50ms interval)
				lastFrameTime = now - (elapsed % 50);
				t += 0.06;
				drawFrame(t);
			}

			rafId = requestAnimationFrame(render);
		}

		rafId = requestAnimationFrame(render);
	}

	function typeNextChar(charIdx: number) {
		if (charIdx < COMMAND.length) {
			typedCommand = COMMAND.slice(0, charIdx + 1);
			const jitter = Math.floor(45 + Math.random() * 40);
			timerId = setTimeout(() => {
				typeNextChar(charIdx + 1);
			}, jitter);
		} else {
			// Finished typing, wait 130ms to simulate Enter
			timerId = setTimeout(() => {
				simState = 'running';
				t = 0;
				lastFrameTime = performance.now();
				resizeCanvas();
				if (isVisible) {
					startRenderLoop();
				}
			}, 130);
		}
	}

	function startBootSequence() {
		clearTimers();
		simState = 'prompt';
		typedCommand = '';

		// 400ms pause at prompt before typing
		timerId = setTimeout(() => {
			simState = 'typing';
			typeNextChar(0);
		}, 400);
	}

	function handleStop() {
		clearTimers();
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
		simState = 'stopped';
	}

	function handleReplay() {
		clearTimers();
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
		startBootSequence();
	}

	$effect(() => {
		if (typeof window === 'undefined') return;

		resizeCanvas();

		const resizeObserver = new ResizeObserver(() => {
			resizeCanvas();
			if (simState === 'running') {
				drawFrame(t);
			}
		});

		if (containerEl) {
			resizeObserver.observe(containerEl);
		}

		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const intersectionObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					isVisible = entry.isIntersecting;
					if (isVisible && simState === 'running' && !rafId) {
						lastFrameTime = performance.now();
						startRenderLoop();
					} else if (!isVisible && rafId) {
						cancelAnimationFrame(rafId);
						rafId = 0;
					}
				}
			},
			{ threshold: 0.1 }
		);

		if (containerEl) {
			intersectionObserver.observe(containerEl);
		}

		if (prefersReducedMotion) {
			simState = 'stopped';
		} else {
			startBootSequence();
		}

		return () => {
			clearTimers();
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
			resizeObserver.disconnect();
			intersectionObserver.disconnect();
		};
	});
</script>

<div class="w-full bg-white/[0.015] backdrop-blur-md overflow-hidden select-none">
	<!-- Title Bar -->
	<div
		class="h-9 px-3.5 bg-black/40 border-b border-white/[0.04] flex items-center justify-between"
	>
		<!-- Left: Window dots + status -->
		<div class="flex items-center gap-2">
			<div class="flex items-center gap-1.5" aria-hidden="true">
				<span class="w-2.5 h-2.5 bg-white/10 border border-white/10"></span>
				<span class="w-2.5 h-2.5 bg-white/10 border border-white/10"></span>
				<span class="w-2.5 h-2.5 bg-white/10 border border-white/10"></span>
			</div>
			<span class="text-[11px] font-mono text-[#a1a1aa] ml-1">
				zsh — {cols}×{rows}
			</span>
		</div>

		<!-- Right: Action button + Studio link -->
		<div class="flex items-center gap-3">
			{#if simState === 'running'}
				<button
					type="button"
					onclick={handleStop}
					class="text-[11px] font-mono text-[#a1a1aa] hover:text-white px-2 py-0.5 border border-white/10 hover:border-white/20 bg-white/[0.02] transition-colors cursor-pointer"
					title="Interrupt script (^C)"
				>
					^C
				</button>
			{:else}
				<button
					type="button"
					onclick={handleReplay}
					class="text-[11px] font-mono text-[#a1a1aa] hover:text-white px-2 py-0.5 border border-white/10 hover:border-white/20 bg-white/[0.02] transition-colors cursor-pointer"
					title="Replay script"
				>
					Replay
				</button>
			{/if}

			<a
				href="/studio/ascii-plasma"
				class="text-[11px] font-mono text-[#a1a1aa] hover:text-white transition-colors flex items-center gap-1"
			>
				Studio ↗
			</a>
		</div>
	</div>

	<!-- Terminal Body -->
	<div
		bind:this={containerEl}
		class="relative w-full h-[250px] bg-transparent overflow-hidden font-mono text-xs"
	>
		<!-- Continuous 20 FPS Canvas -->
		<canvas
			bind:this={canvasEl}
			class="w-full h-full block"
			class:hidden={simState !== 'running'}
		></canvas>

		<!-- Prompt / Typing text overlay -->
		{#if simState === 'prompt' || simState === 'typing'}
			<div class="p-4 text-xs font-mono leading-relaxed text-[#a1a1aa] select-text">
				<div>
					<span class="text-[#71717a]">~/asciing $ </span>
					<span class="text-[#fafafa]">{typedCommand}</span>
					<span class="inline-block w-2 h-3.5 bg-[#fafafa] align-middle animate-pulse ml-0.5"
					></span>
				</div>
			</div>
		{:else if simState === 'stopped'}
			<div class="p-4 text-xs font-mono leading-relaxed text-[#a1a1aa] select-text space-y-1">
				<div>
					<span class="text-[#71717a]">~/asciing $ </span>
					<span class="text-[#fafafa]">{COMMAND}</span>
				</div>
				<div class="text-[#71717a]">^C</div>
				<div>
					<span class="text-[#71717a]">~/asciing $ </span>
					<span class="inline-block w-2 h-3.5 bg-[#fafafa] align-middle animate-pulse ml-0.5"
					></span>
				</div>
			</div>
		{/if}
	</div>
</div>
