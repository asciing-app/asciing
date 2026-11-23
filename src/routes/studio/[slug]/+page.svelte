<script lang="ts">
	import type { PageProps } from './$types.js';
	import CanvasViewport from '#lib/components/CanvasViewport.svelte';
	import ControlDrawer from '#lib/components/ControlDrawer.svelte';
	import ShareModal from '#lib/components/ShareModal.svelte';
	import { decodePresetStateAsync, getDefaultParams, hydrateAssetsFromPayload } from '#lib/engine/codec.js';
	import type { PresetParams, RuntimeAssets } from '#lib/types/preset.js';

	let { data }: PageProps = $props();

	let preset = $derived(data.preset);

	let params = $state<PresetParams>({});
	let assets = $state<RuntimeAssets>({});
	let isShareOpen = $state(false);

	async function loadStateFromHash() {
		const defaults = getDefaultParams(preset.controls);
		if (typeof window === 'undefined') {
			params = defaults;
			return;
		}

		const hash = window.location.hash;
		if (hash && hash.length > 1) {
			const decoded = await decodePresetStateAsync(hash, { [preset.slug]: preset.controls });
			if (decoded && decoded.slug === preset.slug) {
				params = { ...defaults, ...decoded.params };
				if (decoded.assetPayload) {
					try {
						const hydrated = await hydrateAssetsFromPayload(decoded.assetPayload);
						assets = { ...assets, ...hydrated };
					} catch (err) {
						console.error('Failed to hydrate assets from hash:', err);
					}
				}
				return;
			}
		}

		params = defaults;
	}

	$effect(() => {
		// Re-initialize state whenever preset changes
		loadStateFromHash();

		function onHashChange() {
			loadStateFromHash();
		}
		window.addEventListener('hashchange', onHashChange);
		return () => {
			window.removeEventListener('hashchange', onHashChange);
		};
	});
</script>

<svelte:head>
	<title>{preset.title} — asciing.app Studio</title>
</svelte:head>

<div class="fixed inset-0 w-full h-full overflow-hidden bg-transparent select-none z-10">
	<!-- Return to Gallery Pill -->
	<a
		href="/"
		class="fixed top-4 left-4 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border-0 text-xs font-sans font-medium uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
		title="Return to Gallery"
	>
		<span>←</span>
		<span>Gallery</span>
	</a>

	<!-- Canvas Viewport: Fullscreen (100% of screen) -->
	<div class="absolute inset-0 w-full h-full">
		<CanvasViewport {preset} {params} {assets} />
	</div>

	<!-- Collapsible Controls Drawer: Overlaid above the canvas -->
	<ControlDrawer
		{preset}
		bind:params
		bind:assets
		onopenShare={() => (isShareOpen = true)}
	/>

	<!-- Share & Export Modal -->
	<ShareModal
		{preset}
		{params}
		{assets}
		open={isShareOpen}
		onclose={() => (isShareOpen = false)}
	/>
</div>
