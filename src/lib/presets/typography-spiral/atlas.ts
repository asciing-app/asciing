export const ATLAS_CELL_SIZE = 64;
export const ATLAS_FONT_SIZE = 52;
export const ASCII_RAMP = ' .:-=+*#%@';

export interface GlyphSprite {
	sx: number;
	sy: number;
	char: string;
}

export class GlyphAtlas {
	private lastKey = '';
	private offscreenCanvas: HTMLCanvasElement | null = null;
	private sprites: GlyphSprite[] = [];
	private phraseIndices: Uint16Array = new Uint16Array(0);
	private halftoneIndices: Uint16Array = new Uint16Array(0);

	public getAtlas(
		phrase: string,
		mode: string,
		textColor: string
	): {
		canvas: HTMLCanvasElement;
		sprites: GlyphSprite[];
		phraseIndices: Uint16Array;
		halftoneIndices: Uint16Array;
	} | null {
		const safePhrase = phrase.length > 0 ? phrase : ' ';
		const key = `${safePhrase}_${mode}_${textColor}`;

		if (key === this.lastKey && this.offscreenCanvas) {
			return {
				canvas: this.offscreenCanvas,
				sprites: this.sprites,
				phraseIndices: this.phraseIndices,
				halftoneIndices: this.halftoneIndices
			};
		}

		if (typeof document === 'undefined') return null;

		this.lastKey = key;

		// Determine full set of characters to bake into the atlas
		const charSet = new Set<string>();

		if (mode === 'halftone') {
			for (const ch of ASCII_RAMP) {
				charSet.add(ch);
			}
		} else {
			for (const ch of safePhrase) {
				charSet.add(ch);
			}
		}

		const uniqueChars = Array.from(charSet);
		const count = Math.max(1, uniqueChars.length);

		const cols = Math.ceil(Math.sqrt(count));
		const rows = Math.ceil(count / cols);

		const atlasW = cols * ATLAS_CELL_SIZE;
		const atlasH = rows * ATLAS_CELL_SIZE;

		if (typeof document === 'undefined') return null;

		if (!this.offscreenCanvas) {
			this.offscreenCanvas = document.createElement('canvas');
		}
		this.offscreenCanvas.width = atlasW;
		this.offscreenCanvas.height = atlasH;

		const ctx = this.offscreenCanvas.getContext('2d');
		if (!ctx) return null;

		ctx.clearRect(0, 0, atlasW, atlasH);
		ctx.font = '700 52px "JetBrains Mono", "Geist Mono", monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = textColor;

		this.sprites = [];
		const charToIndexMap = new Map<string, number>();

		const half = ATLAS_CELL_SIZE / 2;

		for (let i = 0; i < uniqueChars.length; i++) {
			const ch = uniqueChars[i];
			const col = i % cols;
			const row = Math.floor(i / cols);
			const sx = col * ATLAS_CELL_SIZE;
			const sy = row * ATLAS_CELL_SIZE;

			if (ch !== ' ') {
				ctx.fillText(ch, sx + half, sy + half);
			}

			const sprite: GlyphSprite = { sx, sy, char: ch };
			this.sprites.push(sprite);
			charToIndexMap.set(ch, i);
		}

		// Precompute phrase indices for flowing mode
		this.phraseIndices = new Uint16Array(safePhrase.length);
		for (let i = 0; i < safePhrase.length; i++) {
			const ch = safePhrase[i];
			this.phraseIndices[i] = charToIndexMap.get(ch) ?? 0;
		}

		// Precompute ASCII halftone ramp indices
		this.halftoneIndices = new Uint16Array(ASCII_RAMP.length);
		for (let i = 0; i < ASCII_RAMP.length; i++) {
			const ch = ASCII_RAMP[i];
			this.halftoneIndices[i] = charToIndexMap.get(ch) ?? 0;
		}

		return {
			canvas: this.offscreenCanvas,
			sprites: this.sprites,
			phraseIndices: this.phraseIndices,
			halftoneIndices: this.halftoneIndices
		};
	}
}
