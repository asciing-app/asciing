import type { PresetDefinition } from '../../types/preset.js';
import { mountWeb } from './web.js';
import { generatePython } from './python.js';

export const makeYourOwnPreset: PresetDefinition = {
	slug: 'make-your-own',
	title: 'Make Your Own',
	description:
		'100% client-side media to ASCII studio. Convert photos, animated GIFs, or videos with Floyd-Steinberg dithering, truecolor palettes, and zero-dependency terminal Python exports.',
	tags: ['Studio', 'Custom Media', 'Video to ASCII', 'Floyd-Steinberg', 'Python Export'],
	version: 1,
	controls: [
		{
			key: 'image',
			label: 'Upload Media (Image / GIF / Video)',
			type: 'image',
			accept: 'image/*,video/*'
		},
		{
			key: 'speed',
			label: 'Playback Speed',
			type: 'slider',
			min: 0.1,
			max: 3.0,
			step: 0.1,
			default: 1.0
		},
		{
			key: 'cols',
			label: 'Width (Columns)',
			type: 'slider',
			min: 40,
			max: 180,
			step: 2,
			default: 90
		},
		{
			key: 'fontSize',
			label: 'Font Size (px)',
			type: 'slider',
			min: 8,
			max: 22,
			step: 1,
			default: 11
		},
		{
			key: 'charset',
			label: 'Character Ramp',
			type: 'select',
			options: [
				{ label: 'Standard ( .:-=+*#%@)', value: 'standard' },
				{ label: 'Blocks ( ░▒▓█)', value: 'blocks' },
				{ label: 'Minimal ( .oO@)', value: 'minimal' },
				{ label: 'Binary ( 01)', value: 'binary' },
				{ label: 'Detailed 70-Glyph', value: 'detailed' }
			],
			default: 'standard'
		},
		{
			key: 'customCharset',
			label: 'Custom Charset (Overrides Ramp)',
			type: 'text',
			placeholder: 'e.g. .:-=+*#%@',
			maxLength: 120,
			default: ''
		},
		{
			key: 'colorMode',
			label: 'Color Mode',
			type: 'select',
			options: [
				{ label: 'Full Truecolor (24-bit RGB)', value: 'truecolor' },
				{ label: 'ANSI 256 Colors', value: 'ansi256' },
				{ label: 'Monochrome (Retro Green)', value: 'green' },
				{ label: 'Monochrome (Pure White)', value: 'mono' }
			],
			default: 'truecolor'
		},
		{
			key: 'brightness',
			label: 'Brightness',
			type: 'slider',
			min: -100,
			max: 100,
			step: 5,
			default: 0
		},
		{
			key: 'contrast',
			label: 'Contrast',
			type: 'slider',
			min: -100,
			max: 100,
			step: 5,
			default: 0
		},
		{
			key: 'dither',
			label: 'Floyd-Steinberg Dithering',
			type: 'toggle',
			default: false
		},
		{
			key: 'invert',
			label: 'Invert Luminance',
			type: 'toggle',
			default: false
		}
	],
	mountWeb,
	generatePython
};
