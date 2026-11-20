<script lang="ts">
	import { getDefaultParams } from '../engine/codec.js';
	import type { PresetDefinition, PresetParams, RuntimeAssets } from '../types/preset.js';

	interface Props {
		preset: PresetDefinition;
		params: PresetParams;
		assets: RuntimeAssets;
		onopenShare: () => void;
	}

	let { preset, params = $bindable(), assets = $bindable(), onopenShare }: Props = $props();

	let collapsed = $state(false);
	let fileInputRef: HTMLInputElement | null = $state(null);
	let userImageName = $state<string | null>(null);

	function resetDefaults() {
		const defaults = getDefaultParams(preset.controls);
		for (const [key, val] of Object.entries(defaults)) {
			params[key] = val;
		}
		// Reset uploaded image asset
		delete assets['image'];
		userImageName = null;
		if (fileInputRef) fileInputRef.value = '';
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		userImageName = file.name;
		const reader = new FileReader();
		reader.onload = (loadEvent) => {
			const dataUrl = loadEvent.target?.result as string;
			if (!dataUrl) return;

			const img = new Image();
			img.onload = () => {
				const offscreen = document.createElement('canvas');
				offscreen.width = img.naturalWidth || img.width;
				offscreen.height = img.naturalHeight || img.height;
				const ctx = offscreen.getContext('2d');
				if (ctx) {
					ctx.drawImage(img, 0, 0);
					assets['image'] = offscreen;
				}
			};
			img.src = dataUrl;
		};
		reader.readAsDataURL(file);
	}

	function clearFile() {
		delete assets['image'];
		userImageName = null;
		if (fileInputRef) fileInputRef.value = '';
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

<aside
	class="relative z-30 flex flex-col h-full bg-[#09090b]/95 border-l border-[#27272a] backdrop-blur transition-all duration-300 font-mono text-xs select-none"
	style="width: {collapsed ? '48px' : '320px'};"
>
	<!-- Drawer Header -->
	<div class="flex items-center justify-between h-12 px-3 border-b border-[#27272a] shrink-0">
		{#if !collapsed}
			<div class="flex items-center gap-2 overflow-hidden">
				<span class="inline-block w-2 h-2 rounded-full bg-[#10b981]"></span>
				<span class="font-semibold text-[#fafafa] tracking-wider truncate uppercase">
					{preset.title}
				</span>
			</div>
		{/if}
		<button
			type="button"
			onclick={() => (collapsed = !collapsed)}
			class="p-1.5 rounded hover:bg-[#18181c] text-[#a1a1aa] hover:text-[#fafafa] transition-colors ml-auto"
			title={collapsed ? 'Expand Controls' : 'Collapse Drawer'}
			aria-label={collapsed ? 'Expand Controls' : 'Collapse Drawer'}
		>
			{collapsed ? '◀' : '▶'}
		</button>
	</div>

	{#if !collapsed}
		<!-- Controls Body -->
		<div class="flex-1 overflow-y-auto p-4 space-y-5">
			{#each preset.controls as ctrl (ctrl.key)}
				<div class="space-y-1.5">
					<div class="flex items-center justify-between text-[#a1a1aa]">
						<span class="font-medium tracking-wide uppercase text-[11px]">{ctrl.label}</span>
						{#if ctrl.type === 'slider'}
							<span class="text-[#fafafa] tabular-nums font-mono text-[11px]">
								{Number(params[ctrl.key] ?? ctrl.default).toFixed(ctrl.step && ctrl.step < 1 ? 1 : 0)}
							</span>
						{/if}
					</div>

					{#if ctrl.type === 'slider'}
						<input
							type="range"
							min={ctrl.min}
							max={ctrl.max}
							step={ctrl.step ?? 1}
							bind:value={params[ctrl.key]}
							class="w-full accent-[#38bdf8] bg-[#27272a] h-1.5 rounded-lg cursor-pointer"
						/>
					{:else if ctrl.type === 'color'}
						<div class="flex items-center gap-2">
							<input
								type="color"
								bind:value={params[ctrl.key]}
								class="w-7 h-7 rounded border border-[#27272a] bg-transparent cursor-pointer p-0"
							/>
							<input
								type="text"
								bind:value={params[ctrl.key]}
								class="flex-1 bg-[#121215] border border-[#27272a] rounded px-2 py-1 text-[#fafafa] font-mono text-[11px] uppercase focus:outline-none focus:border-[#38bdf8]"
							/>
						</div>
					{:else if ctrl.type === 'select'}
						<select
							bind:value={params[ctrl.key]}
							class="w-full bg-[#121215] border border-[#27272a] rounded px-2.5 py-1.5 text-[#fafafa] font-mono text-xs focus:outline-none focus:border-[#38bdf8] cursor-pointer"
						>
							{#each ctrl.options as opt (opt.value)}
								<option value={opt.value} class="bg-[#121215] text-[#fafafa]">{opt.label}</option>
							{/each}
						</select>
					{:else if ctrl.type === 'toggle'}
						<label class="flex items-center gap-2 cursor-pointer mt-1">
							<input
								type="checkbox"
								checked={Boolean(params[ctrl.key])}
								onchange={(e) => {
									params[ctrl.key] = (e.currentTarget as HTMLInputElement).checked;
								}}
								class="w-4 h-4 accent-[#38bdf8] rounded bg-[#27272a] cursor-pointer"
							/>
							<span class="text-[#fafafa] text-xs">
								{params[ctrl.key] ? 'Enabled' : 'Disabled'}
							</span>
						</label>
					{:else if ctrl.type === 'text'}
						<input
							type="text"
							placeholder={ctrl.placeholder ?? ''}
							maxlength={ctrl.maxLength ?? 100}
							bind:value={params[ctrl.key]}
							class="w-full bg-[#121215] border border-[#27272a] rounded px-2.5 py-1.5 text-[#fafafa] font-mono text-xs focus:outline-none focus:border-[#38bdf8]"
						/>
					{:else if ctrl.type === 'image'}
						<div class="space-y-2">
							<input
								type="file"
								bind:this={fileInputRef}
								accept={ctrl.accept ?? 'image/*'}
								onchange={handleFileSelect}
								class="hidden"
								id="custom-file-upload"
							/>
							{#if userImageName}
								<div
									class="flex items-center justify-between bg-[#121215] border border-[#27272a] rounded px-2.5 py-1.5"
								>
									<span class="truncate text-[11px] text-[#fafafa] max-w-[190px]">
										{userImageName}
									</span>
									<button
										type="button"
										onclick={clearFile}
										class="text-[#ef4444] hover:text-[#f87171] ml-2 text-xs"
										title="Remove image"
									>
										✕
									</button>
								</div>
							{:else}
								<label
									for="custom-file-upload"
									class="block text-center border border-dashed border-[#3f3f46] hover:border-[#71717a] rounded p-3 text-[11px] text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer transition-colors bg-[#121215]/50"
								>
									<span>CHOOSE LOCAL IMAGE</span>
									<div class="text-[9px] text-[#71717a] mt-0.5 font-sans">
										Processed 100% client-side
									</div>
								</label>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Drawer Footer Actions -->
		<div class="p-4 border-t border-[#27272a] space-y-2 shrink-0 bg-[#09090b]">
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={resetDefaults}
					class="w-full py-2 px-2 text-center rounded border border-[#27272a] hover:bg-[#18181c] text-[#a1a1aa] hover:text-[#fafafa] transition-colors text-[11px]"
				>
					RESET
				</button>
				<button
					type="button"
					onclick={onopenShare}
					class="w-full py-2 px-2 text-center rounded bg-[#38bdf8] hover:bg-[#0284c7] text-[#09090b] font-semibold transition-colors text-[11px]"
				>
					SHARE
				</button>
			</div>

			{#if preset.generatePython}
				<button
					type="button"
					onclick={downloadPythonScript}
					class="w-full py-2 px-2 flex items-center justify-center gap-1.5 rounded border border-[#10b981]/40 bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] transition-colors text-[11px]"
				>
					<span>↓</span>
					<span>EXPORT .PY</span>
				</button>
			{/if}
		</div>
	{/if}
</aside>
