import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config();

let redis: Redis | null = null;

export function getRedis() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null
    });
  }

  return redis;
}
