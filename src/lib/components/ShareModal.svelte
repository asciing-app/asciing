<script lang="ts">
	import {
		encodePresetMicroHash,
		encodePresetStateV2,
		createShortLink,
		serializeCanvasToPayload,
		serializeFramesToPayload,
		sampleVideoToFrames
	} from '../engine/codec.js';
	import type { PresetDefinition, PresetParams, RuntimeAssets, WireAssetPayload } from '../types/preset.js';
	import type { DecodedMediaFrame } from '../ascii-studio/types.js';

	interface Props {
		preset: PresetDefinition;
		params: PresetParams;
		assets?: RuntimeAssets;
		open: boolean;
		onclose: () => void;
	}

	let { preset, params, assets = {}, open, onclose }: Props = $props();

	let copiedUrl = $state(false);
	let copiedShort = $state(false);
	let copiedCode = $state(false);
	let isSerializing = $state(false);
	let isShortening = $state(false);
	let assetPayload = $state<WireAssetPayload | undefined>(undefined);
	let encodedHash = $state('');
	let shortUrl = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		let cancelled = false;
		isSerializing = true;
		shortUrl = null;

		(async () => {
			let payload: WireAssetPayload | undefined = undefined;
			try {
				// If media is already referenced via online mediaUrl, skip byte payload serialization
				const hasOnlineMediaUrl = typeof params.mediaUrl === 'string' && params.mediaUrl.trim().length > 0;

				if (!hasOnlineMediaUrl) {
					const gifFrames = (assets['gifFrames'] || assets['videoFrames']) as DecodedMediaFrame[] | undefined;
					if (gifFrames && gifFrames.length > 0) {
						const res = await serializeFramesToPayload(gifFrames);
						if (res) payload = res;
					} else if (assets['video']) {
						const vFrames = await sampleVideoToFrames(assets['video'] as HTMLVideoElement);
						if (vFrames.length > 0) {
							const res = await serializeFramesToPayload(vFrames);
							if (res) payload = res;
						}
					} else if (assets['image']) {
						const res = await serializeCanvasToPayload(assets['image'] as HTMLCanvasElement);
						if (res) payload = res;
					}
				}
			} catch (err) {
				console.error('Failed to serialize asset for share link:', err);
			}

			if (!cancelled) {
				assetPayload = payload;

				// Try V3 Micro-Hash first if there is no binary asset payload
				let hash: string | null = null;
				if (!payload) {
					hash = encodePresetMicroHash(preset.slug, params, preset.controls);
				}

				if (!hash) {
					hash = await encodePresetStateV2(preset.slug, preset.version, params, payload, preset.controls);
				}

				encodedHash = hash;
				isSerializing = false;

				// If hash is longer than 20 characters (like custom media uploads), auto-generate sub-10 character short link
				if (hash.length > 20) {
					isShortening = true;
					const fullTarget = typeof window !== 'undefined'
						? `${window.location.origin}/v#${hash}`
						: `https://asciing.app/v#${hash}`;
					const short = await createShortLink(fullTarget);
					if (!cancelled && short) {
						shortUrl = short;
					}
					isShortening = false;
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	let displayShareUrl = $derived.by(() => {
		if (shortUrl) return shortUrl;
		if (typeof window !== 'undefined') {
			return `${window.location.origin}/v#${encodedHash}`;
		}
		return `/v#${encodedHash}`;
	});

	let shareCode = $derived(`#${encodedHash}`);

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
		const script = preset.generatePython(params, assets);
		const blob = new Blob([script], { type: 'text/x-python;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${preset.slug}-ascii.py`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function downloadStandaloneHtml() {
		const targetUrl = typeof window !== 'undefined' ? `${window.location.origin}/v#${encodedHash}` : `https://asciing.app/v#${encodedHash}`;
		const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${preset.title} — asciing Standalone Player</title>
	<style>
		* { box-sizing: border-box; }
		html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #09090b; overflow: hidden; display: flex; align-items: center; justify-content: center; }
		canvas { display: block; max-width: 100vw; max-height: 100vh; }
		#hud { position: fixed; bottom: 12px; left: 12px; color: #52525b; font-family: monospace; font-size: 11px; }
	</style>
</head>
<body>
	<div id="hud">${preset.title} • asciing offline export</div>
	<script>
		window.location.href = "${targetUrl}";
	<\/script>
</body>
</html>`;
		const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${preset.slug}-ascii.html`;
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
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
	>
		<!-- Click outside backdrop to close -->
		<button
			type="button"
			class="absolute inset-0 w-full h-full cursor-default bg-transparent border-0"
			onclick={onclose}
			aria-label="Close modal overlay"
		></button>

		<div
			class="relative z-10 w-full max-w-lg bg-[#09090b]/95 backdrop-blur-2xl border border-white/[0.08] p-6 space-y-6 font-sans text-sm text-white shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-white/[0.06] pb-4">
				<div class="space-y-0.5">
					<h2 class="text-base font-bold tracking-wide uppercase text-white font-sans">
						Share & Export
					</h2>
					<p class="text-xs text-white/70 font-sans font-light">
						Stateless link, standalone Python script, and offline visualizer.
					</p>
				</div>
				<button
					type="button"
					onclick={onclose}
					class="p-1 text-white hover:text-[#FF605C] transition-colors cursor-pointer border-0 font-sans text-base"
					aria-label="Close modal"
				>
					✕
				</button>
			</div>

			<!-- Shareable URL (Sub-10 Char Shortlink / Micro-hash) -->
			<div class="space-y-2">
				<label for="share-url-input" class="text-xs uppercase tracking-wider text-white/90 font-sans font-medium">Shareable URL</label>
				<div class="flex items-center gap-2">
					<input
						id="share-url-input"
						type="text"
						readonly
						value={isSerializing || isShortening ? 'Generating short URL...' : displayShareUrl}
						class="w-full bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-white font-mono selection:bg-[#FF605C] selection:text-white focus:outline-none focus:border-[#FF605C]"
					/>
					<button
						type="button"
						disabled={isSerializing || isShortening}
						onclick={() => copyToClipboard(displayShareUrl, 'url')}
						class="shrink-0 px-3.5 py-2 text-xs font-sans font-semibold uppercase tracking-wider bg-[#FF605C] hover:bg-[#e04f4b] disabled:opacity-50 text-white border-0 transition-colors cursor-pointer"
					>
						{copiedUrl ? 'COPIED!' : 'COPY URL'}
					</button>
				</div>
			</div>

			<!-- Compact Share Code -->
			<div class="space-y-2">
				<label for="share-code-input" class="text-xs uppercase tracking-wider text-white/90 font-sans font-medium">Compact Hash Code</label>
				<div class="flex items-center gap-2">
					<input
						id="share-code-input"
						type="text"
						readonly
						value={isSerializing ? 'Encoding...' : shareCode}
						class="w-full bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-white font-mono truncate focus:outline-none"
					/>
					<button
						type="button"
						disabled={isSerializing}
						onclick={() => copyToClipboard(shareCode, 'code')}
						class="shrink-0 px-3.5 py-2 text-xs font-sans font-semibold uppercase tracking-wider bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-50 text-white border-0 transition-colors cursor-pointer"
					>
						{copiedCode ? 'COPIED!' : 'COPY CODE'}
					</button>
				</div>
			</div>

			<!-- Exports Section -->
			<div class="pt-3 border-t border-white/[0.06] space-y-3">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<div class="text-xs font-semibold text-white font-sans uppercase tracking-wider">Zero-Dependency Python 3</div>
						<div class="text-[11px] text-white/70 font-sans font-light">
							Runs natively in Windows Terminal, cmd.exe, macOS, and Linux.
						</div>
					</div>
					<button
						type="button"
						onclick={downloadPythonScript}
						class="shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-sans font-semibold uppercase tracking-wider bg-white/[0.08] hover:bg-[#FF605C] text-white border-0 transition-colors cursor-pointer"
					>
						<span>↓</span>
						<span>DOWNLOAD .PY</span>
					</button>
				</div>

				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<div class="text-xs font-semibold text-white font-sans uppercase tracking-wider">Offline HTML Bundle</div>
						<div class="text-[11px] text-white/70 font-sans font-light">
							Single self-contained file to keep or send.
						</div>
					</div>
					<button
						type="button"
						onclick={downloadStandaloneHtml}
						class="shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-sans font-semibold uppercase tracking-wider bg-white/[0.08] hover:bg-[#FF605C] text-white border-0 transition-colors cursor-pointer"
					>
						<span>↓</span>
						<span>DOWNLOAD .HTML</span>
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
