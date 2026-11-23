import LZString from 'lz-string';
import type { ControlSchema, PresetParams, RuntimeAssets, WireAssetPayload } from '../types/preset.js';
import type { DecodedMediaFrame } from '../ascii-studio/types.js';

export interface DecodedState {
	slug: string;
	version: number;
	params: PresetParams;
	assetPayload?: WireAssetPayload;
}

interface WirePayload {
	s: string;
	v: number;
	p: PresetParams;
	a?: WireAssetPayload;
}

/** Registry of indexed preset slugs for v2 ultra-compact encoding */
export const PRESET_SLUG_MAP: string[] = [
	'ascii-plasma',
	'typography-spiral',
	'torus-field',
	'make-your-own'
];

export function getDefaultParams(controls: ControlSchema[]): PresetParams {
	const params: PresetParams = {};
	for (const ctrl of controls) {
		if (ctrl.type !== 'image') {
			params[ctrl.key] = ctrl.default;
		}
	}
	return params;
}

export function cleanSerializableParams(params: PresetParams): PresetParams {
	const serializable: PresetParams = {};
	for (const [k, v] of Object.entries(params)) {
		// Ignore any non-primitive values
		if (typeof v === 'number' || typeof v === 'boolean') {
			serializable[k] = v;
		} else if (typeof v === 'string') {
			// Skip raw inline data URLs (payloads should use WireAssetPayload)
			if (v.startsWith('data:') && v.length > 512) {
				continue;
			}
			if (v.length <= 2048) {
				serializable[k] = v;
			}
		}
	}
	return serializable;
}

/**
 * Strips default values and non-primitive keys, keeping only delta parameters.
 */
export function extractDeltaParams(
	controls: ControlSchema[] | undefined,
	params: PresetParams
): PresetParams {
	const cleaned = cleanSerializableParams(params);
	if (!controls || controls.length === 0) return cleaned;

	const defaults = getDefaultParams(controls);
	const delta: PresetParams = {};

	for (const [k, v] of Object.entries(cleaned)) {
		if (defaults[k] === undefined || defaults[k] !== v) {
			delta[k] = v;
		}
	}

	return delta;
}

/**
 * Converts a Uint8Array or ArrayBuffer to a URL-safe Base64 string without padding.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	if (typeof btoa !== 'undefined') {
		return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}
	if (typeof globalThis !== 'undefined' && 'Buffer' in globalThis) {
		const buf = (globalThis as unknown as { Buffer: { from: (s: string, enc: string) => { toString: (e: string) => string } } }).Buffer;
		return buf.from(binary, 'binary').toString('base64url');
	}
	return '';
}

/**
 * Converts a URL-safe Base64 string to a Uint8Array.
 */
export function base64UrlToBytes(str: string): Uint8Array {
	let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	while (base64.length % 4) {
		base64 += '=';
	}
	if (typeof atob !== 'undefined') {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	}
	if (typeof globalThis !== 'undefined' && 'Buffer' in globalThis) {
		const buf = (globalThis as unknown as { Buffer: { from: (s: string, enc: string) => Uint8Array } }).Buffer;
		return new Uint8Array(buf.from(base64, 'base64'));
	}
	return new Uint8Array(0);
}

/**
 * V3 Micro-Hash Encoder for presets.
 * Produces strictly sub-10 character hashes for standard presets:
 * - Default: "0", "1", "2", "3" (1 character!)
 * - With overrides: "0:0=1.5" (7 characters!)
 */
export function encodePresetMicroHash(
	slug: string,
	params: PresetParams,
	controls?: ControlSchema[]
): string | null {
	const slugIdx = PRESET_SLUG_MAP.indexOf(slug);
	if (slugIdx === -1 || !controls) return null;

	const delta = extractDeltaParams(controls, params);
	const deltaEntries = Object.entries(delta);

	// If no overrides, return single-digit slug index (1 character!)
	if (deltaEntries.length === 0) {
		return String(slugIdx);
	}

	// Format overrides using control index
	const parts: string[] = [];
	for (const [key, val] of deltaEntries) {
		const ctrlIdx = controls.findIndex((c) => c.key === key);
		if (ctrlIdx === -1) return null;

		let valStr: string;
		if (typeof val === 'boolean') {
			valStr = val ? '1' : '0';
		} else if (typeof val === 'number') {
			valStr = String(Number(val.toFixed(3)));
		} else if (typeof val === 'string') {
			valStr = encodeURIComponent(val);
		} else {
			return null;
		}
		parts.push(`${ctrlIdx}=${valStr}`);
	}

	const micro = `${slugIdx}:${parts.join(',')}`;
	return micro;
}

/**
 * Decodes a V3 micro-hash (e.g. "0", "0:0=1.5", "1:2=18,3=blocks").
 */
export function decodePresetMicroHash(code: string, allControls?: Record<string, ControlSchema[]>): DecodedState | null {
	if (!code || typeof code !== 'string') return null;

	const colonIdx = code.indexOf(':');
	const slugPart = colonIdx === -1 ? code : code.slice(0, colonIdx);
	const slugNum = parseInt(slugPart, 10);
	if (isNaN(slugNum) || slugNum < 0 || slugNum >= PRESET_SLUG_MAP.length) {
		return null;
	}

	const slug = PRESET_SLUG_MAP[slugNum];
	const params: PresetParams = {};

	if (colonIdx !== -1) {
		const paramParts = code.slice(colonIdx + 1).split(',');
		const controls = allControls?.[slug];
		for (const part of paramParts) {
			const eqIdx = part.indexOf('=');
			if (eqIdx === -1) continue;
			const idxStr = part.slice(0, eqIdx);
			const valRaw = part.slice(eqIdx + 1);
			const ctrlIdx = parseInt(idxStr, 10);

			if (controls && controls[ctrlIdx]) {
				const ctrl = controls[ctrlIdx];
				if (ctrl.type === 'slider') {
					params[ctrl.key] = parseFloat(valRaw);
				} else if (ctrl.type === 'toggle') {
					params[ctrl.key] = valRaw === '1' || valRaw === 'true';
				} else {
					params[ctrl.key] = decodeURIComponent(valRaw);
				}
			} else {
				// Fallback if schema not provided
				const num = Number(valRaw);
				params[idxStr] = !isNaN(num) ? num : decodeURIComponent(valRaw);
			}
		}
	}

	return {
		slug,
		version: 1,
		params
	};
}

/**
 * Creates a sub-10 character short link on native asciing.app domain via KV store,
 * falling back to public shortener APIs if backend KV is not active.
 */
export async function createShortLink(targetUrl: string, hash?: string): Promise<string | null> {
	// 1. Try native backend /api/shorten endpoint (asciing.app/s/XXXXXX)
	if (hash) {
		try {
			const res = await fetch('/api/shorten', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ hash })
			});
			if (res.ok) {
				const data = (await res.json()) as { slug?: string; path?: string };
				if (data.path) {
					if (typeof window !== 'undefined') {
						return `${window.location.origin}${data.path}`;
					}
					return `https://asciing.app${data.path}`;
				}
			}
		} catch {
			// Backend unconfigured or unreachable, fallback below
		}
	}

	// 2. Fallback to public shortener
	// is.gd/v.gd require a valid public domain, map localhost to production domain
	const publicUrl = targetUrl.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, 'https://asciing.app');

	// 2a. Try is.gd
	try {
		const isGdRes = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(publicUrl)}`);
		if (isGdRes.ok) {
			const data = (await isGdRes.json()) as { shorturl?: string };
			if (data.shorturl) {
				return data.shorturl;
			}
		}
	} catch {
		// Fall through
	}

	// 2b. Try v.gd
	try {
		const vGdRes = await fetch(`https://v.gd/create.php?format=json&url=${encodeURIComponent(publicUrl)}`);
		if (vGdRes.ok) {
			const data = (await vGdRes.json()) as { shorturl?: string };
			if (data.shorturl) {
				return data.shorturl;
			}
		}
	} catch {
		// Fall through
	}

	return null;
}
async function compressDeflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
	if (typeof CompressionStream === 'undefined') return null;
	try {
		const cs = new CompressionStream('deflate-raw');
		const writer = cs.writable.getWriter();
		writer.write(data as unknown as BufferSource);
		writer.close();
		const reader = cs.readable.getReader();
		const chunks: Uint8Array[] = [];
		let total = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			total += value.length;
		}
		const out = new Uint8Array(total);
		let offset = 0;
		for (const chunk of chunks) {
			out.set(chunk, offset);
			offset += chunk.length;
		}
		return out;
	} catch {
		return null;
	}
}

/**
 * Decompresses bytes using Web Streams deflate-raw.
 */
async function decompressDeflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
	if (typeof DecompressionStream === 'undefined') return null;
	try {
		const ds = new DecompressionStream('deflate-raw');
		const writer = ds.writable.getWriter();
		writer.write(data as unknown as BufferSource);
		writer.close();
		const reader = ds.readable.getReader();
		const chunks: Uint8Array[] = [];
		let total = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			total += value.length;
		}
		const out = new Uint8Array(total);
		let offset = 0;
		for (const chunk of chunks) {
			out.set(chunk, offset);
			offset += chunk.length;
		}
		return out;
	} catch {
		return null;
	}
}

/**
 * V2 Ultra-Compact asynchronous state encoder.
 * - Extracts delta against schema defaults.
 * - Indexes preset slug.
 * - Packs into compact Base64URL with optional deflate-raw.
 */
export async function encodePresetStateV2(
	slug: string,
	version: number,
	params: PresetParams,
	assetPayload?: WireAssetPayload,
	controls?: ControlSchema[]
): Promise<string> {
	const delta = controls ? extractDeltaParams(controls, params) : cleanSerializableParams(params);
	const slugIdx = PRESET_SLUG_MAP.indexOf(slug);

	const v2Obj: Record<string, unknown> = {
		s: slugIdx !== -1 ? slugIdx : slug,
		v: version
	};

	if (Object.keys(delta).length > 0) {
		v2Obj.p = delta;
	}

	if (assetPayload && assetPayload.d) {
		v2Obj.a = assetPayload;
	}

	const json = JSON.stringify(v2Obj);
	const rawBytes = new TextEncoder().encode(json);

	// Test if deflate compression actually saves space
	if (rawBytes.length > 50) {
		const compressed = await compressDeflateRaw(rawBytes);
		if (compressed && compressed.length < rawBytes.length) {
			return `2.z${bytesToBase64Url(compressed)}`;
		}
	}

	return `2.r${bytesToBase64Url(rawBytes)}`;
}

/**
 * Synchronous legacy-compatible encode function.
 * Uses V2 uncompressed Base64URL for tiny parameter sets, or falls back to legacy V1 LZString.
 */
export function encodePresetState(
	slug: string,
	version: number,
	params: PresetParams,
	assetPayload?: WireAssetPayload,
	controls?: ControlSchema[]
): string {
	const delta = controls ? extractDeltaParams(controls, params) : cleanSerializableParams(params);
	const slugIdx = PRESET_SLUG_MAP.indexOf(slug);

	const v2Obj: Record<string, unknown> = {
		s: slugIdx !== -1 ? slugIdx : slug,
		v: version
	};

	if (Object.keys(delta).length > 0) {
		v2Obj.p = delta;
	}

	if (assetPayload && assetPayload.d) {
		v2Obj.a = assetPayload;
	}

	const json = JSON.stringify(v2Obj);
	const rawBytes = new TextEncoder().encode(json);
	return `2.r${bytesToBase64Url(rawBytes)}`;
}

/**
 * Decodes either V2 (compact Base64URL/deflate) or legacy V1 (LZString) hashes.
 */
export async function decodePresetStateAsync(rawInput: string, allControls?: Record<string, ControlSchema[]>): Promise<DecodedState | null> {
	if (!rawInput || typeof rawInput !== 'string') return null;

	let code = rawInput.trim();

	// Check if full URL or contains hash
	const hashIdx = code.indexOf('#');
	if (hashIdx !== -1) {
		code = code.slice(hashIdx + 1);
	}

	// Remove leading 'v=' if present
	if (code.startsWith('v=')) {
		code = code.slice(2);
	}

	if (!code) return null;

	// Check for V3 Micro-Hash (e.g. "0", "1", "0:0=1.5")
	const firstChar = code.charAt(0);
	if ((code.length === 1 || code.charAt(1) === ':') && !isNaN(parseInt(firstChar, 10))) {
		const micro = decodePresetMicroHash(code, allControls);
		if (micro) return micro;
	}

	// Check for V2 prefix
	if (code.startsWith('2.')) {
		const mode = code.charAt(2);
		const payload = code.slice(3);
		try {
			const bytes = base64UrlToBytes(payload);
			let jsonBytes: Uint8Array = bytes;

			if (mode === 'z') {
				const decompressed = await decompressDeflateRaw(bytes);
				if (!decompressed) return null;
				jsonBytes = decompressed;
			}

			const jsonStr = new TextDecoder().decode(jsonBytes);
			const parsed = JSON.parse(jsonStr) as {
				s: number | string;
				v?: number;
				p?: PresetParams;
				a?: WireAssetPayload;
			};

			const slug = typeof parsed.s === 'number' ? PRESET_SLUG_MAP[parsed.s] || String(parsed.s) : parsed.s;
			const version = typeof parsed.v === 'number' ? parsed.v : 1;
			const params = parsed.p || {};

			return {
				slug,
				version,
				params,
				assetPayload: parsed.a
			};
		} catch (err) {
			console.error('Failed to decode V2 preset state:', err);
			return null;
		}
	}

	// Fallback to V1 (LZ-String) decoder for backward compatibility
	return decodePresetStateV1(code);
}

function decodePresetStateV1(code: string): DecodedState | null {
	try {
		const json = LZString.decompressFromEncodedURIComponent(code);
		if (!json) return null;

		const parsed = JSON.parse(json) as Partial<WirePayload>;
		if (typeof parsed?.s === 'string' && typeof parsed?.v === 'number' && parsed.p) {
			return {
				slug: parsed.s,
				version: parsed.v,
				params: parsed.p,
				assetPayload: parsed.a
			};
		}
	} catch {
		return null;
	}

	return null;
}

export function decodePresetState(rawInput: string, allControls?: Record<string, ControlSchema[]>): DecodedState | null {
	if (!rawInput || typeof rawInput !== 'string') return null;

	let code = rawInput.trim();

	const hashIdx = code.indexOf('#');
	if (hashIdx !== -1) {
		code = code.slice(hashIdx + 1);
	}

	if (code.startsWith('v=')) {
		code = code.slice(2);
	}

	if (!code) return null;

	// Check for V3 Micro-Hash (e.g. "0", "1", "0:0=1.5")
	const firstChar = code.charAt(0);
	if ((code.length === 1 || code.charAt(1) === ':') && !isNaN(parseInt(firstChar, 10))) {
		const micro = decodePresetMicroHash(code, allControls);
		if (micro) return micro;
	}

	if (code.startsWith('2.')) {
		const mode = code.charAt(2);
		const payload = code.slice(3);
		try {
			if (mode === 'r') {
				const bytes = base64UrlToBytes(payload);
				const jsonStr = new TextDecoder().decode(bytes);
				const parsed = JSON.parse(jsonStr) as {
					s: number | string;
					v?: number;
					p?: PresetParams;
					a?: WireAssetPayload;
				};

				const slug = typeof parsed.s === 'number' ? PRESET_SLUG_MAP[parsed.s] || String(parsed.s) : parsed.s;
				const version = typeof parsed.v === 'number' ? parsed.v : 1;
				const params = parsed.p || {};

				return {
					slug,
					version,
					params,
					assetPayload: parsed.a
				};
			}
		} catch {
			return null;
		}
	}

	return decodePresetStateV1(code);
}

/**
 * Client-side serializes an image canvas into a compact downscaled WebP data URL.
 */
export async function serializeCanvasToPayload(
	canvas: HTMLCanvasElement | ImageBitmap,
	maxDim = 84,
	quality = 0.40
): Promise<WireAssetPayload | null> {
	if (typeof document === 'undefined') return null;

	const srcW = canvas.width;
	const srcH = canvas.height;
	if (!srcW || !srcH) return null;

	const scale = Math.min(1, Math.min(maxDim / srcW, maxDim / srcH));
	const targetW = Math.max(1, Math.round(srcW * scale));
	const targetH = Math.max(1, Math.round(srcH * scale));

	const offscreen = document.createElement('canvas');
	offscreen.width = targetW;
	offscreen.height = targetH;
	const ctx = offscreen.getContext('2d');
	if (!ctx) return null;

	ctx.drawImage(canvas as CanvasImageSource, 0, 0, targetW, targetH);
	let dataUrl = offscreen.toDataURL('image/webp', quality);
	if (!dataUrl.startsWith('data:image/webp')) {
		// Fallback to jpeg if webp not supported
		dataUrl = offscreen.toDataURL('image/jpeg', quality);
	}

	return {
		t: 'img',
		d: dataUrl,
		w: targetW,
		h: targetH
	};
}

/**
 * Client-side serializes multi-frame animated media into a compact vertical WebP strip.
 */
export async function serializeFramesToPayload(
	frames: DecodedMediaFrame[],
	maxFrames = 10,
	maxDim = 52,
	quality = 0.35
): Promise<WireAssetPayload | null> {
	if (typeof document === 'undefined' || !frames || frames.length === 0) return null;

	if (frames.length === 1) {
		return serializeCanvasToPayload(frames[0].bitmap, maxDim, quality);
	}

	// Sample up to maxFrames evenly
	const total = frames.length;
	const sampledFrames: DecodedMediaFrame[] = [];
	const step = total <= maxFrames ? 1 : total / maxFrames;

	for (let i = 0; i < total && sampledFrames.length < maxFrames; i += step) {
		sampledFrames.push(frames[Math.floor(i)]);
	}

	const first = sampledFrames[0].bitmap;
	const srcW = first.width || 320;
	const srcH = first.height || 240;

	const scale = Math.min(1, Math.min(maxDim / srcW, maxDim / srcH));
	const frameW = Math.max(1, Math.round(srcW * scale));
	const frameH = Math.max(1, Math.round(srcH * scale));
	const count = sampledFrames.length;

	const stripCanvas = document.createElement('canvas');
	stripCanvas.width = frameW;
	stripCanvas.height = frameH * count;
	const ctx = stripCanvas.getContext('2d');
	if (!ctx) return null;

	for (let i = 0; i < count; i++) {
		ctx.drawImage(sampledFrames[i].bitmap, 0, i * frameH, frameW, frameH);
	}

	let dataUrl = stripCanvas.toDataURL('image/webp', quality);
	if (!dataUrl.startsWith('data:image/webp')) {
		dataUrl = stripCanvas.toDataURL('image/jpeg', quality);
	}

	const delays = sampledFrames.map((f) => f.delayMs || 100);

	return {
		t: 'anim',
		d: dataUrl,
		w: frameW,
		h: frameH,
		count,
		delays
	};
}

/**
 * Extracts a sequence of frames from an active HTMLVideoElement for link sharing.
 */
export async function sampleVideoToFrames(
	video: HTMLVideoElement,
	maxDurationSec = 2.0,
	fps = 7,
	maxDim = 72
): Promise<DecodedMediaFrame[]> {
	if (typeof document === 'undefined' || !video) return [];

	const srcW = video.videoWidth || 320;
	const srcH = video.videoHeight || 240;
	const scale = Math.min(1, Math.min(maxDim / srcW, maxDim / srcH));
	const targetW = Math.max(1, Math.round(srcW * scale));
	const targetH = Math.max(1, Math.round(srcH * scale));

	const offscreen = document.createElement('canvas');
	offscreen.width = targetW;
	offscreen.height = targetH;
	const ctx = offscreen.getContext('2d');
	if (!ctx) return [];

	const duration = video.duration && !isNaN(video.duration) ? Math.min(video.duration, maxDurationSec) : maxDurationSec;
	const frameCount = Math.max(4, Math.min(16, Math.round(duration * fps)));
	const delayMs = Math.round(1000 / fps);
	const frames: DecodedMediaFrame[] = [];

	const wasPaused = video.paused;
	const originalTime = video.currentTime;

	const seekTo = (t: number): Promise<void> => {
		return new Promise((resolve) => {
			let done = false;
			const onSeeked = () => {
				if (!done) {
					done = true;
					video.removeEventListener('seeked', onSeeked);
					resolve();
				}
			};
			video.addEventListener('seeked', onSeeked);
			video.currentTime = t;
			setTimeout(() => {
				if (!done) {
					done = true;
					video.removeEventListener('seeked', onSeeked);
					resolve();
				}
			}, 250);
		});
	};

	try {
		for (let i = 0; i < frameCount; i++) {
			const targetTime = (i / frameCount) * duration;
			await seekTo(targetTime);
			ctx.clearRect(0, 0, targetW, targetH);
			ctx.drawImage(video, 0, 0, targetW, targetH);

			let bitmap: ImageBitmap;
			if (typeof createImageBitmap !== 'undefined') {
				try {
					bitmap = await createImageBitmap(offscreen);
				} catch {
					bitmap = offscreen as any;
				}
			} else {
				bitmap = offscreen as any;
			}
			frames.push({ bitmap, delayMs });
		}
	} finally {
		video.currentTime = originalTime;
		if (!wasPaused) {
			video.play().catch(() => {});
		}
	}

	return frames;
}

/**
 * Reconstructs RuntimeAssets from a WireAssetPayload client-side.
 */
export async function hydrateAssetsFromPayload(payload?: WireAssetPayload): Promise<RuntimeAssets> {
	if (typeof document === 'undefined' || !payload || !payload.d) return {};

	const img = new Image();
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = () => reject(new Error('Failed to load asset image from payload'));
		img.src = payload.d;
	});

	if (payload.t === 'img') {
		const canvas = document.createElement('canvas');
		canvas.width = img.naturalWidth || payload.w || 120;
		canvas.height = img.naturalHeight || payload.h || 80;
		const ctx = canvas.getContext('2d');
		ctx?.drawImage(img, 0, 0);
		return { image: canvas };
	}

	if (payload.t === 'anim') {
		const frameW = payload.w || img.naturalWidth || 80;
		const frameH = payload.h || (payload.count ? Math.floor(img.naturalHeight / payload.count) : 60);
		const count = payload.count || Math.max(1, Math.floor(img.naturalHeight / frameH));
		const delays = payload.delays || [];

		const frames: DecodedMediaFrame[] = [];
		for (let i = 0; i < count; i++) {
			const frameCanvas = document.createElement('canvas');
			frameCanvas.width = frameW;
			frameCanvas.height = frameH;
			const ctx = frameCanvas.getContext('2d');
			if (ctx) {
				ctx.drawImage(img, 0, i * frameH, frameW, frameH, 0, 0, frameW, frameH);
			}

			let bitmap: ImageBitmap;
			if (typeof createImageBitmap !== 'undefined') {
				try {
					bitmap = await createImageBitmap(frameCanvas);
				} catch {
					bitmap = frameCanvas as any;
				}
			} else {
				bitmap = frameCanvas as any;
			}

			frames.push({
				bitmap,
				delayMs: delays[i] || 100
			});
		}

		// Initial display canvas for first frame
		const firstCanvas = document.createElement('canvas');
		firstCanvas.width = frameW;
		firstCanvas.height = frameH;
		const fCtx = firstCanvas.getContext('2d');
		if (fCtx && frames.length > 0) {
			fCtx.drawImage(frames[0].bitmap as any, 0, 0);
		}

		return {
			image: firstCanvas,
			gifFrames: frames
		};
	}

	return {};
}
