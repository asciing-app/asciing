<script lang="ts">
	import { PRESETS } from '#lib/presets/registry.js';
	import CodeDecoder from '#lib/components/CodeDecoder.svelte';
</script>

<svelte:head>
	<title>asciing.app — Generative ASCII Art Gallery & Studio</title>
</svelte:head>

<div class="flex-1 w-full max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-12">
	<!-- Hero Section -->
	<section class="text-center space-y-4 max-w-2xl mx-auto">
		<div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[#27272a] bg-[#121215] text-[11px] text-[#38bdf8] font-mono">
			<span class="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse"></span>
			<span>v1.0 • ZERO BACKEND • ZERO COOKIES</span>
		</div>
		<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#fafafa] font-mono">
			GENERATIVE ASCII STUDIO
		</h1>
		<p class="text-sm text-[#a1a1aa] font-sans leading-relaxed">
			Real-time creative-coding visualizers. Customize parameters, export standalone zero-dependency Python 3 terminal scripts, or share creations instantly via compressed URL hashes.
		</p>
	</section>

	<!-- Code Decoder Input -->
	<section class="pt-2">
		<CodeDecoder />
	</section>

	<!-- Preset Cards Grid -->
	<section class="space-y-6">
		<div class="flex items-center justify-between border-b border-[#27272a] pb-3">
			<div class="flex items-center gap-2 font-mono text-xs text-[#fafafa] font-semibold tracking-wider uppercase">
				<span>PRESETS CATALOG</span>
				<span class="text-[#71717a] font-normal">({PRESETS.length})</span>
			</div>
			<span class="text-[11px] text-[#71717a] font-mono">SELECT A PRESET TO LAUNCH</span>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each PRESETS as preset (preset.slug)}
				<div class="flex flex-col justify-between bg-[#121215] border border-[#27272a] hover:border-[#38bdf8]/50 rounded-lg p-5 transition-all duration-200 group">
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<span class="text-xs font-semibold text-[#fafafa] font-mono tracking-wide uppercase group-hover:text-[#38bdf8] transition-colors">
								{preset.title}
							</span>
							{#if preset.generatePython}
								<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
									PYTHON 3
								</span>
							{/if}
						</div>

						<p class="text-xs text-[#a1a1aa] font-sans leading-relaxed line-clamp-3">
							{preset.description}
						</p>

						<div class="flex flex-wrap gap-1.5 pt-1">
							{#each preset.tags as tag}
								<span class="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#18181c] text-[#71717a] border border-[#27272a]">
									{tag}
								</span>
							{/each}
						</div>
					</div>

					<div class="pt-6 mt-4 border-t border-[#27272a]/60 flex items-center justify-between">
						<span class="text-[11px] font-mono text-[#71717a]">
							{preset.controls.length} controls
						</span>
						<a
							href={`/studio/${preset.slug}`}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs font-medium bg-[#27272a] hover:bg-[#38bdf8] text-[#fafafa] hover:text-[#09090b] transition-colors"
						>
							<span>OPEN STUDIO</span>
							<span>→</span>
						</a>
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
