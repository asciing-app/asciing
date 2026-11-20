<script lang="ts">
	import { encodePresetState } from '../engine/codec.js';
	import type { PresetDefinition, PresetParams } from '../types/preset.js';

	interface Props {
		preset: PresetDefinition;
		params: PresetParams;
		open: boolean;
		onclose: () => void;
	}

	let { preset, params, open, onclose }: Props = $props();

	let copiedUrl = $state(false);
	let copiedCode = $state(false);

	let encodedHash = $derived(encodePresetState(preset.slug, preset.version, params));

	let shareUrl = $derived.by(() => {
		if (typeof window !== 'undefined') {
			return `${window.location.origin}/view#v=${encodedHash}`;
		}
		return `/view#v=${encodedHash}`;
	});

	let shareCode = $derived(`#v=${encodedHash}`);

	async function copyToClipboard(text: string, type: 'url' | 'code') {
		try {
			await navigator.clipboard.writeText(text);
			if (type === 'url') {
				copiedUrl = true;
				setTimeout(() => (copiedUrl = false), 2000);
			} else {
				copiedCode = true;
				setTimeout(() => (copiedCode = false), 2000);
			}
		} catch (err) {
			console.error('Clipboard copy failed:', err);
		}
	}

	function downloadPythonScript() {
		if (!preset.generatePython) return;
		const script = preset.generatePython(params);
		const blob = new Blob([script], { type: 'text/x-python;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${preset.slug}.py`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

{#if open}
	<div
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
	>
		<!-- Click outside backdrop to close -->
		<button
			type="button"
			class="absolute inset-0 w-full h-full cursor-default bg-transparent"
			onclick={onclose}
			aria-label="Close modal overlay"
		></button>

		<div
			class="relative z-10 w-full max-w-lg bg-[#09090b] border border-[#27272a] rounded-lg p-6 shadow-2xl space-y-6 font-mono text-sm text-[#fafafa]"
		>
			<div class="flex items-center justify-between border-b border-[#27272a] pb-4">
				<div class="space-y-0.5">
					<h2 class="text-base font-semibold tracking-wide uppercase text-[#fafafa]">
						Share & Export
					</h2>
					<p class="text-xs text-[#a1a1aa] font-sans">
						Stateless link and standalone Python 3 terminal script.
					</p>
				</div>
				<button
					type="button"
					onclick={onclose}
					class="p-1 text-[#71717a] hover:text-[#fafafa] transition-colors"
					aria-label="Close modal"
				>
					✕
				</button>
			</div>

			<!-- Live View URL -->
			<div class="space-y-2">
				<label for="share-url-input" class="text-xs uppercase tracking-wider text-[#a1a1aa]">Shareable URL</label>
				<div class="flex items-center gap-2">
					<input
						id="share-url-input"
						type="text"
						readonly
						value={shareUrl}
						class="w-full bg-[#121215] border border-[#27272a] rounded px-3 py-2 text-xs text-[#fafafa] font-mono selection:bg-[#38bdf8] selection:text-black focus:outline-none focus:border-[#38bdf8]"
					/>
					<button
						type="button"
						onclick={() => copyToClipboard(shareUrl, 'url')}
						class="shrink-0 px-3 py-2 text-xs font-mono font-medium rounded bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] transition-colors"
					>
						{copiedUrl ? 'COPIED!' : 'COPY URL'}
					</button>
				</div>
			</div>

			<!-- Compact Share Code -->
			<div class="space-y-2">
				<label for="share-code-input" class="text-xs uppercase tracking-wider text-[#a1a1aa]">Compact Hash Code</label>
				<div class="flex items-center gap-2">
					<input
						id="share-code-input"
						type="text"
						readonly
						value={shareCode}
						class="w-full bg-[#121215] border border-[#27272a] rounded px-3 py-2 text-xs text-[#71717a] font-mono truncate focus:outline-none"
					/>
					<button
						type="button"
						onclick={() => copyToClipboard(shareCode, 'code')}
						class="shrink-0 px-3 py-2 text-xs font-mono font-medium rounded bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] transition-colors"
					>
						{copiedCode ? 'COPIED!' : 'COPY CODE'}
					</button>
				</div>
			</div>

			<!-- Python Export Section -->
			{#if preset.generatePython}
				<div class="pt-2 border-t border-[#27272a]">
					<div class="flex items-center justify-between">
						<div>
							<div class="text-xs font-semibold text-[#fafafa]">Zero-Dependency Python 3</div>
							<div class="text-[11px] text-[#71717a] font-sans">
								Runs natively in Windows Terminal, cmd.exe, macOS, and Linux.
							</div>
						</div>
						<button
							type="button"
							onclick={downloadPythonScript}
							class="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium rounded bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] border border-[#10b981]/40 transition-colors"
						>
							<span>↓</span>
							<span>DOWNLOAD .PY</span>
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
