import { Router } from "express";
import { AnalyticsController } from "../controllers/analyticsController";
import { authenticateToken, requireRoles } from "../middleware/auth";

const router = Router();

// Analytics dashboard is accessible by Admin and Staff
router.get(
  "/dashboard",
  authenticateToken,
  requireRoles("ADMIN", "STAFF"),
  AnalyticsController.getDashboardMetrics
);

export default router;
