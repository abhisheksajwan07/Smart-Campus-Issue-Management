import { redis } from "../config/redis";

const LOGIN_ATTEMPT_PREFIX = "login_attempts:";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15-minute lockout after max failures

/**
 * Login Brute-Force Protection — tracks failed login attempts per email in Redis.
 * After 5 consecutive failures, the account is locked for 15 minutes.
 * Successful login resets the counter.
 */
export class LoginGuardService {
  /** Check if the account is currently locked out. */
  static async checkLockout(email: string): Promise<{
    locked: boolean;
    remainingSeconds: number;
    attempts: number;
  }> {
    const key = `${LOGIN_ATTEMPT_PREFIX}${email.toLowerCase()}`;
    const attempts = parseInt((await redis.get(key)) || "0", 10);
    const ttl = await redis.ttl(key);

    return {
      locked: attempts >= MAX_FAILED_ATTEMPTS,
      remainingSeconds: ttl > 0 ? ttl : 0,
      attempts,
    };
  }

  /** Record a failed login attempt. Returns the updated attempt count. */
  static async recordFailedAttempt(email: string): Promise<number> {
    const key = `${LOGIN_ATTEMPT_PREFIX}${email.toLowerCase()}`;
    const attempts = await redis.incr(key);

    // Set TTL on first failure or when hitting the lockout threshold
    if (attempts === 1 || attempts === MAX_FAILED_ATTEMPTS) {
      await redis.expire(key, LOCKOUT_SECONDS);
    }

    return attempts;
  }

  /** Reset failed attempts on successful login. */
  static async resetAttempts(email: string): Promise<void> {
    await redis.del(`${LOGIN_ATTEMPT_PREFIX}${email.toLowerCase()}`);
  }

  static get maxAttempts(): number {
    return MAX_FAILED_ATTEMPTS;
  }
}

