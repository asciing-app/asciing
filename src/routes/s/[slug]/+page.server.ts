import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { getRedis } from '#lib/server/redis.js';

export const load: PageServerLoad = async ({ params }) => {
	const slug = params.slug;
	if (!slug) {
		throw error(404, 'Shortlink not found');
	}

	const redis = getRedis();
	if (!redis) {
		throw error(503, 'Storage backend not configured');
	}

	const hash = await redis.get<string>(`s:${slug}`);
	if (!hash) {
		throw error(404, 'Shortlink expired or invalid');
	}

	throw redirect(307, `/v#${hash}`);
};
