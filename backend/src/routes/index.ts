import { Router } from "express";
import authRoutes from "./authRoutes";
import complaintRoutes from "./complaintRoutes";
import departmentRoutes from "./departmentRoutes";
import analyticsRoutes from "./analyticsRoutes";
import adminRoutes from "./adminRoutes";
import uploadRoutes from "./uploadRoutes";
import { generalLimiter } from "../middleware/rateLimiter";

const router = Router();

// Baseline rate limiter for all API routes (100 req / 15 min per IP)
router.use(generalLimiter);

router.use("/auth", authRoutes);
router.use("/complaints", complaintRoutes);
router.use("/departments", departmentRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/admin", adminRoutes);
router.use("/upload", uploadRoutes);

// Health check endpoint
router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "smart-campus-backend",
  });
});

export default router;
