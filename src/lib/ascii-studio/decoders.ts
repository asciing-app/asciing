import { parseGIF, decompressFrames } from 'gifuct-js';
import type { DecodedMediaFrame, DecodedMediaResult } from './types.js';

/**
 * 1. File type routing order:
 * Check for GIF (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif'))
 * BEFORE checking file.type.startsWith('image/') so GIFs never fall into the static image path.
 */
export async function decodeMediaFile(file: File): Promise<DecodedMediaResult> {
	const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

	if (isGif) {
		return await decodeGif(file);
	}

	if (file.type.startsWith('image/')) {
		return await decodeStaticImage(file);
	}

	throw new Error(`Unsupported media type: ${file.type}`);
}

/**
 * Static Image Decoder
 */
export async function decodeStaticImage(file: File): Promise<DecodedMediaResult> {
	const bitmap = await createImageBitmap(file);
	const frames: DecodedMediaFrame[] = [{ bitmap, delayMs: 100 }];
	return {
		kind: 'image',
		frames,
		width: bitmap.width,
		height: bitmap.height
	};
}

/**
 * GIF Decoder
 */
export async function decodeGif(file: File): Promise<DecodedMediaResult> {
	const arrayBuffer = await file.arrayBuffer();

	// Primary path: ImageDecoder
	if (typeof window !== 'undefined' && 'ImageDecoder' in window) {
		try {
			const result = await decodeWithImageDecoder(arrayBuffer);
			console.log('[GIF decode] frames:', result.frames.length);
			return result;
		} catch (err) {
			console.warn('[GIF decode] ImageDecoder failed, falling back to gifuct-js:', err);
		}
	}

	// Fallback path: gifuct-js
	const result = await decodeWithGifuct(arrayBuffer);
	console.log('[GIF decode] frames:', result.frames.length);
	return result;
}

/**
 * 2. ImageDecoder frame count & timing:
 * When using new ImageDecoder({ data: arrayBuffer, type: 'image/gif' }), await BOTH await decoder.tracks.ready
 * and await decoder.completed before reading decoder.tracks.selectedTrack.frameCount. Loop 0..frameCount-1,
 * call const { image } = await decoder.decode({ frameIndex: i }), convert to an ImageBitmap via
 * await createImageBitmap(image), read delayMs = image.duration ? Math.round(image.duration / 1000) : 100
 * (clamp < 20 to 100), and then call image.close().
 */
export async function decodeWithImageDecoder(arrayBuffer: ArrayBuffer): Promise<DecodedMediaResult> {
	const ImageDecoderCtor = (window as unknown as { ImageDecoder: new (init: { data: ArrayBuffer; type: string }) => any }).ImageDecoder;
	const decoder = new ImageDecoderCtor({ data: arrayBuffer, type: 'image/gif' });

	await decoder.tracks.ready;
	await decoder.completed;

	const track = decoder.tracks.selectedTrack;
	const frameCount = track?.frameCount ?? 1;
	const frames: DecodedMediaFrame[] = [];

	let width = 0;
	let height = 0;

	for (let i = 0; i < frameCount; i++) {
		const { image } = await decoder.decode({ frameIndex: i });
		if (i === 0) {
			width = image.displayWidth || image.codedWidth;
			height = image.displayHeight || image.codedHeight;
		}
		let bitmap: ImageBitmap;
		try {
			// VideoFrame alpha preservation: 'none' ensures alpha channel is strictly preserved
			bitmap = await createImageBitmap(image, { premultiplyAlpha: 'none' });
		} catch {
			bitmap = await createImageBitmap(image);
		}
		const rawDelay = image.duration ? Math.round(image.duration / 1000) : 100;
		const delayMs = rawDelay < 20 ? 100 : rawDelay;
		image.close();
		frames.push({ bitmap, delayMs });
	}

	return {
		kind: 'gif',
		frames,
		width: width || 320,
		height: height || 240
	};
}

/**
 * 3. gifuct-js fallback compositing:
 * Ensure the gifuct-js fallback uses decompressFrames(gif, true), creates a persistent canvas sized to
 * gif.lsd.width x gif.lsd.height, draws each frame's patch onto a temporary canvas first and then
 * drawImages it onto the persistent canvas (do NOT putImageData directly onto the main canvas or transparency breaks),
 * snapshots via await createImageBitmap(mainCanvas), and handles disposalType === 2 (clear patch rect)
 * and disposalType === 3 (restore prior state) after capturing.
 */
export async function decodeWithGifuct(arrayBuffer: ArrayBuffer): Promise<DecodedMediaResult> {
	const parsedGif = parseGIF(arrayBuffer);
	const decompressed = decompressFrames(parsedGif, true);

	const width = parsedGif.lsd.width;
	const height = parsedGif.lsd.height;

	const mainCanvas = document.createElement('canvas');
	mainCanvas.width = width;
	mainCanvas.height = height;
	const mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });
	if (!mainCtx) throw new Error('Cannot acquire canvas context for gifuct compositing');

	const tempCanvas = document.createElement('canvas');
	const tempCtx = tempCanvas.getContext('2d');
	if (!tempCtx) throw new Error('Cannot acquire temp canvas context for gifuct patch');

	const frames: DecodedMediaFrame[] = [];
	let previousState: ImageData | null = null;

	for (let i = 0; i < decompressed.length; i++) {
		const frame = decompressed[i];

		// If disposalType is 3, save state before compositing current patch
		if (frame.disposalType === 3) {
			previousState = mainCtx.getImageData(0, 0, width, height);
		}

		// Draw patch onto temporary canvas first
		tempCanvas.width = frame.dims.width;
		tempCanvas.height = frame.dims.height;
		tempCtx.clearRect(0, 0, frame.dims.width, frame.dims.height);
		const patchData = tempCtx.createImageData(frame.dims.width, frame.dims.height);
		patchData.data.set(frame.patch);
		tempCtx.putImageData(patchData, 0, 0);

		// drawImage temporary canvas onto persistent main canvas
		mainCtx.drawImage(tempCanvas, frame.dims.left, frame.dims.top);

		// Snapshot via createImageBitmap
		let bitmap: ImageBitmap;
		try {
			bitmap = await createImageBitmap(mainCanvas, { premultiplyAlpha: 'none' });
		} catch {
			bitmap = await createImageBitmap(mainCanvas);
		}
		const rawDelay = frame.delay;
		const delayMs = !rawDelay || rawDelay < 20 ? 100 : rawDelay;
		frames.push({ bitmap, delayMs });

		// Handle disposal after capturing
		if (frame.disposalType === 2) {
			// Clear patch rect
			mainCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
		} else if (frame.disposalType === 3 && previousState) {
			// Restore prior state
			mainCtx.putImageData(previousState, 0, 0);
			previousState = null;
		}
	}

	return {
		kind: 'gif',
		frames,
		width,
		height
	};
}
