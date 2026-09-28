import { Router } from "express";
import authRoutes from "./authRoutes";
import complaintRoutes from "./complaintRoutes";
import departmentRoutes from "./departmentRoutes";
import analyticsRoutes from "./analyticsRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/complaints", complaintRoutes);
router.use("/departments", departmentRoutes);
router.use("/analytics", analyticsRoutes);

// Health check endpoint
router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "smart-campus-backend",
  });
});

export default router;
