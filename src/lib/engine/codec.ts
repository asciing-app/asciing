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

export function encodePresetState(
	slug: string,
	version: number,
	params: PresetParams,
	assetPayload?: WireAssetPayload
): string {
	const payload: WirePayload = {
		s: slug,
		v: version,
		p: cleanSerializableParams(params)
	};
	if (assetPayload && assetPayload.d) {
		payload.a = assetPayload;
	}
	const json = JSON.stringify(payload);
	return LZString.compressToEncodedURIComponent(json);
}

export function decodePresetState(rawInput: string): DecodedState | null {
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

/**
 * Client-side serializes an image canvas into a compact downscaled WebP data URL.
 */
export async function serializeCanvasToPayload(
	canvas: HTMLCanvasElement | ImageBitmap,
	maxDim = 120,
	quality = 0.55
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
	maxFrames = 20,
	maxDim = 80,
	quality = 0.5
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
	maxDurationSec = 2.5,
	fps = 8,
	maxDim = 80
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
	const frameCount = Math.max(4, Math.min(20, Math.round(duration * fps)));
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
