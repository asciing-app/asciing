<script lang="ts">
	import type { PageProps } from './$types.js';
	import CanvasViewport from '#lib/components/CanvasViewport.svelte';
	import ControlDrawer from '#lib/components/ControlDrawer.svelte';
	import ShareModal from '#lib/components/ShareModal.svelte';
	import { decodePresetState, getDefaultParams } from '#lib/engine/codec.js';
	import type { PresetParams, RuntimeAssets } from '#lib/types/preset.js';

	let { data }: PageProps = $props();

	let preset = $derived(data.preset);

	let params = $state<PresetParams>({});
	let assets = $state<RuntimeAssets>({});
	let isShareOpen = $state(false);

	function loadStateFromHash() {
		const defaults = getDefaultParams(preset.controls);
		if (typeof window === 'undefined') {
			params = defaults;
			return;
		}

		const hash = window.location.hash;
		if (hash && hash.includes('v=')) {
			const decoded = decodePresetState(hash);
			if (decoded && decoded.slug === preset.slug) {
				params = { ...defaults, ...decoded.params };
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

<div class="flex-1 flex flex-row w-full h-[calc(100vh-48px)] overflow-hidden bg-[#09090b] relative">
	<!-- Canvas Viewport Area -->
	<div class="flex-1 h-full min-w-0 relative">
		<CanvasViewport {preset} {params} {assets} />
	</div>

	<!-- Collapsible Controls Drawer -->
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
		open={isShareOpen}
		onclose={() => (isShareOpen = false)}
	/>
</div>
