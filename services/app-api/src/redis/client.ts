import dotenv from "dotenv";
import Redis from "ioredis";

dotenv.config();

let redis: Redis | null = null;

export function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 3
    });
  }

  return redis;
}
