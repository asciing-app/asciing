<script lang="ts">
	import CanvasViewport from '#lib/components/CanvasViewport.svelte';
	import { decodePresetStateAsync, getDefaultParams, hydrateAssetsFromPayload } from '#lib/engine/codec.js';
	import { getPresetBySlug, PRESETS } from '#lib/presets/registry.js';
	import type { PresetDefinition, PresetParams, RuntimeAssets } from '#lib/types/preset.js';

	let currentPreset = $state<PresetDefinition | null>(null);
	let currentParams = $state<PresetParams>({});
	let currentAssets = $state<RuntimeAssets>({});
	let currentHash = $state('');
	let errorNotice = $state<string | null>(null);
	let isLoading = $state(false);

	let studioLink = $derived.by(() => {
		if (!currentPreset) return '/';
		return `/studio/${currentPreset.slug}${currentHash}`;
	});

	async function loadMediaUrlIntoAssets(url: string) {
		isLoading = true;
		const isGif = url.toLowerCase().includes('.gif');
		const isVideo = url.toLowerCase().match(/\.(mp4|webm|ogg|mov)(\?|$)/i);

		if (isGif) {
			try {
				let res: Response;
				try {
					res = await fetch(url);
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
				} catch {
					const clean = url.replace(/^https?:\/\//i, '');
					res = await fetch(`https://images.weserv.nl/?url=${encodeURIComponent(clean)}&output=gif`);
				}
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const blob = await res.blob();
				const file = new File([blob], 'online.gif', { type: 'image/gif' });
				const { decodeGif } = await import('#lib/ascii-studio/decoders.js');
				const decoded = await decodeGif(file);
				currentAssets = { gifFrames: decoded.frames };
			} catch (err) {
				console.error('Failed to load GIF from URL:', err);
			} finally {
				isLoading = false;
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
				currentAssets = { video };
				isLoading = false;
				video.play().catch(() => {});
			};
			video.onerror = () => {
				isLoading = false;
			};
			return;
		}

		const tryLoad = (srcUrl: string, isFallback: boolean) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				const offscreen = document.createElement('canvas');
				offscreen.width = img.naturalWidth || img.width;
				offscreen.height = img.naturalHeight || img.height;
				const ctx = offscreen.getContext('2d');
				if (ctx) {
					try {
						ctx.drawImage(img, 0, 0);
						ctx.getImageData(0, 0, 1, 1);
						currentAssets = { image: offscreen };
						isLoading = false;
					} catch {
						if (!isFallback) {
							const clean = url.replace(/^https?:\/\//i, '');
							tryLoad(`https://images.weserv.nl/?url=${encodeURIComponent(clean)}`, true);
						} else {
							isLoading = false;
						}
					}
				} else {
					isLoading = false;
				}
			};
			img.onerror = () => {
				if (!isFallback) {
					const clean = url.replace(/^https?:\/\//i, '');
					tryLoad(`https://images.weserv.nl/?url=${encodeURIComponent(clean)}`, true);
				} else {
					isLoading = false;
				}
			};
			img.src = srcUrl;
		};

		tryLoad(url, false);
	}

	async function parseHash() {
		errorNotice = null;
		if (typeof window === 'undefined') return;

		const hash = window.location.hash;
		currentHash = hash;

		if (!hash || hash.length <= 1) {
			// Fallback to first preset with defaults
			const fallback = PRESETS[0];
			currentPreset = fallback;
			currentParams = getDefaultParams(fallback.controls);
			currentAssets = {};
			return;
		}

		const controlsMap = Object.fromEntries(PRESETS.map((p) => [p.slug, p.controls]));
		const decoded = await decodePresetStateAsync(hash, controlsMap);
		if (!decoded) {
			errorNotice = 'Unable to decode visualizer state hash.';
			currentPreset = PRESETS[0];
			currentParams = getDefaultParams(PRESETS[0].controls);
			currentAssets = {};
			return;
		}

		const found = getPresetBySlug(decoded.slug);
		if (!found) {
			errorNotice = `Preset "${decoded.slug}" not found in gallery.`;
			currentPreset = PRESETS[0];
			currentParams = getDefaultParams(PRESETS[0].controls);
			currentAssets = {};
			return;
		}

		currentPreset = found;
		const defaults = getDefaultParams(found.controls);
		currentParams = { ...defaults, ...decoded.params };

		if (decoded.assetPayload) {
			try {
				const hydrated = await hydrateAssetsFromPayload(decoded.assetPayload);
				currentAssets = hydrated;
			} catch (err) {
				console.error('Failed to hydrate asset from hash:', err);
			}
		} else if (decoded.params.mediaUrl && typeof decoded.params.mediaUrl === 'string') {
			loadMediaUrlIntoAssets(decoded.params.mediaUrl);
		} else {
			currentAssets = {};
		}
	}

	$effect(() => {
		parseHash();

		function onHashChange() {
			parseHash();
		}
		window.addEventListener('hashchange', onHashChange);
		return () => {
			window.removeEventListener('hashchange', onHashChange);
		};
	});
</script>

<svelte:head>
	<title>{currentPreset ? `${currentPreset.title} — asciing.app` : 'asciing.app Viewer'}</title>
</svelte:head>

<div class="fixed inset-0 w-full h-[100dvh] bg-transparent overflow-hidden select-none">
	{#if currentPreset}
		<CanvasViewport preset={currentPreset} params={currentParams} assets={currentAssets} showHUD={true} />

		{#if isLoading}
			<div class="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-1.5 bg-black/80 backdrop-blur-md border border-white/10 text-white text-xs font-sans font-medium tracking-wider shadow-2xl">
				<div class="w-3.5 h-3.5 border-2 border-white/20 border-t-[#FF605C] rounded-full animate-spin"></div>
				<span>LOADING MEDIA...</span>
			</div>
		{/if}

		<!-- Subtle auto-fading corner studio link pill -->
		<div class="absolute top-4 right-4 z-30 flex items-center gap-2">
			<a
				href={studioLink}
				class="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border-0 text-xs font-sans font-medium uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
			>
				<span>EDIT IN STUDIO</span>
				<span class="text-[#FF605C]">↗</span>
			</a>
		</div>

		{#if errorNotice}
			<div class="absolute top-4 left-4 z-30 px-3 py-1.5 bg-red-950/80 backdrop-blur-md border-0 text-white text-xs font-sans">
				{errorNotice}
			</div>
		{/if}
	{/if}
</div>
