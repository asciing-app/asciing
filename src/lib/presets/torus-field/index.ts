import type { PresetDefinition } from '../../types/preset.js';
import { mountWeb } from './web.js';
import { generatePython } from './python.js';

export const torusFieldPreset: PresetDefinition = {
	slug: 'torus-field',
	title: '3D Torus Field',
	description:
		'Real-time 3D donut ray projection with z-buffering and specular surface normal illumination mapped to ASCII glyphs.',
	tags: ['3D', 'Ray Projection', 'Geometry', 'Terminal Export'],
	version: 1,
	controls: [
		{
			key: 'speedX',
			label: 'Pitch Rotation Speed',
			type: 'slider',
			min: -2.0,
			max: 2.0,
			step: 0.1,
			default: 0.8
		},
		{
			key: 'speedY',
			label: 'Yaw Rotation Speed',
			type: 'slider',
			min: -2.0,
			max: 2.0,
			step: 0.1,
			default: 0.5
		},
		{
			key: 'innerRadius',
			label: 'Tube Radius (R1)',
			type: 'slider',
			min: 0.4,
			max: 2.0,
			step: 0.1,
			default: 1.0
		},
		{
			key: 'outerRadius',
			label: 'Ring Radius (R2)',
			type: 'slider',
			min: 1.2,
			max: 4.0,
			step: 0.1,
			default: 2.0
		},
		{
			key: 'fontSize',
			label: 'Grid Cell Size (px)',
			type: 'slider',
			min: 9,
			max: 24,
			step: 1,
			default: 13
		},
		{
			key: 'colorMode',
			label: 'Color Palette',
			type: 'select',
			options: [
				{ label: 'Emerald Phosphor', value: 'emerald' },
				{ label: 'Amber Vintage CRT', value: 'amber' },
				{ label: 'Electric Blue', value: 'electric-blue' },
				{ label: 'Monochrome White', value: 'monochrome' }
			],
			default: 'emerald'
		}
	],
	mountWeb,
	generatePython
};
