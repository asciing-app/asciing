import type { PresetDefinition } from '../types/preset.js';
import { asciiPlasmaPreset } from './ascii-plasma/index.js';
import { typographySpiralPreset } from './typography-spiral/index.js';
import { torusFieldPreset } from './torus-field/index.js';
import { makeYourOwnPreset } from './make-your-own/index.js';

export const PRESETS: PresetDefinition[] = [
	asciiPlasmaPreset,
	typographySpiralPreset,
	torusFieldPreset,
	makeYourOwnPreset
];

export function getPresetBySlug(slug: string): PresetDefinition | undefined {
	return PRESETS.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
	return PRESETS.map((p) => p.slug);
}
