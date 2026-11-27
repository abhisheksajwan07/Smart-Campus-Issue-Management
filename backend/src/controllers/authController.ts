import { Request, Response, CookieOptions } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../config/database";
import { redis } from "../config/redis";
import { users, gbuStudentRoster } from "../db/schema";
import { eq } from "drizzle-orm";
import { ENV } from "../config/env";
import { AuthenticatedRequest, TokenPayload, UserRole } from "../types";
import { OtpService } from "../services/otpService";
import { LoginGuardService } from "../services/loginGuardService";
import { EmailService } from "../services/emailService";

export const verifyEnrollmentSchema = z.object({
  enrollmentNo: z.string().min(3, "Enrollment number is required (e.g. 22/ICS/045)"),
});

export const resendOtpSchema = z.object({
  enrollmentNo: z.string().min(3, "Enrollment number is required (e.g. 22/ICS/045)"),
});

export const registerStudentSchema = z.object({
  enrollmentNo: z.string().min(3, "Enrollment number is required"),
  otp: z.string().min(4, "Verification OTP is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["STUDENT", "ADMIN", "STAFF"]).optional().default("STUDENT"),
  departmentId: z.string().uuid().optional().nullable(),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});

export const updateProfileSchema = z.object({
  phone: z.string().trim().max(32, "Phone number is too long").optional().nullable(),
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
});

function parseDurationMs(expr: string, fallbackMs: number): number {
  const m = String(expr || "").trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = unit === "s" ? 1000 : unit === "m" ? 60000 : unit === "h" ? 3600000 : 86400000;
  return n * mult;
}

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const visible = name.slice(0, 2);
  return `${visible}****@${domain}`;
}

export class AuthController {
  /**
   * Helper to build consistent cookie configuration across set and clear operations
   */
  private static getCookieBaseOptions(): CookieOptions {
    const isProd = ENV.NODE_ENV === "production";
    const sameSiteMode: "none" | "lax" | "strict" = (ENV.COOKIE_SAMESITE as any) || "lax";
    const secureCookie =
      sameSiteMode === "none"
        ? true
        : ENV.COOKIE_SECURE !== undefined
        ? ENV.COOKIE_SECURE === "true"
        : isProd;

    return {
      httpOnly: true,
      // Browsers mandate secure: true whenever sameSite is 'none'
      secure: secureCookie,
      sameSite: sameSiteMode,
      domain: ENV.COOKIE_DOMAIN || undefined,
      path: "/",
    };
  }

  /**
   * Secure Cookie Architecture:
   * Sets httpOnly cookies on the response, keeping tokens safe from XSS attacks.
   * Access Token cookie expires in 15 minutes (matching JWT_ACCESS_EXPIRES_IN).
   * Refresh Token cookie expires in 7 days (matching JWT_REFRESH_EXPIRES_IN).
   */
  public static setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken?: string }): void {
    const baseOptions = AuthController.getCookieBaseOptions();

    // Set primary access token cookie (httpOnly) matching JWT_ACCESS_EXPIRES_IN
    res.cookie("token", tokens.accessToken, {
      ...baseOptions,
      maxAge: parseDurationMs(ENV.JWT_ACCESS_EXPIRES_IN, 2 * 60 * 60 * 1000),
    });

    if (tokens.refreshToken) {
      // Set long-lived refresh token cookie (httpOnly) matching JWT_REFRESH_EXPIRES_IN
      res.cookie("refreshToken", tokens.refreshToken, {
        ...baseOptions,
        maxAge: parseDurationMs(ENV.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000),
      });
    }
  }

  /**
   * Clears auth cookies on logout with matching domain/path settings
   */
  public static clearAuthCookies(res: Response): void {
    const baseOptions = AuthController.getCookieBaseOptions();
    const clearOptions: CookieOptions = {
      ...baseOptions,
      expires: new Date(0),
    };

    res.cookie("token", "", clearOptions);
    res.cookie("refreshToken", "", clearOptions);
    res.clearCookie("token", baseOptions);
    res.clearCookie("refreshToken", baseOptions);
  }

  /**
   * Generates short-lived Access Token (15m) and long-lived Refresh Token (7d).
   * Persists the active Refresh Token in Redis for session verification.
   */
  public static async issueTokens(payload: TokenPayload): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = jwt.sign(payload, ENV.JWT_ACCESS_SECRET, {
      expiresIn: ENV.JWT_ACCESS_EXPIRES_IN as any,
    });

    const refreshToken = jwt.sign(
      { userId: payload.userId, tokenType: "refresh" },
      ENV.JWT_REFRESH_SECRET,
      { expiresIn: ENV.JWT_REFRESH_EXPIRES_IN as any }
    );

    // Store active refresh token in Redis (7 days TTL)
    await redis.setex(`rt:${payload.userId}`, 7 * 86400, refreshToken);

    return { accessToken, refreshToken };
  }

  /**
   * STEP 1: 
   * Student enters enrollment number (e.g., 22/ICS/045).
   * Backend verifies against gbu_student_roster and dispatches verification OTP via Resend.
   */
  static async verifyEnrollment(req: Request, res: Response): Promise<void> {
    try {
      const enrollmentNo = (req.body.enrollmentNo || "").trim().toUpperCase();

      const [rosterRecord] = await db
        .select()
        .from(gbuStudentRoster)
        .where(eq(gbuStudentRoster.enrollmentNo, enrollmentNo))
        .limit(1);

      if (!rosterRecord) {
        res.status(404).json({
          success: false,
          message: `Enrollment number "${enrollmentNo}" not found in GBU CSMS registry. Please contact registrar/ERP cell.`,
        });
        return;
      }

      if (rosterRecord.isClaimed) {
        res.status(400).json({
          success: false,
          message: `An account for enrollment "${enrollmentNo}" is already activated. Please proceed to login.`,
        });
        return;
      }

      // Check 60-second cooldown in Redis
      const cooldownRemaining = await OtpService.getCooldownSeconds(enrollmentNo);
      if (cooldownRemaining > 0) {
        res.status(429).json({
          success: false,
          message: `Please wait ${cooldownRemaining} second(s) before requesting another OTP.`,
          cooldownRemaining,
        });
        return;
      }

      // Generate a 6-digit verification OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP in Redis (15m TTL) and activate 60s cooldown
      await OtpService.storeOtp(enrollmentNo, otp);
      await OtpService.setCooldown(enrollmentNo);

      // Dispatch real email via Resend (with graceful terminal fallback if key not configured)
      await EmailService.sendOtpEmail(
        rosterRecord.registeredEmail,
        otp,
        rosterRecord.fullName,
        rosterRecord.enrollmentNo
      );

      res.status(200).json({
        success: true,
        message: `Student identified: ${rosterRecord.fullName}. Verification OTP dispatched to registered email.`,
        data: {
          enrollmentNo: rosterRecord.enrollmentNo,
          fullName: rosterRecord.fullName,
          school: rosterRecord.school,
          program: rosterRecord.program,
          hostelBlock: rosterRecord.hostelBlock,
          roomNo: rosterRecord.roomNo,
          maskedEmail: maskEmail(rosterRecord.registeredEmail),
          cooldownSeconds: 60,
          // In development mode, return devOtp so local testing never stalls
          devOtp: ENV.NODE_ENV === "development" ? otp : undefined,
        },
      });
    } catch (err) {
      console.error("Verify enrollment error:", err);
      res.status(500).json({ success: false, message: "Failed to verify enrollment number" });
    }
  }

  /**
   * Resend Verification OTP with 60-second Redis cooldown
   */
  static async resendOtp(req: Request, res: Response): Promise<void> {
    try {
      const enrollmentNo = (req.body.enrollmentNo || "").trim().toUpperCase();

      const [rosterRecord] = await db
        .select()
        .from(gbuStudentRoster)
        .where(eq(gbuStudentRoster.enrollmentNo, enrollmentNo))
        .limit(1);

      if (!rosterRecord) {
        res.status(404).json({
          success: false,
          message: `Enrollment number "${enrollmentNo}" not found in GBU CSMS registry.`,
        });
        return;
      }

      if (rosterRecord.isClaimed) {
        res.status(400).json({
          success: false,
          message: `An account for enrollment "${enrollmentNo}" is already activated. Please log in.`,
        });
        return;
      }

      // Check 60-second cooldown in Redis
      const cooldownRemaining = await OtpService.getCooldownSeconds(enrollmentNo);
      if (cooldownRemaining > 0) {
        res.status(429).json({
          success: false,
          message: `Please wait ${cooldownRemaining} second(s) before requesting another OTP.`,
          cooldownRemaining,
        });
        return;
      }

      // Generate new 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Store in Redis with 15m TTL & activate 60s cooldown
      await OtpService.storeOtp(enrollmentNo, otp);
      await OtpService.setCooldown(enrollmentNo);

      // Dispatch real email via Resend
      await EmailService.sendOtpEmail(
        rosterRecord.registeredEmail,
        otp,
        rosterRecord.fullName,
        rosterRecord.enrollmentNo
      );

      res.status(200).json({
        success: true,
        message: `A fresh verification code has been dispatched to ${maskEmail(rosterRecord.registeredEmail)}.`,
        data: {
          maskedEmail: maskEmail(rosterRecord.registeredEmail),
          cooldownSeconds: 60,
          devOtp: ENV.NODE_ENV === "development" ? otp : undefined,
        },
      });
    } catch (err) {
      console.error("Resend OTP error:", err);
      res.status(500).json({ success: false, message: "Failed to resend verification OTP" });
    }
  }

  /**
   * STEP 2: Complete Student Registration using verified GBU Enrollment + OTP
   * Auto-populates official student profile directly from GBU CSMS registry!
   */
  static async registerStudent(req: Request, res: Response): Promise<void> {
    try {
      const enrollmentNo = (req.body.enrollmentNo || "").trim().toUpperCase();
      const { otp, password } = req.body;

      const [rosterRecord] = await db
        .select()
        .from(gbuStudentRoster)
        .where(eq(gbuStudentRoster.enrollmentNo, enrollmentNo))
        .limit(1);

      if (!rosterRecord) {
        res.status(404).json({ success: false, message: "Enrollment record not found" });
        return;
      }

      if (rosterRecord.isClaimed) {
        res.status(400).json({ success: false, message: "Account already registered for this enrollment number" });
        return;
      }

      // Verify OTP via Redis (or Postgres fallback)
      const isOtpValid = await OtpService.verifyOtp(enrollmentNo, otp);

      if (!isOtpValid) {
        res.status(400).json({ success: false, message: "Invalid or expired verification OTP." });
        return;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create verified student user
      const [newUser] = await db
        .insert(users)
        .values({
          name: rosterRecord.fullName,
          email: rosterRecord.registeredEmail.toLowerCase(),
          passwordHash,
          role: "STUDENT" as const,
          enrollmentNo: rosterRecord.enrollmentNo,
          school: rosterRecord.school,
          hostelBlock: rosterRecord.hostelBlock,
          roomNo: rosterRecord.roomNo,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          enrollmentNo: users.enrollmentNo,
          school: users.school,
          hostelBlock: users.hostelBlock,
          roomNo: users.roomNo,
          createdAt: users.createdAt,
        });

      // Mark roster record as claimed & clear OTP
      await db
        .update(gbuStudentRoster)
        .set({ isClaimed: true, activeOtp: null, otpExpiresAt: null })
        .where(eq(gbuStudentRoster.enrollmentNo, enrollmentNo));
      await OtpService.clearOtp(enrollmentNo);

      // Sign Double JWT Tokens (Access Token + Refresh Token)
      const tokenPayload: TokenPayload = {
        userId: newUser.id,
        email: newUser.email,
        role: "STUDENT",
        name: newUser.name,
        enrollmentNo: newUser.enrollmentNo,
        school: newUser.school,
        hostelBlock: newUser.hostelBlock,
        roomNo: newUser.roomNo,
      };

      const tokens = await AuthController.issueTokens(tokenPayload);

      // Set httpOnly cookie on response
      AuthController.setAuthCookies(res, tokens);

      res.status(201).json({
        success: true,
        message: `Account activated for ${newUser.name} (${newUser.enrollmentNo})!`,
        data: {
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            enrollmentNo: newUser.enrollmentNo,
            school: newUser.school,
            hostelBlock: newUser.hostelBlock,
            roomNo: newUser.roomNo,
          },
          // Auth is handled via httpOnly cookies. No tokens exposed in JSON.
        },
      });
    } catch (err) {
      console.error("Register student error:", err);
      res.status(500).json({ success: false, message: "Failed to register student account" });
    }
  }

  /**
   * Generic Registration for Admin / Staff
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password, role, departmentId, phone } = req.body;

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "A user with this email already exists.",
        });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const [newUser] = await db
        .insert(users)
        .values({
          name,
          email: email.toLowerCase(),
          passwordHash,
          role: role as UserRole,
          departmentId: departmentId || null,
          phone: phone || null,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          departmentId: users.departmentId,
          createdAt: users.createdAt,
        });

      const tokenPayload: TokenPayload = {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role as UserRole,
        name: newUser.name,
        departmentId: newUser.departmentId,
      };

      const tokens = await AuthController.issueTokens(tokenPayload);

      // Set httpOnly cookie on response
      AuthController.setAuthCookies(res, tokens);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: newUser,
          // Auth is handled via httpOnly cookies. No tokens exposed in JSON.
        },
      });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error during registration",
      });
    }
  }

  /**
   * User Login (Supports Student, Staff, Admin)
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Check brute-force lockout before doing anything
      const lockout = await LoginGuardService.checkLockout(email);
      if (lockout.locked) {
        const mins = Math.ceil(lockout.remainingSeconds / 60);
        res.status(429).json({
          success: false,
          message: `Account temporarily locked due to ${LoginGuardService.maxAttempts} failed attempts. Try again in ${mins} minute(s).`,
        });
        return;
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (!user) {
        await LoginGuardService.recordFailedAttempt(email);
        res.status(401).json({
          success: false,
          message: "Invalid email or password credentials.",
        });
        return;
      }

      const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordMatch) {
        const attempts = await LoginGuardService.recordFailedAttempt(email);
        const remaining = LoginGuardService.maxAttempts - attempts;
        res.status(401).json({
          success: false,
          message: remaining > 0
            ? `Invalid email or password credentials. ${remaining} attempt(s) remaining.`
            : `Account locked due to too many failed attempts. Try again in 15 minutes.`,
        });
        return;
      }

      // Successful login — reset failed attempts
      await LoginGuardService.resetAttempts(email);

      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as UserRole,
        name: user.name,
        departmentId: user.departmentId,
        enrollmentNo: user.enrollmentNo,
        school: user.school,
        hostelBlock: user.hostelBlock,
        roomNo: user.roomNo,
      };

      const tokens = await AuthController.issueTokens(tokenPayload);

      // Set httpOnly cookie on response
      AuthController.setAuthCookies(res, tokens);

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            departmentId: user.departmentId,
            enrollmentNo: user.enrollmentNo,
            school: user.school,
            hostelBlock: user.hostelBlock,
            roomNo: user.roomNo,
          },
          // Auth is handled via httpOnly cookies. No tokens exposed in JSON.
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({
        success: false,
        message: "Internal server error during login",
      });
    }
  }

  /**
   * Get Current User Profile
   */
  static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          enrollmentNo: users.enrollmentNo,
          school: users.school,
          hostelBlock: users.hostelBlock,
          roomNo: users.roomNo,
          departmentId: users.departmentId,
          phone: users.phone,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, req.user.userId))
        .limit(1);

      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (err) {
      console.error("GetMe error:", err);
      res.status(500).json({ success: false, message: "Failed to get user profile" });
    }
  }

  /**
   * Update Current User Profile (phone for all users; name for non-students)
   */
  static async updateMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { phone, name } = req.body;
      const updates: { phone?: string | null; name?: string; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (phone !== undefined) {
        updates.phone = phone ? String(phone).trim() : null;
      }
      if (name && req.user.role !== "STUDENT") {
        updates.name = String(name).trim();
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, req.user.userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          enrollmentNo: users.enrollmentNo,
          school: users.school,
          hostelBlock: users.hostelBlock,
          roomNo: users.roomNo,
          departmentId: users.departmentId,
          phone: users.phone,
          createdAt: users.createdAt,
        });

      if (!updated) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: updated,
      });
    } catch (err) {
      console.error("UpdateMe error:", err);
      res.status(500).json({ success: false, message: "Failed to update profile" });
    }
  }

  /**
   * JWT Refresh Token Rotation Endpoint
   * Accepts long-lived Refresh Token, verifies against Redis, and issues a fresh pair.
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      // Read refresh token from httpOnly cookie (preferred) or request body (fallback for API clients)
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: "Refresh token is missing. Please log in again or provide refreshToken in request body.",
        });
        return;
      }

      let decoded: { userId: string; tokenType?: string };
      try {
        decoded = jwt.verify(refreshToken, ENV.JWT_REFRESH_SECRET) as any;
      } catch {
        res.status(401).json({
          success: false,
          message: "Invalid or expired refresh token. Please log in again.",
        });
        return;
      }

      // Check if refresh token is in Redis and matches active session (with 15s grace window for concurrent tab/SSE refreshes)
      const [storedToken, prevToken] = await Promise.all([
        redis.get(`rt:${decoded.userId}`),
        redis.get(`rt_prev:${decoded.userId}`),
      ]);
      const matchesActive = storedToken && storedToken === refreshToken;
      const matchesGrace = prevToken && prevToken === refreshToken;
      if (!matchesActive && !matchesGrace) {
        res.status(401).json({
          success: false,
          message: "Refresh token has been revoked or expired. Please log in again.",
        });
        return;
      }

      // Fetch user profile for token payload — select only safe fields (no passwordHash)
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          departmentId: users.departmentId,
          enrollmentNo: users.enrollmentNo,
          school: users.school,
          hostelBlock: users.hostelBlock,
          roomNo: users.roomNo,
        })
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (!user) {
        res.status(404).json({ success: false, message: "User account no longer exists." });
        return;
      }

      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as UserRole,
        name: user.name,
        departmentId: user.departmentId,
        enrollmentNo: user.enrollmentNo,
        school: user.school,
        hostelBlock: user.hostelBlock,
        roomNo: user.roomNo,
      };

      // Keep previous refresh token valid for 60s so concurrent/waking tabs don't race-revoke each other
      if (matchesActive) {
        await redis.setex(`rt_prev:${decoded.userId}`, 60, refreshToken);
      }

      // Token Rotation: issue brand new Access Token and Refresh Token
      const tokens = await AuthController.issueTokens(tokenPayload);

      // Set rotated httpOnly cookies
      AuthController.setAuthCookies(res, tokens);

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        // Auth is handled via httpOnly cookies. No tokens exposed in JSON.
      });
    } catch (err) {
      console.error("Refresh token error:", err);
      res.status(500).json({ success: false, message: "Failed to refresh token." });
    }
  }

  /**
   * User Logout: Revokes active Refresh Token in Redis and blacklists the current Access Token.
   * Clears cookies from the browser.
   */
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user) {
        // 1. Delete refresh token from Redis (revokes session renewal)
        await redis.del(`rt:${req.user.userId}`, `rt_prev:${req.user.userId}`);
      }

      if (req.token) {
        // 2. Blacklist current access token in Redis (15 minutes TTL)
        await redis.setex(`bl:${req.token}`, 15 * 60, "revoked");
      }

      // Clear auth cookies on response
      AuthController.clearAuthCookies(res);

      res.status(200).json({
        success: true,
        message: "Logged out successfully. All sessions revoked.",
      });
    } catch (err) {
      console.error("Logout error:", err);
      res.status(500).json({ success: false, message: "Failed to log out." });
    }
  }
}
