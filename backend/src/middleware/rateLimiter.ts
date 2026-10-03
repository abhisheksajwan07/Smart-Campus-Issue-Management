import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redis } from "../config/redis";

/**
 * Creates a rate limiter backed by Redis.
 * Redis is a hard dependency — guaranteed up by Docker health check.
 */
function createLimiter(opts: {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix: string;
}) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: opts.message },
    store: new RedisStore({
      // @ts-expect-error - ioredis is compatible but types differ slightly
      sendCommand: (...args: string[]) => redis.call(...args),
      prefix: `rl:${opts.keyPrefix}:`,
    }),
  });
}

// -------------------------------------------------------------
// RATE LIMITER TIERS (strictest → most lenient)
// -------------------------------------------------------------

/**
 * AUTH — Login & Registration
 * Strict: 10 attempts per 15 minutes per IP.
 * Prevents credential stuffing and brute-force attacks.
 */
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many authentication attempts. Please try again after 15 minutes.",
  keyPrefix: "auth",
});

/**
 * OTP — Enrollment Verification
 * Very strict: 5 attempts per 15 minutes per IP.
 * Prevents OTP brute-force on enrollment verification.
 */
export const otpLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many OTP requests. Please wait 15 minutes before trying again.",
  keyPrefix: "otp",
});

/**
 * COMPLAINT CREATION — Submit new complaints
 * Moderate: 20 complaints per hour per IP.
 * Prevents spam complaint flooding.
 */
export const complaintCreateLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: "Complaint submission rate exceeded. Please try again later.",
  keyPrefix: "complaint-create",
});

/**
 * FILE UPLOAD — Image uploads
 * Moderate: 30 uploads per hour per IP.
 */
export const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Upload rate exceeded. Please try again later.",
  keyPrefix: "upload",
});

/**
 * GENERAL API — All other routes
 * Lenient: 100 requests per 15 minutes per IP.
 * Baseline protection against runaway clients.
 */
export const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests. Please slow down.",
  keyPrefix: "general",
});
