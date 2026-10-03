import { Router } from "express";
import { RosterController, bulkRosterSchema } from "../controllers/rosterController";
import { authenticateToken, requireRoles } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();

// All admin routes require ADMIN role
router.use(authenticateToken, requireRoles("ADMIN"));

// Bulk upload / import student roster
router.post(
  "/roster/bulk-upload",
  validateBody(bulkRosterSchema),
  RosterController.bulkUploadRoster
);

// List student roster entries
router.get("/roster", RosterController.listRoster);

export default router;
