import Redis from "ioredis";
import { ENV } from "./env";

/**
 * Redis Client — hard dependency.
 * Docker Compose ensures Redis is healthy before the backend starts.
 * Used for: rate limiting, OTP TTL storage, login brute-force counters.
 */
export const redis = new Redis(ENV.REDIS_URL);

redis.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

export async function connectRedis(): Promise<void> {
  // Ping to verify connection on startup
  await redis.ping();
  console.log("[Redis] Ping OK");
}
