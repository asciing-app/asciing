<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getDefaultParams, sampleVideoToFrames } from '../engine/codec.js';
	import { decodeGif } from '../ascii-studio/decoders.js';
	import { exportPythonScript } from '../ascii-studio/pyExporter.js';
	import type { DecodedMediaFrame, AsciiSettings } from '../ascii-studio/types.js';
	import type { PresetDefinition, PresetParams, RuntimeAssets } from '../types/preset.js';

	interface Props {
		preset: PresetDefinition;
		params: PresetParams;
		assets: RuntimeAssets;
		onopenShare: () => void;
	}

	let { preset, params = $bindable(), assets = $bindable(), onopenShare }: Props = $props();

	let collapsed = $state(false);
	let fileInputRef: HTMLInputElement | null = $state(null);
	let userImageName = $state<string | null>(null);

	let gifFrames = $state<DecodedMediaFrame[]>([]);
	let currentFrameIndex = $state(0);
	let isGifPlaying = $state(true);
	let gifTimer: ReturnType<typeof setTimeout> | null = null;
	let gifCanvas: HTMLCanvasElement | null = null;

	$effect(() => {
		if (typeof window !== 'undefined' && window.innerWidth < 768) {
			collapsed = true;
		}
	});

	let activeVideoUrl: string | null = null;

	function resetDefaults() {
		const defaults = getDefaultParams(preset.controls);
		for (const [key, val] of Object.entries(defaults)) {
			params[key] = val;
		}
		clearFile();
	}

	function scheduleGifPlayback() {
		if (gifTimer !== null) {
			clearTimeout(gifTimer);
			gifTimer = null;
		}
		if (!isGifPlaying || gifFrames.length <= 1) return;

		const current = gifFrames[currentFrameIndex];
		const delay = current?.delayMs || 100;

		gifTimer = setTimeout(() => {
			if (!isGifPlaying || gifFrames.length <= 1) return;
			currentFrameIndex = (currentFrameIndex + 1) % gifFrames.length;
			renderActiveGifFrame();
			scheduleGifPlayback();
		}, delay);
	}

	function renderActiveGifFrame() {
		if (gifFrames.length === 0) return;
		const frame = gifFrames[currentFrameIndex];
		if (!frame) return;

		if (!gifCanvas) {
			gifCanvas = document.createElement('canvas');
		}
		gifCanvas.width = frame.bitmap.width;
		gifCanvas.height = frame.bitmap.height;
		const ctx = gifCanvas.getContext('2d');
		if (ctx) {
			ctx.clearRect(0, 0, gifCanvas.width, gifCanvas.height);
			ctx.drawImage(frame.bitmap, 0, 0);
		}

		assets['image'] = gifCanvas;
		assets['gifFrames'] = gifFrames;
	}

	function toggleGifPlayPause() {
		isGifPlaying = !isGifPlaying;
		if (isGifPlaying) {
			scheduleGifPlayback();
		} else if (gifTimer !== null) {
			clearTimeout(gifTimer);
			gifTimer = null;
		}
	}

	let uploadError = $state<string | null>(null);

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		uploadError = null;
		const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB limit
		if (file.size > MAX_FILE_SIZE) {
			uploadError = 'File exceeds 5MB limit. Please select a smaller file.';
			if (fileInputRef) fileInputRef.value = '';
			return;
		}

		clearFile();
		userImageName = file.name;

		// 1. File type routing order:
		// Check for GIF (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif'))
		// BEFORE checking file.type.startsWith('image/') so GIFs never fall into the static image path.
		if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
			try {
				const result = await decodeGif(file);
				gifFrames = result.frames;
				currentFrameIndex = 0;
				isGifPlaying = true;
				renderActiveGifFrame();
				if (gifFrames.length > 1) {
					scheduleGifPlayback();
				}
			} catch (err) {
				console.error('Failed to decode GIF:', err);
			}
			return;
		}

		if (file.type.startsWith('video/')) {
			if (activeVideoUrl) URL.revokeObjectURL(activeVideoUrl);
			activeVideoUrl = URL.createObjectURL(file);
			const video = document.createElement('video');
			video.src = activeVideoUrl;
			video.muted = true;
			video.loop = true;
			video.autoplay = true;
			video.playsInline = true;
			video.play().catch(() => {});
			delete assets['image'];
			assets['video'] = video;
			return;
		}

		if (file.type.startsWith('image/')) {
			const reader = new FileReader();
			reader.onload = (loadEvent) => {
				const dataUrl = loadEvent.target?.result as string;
				if (!dataUrl) return;

				const img = new Image();
				img.onload = () => {
					const MAX_DIM = 512;
					let targetW = img.naturalWidth || img.width;
					let targetH = img.naturalHeight || img.height;
					if (targetW > MAX_DIM || targetH > MAX_DIM) {
						const scale = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
						targetW = Math.max(1, Math.round(targetW * scale));
						targetH = Math.max(1, Math.round(targetH * scale));
					}
					const offscreen = document.createElement('canvas');
					offscreen.width = targetW;
					offscreen.height = targetH;
					const ctx = offscreen.getContext('2d');
					if (ctx) {
						ctx.drawImage(img, 0, 0, targetW, targetH);
						assets['image'] = offscreen;
					}
				};
				img.src = dataUrl;
			};
			reader.readAsDataURL(file);
		}
	}

	let mediaUrlInput = $state('');
	let isLoadingUrl = $state(false);
	let urlError = $state<string | null>(null);
	let lastLoadedUrl = '';

	function clearMediaAssetsOnly() {
		if (gifTimer !== null) {
			clearTimeout(gifTimer);
			gifTimer = null;
		}
		if (gifFrames && gifFrames.length > 0) {
			for (const f of gifFrames) {
				f.bitmap.close?.();
			}
			gifFrames = [];
		}
		currentFrameIndex = 0;
		if (activeVideoUrl) {
			URL.revokeObjectURL(activeVideoUrl);
			activeVideoUrl = null;
		}
		if (assets['video']) {
			(assets['video'] as HTMLVideoElement).pause?.();
			delete assets['video'];
		}
		delete assets['image'];
		delete assets['gifFrames'];
		delete assets['videoFrames'];
	}

	async function loadMediaFromUrl(rawUrl: string) {
		const url = rawUrl.trim();
		if (!url || typeof window === 'undefined') return;

		urlError = null;
		isLoadingUrl = true;

		const isGif = url.toLowerCase().includes('.gif');
		const isVideo = url.toLowerCase().match(/\.(mp4|webm|ogg|mov)(\?|$)/i);

		if (isGif) {
			try {
				let res: Response;
				try {
					res = await fetch(url);
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
				} catch {
					// Fallback to CORS proxy
					const clean = url.replace(/^https?:\/\//i, '');
					res = await fetch(`https://images.weserv.nl/?url=${encodeURIComponent(clean)}&output=gif`);
				}
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const blob = await res.blob();
				const file = new File([blob], 'online.gif', { type: 'image/gif' });
				const decoded = await decodeGif(file);
				clearMediaAssetsOnly();
				gifFrames = decoded.frames;
				currentFrameIndex = 0;
				isGifPlaying = true;
				renderActiveGifFrame();
				if (gifFrames.length > 1) {
					scheduleGifPlayback();
				}
				userImageName = url.split('/').pop()?.split('?')[0] || 'online.gif';
				params.mediaUrl = url;
				lastLoadedUrl = url;
			} catch (err: any) {
				urlError = 'Could not load GIF. Check link or upload file directly.';
				console.error('Failed to load online GIF:', err);
			} finally {
				isLoadingUrl = false;
			}
			return;
		}

		if (isVideo) {
			const video = document.createElement('video');
			video.crossOrigin = 'anonymous';
			video.src = url;
			video.muted = true;
			video.loop = true;
			video.autoplay = true;
			video.playsInline = true;

			video.onloadeddata = () => {
				clearMediaAssetsOnly();
				assets['video'] = video;
				userImageName = url.split('/').pop()?.split('?')[0] || 'online-video';
				params.mediaUrl = url;
				lastLoadedUrl = url;
				isLoadingUrl = false;
				video.play().catch(() => {});
			};

			video.onerror = () => {
				urlError = 'Could not load video (CORS block or invalid URL).';
				isLoadingUrl = false;
			};
			return;
		}

		// Static image
		const tryLoadImage = (srcUrl: string, isFallback: boolean) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				const MAX_DIM = 512;
				let targetW = img.naturalWidth || img.width;
				let targetH = img.naturalHeight || img.height;
				if (targetW > MAX_DIM || targetH > MAX_DIM) {
					const scale = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
					targetW = Math.max(1, Math.round(targetW * scale));
					targetH = Math.max(1, Math.round(targetH * scale));
				}
				const offscreen = document.createElement('canvas');
				offscreen.width = targetW;
				offscreen.height = targetH;
				const ctx = offscreen.getContext('2d');
				if (ctx) {
					try {
						ctx.drawImage(img, 0, 0, targetW, targetH);
						// Test reading to make sure canvas is not tainted by CORS
						ctx.getImageData(0, 0, 1, 1);
						clearMediaAssetsOnly();
						assets['image'] = offscreen;
						userImageName = url.split('/').pop()?.split('?')[0] || 'online-image';
						params.mediaUrl = url;
						lastLoadedUrl = url;
						isLoadingUrl = false;
					} catch {
						if (!isFallback) {
							const clean = url.replace(/^https?:\/\//i, '');
							tryLoadImage(`https://images.weserv.nl/?url=${encodeURIComponent(clean)}`, true);
						} else {
							urlError = 'CORS blocked reading image pixels.';
							isLoadingUrl = false;
						}
					}
				}
			};

			img.onerror = () => {
				if (!isFallback) {
					const clean = url.replace(/^https?:\/\//i, '');
					tryLoadImage(`https://images.weserv.nl/?url=${encodeURIComponent(clean)}`, true);
				} else {
					urlError = 'Could not load image. Check URL or upload directly.';
					isLoadingUrl = false;
				}
			};

			img.src = srcUrl;
		};

		tryLoadImage(url, false);
	}

	function submitUrlInput() {
		const u = mediaUrlInput.trim();
		if (!u) return;
		loadMediaFromUrl(u);
	}

	$effect(() => {
		const target = typeof params.mediaUrl === 'string' ? params.mediaUrl.trim() : '';
		if (target && target !== lastLoadedUrl) {
			lastLoadedUrl = target;
			mediaUrlInput = target;
			loadMediaFromUrl(target);
		}
	});

	function clearFile() {
		clearMediaAssetsOnly();
		userImageName = null;
		mediaUrlInput = '';
		urlError = null;
		isLoadingUrl = false;
		lastLoadedUrl = '';
		params.mediaUrl = '';
		delete params.mediaUrl;
		if (fileInputRef) fileInputRef.value = '';
	}

	onDestroy(() => {
		clearFile();
	});

	async function downloadPythonScript() {
		let script = '';
		if (gifFrames && gifFrames.length > 0) {
			const settings: AsciiSettings = {
				cols: Number(params.cols ?? 90),
				aspectCorrection: 0.55,
				charset: String(params.customCharset || '').trim() || ' .:-=+*#%@',
				colorMode: (params.colorMode as any) || 'truecolor',
				brightness: Number(params.brightness ?? 0),
				contrast: Number(params.contrast ?? 0),
				invert: Boolean(params.invert ?? false),
				dither: Boolean(params.dither ?? false)
			};
			script = exportPythonScript(gifFrames, settings);
		} else if (assets['video']) {
			const vFrames = await sampleVideoToFrames(assets['video'] as HTMLVideoElement);
			const settings: AsciiSettings = {
				cols: Number(params.cols ?? 90),
				aspectCorrection: 0.55,
				charset: String(params.customCharset || '').trim() || ' .:-=+*#%@',
				colorMode: (params.colorMode as any) || 'truecolor',
				brightness: Number(params.brightness ?? 0),
				contrast: Number(params.contrast ?? 0),
				invert: Boolean(params.invert ?? false),
				dither: Boolean(params.dither ?? false)
			};
			script = exportPythonScript(vFrames, settings);
		} else if (preset.generatePython) {
			script = preset.generatePython(params, assets);
		} else {
			return;
		}

		const blob = new Blob([script], { type: 'text/x-python;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${userImageName ? userImageName.replace(/\.[^/.]+$/, '') : preset.slug}-ascii.py`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

<!-- Floating Open Controls Pill (shown when collapsed) -->
{#if collapsed}
	<button
		type="button"
		onclick={() => (collapsed = false)}
		class="fixed top-4 right-4 z-40 flex items-center gap-2 px-3.5 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs font-sans font-medium uppercase tracking-wider border-0 shadow-lg cursor-pointer transition-colors"
		title="Open Controls"
	>
		{#if isLoadingUrl}
			<div class="w-3 h-3 border-2 border-white/20 border-t-[#FF605C] rounded-full animate-spin"></div>
			<span>Loading...</span>
		{:else}
			<span>Controls</span>
		{/if}
		<span>◀</span>
	</button>
{/if}

<!-- Mobile Backdrop (shown when drawer is open on mobile) -->
{#if !collapsed}
	<button
		type="button"
		class="fixed inset-0 bg-black/40 backdrop-blur-xs z-20 md:hidden border-0 cursor-default"
		onclick={() => (collapsed = true)}
		aria-label="Close controls overlay"
	></button>
{/if}

<!-- Floating Control Drawer: Overlaid above ASCII canvas, transparent, no borders, uniform color -->
<aside
	class="fixed top-0 right-0 h-full z-30 flex flex-col w-80 max-w-[calc(100vw-2.5rem)] bg-black/60 backdrop-blur-xl border-0 transition-transform duration-300 font-sans select-none shadow-2xl {collapsed
		? 'translate-x-full'
		: 'translate-x-0'}"
>
	<!-- Loading Media Overlay on the Right Bar -->
	{#if isLoadingUrl}
		<div class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md text-white font-sans space-y-3 p-6 text-center">
			<div class="w-6 h-6 border-2 border-white/20 border-t-[#FF605C] rounded-full animate-spin"></div>
			<div class="text-xs font-bold tracking-wider uppercase text-white">Loading Media...</div>
			<div class="text-[11px] text-white/60 font-mono truncate max-w-full px-2">{mediaUrlInput || params.mediaUrl}</div>
			<div class="text-[10px] text-white/40 font-sans font-light">Streaming source media & preparing ASCII</div>
		</div>
	{/if}
	<!-- Drawer Header: No red square, no separating lines, same background -->
	<div class="flex items-center justify-between h-14 px-4 bg-transparent border-0 shrink-0">
		<a href="/" class="flex items-center overflow-hidden hover:text-[#FF605C] transition-colors group" title="Return to Gallery">
			<span class="font-sans font-bold text-white group-hover:text-[#FF605C] tracking-wider truncate uppercase text-xs">
				{preset.title}
			</span>
		</a>
		<button
			type="button"
			onclick={() => (collapsed = true)}
			class="p-1.5 hover:bg-white/10 text-white hover:text-[#FF605C] transition-colors ml-auto cursor-pointer border-0 font-sans text-xs"
			title="Collapse Controls"
			aria-label="Collapse Controls"
		>
			▶
		</button>
	</div>

	<!-- Controls Body: Uniform transparent background, no separating lines -->
	<div class="flex-1 overflow-y-auto px-4 py-2 space-y-5 bg-transparent border-0">
		{#each preset.controls as ctrl (ctrl.key)}
			<div class="space-y-1.5">
				<div class="flex items-center justify-between text-white font-sans">
					<span class="font-medium tracking-wide uppercase text-[11px] text-white/90">{ctrl.label}</span>
					{#if ctrl.type === 'slider'}
						<span class="text-white/80 tabular-nums font-mono text-[11px]">
							{Number(params[ctrl.key] ?? ctrl.default).toFixed(ctrl.step && ctrl.step < 1 ? 1 : 0)}
						</span>
					{/if}
				</div>

				{#if ctrl.type === 'slider'}
					<input
						type="range"
						min={ctrl.min}
						max={ctrl.max}
						step={ctrl.step ?? 1}
						bind:value={params[ctrl.key]}
						class="w-full accent-[#FF605C] bg-white/10 h-1.5 cursor-pointer"
					/>
				{:else if ctrl.type === 'color'}
					<div class="flex items-center gap-2">
						<input
							type="color"
							bind:value={params[ctrl.key]}
							class="w-7 h-7 border border-white/15 bg-transparent cursor-pointer p-0 shrink-0"
						/>
						<input
							type="text"
							bind:value={params[ctrl.key]}
							class="flex-1 bg-white/5 border border-white/10 px-2.5 py-1 text-white font-mono text-[11px] uppercase focus:outline-none focus:border-[#FF605C]"
						/>
					</div>
				{:else if ctrl.type === 'select'}
					<select
						bind:value={params[ctrl.key]}
						class="w-full bg-white/5 border border-white/10 px-2.5 py-1.5 text-white font-sans text-xs focus:outline-none focus:border-[#FF605C] cursor-pointer"
					>
						{#each ctrl.options as opt (opt.value)}
							<option value={opt.value} class="bg-[#09090b] text-white">{opt.label}</option>
						{/each}
					</select>
				{:else if ctrl.type === 'toggle'}
					<label class="flex items-center gap-2 cursor-pointer mt-1">
						<input
							type="checkbox"
							checked={Boolean(params[ctrl.key])}
							onchange={(e) => {
								params[ctrl.key] = (e.currentTarget as HTMLInputElement).checked;
							}}
							class="w-4 h-4 accent-[#FF605C] bg-white/10 cursor-pointer"
						/>
						<span class="text-white font-sans text-xs">
							{params[ctrl.key] ? 'Enabled' : 'Disabled'}
						</span>
					</label>
				{:else if ctrl.type === 'text'}
					<input
						type="text"
						placeholder={ctrl.placeholder ?? ''}
						maxlength={ctrl.maxLength ?? 100}
						bind:value={params[ctrl.key]}
						class="w-full bg-white/5 border border-white/10 px-2.5 py-1.5 text-white font-sans text-xs focus:outline-none focus:border-[#FF605C]"
					/>
				{:else if ctrl.type === 'image'}
					<div class="space-y-2">
						<input
							type="file"
							bind:this={fileInputRef}
							accept={ctrl.accept ?? 'image/*'}
							onchange={handleFileSelect}
							class="hidden"
							id="custom-file-upload"
						/>
						{#if userImageName}
							<div
								class="flex items-center justify-between bg-white/5 border border-white/10 px-2.5 py-1.5"
							>
								<span class="truncate text-[11px] text-white max-w-[190px] font-sans">
									{userImageName}
								</span>
								<button
									type="button"
									onclick={clearFile}
									class="border-0 font-sans text-[#FF605C] hover:text-[#e04f4b] ml-2 text-xs cursor-pointer"
									title="Remove image"
								>
									✕
								</button>
							</div>
						{:else}
							<label
								for="custom-file-upload"
								class="block text-center border border-dashed border-white/15 hover:border-[#FF605C] p-3 text-[11px] text-white cursor-pointer transition-colors bg-white/5 hover:bg-white/10"
							>
								<span class="font-sans font-medium uppercase">CHOOSE LOCAL MEDIA</span>
								<div class="text-[9px] text-white/70 mt-0.5 font-sans">
									Max 5MB • Processed 100% client-side
								</div>
							</label>
							{#if uploadError}
								<div class="text-[10px] text-[#FF605C] font-sans px-1">
									{uploadError}
								</div>
							{/if}

							<div class="space-y-1.5 pt-1">
								<div class="flex items-center gap-1.5">
									<input
										type="url"
										placeholder="or paste image/gif/video URL"
										bind:value={mediaUrlInput}
										onkeydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												submitUrlInput();
											}
										}}
										class="flex-1 min-w-0 bg-white/5 border border-white/10 px-2.5 py-1 text-white font-sans text-[11px] focus:outline-none focus:border-[#FF605C]"
									/>
									<button
										type="button"
										onclick={submitUrlInput}
										disabled={!mediaUrlInput.trim() || isLoadingUrl}
										class="shrink-0 px-2.5 py-1 bg-white/10 hover:bg-[#FF605C] disabled:opacity-30 text-white font-sans text-[10px] font-semibold uppercase tracking-wider border-0 cursor-pointer transition-colors"
									>
										{isLoadingUrl ? '...' : 'LOAD'}
									</button>
								</div>
								{#if urlError}
									<div class="text-[10px] text-[#FF605C] font-sans">
										{urlError}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Drawer Footer Actions: Same background, no separating line -->
	<div class="p-4 bg-transparent border-0 space-y-2 shrink-0">
		<div class="grid grid-cols-2 gap-2">
			<button
				type="button"
				onclick={resetDefaults}
				class="w-full py-2.5 px-2 text-center border-0 bg-white/10 hover:bg-white/15 text-white font-sans font-medium uppercase tracking-wider transition-colors text-[11px] cursor-pointer"
			>
				RESET
			</button>
			<button
				type="button"
				onclick={onopenShare}
				class="w-full py-2.5 px-2 text-center border-0 bg-[#FF605C] hover:bg-[#e04f4b] text-white font-sans font-semibold uppercase tracking-wider transition-colors text-[11px] cursor-pointer"
			>
				SHARE
			</button>
		</div>

		{#if preset.generatePython}
			<button
				type="button"
				onclick={downloadPythonScript}
				class="w-full py-2.5 px-2 flex items-center justify-center gap-1.5 border-0 bg-white/10 hover:bg-white/15 hover:text-[#FF605C] text-white font-sans font-medium uppercase tracking-wider transition-colors text-[11px] cursor-pointer"
			>
				<span>↓</span>
				<span>EXPORT .PY</span>
			</button>
		{/if}
	</div>
</aside>
