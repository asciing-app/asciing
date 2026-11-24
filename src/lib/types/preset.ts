export type SliderControl = {
	key: string;
	label: string;
	type: 'slider';
	min: number;
	max: number;
	step?: number;
	default: number;
};

export type ColorControl = {
	key: string;
	label: string;
	type: 'color';
	default: string;
};

export type SelectControl = {
	key: string;
	label: string;
	type: 'select';
	options: { label: string; value: string }[];
	default: string;
};

export type ToggleControl = {
	key: string;
	label: string;
	type: 'toggle';
	default: boolean;
};

export type TextControl = {
	key: string;
	label: string;
	type: 'text';
	placeholder?: string;
	maxLength?: number;
	default: string;
};

export type ImageControl = {
	key: string;
	label: string;
	type: 'image';
	accept?: string;
};

export type CounterControl = {
	key: string;
	label: string;
	type: 'counter';
	min?: number;
	max?: number;
	step?: number;
	icon?: string;
	default: number;
};

export type ControlSchema =
	| SliderControl
	| ColorControl
	| SelectControl
	| ToggleControl
	| TextControl
	| ImageControl
	| CounterControl;

export type PresetParams = Record<string, string | number | boolean>;
export type RuntimeAssets = Record<string, ImageData | HTMLCanvasElement | HTMLVideoElement | ImageBitmap | unknown>;

export interface WireAssetPayload {
	/** Asset kind: 'img' for single image, 'anim' for animated frame strip */
	t: 'img' | 'anim';
	/** Compact base64 image data URL or strip */
	d: string;
	/** Frame width for strip slicing */
	w?: number;
	/** Frame height for strip slicing */
	h?: number;
	/** Number of frames in strip */
	count?: number;
	/** Frame delays in milliseconds */
	delays?: number[];
}

export interface MountContext {
	canvas: HTMLCanvasElement;
	container: HTMLElement;
	getParams: () => PresetParams;
	getAssets: () => RuntimeAssets;
}

export interface PresetDefinition {
	slug: string;
	title: string;
	description: string;
	tags: string[];
	version: number;
	controls: ControlSchema[];
	mountWeb: (ctx: MountContext) => () => void;
	generatePython?: (params: PresetParams, assets?: RuntimeAssets) => string;
}
