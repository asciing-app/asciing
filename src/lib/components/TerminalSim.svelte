<script lang="ts">
	import { decodePresetState } from '../engine/codec.js';
	import { getPresetBySlug } from '../presets/registry.js';
	import type { PresetDefinition, PresetParams } from '../types/preset.js';

	const DEFAULT_COMMAND = 'python3 ascii_plasma.py';
	let commandName = $state(DEFAULT_COMMAND);
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

	let customPreset = $state<PresetDefinition | null>(null);
	let customParams = $state<PresetParams>({});
	let customHash = $state<string>('');
	let activeChoice = $state<1 | 2 | 3>(1);
	let activeMountCleanup: (() => void) | null = null;

	let inputCode = $state('');

	let decoded = $derived.by(() => {
		if (!inputCode.trim()) return null;
		return decodePresetState(inputCode);
	});

	let matchedPreset = $derived.by(() => {
		if (!decoded) return null;
		return getPresetBySlug(decoded.slug);
	});

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
			const fontSize = typeof window !== 'undefined' && window.innerWidth >= 640 ? 12 : 11;
			ctx.font = `${fontSize}px "JetBrains Mono", "Geist Mono", monospace`;
			const measured = ctx.measureText('M').width;
			charWidth = measured > 0 ? measured : (fontSize === 12 ? 7.2 : 6.6);
			charHeight = fontSize === 12 ? 16 : 15;
			cols = Math.max(10, Math.floor((cssW - 24) / charWidth));
			rows = Math.max(5, Math.floor((cssH - 20) / charHeight));
		}
	}

	function drawFrame(time: number) {
		if (!canvasEl || !containerEl || customPreset) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const rect = containerEl.getBoundingClientRect();
		const cssW = rect.width;
		const cssH = rect.height;

		ctx.clearRect(0, 0, cssW, cssH);

		const fontSize = typeof window !== 'undefined' && window.innerWidth >= 640 ? 12 : 11;
		ctx.font = `${fontSize}px "JetBrains Mono", "Geist Mono", monospace`;
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
		if (rafId || customPreset) return;

		function render(now: number) {
			if (!isVisible || simState !== 'running' || customPreset) {
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

	function typeCommand(charIdx: number, slug: string, cmd: string) {
		if (charIdx < cmd.length) {
			typedCommand = cmd.slice(0, charIdx + 1);
			const jitter = Math.floor(35 + Math.random() * 30);
			timerId = setTimeout(() => {
				typeCommand(charIdx + 1, slug, cmd);
			}, jitter);
		} else {
			// Finished typing, wait 140ms to simulate Enter
			timerId = setTimeout(() => {
				mountPreset(slug, cmd);
			}, 140);
		}
	}

	function startBootSequence() {
		clearTimers();
		simState = 'prompt';
		typedCommand = '';
		activeChoice = 1;

		timerId = setTimeout(() => {
			simState = 'typing';
			typeCommand(0, 'ascii-plasma', 'python3 ascii_plasma.py');
		}, 350);
	}

	function selectPreset(choice: 1 | 2 | 3) {
		activeChoice = choice;
		const slug = choice === 1 ? 'ascii-plasma' : choice === 2 ? 'typography-spiral' : 'torus-field';
		const cmd = `python3 ${slug.replace(/-/g, '_')}.py`;

		clearTimers();
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
		if (activeMountCleanup) {
			activeMountCleanup();
			activeMountCleanup = null;
		}

		commandName = cmd;
		typedCommand = '';
		simState = 'typing';
		typeCommand(0, slug, cmd);
	}

	function mountPreset(slug: string, cmd: string) {
		const p = getPresetBySlug(slug);
		if (!p) return;

		clearTimers();
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
		if (activeMountCleanup) {
			activeMountCleanup();
			activeMountCleanup = null;
		}

		const defaultParams: PresetParams = {};
		for (const ctrl of p.controls) {
			if ('default' in ctrl) {
				defaultParams[ctrl.key] = ctrl.default;
			}
		}

		customPreset = p;
		customParams = defaultParams;
		customHash = '';
		commandName = cmd;
		typedCommand = cmd;
		simState = 'running';

		if (canvasEl && containerEl) {
			activeMountCleanup = p.mountWeb({
				canvas: canvasEl,
				container: containerEl,
				getParams: () => customParams,
				getAssets: () => ({})
			});
		}
	}

	function playCode(codeString: string) {
		if (!codeString.trim()) return;
		const d = decodePresetState(codeString.trim());
		if (!d) return;

		const p = getPresetBySlug(d.slug);
		if (!p) return;

		let rawHash = codeString.trim();
		const hashIdx = rawHash.indexOf('#');
		if (hashIdx !== -1) {
			rawHash = rawHash.slice(hashIdx);
		} else if (rawHash.startsWith('v=')) {
			rawHash = `#${rawHash}`;
		} else {
			rawHash = `#v=${rawHash}`;
		}

		customPreset = p;
		customParams = d.params;
		customHash = rawHash;
		if (d.slug === 'ascii-plasma') activeChoice = 1;
		else if (d.slug === 'typography-spiral') activeChoice = 2;
		else if (d.slug === 'torus-field') activeChoice = 3;

		clearTimers();
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
		if (activeMountCleanup) {
			activeMountCleanup();
			activeMountCleanup = null;
		}

		const cmd = `python3 ${p.slug.replace(/-/g, '_')}.py`;
		commandName = cmd;
		typedCommand = cmd;
		simState = 'running';

		if (canvasEl && containerEl) {
			activeMountCleanup = p.mountWeb({
				canvas: canvasEl,
				container: containerEl,
				getParams: () => customParams,
				getAssets: () => ({})
			});
		}
	}

	function handleView() {
		if (!inputCode.trim()) return;
		playCode(inputCode);
	}

	function handleFullscreen() {
		if (!decoded) return;
		let rawHash = inputCode.trim();
		const hashIdx = rawHash.indexOf('#');
		if (hashIdx !== -1) {
			rawHash = rawHash.slice(hashIdx);
		} else if (rawHash.startsWith('v=')) {
			rawHash = `#${rawHash}`;
		} else {
			rawHash = `#v=${rawHash}`;
		}
		window.location.href = `/view${rawHash}`;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleView();
		}
	}

	function handlePaste(e: ClipboardEvent) {
		const pasted = e.clipboardData?.getData('text');
		if (pasted) {
			inputCode = pasted;
			setTimeout(() => {
				playCode(pasted);
			}, 10);
		}
	}

	function handleWindowKeyDown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		const tag = target?.tagName.toLowerCase();
		if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

		if (e.key === '1') {
			selectPreset(1);
		} else if (e.key === '2') {
			selectPreset(2);
		} else if (e.key === '3') {
			selectPreset(3);
		}
	}

	$effect(() => {
		if (typeof window === 'undefined') return;

		window.addEventListener('keydown', handleWindowKeyDown);

		resizeCanvas();

		const resizeObserver = new ResizeObserver(() => {
			resizeCanvas();
			if (simState === 'running' && !customPreset) {
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
					if (isVisible && simState === 'running' && !rafId && !customPreset) {
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
			mountPreset('ascii-plasma', 'python3 ascii_plasma.py');
		} else {
			startBootSequence();
		}

		return () => {
			clearTimers();
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
			if (activeMountCleanup) {
				activeMountCleanup();
				activeMountCleanup = null;
			}
			window.removeEventListener('keydown', handleWindowKeyDown);
			resizeObserver.disconnect();
			intersectionObserver.disconnect();
		};
	});
</script>

<div class="w-full min-w-0 bg-white/[0.015] backdrop-blur-md overflow-hidden select-none border-0">
	<!-- Header Bar: Replaced with slightly transparent borderless text box -->
	<div
		class="relative flex items-center h-10 px-3 bg-white/[0.015] hover:bg-white/[0.03] focus-within:bg-white/[0.03] backdrop-blur-md transition-colors border-0"
	>
		<input
			type="text"
			placeholder="paste generated code"
			bind:value={inputCode}
			onkeydown={handleKeyDown}
			onpaste={handlePaste}
			class="w-full bg-transparent border-0 pl-1 pr-44 sm:pr-52 py-2 text-white font-normal text-xs placeholder:font-normal placeholder:text-white/30 placeholder:drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-colors focus:outline-none"
		/>

		<!-- Right Side: view button with darker red padding & fullscreen button -->
		<div class="absolute right-2 flex items-center gap-1.5 sm:gap-2">
			<button
				type="button"
				onclick={handleFullscreen}
				disabled={!decoded}
				class="px-2.5 py-1 text-xs font-normal text-white/70 hover:text-white disabled:opacity-0 disabled:pointer-events-none bg-white/[0.06] hover:bg-white/[0.12] transition-all border-0 cursor-pointer"
			>
				fullscreen
			</button>
			<button
				type="button"
				onclick={handleView}
				disabled={!decoded}
				class="px-3.5 py-1 text-xs font-normal text-white disabled:opacity-40 disabled:cursor-not-allowed bg-[#7a1616] hover:bg-[#8f1a1a] transition-colors border-0 cursor-pointer"
			>
				view
			</button>
		</div>
	</div>

	<!-- Terminal Body: Scales with width and viewport height like cards -->
	<div
		bind:this={containerEl}
		class="relative w-full h-64 sm:h-72 lg:h-[clamp(280px,42vh,520px)] bg-transparent overflow-hidden font-mono text-xs sm:text-sm"
	>
		<!-- Continuous Canvas -->
		<canvas
			bind:this={canvasEl}
			class="w-full h-full block"
			class:hidden={simState !== 'running'}
		></canvas>

		<!-- Corner controls overlay: 1, 2, 3 -->
		<div class="absolute top-2.5 right-2.5 z-10 flex flex-col items-end gap-1.5">
			<button
				type="button"
				onclick={() => selectPreset(1)}
				class="w-7 h-6 flex items-center justify-center text-xs font-sans border-0 transition-colors cursor-pointer backdrop-blur-md {activeChoice === 1
					? 'bg-[#7a1616] text-white font-semibold'
					: 'bg-black/40 hover:bg-black/70 text-white/50 hover:text-white font-normal'}"
				title="1: ASCII Plasma"
			>
				1
			</button>

			<button
				type="button"
				onclick={() => selectPreset(2)}
				class="w-7 h-6 flex items-center justify-center text-xs font-sans border-0 transition-colors cursor-pointer backdrop-blur-md {activeChoice === 2
					? 'bg-[#7a1616] text-white font-semibold'
					: 'bg-black/40 hover:bg-black/70 text-white/50 hover:text-white font-normal'}"
				title="2: Typography Spiral"
			>
				2
			</button>

			<button
				type="button"
				onclick={() => selectPreset(3)}
				class="w-7 h-6 flex items-center justify-center text-xs font-sans border-0 transition-colors cursor-pointer backdrop-blur-md {activeChoice === 3
					? 'bg-[#7a1616] text-white font-semibold'
					: 'bg-black/40 hover:bg-black/70 text-white/50 hover:text-white font-normal'}"
				title="3: 3D Torus Field"
			>
				3
			</button>
		</div>

		<!-- Prompt / Typing text overlay -->
		{#if simState === 'prompt' || simState === 'typing'}
			<div class="p-3.5 sm:p-4 text-xs sm:text-sm font-mono leading-relaxed text-[#a1a1aa] select-text">
				<div>
					<span class="text-[#71717a]">~/asciing $ </span>
					<span class="text-[#fafafa]">{typedCommand}</span>
					<span class="inline-block w-2 h-3.5 bg-[#fafafa] align-middle animate-pulse ml-0.5"
					></span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Status notice if preset recognized or invalid code -->
	{#if matchedPreset}
		<div class="flex items-center gap-1.5 text-[11px] text-white/90 px-3 py-1.5 bg-black/30 border-t border-white/[0.03]">
			<span class="text-[#FF605C]">✔</span>
			<span>Loaded: <strong>{matchedPreset.title}</strong></span>
		</div>
	{:else if inputCode.trim() && !decoded}
		<div class="text-[11px] text-[#FF605C] px-3 py-1.5 bg-black/30 border-t border-white/[0.03]">
			Invalid or corrupted share code / URL
		</div>
	{/if}
</div>
