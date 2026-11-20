<script lang="ts">
	import { PRESETS } from '#lib/presets/registry.js';
	import CodeDecoder from '#lib/components/CodeDecoder.svelte';
	import PresetThumbnail from '#lib/components/PresetThumbnail.svelte';
</script>

<svelte:head>
	<title>asciing.app — Generative ASCII Art Gallery & Studio</title>
</svelte:head>

<div class="flex-1 w-full px-6 sm:px-10 lg:pl-10 lg:pr-6 xl:pr-8 pt-10 sm:pt-14 pb-12 flex flex-col lg:flex-row items-start justify-between gap-10 lg:gap-14">
	<!-- Left Side: Hero Section & Code Decoder -->
	<section class="flex-1 w-full max-w-xl flex flex-col justify-start">
		<div>
			<h1 class="text-3xl sm:text-5xl font-light tracking-tight text-white font-sans lowercase">
				asciing
			</h1>
			<p class="mt-6 sm:mt-8 text-sm sm:text-base text-white font-sans leading-relaxed font-light max-w-lg">
				Zero-backend creative-coding studio. Customize generative visuals, export standalone Python scripts, or share via compressed URL hashes.
			</p>
		</div>

		<!-- Code Decoder Input -->
		<div class="mt-12 sm:mt-16 w-full">
			<div class="text-xs uppercase tracking-wider text-white mb-3 font-mono">Instant Preset Loader</div>
			<CodeDecoder />
		</div>
	</section>

	<!-- Right Side: 3 Cards Sitting at the Right Side -->
	<section class="w-full lg:w-[480px] xl:w-[540px] shrink-0 flex flex-col gap-5 lg:ml-auto">
		{#each PRESETS as preset, idx (preset.slug)}
			<a
				href={`/studio/${preset.slug}`}
				class="flex items-stretch justify-between min-h-[140px] sm:min-h-[155px] bg-[#000000]/20 hover:bg-white/5 transition-all duration-200 group cursor-pointer overflow-hidden backdrop-blur-md"
			>
				<!-- Left Side: Title, Description & Bottom-Left Try Text -->
				<div class="flex-1 p-5 sm:p-6 flex flex-col justify-between space-y-3">
					<div class="space-y-1.5 pr-2">
						<div class="flex items-center gap-2">
							<span class="text-xs font-mono text-white font-bold">
								0{idx + 1}
							</span>
							<h2 class="text-base font-bold text-white uppercase tracking-wide">
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
				<div class="w-36 sm:w-48 shrink-0 self-stretch relative overflow-hidden bg-black/10">
					<PresetThumbnail {preset} />
				</div>
			</a>
		{/each}
	</section>
</div>
