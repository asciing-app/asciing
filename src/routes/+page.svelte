<script lang="ts">
	import { PRESETS } from '#lib/presets/registry.js';
	import CodeDecoder from '#lib/components/CodeDecoder.svelte';
	import PresetThumbnail from '#lib/components/PresetThumbnail.svelte';
	import TerminalSim from '#lib/components/TerminalSim.svelte';
</script>

<svelte:head>
	<title>asciing.app — Generative ASCII Art Gallery & Studio</title>
</svelte:head>

<div
	class="w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-[4vw] lg:py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-12 items-start"
>
	<!-- Left Column: Text + Code Decoder + Terminal Simulator -->
	<section class="w-full flex flex-col gap-6 min-w-0">
		<div>
			<h1
				class="text-[clamp(2.5rem,4vw,4.5rem)] font-light tracking-tight text-white font-sans lowercase leading-none"
			>
				asciing
			</h1>
			<p
				class="mt-4 sm:mt-6 text-sm sm:text-base text-white/90 font-sans leading-relaxed font-light max-w-prose"
			>
				Creative-coding studio. Customize generative visuals, export standalone Python scripts, or share via compressed URL hashes.
			</p>
		</div>

		<!-- Code Decoder Input -->
		<div class="w-full min-w-0">
			<div class="text-xs uppercase tracking-wider text-white mb-2.5 font-sans font-medium">
				Instant Preset Loader
			</div>
			<CodeDecoder />
		</div>

		<!-- Terminal Simulation -->
		<div class="w-full min-w-0">
			<TerminalSim />
		</div>
	</section>

	<!-- Right Column: 3 Preset Cards -->
	<section
		class="w-full min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-5 lg:gap-6"
	>
		{#each PRESETS as preset, idx (preset.slug)}
			<a
				href={`/studio/${preset.slug}`}
				class="w-full flex items-stretch justify-between min-h-[125px] sm:min-h-[140px] sm:last:col-span-2 lg:last:col-span-1 bg-white/[0.015] hover:bg-white/[0.05] transition-all duration-200 group cursor-pointer overflow-hidden backdrop-blur-md"
			>
				<!-- Left Side: Title, Description & Bottom-Left Try Text -->
				<div class="flex-1 p-4 sm:p-5 lg:p-6 flex flex-col justify-between space-y-3 min-w-0">
					<div class="space-y-1.5 pr-2">
						<div class="flex items-center gap-2">
							<span class="text-xs font-mono text-white font-bold">
								0{idx + 1}
							</span>
							<h2 class="text-base font-bold text-white uppercase tracking-wide truncate">
								{preset.title}
							</h2>
						</div>

						<p class="text-xs sm:text-sm text-white/80 leading-relaxed font-sans font-light line-clamp-3">
							{preset.description}
						</p>
					</div>

					<div class="pt-1">
						<span class="font-mono text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1">
							try →
						</span>
					</div>
				</div>

				<!-- Right Side: Picture taking up to the edges of the card from its side -->
				<div
					class="w-28 sm:w-44 md:w-48 lg:w-40 xl:w-52 shrink-0 self-stretch relative overflow-hidden bg-black/10"
				>
					<PresetThumbnail {preset} />
				</div>
			</a>
		{/each}
	</section>
</div>
