import { Router } from "express";
import { AuthController, registerSchema, loginSchema } from "../controllers/authController";
import { validateBody } from "../middleware/validate";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.post("/register", validateBody(registerSchema), AuthController.register);
router.post("/login", validateBody(loginSchema), AuthController.login);
router.get("/me", authenticateToken, AuthController.getMe);

export default router;
