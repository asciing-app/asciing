import type { PresetDefinition } from '../../types/preset.js';
import { mountWeb } from './web.js';
import { generatePython } from './python.js';

export const asciiPlasmaPreset: PresetDefinition = {
	slug: 'ascii-plasma',
	title: 'ASCII Plasma',
	description: 'Fluid trigonometric wave interference shader mapped to customizable ASCII character densities.',
	tags: ['2D', 'Shader', 'Plasma', 'Terminal Export'],
	version: 1,
	controls: [
		{
			key: 'speed',
			label: 'Animation Speed',
			type: 'slider',
			min: 0.1,
			max: 3.0,
			step: 0.1,
			default: 1.0
		},
		{
			key: 'scale',
			label: 'Wave Frequency',
			type: 'slider',
			min: 0.5,
			max: 6.0,
			step: 0.1,
			default: 2.5
		},
		{
			key: 'fontSize',
			label: 'Cell Size (px)',
			type: 'slider',
			min: 8,
			max: 28,
			step: 1,
			default: 13
		},
		{
			key: 'charSet',
			label: 'Character Density',
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
			key: 'colorMode',
			label: 'Color Palette',
			type: 'select',
			options: [
				{ label: 'Cyan / Magenta Glow', value: 'cyan-magenta' },
				{ label: 'Green Phosphor (VT100)', value: 'green-phosphor' },
				{ label: 'Amber CRT', value: 'amber-crt' },
				{ label: 'Fire Thermal', value: 'fire' },
				{ label: 'Monochrome Silver', value: 'monochrome' }
			],
			default: 'cyan-magenta'
		}
	],
	mountWeb,
	generatePython
};
