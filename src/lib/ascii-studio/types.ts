export type MediaKind = 'image' | 'gif' | 'video';
export type ColorMode = 'mono' | 'ansi256' | 'truecolor' | 'green';

export interface AsciiSettings {
	cols: number;
	aspectCorrection: number;
	charset: string;
	colorMode: ColorMode;
	brightness: number;
	contrast: number;
	invert: boolean;
	dither: boolean;
	speed?: number;
}

export interface DecodedMediaFrame {
	bitmap: ImageBitmap;
	delayMs: number;
}

export interface DecodedMediaResult {
	kind: MediaKind;
	frames: DecodedMediaFrame[];
	width: number;
	height: number;
}

export interface AsciiFrameGrid {
	cols: number;
	rows: number;
	delayMs: number;
	lines: string[];
	ansiText: string;
	cells?: Uint8Array;
}
