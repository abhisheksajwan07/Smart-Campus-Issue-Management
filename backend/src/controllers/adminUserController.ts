import { Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../config/database";
import { users, departments } from "../db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { AuthenticatedRequest, UserRole } from "../types";

export const createTeamUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "STAFF"]),
  departmentId: z.string().uuid("Invalid department ID").optional().nullable(),
  phone: z.string().trim().optional(),
});

export class AdminUserController {
  /**
   * ADMIN ONLY: List staff and admin team members (excluding passwordHash)
   */
  static async listTeamUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const roleFilter = req.query.role ? String(req.query.role).toUpperCase() : "";
      const allowedRoles: UserRole[] =
        roleFilter === "STAFF" || roleFilter === "ADMIN"
          ? [roleFilter as UserRole]
          : ["ADMIN", "STAFF"];

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          departmentId: users.departmentId,
          departmentName: departments.name,
          departmentCode: departments.code,
          phone: users.phone,
          createdAt: users.createdAt,
        })
        .from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .where(inArray(users.role, allowedRoles))
        .orderBy(desc(users.createdAt));

      res.status(200).json({
        success: true,
        count: rows.length,
        data: rows,
      });
    } catch (err) {
      console.error("List team users error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch team members" });
    }
  }

  /**
   * ADMIN ONLY: Create a new STAFF or ADMIN account without altering the admin's own auth session
   */
  static async createTeamUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name, email, password, role, departmentId, phone } = req.body;
      const normalizedEmail = email.toLowerCase();

      if (role === "STAFF" && !departmentId) {
        res.status(400).json({
          success: false,
          message: "Department is required for staff accounts.",
        });
        return;
      }

      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existing) {
        res.status(409).json({
          success: false,
          message: "A user with this email already exists.",
        });
        return;
      }

      let deptName: string | null = null;
      let deptCode: string | null = null;
      if (role === "STAFF" && departmentId) {
        const [dept] = await db
          .select({ id: departments.id, name: departments.name, code: departments.code })
          .from(departments)
          .where(eq(departments.id, departmentId))
          .limit(1);
        if (!dept) {
          res.status(400).json({ success: false, message: "Selected department does not exist." });
          return;
        }
        deptName = dept.name;
        deptCode = dept.code;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const [created] = await db
        .insert(users)
        .values({
          name,
          email: normalizedEmail,
          passwordHash,
          role: role as UserRole,
          departmentId: role === "STAFF" ? departmentId || null : null,
          phone: phone || null,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          departmentId: users.departmentId,
          phone: users.phone,
          createdAt: users.createdAt,
        });

      res.status(201).json({
        success: true,
        message: `Team member ${created.email} created successfully.`,
        data: {
          ...created,
          departmentName: deptName,
          departmentCode: deptCode,
        },
      });
    } catch (err) {
      console.error("Create team user error:", err);
      res.status(500).json({ success: false, message: "Failed to create team account" });
    }
  }
}
