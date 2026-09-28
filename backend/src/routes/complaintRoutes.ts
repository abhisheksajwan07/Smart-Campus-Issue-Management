import { Router } from "express";
import {
  ComplaintController,
  createComplaintSchema,
  updateStatusSchema,
  overrideAiSchema,
} from "../controllers/complaintController";
import { authenticateToken, requireRoles } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();

// All complaint endpoints require authentication
router.use(authenticateToken);

// 1. Submit complaint (Student, Staff, or Admin)
router.post("/", validateBody(createComplaintSchema), ComplaintController.createComplaint);

// 2. List complaints (scoped by role & query filters)
router.get("/", ComplaintController.getComplaints);

// 3. Get single complaint with full details, AI logs, and similarity matches
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
