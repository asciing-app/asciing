<script lang="ts">
	import type { PresetDefinition } from '../types/preset.js';
	import { getDefaultParams } from '../engine/codec.js';

	interface Props {
		preset: PresetDefinition;
	}

	let { preset }: Props = $props();

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let containerEl: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (!canvasEl || !containerEl || !preset) return;
		const defaults = getDefaultParams(preset.controls);

		const cleanup = preset.mountWeb({
			canvas: canvasEl,
			container: containerEl,
			getParams: () => defaults,
			getAssets: () => ({})
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
	class="w-full h-full bg-transparent relative overflow-hidden pointer-events-none select-none"
>
	<canvas bind:this={canvasEl} class="block w-full h-full opacity-90"></canvas>
</div>
