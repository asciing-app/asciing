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

export type ControlSchema =
	| SliderControl
	| ColorControl
	| SelectControl
	| ToggleControl
	| TextControl
	| ImageControl;

export type PresetParams = Record<string, string | number | boolean>;
export type RuntimeAssets = Record<string, ImageData | HTMLCanvasElement>;

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
	generatePython?: (params: PresetParams) => string;
}
