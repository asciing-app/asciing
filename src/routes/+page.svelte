<script lang="ts">
	import { PRESETS } from '#lib/presets/registry.js';
	import CodeDecoder from '#lib/components/CodeDecoder.svelte';
	import PresetThumbnail from '#lib/components/PresetThumbnail.svelte';
	import TerminalSim from '#lib/components/TerminalSim.svelte';
</script>

<svelte:head>
	<title>asciing.app — Generative ASCII Art Gallery & Studio</title>
</svelte:head>

<div class="flex-1 w-full px-6 sm:px-10 pt-10 sm:pt-14 pb-12 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
	<!-- Left Side: Takes left half of the page -->
	<section class="w-full flex flex-col justify-start">
		<div>
			<h1 class="text-3xl sm:text-5xl font-light tracking-tight text-white font-sans lowercase">
				asciing
			</h1>
			<p class="mt-6 sm:mt-8 text-sm sm:text-base text-white font-sans leading-relaxed font-light max-w-xl">
				Creative-coding studio. Customize generative visuals, export standalone Python scripts, or share via compressed URL hashes.
			</p>
		</div>

		<!-- Code Decoder Input -->
		<div class="mt-6 sm:mt-8 w-full max-w-xl">
			<div class="text-xs uppercase tracking-wider text-white mb-3 font-sans font-medium">Instant Preset Loader</div>
			<CodeDecoder />
		</div>

		<!-- Terminal Simulation -->
		<div class="mt-6 sm:mt-8 w-full max-w-xl">
			<TerminalSim />
		</div>
	</section>

	<!-- Right Side: Takes right half of the page dynamically -->
	<section class="w-full flex flex-col gap-5">
		{#each PRESETS as preset, idx (preset.slug)}
			<a
				href={`/studio/${preset.slug}`}
				class="w-full flex items-stretch justify-between min-h-[140px] sm:min-h-[155px] bg-white/[0.015] hover:bg-white/[0.05] transition-all duration-200 group cursor-pointer overflow-hidden backdrop-blur-md"
			>
				<!-- Left Side: Title, Description & Bottom-Left Try Text -->
				<div class="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-3 min-w-0">
					<div class="space-y-1.5 pr-2">
						<div class="flex items-center gap-2">
							<span class="text-xs font-mono text-white font-bold">
								0{idx + 1}
							</span>
							<h2 class="text-base font-bold text-white uppercase tracking-wide truncate">
								{preset.title}
							</h2>
						</div>

						<p class="text-xs sm:text-sm text-white leading-relaxed font-sans font-light line-clamp-3">
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
				<div class="w-36 sm:w-48 lg:w-44 xl:w-56 shrink-0 self-stretch relative overflow-hidden bg-black/10">
					<PresetThumbnail {preset} />
				</div>
			</a>
		{/each}
	</section>
</div>
