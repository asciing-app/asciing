import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getRedis } from '#lib/server/redis.js';

function generateRandomSlug(len = 6): string {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let res = '';
	for (let i = 0; i < len; i++) {
		res += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return res;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { hash } = (await request.json()) as { hash?: string };
		if (!hash || typeof hash !== 'string') {
			return json({ error: 'Missing or invalid hash' }, { status: 400 });
		}

		const redis = getRedis();
		if (!redis) {
			return json({ error: 'Storage backend not configured' }, { status: 503 });
		}

		const slug = generateRandomSlug(6);
		// 90 days expiration (7,776,000 seconds)
		await redis.set(`s:${slug}`, hash, { ex: 7776000 });

		return json({ slug, path: `/s/${slug}` });
	} catch (err) {
		console.error('Error creating shortlink:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
