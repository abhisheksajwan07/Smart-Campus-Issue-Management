import dotenv from "dotenv";
import path from "path";

// Prioritize .env.local if present, fallback to .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const ENV = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/smart_campus",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  
  // Double Token JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || "smart-campus-jwt-default-secret-key-2026",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "smart-campus-jwt-access-secret-2026",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "smart-campus-jwt-refresh-secret-2026",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // Resend Email Service Configuration
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  EMAIL_FROM: process.env.EMAIL_FROM || "Smart Campus <onboarding@resend.dev>",

  FASTAPI_URL: process.env.FASTAPI_URL || "http://localhost:8000",
  FASTAPI_TIMEOUT_MS: parseInt(process.env.FASTAPI_TIMEOUT_MS || "5000", 10),
  USE_MOCK_AI: process.env.USE_MOCK_AI === "true",
  // Allowed CORS Origins & Cookie Configuration
  CORS_ORIGIN: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000").split(","),
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  COOKIE_SAMESITE: (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none") || "lax",
};
