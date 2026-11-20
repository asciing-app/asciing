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
	class="relative z-30 flex flex-col h-full bg-[#000000] border-l border-[#27272a] transition-all duration-300 font-mono text-xs select-none"
	style="width: {collapsed ? '48px' : '320px'};"
>
	<!-- Drawer Header -->
	<div class="flex items-center justify-between h-12 px-3 border-b border-[#27272a] shrink-0">
		{#if !collapsed}
			<a href="/" class="flex items-center gap-2 overflow-hidden hover:text-[#FF605C] transition-colors group" title="Return to Gallery">
				<span class="inline-block w-2 h-2 bg-[#FF605C]"></span>
				<span class="font-bold text-white group-hover:text-[#FF605C] tracking-wider truncate uppercase">
					{preset.title}
				</span>
			</a>
		{/if}
		<button
			type="button"
			onclick={() => (collapsed = !collapsed)}
			class="p-1.5 hover:bg-[#121212] text-white hover:text-[#FF605C] transition-colors ml-auto cursor-pointer"
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
					<div class="flex items-center justify-between text-white">
						<span class="font-medium tracking-wide uppercase text-[11px]">{ctrl.label}</span>
						{#if ctrl.type === 'slider'}
							<span class="text-white tabular-nums font-mono text-[11px]">
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
							class="w-full accent-[#FF605C] bg-[#27272a] h-1.5 cursor-pointer"
						/>
					{:else if ctrl.type === 'color'}
						<div class="flex items-center gap-2">
							<input
								type="color"
								bind:value={params[ctrl.key]}
								class="w-7 h-7 border border-[#27272a] bg-transparent cursor-pointer p-0"
							/>
							<input
								type="text"
								bind:value={params[ctrl.key]}
								class="flex-1 bg-[#000000] border border-[#27272a] px-2 py-1 text-white font-mono text-[11px] uppercase focus:outline-none focus:border-[#FF605C]"
							/>
						</div>
					{:else if ctrl.type === 'select'}
						<select
							bind:value={params[ctrl.key]}
							class="w-full bg-[#000000] border border-[#27272a] px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-[#FF605C] cursor-pointer"
						>
							{#each ctrl.options as opt (opt.value)}
								<option value={opt.value} class="bg-[#000000] text-white">{opt.label}</option>
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
								class="w-4 h-4 accent-[#FF605C] bg-[#27272a] cursor-pointer"
							/>
							<span class="text-white text-xs">
								{params[ctrl.key] ? 'Enabled' : 'Disabled'}
							</span>
						</label>
					{:else if ctrl.type === 'text'}
						<input
							type="text"
							placeholder={ctrl.placeholder ?? ''}
							maxlength={ctrl.maxLength ?? 100}
							bind:value={params[ctrl.key]}
							class="w-full bg-[#000000] border border-[#27272a] px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-[#FF605C]"
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
									class="flex items-center justify-between bg-[#000000] border border-[#27272a] px-2.5 py-1.5"
								>
									<span class="truncate text-[11px] text-white max-w-[190px]">
										{userImageName}
									</span>
									<button
										type="button"
										onclick={clearFile}
										class="text-[#FF605C] hover:text-[#e04f4b] ml-2 text-xs cursor-pointer"
										title="Remove image"
									>
										✕
									</button>
								</div>
							{:else}
								<label
									for="custom-file-upload"
									class="block text-center border border-dashed border-[#27272a] hover:border-[#FF605C] p-3 text-[11px] text-white cursor-pointer transition-colors bg-transparent"
								>
									<span>CHOOSE LOCAL IMAGE</span>
									<div class="text-[9px] text-white mt-0.5 font-sans">
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
		<div class="p-4 border-t border-[#27272a] space-y-2 shrink-0 bg-[#000000]">
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={resetDefaults}
					class="w-full py-2 px-2 text-center border border-[#27272a] hover:bg-[#121212] text-white transition-colors text-[11px] cursor-pointer"
				>
					RESET
				</button>
				<button
					type="button"
					onclick={onopenShare}
					class="w-full py-2 px-2 text-center bg-[#FF605C] hover:bg-[#e04f4b] text-white font-semibold transition-colors text-[11px] cursor-pointer"
				>
					SHARE
				</button>
			</div>

			{#if preset.generatePython}
				<button
					type="button"
					onclick={downloadPythonScript}
					class="w-full py-2 px-2 flex items-center justify-center gap-1.5 border border-[#27272a] hover:border-[#FF605C] bg-transparent text-white transition-colors text-[11px] cursor-pointer"
				>
					<span>↓</span>
					<span>EXPORT .PY</span>
				</button>
			{/if}
		</div>
	{/if}
</aside>
