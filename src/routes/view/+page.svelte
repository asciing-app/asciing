<script lang="ts">
	import CanvasViewport from '#lib/components/CanvasViewport.svelte';
	import { decodePresetState, getDefaultParams } from '#lib/engine/codec.js';
	import { getPresetBySlug, PRESETS } from '#lib/presets/registry.js';
	import type { PresetDefinition, PresetParams } from '#lib/types/preset.js';

	let currentPreset = $state<PresetDefinition | null>(null);
	let currentParams = $state<PresetParams>({});
	let currentHash = $state('');
	let errorNotice = $state<string | null>(null);

	let studioLink = $derived.by(() => {
		if (!currentPreset) return '/';
		return `/studio/${currentPreset.slug}${currentHash}`;
	});

	function parseHash() {
		errorNotice = null;
		if (typeof window === 'undefined') return;

		const hash = window.location.hash;
		currentHash = hash;

		if (!hash || !hash.includes('v=')) {
			// Fallback to first preset with defaults
			const fallback = PRESETS[0];
			currentPreset = fallback;
			currentParams = getDefaultParams(fallback.controls);
			return;
		}

		const decoded = decodePresetState(hash);
		if (!decoded) {
			errorNotice = 'Unable to decode visualizer state hash.';
			currentPreset = PRESETS[0];
			currentParams = getDefaultParams(PRESETS[0].controls);
			return;
		}

		const found = getPresetBySlug(decoded.slug);
		if (!found) {
			errorNotice = `Preset "${decoded.slug}" not found in gallery.`;
			currentPreset = PRESETS[0];
			currentParams = getDefaultParams(PRESETS[0].controls);
			return;
		}

		currentPreset = found;
		const defaults = getDefaultParams(found.controls);
		currentParams = { ...defaults, ...decoded.params };
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

<div class="fixed inset-0 w-screen h-screen bg-[#000000] overflow-hidden select-none">
	{#if currentPreset}
		<CanvasViewport preset={currentPreset} params={currentParams} showHUD={true} />

		<!-- Subtle auto-fading corner studio link pill -->
		<div class="absolute top-4 right-4 z-30 flex items-center gap-2">
			<a
				href={studioLink}
				class="flex items-center gap-1.5 px-3 py-1.5 bg-[#000000] hover:bg-[#121212] text-white border border-[#27272a] hover:border-[#FF605C] text-xs font-mono transition-colors"
			>
				<span>EDIT IN STUDIO</span>
				<span class="text-[#FF605C]">↗</span>
			</a>
		</div>

		{#if errorNotice}
			<div class="absolute top-4 left-4 z-30 px-3 py-1.5 bg-[#000000] border border-[#FF605C] text-white text-xs font-mono">
				{errorNotice}
			</div>
		{/if}
	{/if}
</div>
