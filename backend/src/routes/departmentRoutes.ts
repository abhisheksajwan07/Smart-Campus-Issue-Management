import { Router } from "express";
import {
  DepartmentController,
  createDepartmentSchema,
} from "../controllers/departmentController";
import { authenticateToken, requireRoles } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();

// Publicly readable or authenticated
router.get("/", DepartmentController.listDepartments);

// Admin only: create department
router.post(
  "/",
  authenticateToken,
  requireRoles("ADMIN"),
  validateBody(createDepartmentSchema),
  DepartmentController.createDepartment
);

export default router;
