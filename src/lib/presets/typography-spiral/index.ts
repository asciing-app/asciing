import type { PresetDefinition } from '../../types/preset.js';
import { mountWeb } from './web.js';

export const typographySpiralPreset: PresetDefinition = {
	slug: 'typography-spiral',
	title: 'Typography Spiral',
	description:
		'Constant arc-length Archimedean spiral orbiting stationary halftone portraiture with cached bilinear luminance sampling.',
	tags: ['2D', 'Typography', 'Image Halftone', 'Archimedean Spiral', 'Client Privacy'],
	version: 2,
	controls: [
		{
			key: 'image',
			label: 'Local Portrait Upload',
			type: 'image',
			accept: 'image/*'
		},
		{
			key: 'text',
			label: 'Spiral Phrase',
			type: 'text',
			placeholder: 'ENTER TEXT HERE...',
			maxLength: 160,
			default: 'ASCIING // ARCHIMEDEAN SPIRAL // '
		},
		{
			key: 'mode',
			label: 'Render Mode',
			type: 'select',
			options: [
				{ label: 'Flowing Text', value: 'flowing' },
				{ label: 'ASCII Halftone', value: 'halftone' }
			],
			default: 'flowing'
		},
		{
			key: 'ringSpacing',
			label: 'Ring Spacing (px)',
			type: 'slider',
			min: 10,
			max: 32,
			step: 1,
			default: 16
		},
		{
			key: 'speed',
			label: 'Orbit Speed',
			type: 'slider',
			min: 0.0,
			max: 1.2,
			step: 0.05,
			default: 0.15
		},
		{
			key: 'contrast',
			label: 'Contrast',
			type: 'slider',
			min: 0.5,
			max: 2.5,
			step: 0.05,
			default: 1.25
		},
		{
			key: 'invert',
			label: 'Invert Luminance',
			type: 'toggle',
			default: false
		},
		{
			key: 'textColor',
			label: 'Text Color',
			type: 'color',
			default: '#fafafa'
		},
		{
			key: 'bgColor',
			label: 'Background Color',
			type: 'color',
			default: '#09090b'
		}
	],
	mountWeb
};
