import express, { Application, Request, Response } from "express";
import cors from "cors";
import { ENV } from "./config/env";
import apiRoutes from "./routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) return callback(null, true);
        if (ENV.CORS_ORIGIN.indexOf(origin) !== -1 || ENV.NODE_ENV === "development") {
          return callback(null, true);
        }
        return callback(new Error("CORS policy violation"), false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Root welcome
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      message: "Smart Campus Complaint Resolution & Intelligence System API",
      version: "1.0.0",
      status: "online",
      endpoints: {
        health: "/api/health",
        auth: "/api/auth",
        complaints: "/api/complaints",
        departments: "/api/departments",
        analytics: "/api/analytics/dashboard",
      },
    });
  });

  // Mount API Routes
  app.use("/api", apiRoutes);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `Resource not found on endpoint ${req.method} ${req.originalUrl}`,
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
