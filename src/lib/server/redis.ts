import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

export function getRedis(): Redis | null {
	if (redisInstance) return redisInstance;

	const env = typeof process !== 'undefined' ? process.env : {};
	const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;

	if (!url || !token) {
		return null;
	}

	redisInstance = new Redis({
		url,
		token
	});

	return redisInstance;
}
