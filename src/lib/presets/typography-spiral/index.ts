import type { PresetDefinition } from '../../types/preset.js';
import { mountWeb } from './web.js';

export const typographySpiralPreset: PresetDefinition = {
	slug: 'typography-spiral',
	title: 'Typography Spiral',
	description:
		'Client-side luminance sampling mapped to Archimedean spiral typography. Upload an image locally for real-time ASCII halftone portraiture.',
	tags: ['2D', 'Typography', 'Image Halftone', 'Client Privacy'],
	version: 1,
	controls: [
		{
			key: 'image',
			label: 'Custom Image (Client Only)',
			type: 'image',
			accept: 'image/*'
		},
		{
			key: 'text',
			label: 'Spiral Phrase',
			type: 'text',
			placeholder: 'ENTER TEXT HERE...',
			maxLength: 80,
			default: 'ASCIING APP CREATIVE STUDIO ZERO BACKEND PRIVACY FIRST '
		},
		{
			key: 'fontSize',
			label: 'Base Font Size (px)',
			type: 'slider',
			min: 9,
			max: 28,
			step: 1,
			default: 14
		},
		{
			key: 'spiralDensity',
			label: 'Spiral Gap (px)',
			type: 'slider',
			min: 10,
			max: 36,
			step: 1,
			default: 18
		},
		{
			key: 'speed',
			label: 'Rotation Speed',
			type: 'slider',
			min: -2.0,
			max: 2.0,
			step: 0.1,
			default: 0.4
		},
		{
			key: 'textColor',
			label: 'Glyph Color',
			type: 'color',
			default: '#38bdf8'
		},
		{
			key: 'invert',
			label: 'Invert Luminance',
			type: 'toggle',
			default: false
		}
	],
	mountWeb
};
