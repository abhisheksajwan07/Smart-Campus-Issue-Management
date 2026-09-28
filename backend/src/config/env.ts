import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/smart_campus",
  JWT_SECRET: process.env.JWT_SECRET || "smart-campus-jwt-default-secret-key-2026",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  FASTAPI_URL: process.env.FASTAPI_URL || "http://localhost:8000",
  FASTAPI_TIMEOUT_MS: parseInt(process.env.FASTAPI_TIMEOUT_MS || "5000", 10),
  USE_MOCK_AI: process.env.USE_MOCK_AI === "true",
  CORS_ORIGIN: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000").split(","),
};
