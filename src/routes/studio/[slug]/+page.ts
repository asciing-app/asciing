import { error } from '@sveltejs/kit';
import { getAllSlugs, getPresetBySlug } from '#lib/presets/registry.js';
import type { EntryGenerator, PageLoad } from './$types.js';

export const prerender = true;

export const entries: EntryGenerator = () => {
	return getAllSlugs().map((slug: string) => ({ slug }));
};

export const load: PageLoad = ({ params }) => {
	const preset = getPresetBySlug(params.slug);
	if (!preset) {
		throw error(404, `Preset "${params.slug}" not found`);
	}
	return {
		preset
	};
};
