export const LUMINANCE_GRID_SIZE = 256;

export class LuminanceSampler {
	private lastAsset: ImageData | HTMLCanvasElement | null = null;
	private luminanceBuffer: Float32Array = new Float32Array(LUMINANCE_GRID_SIZE * LUMINANCE_GRID_SIZE);
	private offscreenCanvas: HTMLCanvasElement | null = null;
	private offscreenCtx: CanvasRenderingContext2D | null = null;

	constructor() {
		this.generateProceduralFallback();
	}

	/**
	 * Creates a calm, sculptural fallback luminance field (clean directional 3D sphere shading)
	 * when no local image is uploaded.
	 */
	private generateProceduralFallback(): void {
		const size = LUMINANCE_GRID_SIZE;
		const half = size / 2;

		// Key light vector (-0.4, -0.6, 0.7) normalized
		const lx = -0.4082;
		const ly = -0.6124;
		const lz = 0.6804;

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const nx = (x - half) / half;
				const ny = (y - half) / half;
				const distSq = nx * nx + ny * ny;

				// Strict outer-radius cutoff: outside the sphere radius is strictly 0.0
				if (distSq >= 1.0) {
					this.luminanceBuffer[y * size + x] = 0.0;
					continue;
				}

				// 3D sphere surface normal
				const z = Math.sqrt(Math.max(0, 1.0 - distSq));

				// 1. Clean directional diffuse shading (N dot L)
				// Zero rim light, zero ambient floor, zero backlight on the shadow side
				const dot = nx * lx + ny * ly + z * lz;

				if (dot <= 0.0) {
					this.luminanceBuffer[y * size + x] = 0.0;
					continue;
				}

				const diffuse = Math.pow(dot, 1.2);
				this.luminanceBuffer[y * size + x] = Math.min(1.0, diffuse);
			}
		}
	}

	/**
	 * Updates the luminance buffer if the asset reference changed.
	 * Never called inside per-pixel loops—only checked once per frame.
	 */
	public syncAsset(asset: ImageData | HTMLCanvasElement | undefined): void {
		const currentAsset = asset ?? null;
		if (currentAsset === this.lastAsset) return;

		this.lastAsset = currentAsset;

		if (!currentAsset) {
			this.generateProceduralFallback();
			return;
		}

		if (typeof document === 'undefined') return;

		if (!this.offscreenCanvas) {
			this.offscreenCanvas = document.createElement('canvas');
			this.offscreenCanvas.width = LUMINANCE_GRID_SIZE;
			this.offscreenCanvas.height = LUMINANCE_GRID_SIZE;
			this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
		}

		const ctx = this.offscreenCtx;
		if (!ctx) return;

		const size = LUMINANCE_GRID_SIZE;
		ctx.clearRect(0, 0, size, size);

		let srcWidth = 0;
		let srcHeight = 0;

		if ('width' in currentAsset && 'height' in currentAsset) {
			srcWidth = currentAsset.width;
			srcHeight = currentAsset.height;
		}

		if (srcWidth <= 0 || srcHeight <= 0) {
			this.generateProceduralFallback();
			return;
		}

		// Center-crop ("cover") aspect ratio fit onto working grid
		const scale = Math.max(size / srcWidth, size / srcHeight);
		const renderW = srcWidth * scale;
		const renderH = srcHeight * scale;
		const offsetX = (size - renderW) / 2;
		const offsetY = (size - renderH) / 2;

		if (currentAsset instanceof ImageData) {
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = srcWidth;
			tempCanvas.height = srcHeight;
			const tempCtx = tempCanvas.getContext('2d');
			if (tempCtx) {
				tempCtx.putImageData(currentAsset, 0, 0);
				ctx.drawImage(tempCanvas, offsetX, offsetY, renderW, renderH);
			}
		} else {
			ctx.drawImage(currentAsset, offsetX, offsetY, renderW, renderH);
		}

		const imgData = ctx.getImageData(0, 0, size, size).data;
		const rawLum = new Float32Array(size * size);

		for (let i = 0; i < size * size; i++) {
			const r = imgData[i * 4];
			const g = imgData[i * 4 + 1];
			const b = imgData[i * 4 + 2];
			const a = imgData[i * 4 + 3] / 255.0;
			// Perceptual Rec. 601 luminance
			rawLum[i] = ((0.299 * r + 0.587 * g + 0.114 * b) / 255.0) * a;
		}

		// Lightweight 3x3 box-blur pass to eliminate high-frequency pixel noise
		for (let y = 0; y < size; y++) {
			const y0 = Math.max(0, y - 1);
			const y1 = y;
			const y2 = Math.min(size - 1, y + 1);

			for (let x = 0; x < size; x++) {
				const x0 = Math.max(0, x - 1);
				const x1 = x;
				const x2 = Math.min(size - 1, x + 1);

				const sum =
					rawLum[y0 * size + x0] +
					rawLum[y0 * size + x1] +
					rawLum[y0 * size + x2] +
					rawLum[y1 * size + x0] +
					rawLum[y1 * size + x1] +
					rawLum[y1 * size + x2] +
					rawLum[y2 * size + x0] +
					rawLum[y2 * size + x1] +
					rawLum[y2 * size + x2];

				this.luminanceBuffer[y * size + x] = sum / 9.0;
			}
		}
	}

	/**
	 * Bilinear O(1) luminance sampling at normalized (0..1) coordinates.
	 */
	public sampleLuminance(normX: number, normY: number, contrast = 1.0, invert = false): number {
		// 2. Strict outer-radius cutoff:
		// If a spiral point's normalized distance from center >= 1.0 (outside sphere radius),
		// return 0 immediately - never a fallback ambient value or wrapped pixel.
		const dx = (normX - 0.5) * 2.0;
		const dy = (normY - 0.5) * 2.0;
		const distSq = dx * dx + dy * dy;

		if (distSq >= 1.0 || normX < 0.0 || normX > 1.0 || normY < 0.0 || normY > 1.0) {
			return 0.0;
		}

		const size = LUMINANCE_GRID_SIZE;
		const gx = normX * (size - 1);
		const gy = normY * (size - 1);

		const x0 = Math.floor(gx);
		const y0 = Math.floor(gy);
		const x1 = Math.min(size - 1, x0 + 1);
		const y1 = Math.min(size - 1, y0 + 1);

		const fx = gx - x0;
		const fy = gy - y0;

		const v00 = this.luminanceBuffer[y0 * size + x0];
		const v10 = this.luminanceBuffer[y0 * size + x1];
		const v01 = this.luminanceBuffer[y1 * size + x0];
		const v11 = this.luminanceBuffer[y1 * size + x1];

		let lum = (1.0 - fx) * (1.0 - fy) * v00 + fx * (1.0 - fy) * v10 + (1.0 - fx) * fy * v01 + fx * fy * v11;

		if (lum <= 0.0) {
			return 0.0;
		}

		// 4. Contrast curve responsiveness: cleanly push shadows toward 0 across normal range
		if (contrast !== 1.0) {
			lum = (lum - 0.5) * contrast + 0.5;
		}

		lum = Math.max(0.0, Math.min(1.0, lum));

		if (invert) {
			lum = 1.0 - lum;
		}

		// 3. Hard visibility cull threshold after contrast (< 0.04)
		if (lum < 0.04) {
			return 0.0;
		}

		return lum;
	}
}
