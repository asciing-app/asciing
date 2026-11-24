import type { PresetDefinition } from '../../types/preset.js';
import { mountWeb } from './web.js';
import { generatePython } from './python.js';

export const bloomingBouquetPreset: PresetDefinition = {
	slug: 'blooming-bouquet',
	title: 'Blooming Bouquet',
	description:
		'Generative ASCII bouquet studio. Add and subtract your favorite flowers (Lilies, Roses, Tulips, Daisies, Orchids) with compact button counters, blooming with thick filled stems and dense cross-stitch petals.',
	tags: ['2D', 'Procedural', 'Organic', 'Flowers', 'Animation', 'Cross-Stitch'],
	version: 1,
	controls: [
		{
			key: 'lilies',
			label: 'Lilies',
			icon: '🌺',
			type: 'counter',
			min: 0,
			max: 12,
			default: 5
		},
		{
			key: 'roses',
			label: 'Roses',
			icon: '🌹',
			type: 'counter',
			min: 0,
			max: 12,
			default: 2
		},
		{
			key: 'tulips',
			label: 'Tulips',
			icon: '🌷',
			type: 'counter',
			min: 0,
			max: 12,
			default: 1
		},
		{
			key: 'daisies',
			label: 'Daisies',
			icon: '🌼',
			type: 'counter',
			min: 0,
			max: 12,
			default: 0
		},
		{
			key: 'orchids',
			label: 'Orchids',
			icon: '🌸',
			type: 'counter',
			min: 0,
			max: 12,
			default: 0
		},
		{
			key: 'colorPalette',
			label: 'Color Palette',
			type: 'select',
			options: [
				{ label: 'Vibrant Sunset (Red, Pink, Yellow, Orange)', value: 'sunset' },
				{ label: 'Romantic Pastel Pink', value: 'pink-romance' },
				{ label: 'Golden Meadow (Yellow & Amber)', value: 'golden-meadow' },
				{ label: 'Passion Crimson Velvet', value: 'passion-red' },
				{ label: 'Cyberpunk Neon Glow', value: 'cyber-neon' },
				{ label: 'Vintage Botanical Garden', value: 'vintage-garden' }
			],
			default: 'sunset'
		},
		{
			key: 'bloomSpeed',
			label: 'Bloom Animation Speed',
			type: 'slider',
			min: 0.3,
			max: 2.5,
			step: 0.1,
			default: 1.0
		},
		{
			key: 'charRamp',
			label: 'Character Ramp',
			type: 'select',
			options: [
				{ label: 'Standard Cross-Stitch ( .:-=+*#%@)', value: 'standard' },
				{ label: 'Detailed Micro Ramp ( `.-":;!+*?%S#@$)', value: 'detailed' },
				{ label: 'Floral Botanica ( .·:;*✿❀❁#@)', value: 'floral' },
				{ label: 'Minimal Clean ( .·:*#)', value: 'minimal' },
				{ label: 'Dense Braille / Matrix ( ⠂⠅⠖⠦⠯⠿)', value: 'braille' },
				{ label: 'Custom Charset (Use Text Field Below)', value: 'custom' }
			],
			default: 'standard'
		},
		{
			key: 'customCharset',
			label: 'Custom Charset (Darkest to Brightest)',
			type: 'text',
			placeholder: ' .:-=+*#%@',
			maxLength: 64,
			default: ' .:-=+*#%@'
		},
		{
			key: 'fontSize',
			label: 'ASCII Detail Density (px)',
			type: 'slider',
			min: 6,
			max: 11,
			step: 0.5,
			default: 7.2
		},
		{
			key: 'wrappingPaper',
			label: 'Wrapping Paper & Ribbon',
			type: 'toggle',
			default: true
		},
		{
			key: 'sparkles',
			label: 'Sparkling Ambient Particles',
			type: 'toggle',
			default: true
		},
		{
			key: 'butterflies',
			label: 'Animated Butterflies',
			type: 'slider',
			min: 0,
			max: 4,
			step: 1,
			default: 2
		},
		{
			key: 'holdDuration',
			label: 'Stay in Full Bloom (Seconds)',
			type: 'slider',
			min: 5,
			max: 60,
			step: 5,
			default: 20
		},
		{
			key: 'overlayText',
			label: 'Overlay Message',
			type: 'text',
			placeholder: 'Who needs flowers when you can code them?',
			maxLength: 80,
			default: 'Who needs flowers when you can code them?'
		}
	],
	mountWeb,
	generatePython
};
