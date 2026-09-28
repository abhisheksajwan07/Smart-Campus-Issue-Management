import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../config/database";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { ENV } from "../config/env";
import { AuthenticatedRequest, TokenPayload, UserRole } from "../types";

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

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password, role, departmentId, phone } = req.body;

      // Check if user already exists
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

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user
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

      // Sign JWT
      const tokenPayload: TokenPayload = {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role as UserRole,
        name: newUser.name,
        departmentId: newUser.departmentId,
      };

      const token = jwt.sign(tokenPayload, ENV.JWT_SECRET, {
        expiresIn: ENV.JWT_EXPIRES_IN as any,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: newUser,
          token,
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

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password credentials.",
        });
        return;
      }

      const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordMatch) {
        res.status(401).json({
          success: false,
          message: "Invalid email or password credentials.",
        });
        return;
      }

      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as UserRole,
        name: user.name,
        departmentId: user.departmentId,
      };

      const token = jwt.sign(tokenPayload, ENV.JWT_SECRET, {
        expiresIn: ENV.JWT_EXPIRES_IN as any,
      });

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
          },
          token,
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
}
