<script lang="ts">
	import { decodePresetState } from '../engine/codec.js';
	import { getPresetBySlug } from '../presets/registry.js';

	let inputCode = $state('');
	let errorMessage = $state<string | null>(null);

	let decoded = $derived.by(() => {
		if (!inputCode.trim()) return null;
		return decodePresetState(inputCode);
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
		} else if (rawHash.startsWith('v=')) {
			rawHash = `#${rawHash}`;
		} else {
			rawHash = `#v=${rawHash}`;
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

<div class="w-full space-y-2 font-sans text-xs">
	<div class="relative flex items-center">
		<span class="absolute left-3 text-white font-sans text-xs select-none">#v=</span>
		<input
			type="text"
			placeholder="Paste share code or /view#v= URL to load creation..."
			bind:value={inputCode}
			onkeydown={handleKeyDown}
			class="w-full bg-[#000000] border border-[#27272a] focus:border-[#FF605C] pl-9 sm:pl-10 pr-28 sm:pr-36 py-2.5 sm:py-3 text-white placeholder:text-white/40 font-sans text-xs transition-colors focus:outline-none"
		/>
		<div class="absolute right-1 sm:right-1.5 flex items-center gap-1 sm:gap-1.5">
			<button
				type="button"
				onclick={() => handleOpen('studio')}
				disabled={!inputCode.trim()}
				class="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-transparent border border-[#27272a] hover:border-[#FF605C] hover:text-[#FF605C] disabled:opacity-30 text-white font-sans text-[10px] sm:text-[11px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed uppercase"
			>
				STUDIO
			</button>
			<button
				type="button"
				onclick={() => handleOpen('view')}
				disabled={!inputCode.trim()}
				class="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#FF605C] hover:bg-[#e04f4b] disabled:opacity-30 text-white font-sans text-[10px] sm:text-[11px] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed uppercase"
			>
				VIEW
			</button>
		</div>
	</div>

	{#if matchedPreset}
		<div class="flex items-center gap-2 text-[11px] text-white px-1">
			<span class="text-[#FF605C]">✔</span>
			<span>Recognized preset: <strong>{matchedPreset.title}</strong></span>
		</div>
	{:else if inputCode.trim() && !decoded}
		<div class="text-[11px] text-[#FF605C] px-1">
			{errorMessage || 'Enter a valid compressed state hash'}
		</div>
	{/if}
</div>
