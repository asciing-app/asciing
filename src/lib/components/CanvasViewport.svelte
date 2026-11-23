<script lang="ts">
	import type { PresetDefinition, PresetParams, RuntimeAssets } from '../types/preset.js';

	interface Props {
		preset: PresetDefinition;
		params: PresetParams;
		assets?: RuntimeAssets;
		showHUD?: boolean;
	}

	let { preset, params, assets = {}, showHUD = true }: Props = $props();

	let containerEl: HTMLDivElement | null = $state(null);
	let canvasEl: HTMLCanvasElement | null = $state(null);
	let isFullscreen = $state(false);
	let hudVisible = $state(true);
	let isPaused = $state(false);

	let hudTimeout: ReturnType<typeof setTimeout> | null = null;

	function showHUDTemporarily() {
		hudVisible = true;
		if (hudTimeout) clearTimeout(hudTimeout);
		if (isFullscreen) {
			hudTimeout = setTimeout(() => {
				hudVisible = false;
			}, 2500);
		}
	}

	function handleInteraction() {
		showHUDTemporarily();
	}

	async function toggleFullscreen() {
		if (!containerEl) return;
		try {
			if (!document.fullscreenElement) {
				await containerEl.requestFullscreen();
				isFullscreen = true;
				showHUDTemporarily();
			} else {
				await document.exitFullscreen();
				isFullscreen = false;
				hudVisible = true;
			}
		} catch (err) {
			console.error('Fullscreen toggle failed:', err);
		}
	}

	$effect(() => {
		function onFullscreenChange() {
			isFullscreen = !!document.fullscreenElement;
			if (!isFullscreen) hudVisible = true;
		}
		document.addEventListener('fullscreenchange', onFullscreenChange);
		return () => {
			document.removeEventListener('fullscreenchange', onFullscreenChange);
		};
	});

	// Mount canvas lifecycle
	$effect(() => {
		if (!canvasEl || !containerEl || !preset) return;

		// Mount the web renderer with access to reactive getters
		const cleanup = preset.mountWeb({
			canvas: canvasEl,
			container: containerEl,
			getParams: () => params,
			getAssets: () => assets
		});

		return () => {
			if (typeof cleanup === 'function') {
				cleanup();
			}
		};
	});
</script>

<div
	bind:this={containerEl}
	role="region"
	aria-label="Interactive Canvas Viewport"
	class="relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent select-none touch-none"
	onmousemove={handleInteraction}
	ontouchstart={handleInteraction}
>
	<canvas bind:this={canvasEl} class="block w-full h-full"></canvas>

	{#if showHUD}
		<div
			class="absolute bottom-4 left-4 z-20 flex items-center gap-2 transition-opacity duration-300 pointer-events-auto"
			class:opacity-0={!hudVisible}
			class:pointer-events-none={!hudVisible}
		>
			<button
				type="button"
				onclick={toggleFullscreen}
				aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
				title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
				class="flex items-center gap-2 px-3 py-1.5 text-xs font-sans font-medium uppercase tracking-wider bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border-0 transition-colors shadow-lg cursor-pointer"
			>
				<span>{isFullscreen ? 'WINDOWED' : 'FULLSCREEN'}</span>
			</button>
		</div>
	{/if}
</div>
