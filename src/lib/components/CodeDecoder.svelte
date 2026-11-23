<script lang="ts">
	import { decodePresetState } from '../engine/codec.js';
	import { getPresetBySlug, PRESETS } from '../presets/registry.js';

	let inputCode = $state('');
	let errorMessage = $state<string | null>(null);

	const controlsMap = Object.fromEntries(PRESETS.map((p) => [p.slug, p.controls]));

	let decoded = $derived.by(() => {
		if (!inputCode.trim()) return null;
		return decodePresetState(inputCode, controlsMap);
	});

	let matchedPreset = $derived.by(() => {
		if (!decoded) return null;
		return getPresetBySlug(decoded.slug);
	});

	function handleOpen(mode: 'studio' | 'view') {
		errorMessage = null;
		if (!decoded) {
			errorMessage = 'Invalid or corrupted share code / URL';
			return;
		}

		if (!matchedPreset) {
			errorMessage = `Unknown preset slug: "${decoded.slug}"`;
			return;
		}

		let rawHash = inputCode.trim();
		const hashIdx = rawHash.indexOf('#');
		if (hashIdx !== -1) {
			rawHash = rawHash.slice(hashIdx);
		} else if (rawHash.startsWith('2.') || rawHash.startsWith('v=')) {
			rawHash = `#${rawHash}`;
		} else {
			rawHash = `#${rawHash}`;
		}

		if (mode === 'studio') {
			window.location.href = `/studio/${decoded.slug}${rawHash}`;
		} else {
			window.location.href = `/view${rawHash}`;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleOpen('studio');
		}
	}
</script>

<div class="w-full space-y-1.5 font-sans text-xs">
	<div class="relative flex items-center">
		<input
			type="text"
			placeholder="paste generated code"
			bind:value={inputCode}
			onkeydown={handleKeyDown}
			class="w-full bg-white/[0.02] hover:bg-white/[0.04] focus:bg-white/[0.04] backdrop-blur-md border border-white/[0.06] focus:border-[#FF605C]/60 pl-3 pr-28 sm:pr-32 py-2 text-white placeholder:text-white/30 placeholder:drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] font-sans text-xs transition-colors focus:outline-none"
		/>
		<div class="absolute right-1 sm:right-1.5 flex items-center gap-1 sm:gap-1.5">
			<button
				type="button"
				onclick={() => handleOpen('studio')}
				disabled={!inputCode.trim()}
				class="px-2.5 py-1 bg-white/[0.08] hover:bg-white/[0.14] hover:text-[#FF605C] border-0 disabled:opacity-0 disabled:pointer-events-none text-white font-sans text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer uppercase tracking-wider"
			>
				STUDIO
			</button>
			<button
				type="button"
				onclick={() => handleOpen('view')}
				disabled={!inputCode.trim()}
				class="px-2.5 py-1 bg-[#FF605C] hover:bg-[#e04f4b] border-0 disabled:opacity-0 disabled:pointer-events-none text-white font-sans text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer uppercase tracking-wider"
			>
				VIEW
			</button>
		</div>
	</div>

	{#if matchedPreset}
		<div class="flex items-center gap-1.5 text-[11px] text-white/90 px-1">
			<span class="text-[#FF605C]">✔</span>
			<span>Recognized preset: <strong>{matchedPreset.title}</strong></span>
		</div>
	{:else if inputCode.trim() && !decoded}
		<div class="text-[11px] text-[#FF605C] px-1">
			{errorMessage || 'Enter a valid compressed state hash'}
		</div>
	{/if}
</div>
