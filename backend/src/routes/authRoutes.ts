import { Router } from "express";
import {
  AuthController,
  registerSchema,
  loginSchema,
  verifyEnrollmentSchema,
  resendOtpSchema,
  registerStudentSchema,
  refreshTokenSchema,
  updateProfileSchema,
} from "../controllers/authController";
import { validateBody } from "../middleware/validate";
import { authenticateToken } from "../middleware/auth";
import { authLimiter, otpLimiter } from "../middleware/rateLimiter";

const router = Router();

// GBU Student Enrollment & OTP Flow (strict rate limiting)
router.post(
  "/verify-enrollment",
  otpLimiter,
  validateBody(verifyEnrollmentSchema),
  AuthController.verifyEnrollment,
);

router.post(
  "/resend-otp",
  otpLimiter,
  validateBody(resendOtpSchema),
  AuthController.resendOtp,
);

router.post(
  "/register-student",
  otpLimiter,
  validateBody(registerStudentSchema),
  AuthController.registerStudent,
);

// Standard Authentication Routes
router.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  AuthController.register,
);

router.post(
  "/login",
  authLimiter,
  validateBody(loginSchema),
  AuthController.login,
);

router.post(
  "/refresh-token",
  validateBody(refreshTokenSchema),
  AuthController.refreshToken,
);

router.post(
  "/logout",
  authenticateToken,
  AuthController.logout,
);

router.get("/me", authenticateToken, AuthController.getMe);
router.patch("/me", authenticateToken, validateBody(updateProfileSchema), AuthController.updateMe);

export default router;
