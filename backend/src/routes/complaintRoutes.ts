import { Router } from "express";
import {
  ComplaintController,
  createComplaintSchema,
  updateStatusSchema,
  overrideAiSchema,
} from "../controllers/complaintController";
import { authenticateToken, requireRoles } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { complaintCreateLimiter } from "../middleware/rateLimiter";

const router = Router();

// All complaint endpoints require authentication
router.use(authenticateToken);

// 1. Submit complaint (Student, Staff, or Admin) — rate limited
router.post("/", complaintCreateLimiter, validateBody(createComplaintSchema), ComplaintController.createComplaint);

// 2. Real-Time Server-Sent Events (SSE) Stream
router.get("/stream", ComplaintController.streamEvents);

// 3. List complaints (scoped by role & query filters)
router.get("/", ComplaintController.getComplaints);

// 4. Get single complaint with full details, AI logs, and similarity matches
router.get("/:id", ComplaintController.getComplaintById);

// 4. Update complaint status (Staff & Admin)
router.patch(
  "/:id/status",
  requireRoles("ADMIN", "STAFF"),
  validateBody(updateStatusSchema),
  ComplaintController.updateStatus
);

// 5. HUMAN-IN-THE-LOOP OVERRIDE (Admin & Staff)
router.patch(
  "/:id/override",
  requireRoles("ADMIN", "STAFF"),
  validateBody(overrideAiSchema),
  ComplaintController.overrideAi
);

export default router;
