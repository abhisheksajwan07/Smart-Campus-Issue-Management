import { Request, Response } from "express";
import { z } from "zod";
import { db } from "../config/database";
import { departments, complaints, users } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export const createDepartmentSchema = z.object({
  name: z.string().min(2, "Department name required"),
  code: z.string().min(2, "Department code required (e.g. ELEC)"),
  contactEmail: z.string().email().optional(),
  headName: z.string().optional(),
});

export class DepartmentController {
  static async listDepartments(_req: Request, res: Response): Promise<void> {
    try {
      const depts = await db.select().from(departments);

      // Get count of open complaints for each department
      const stats = await db
        .select({
          departmentId: complaints.assignedDepartmentId,
          openCount: sql<number>`count(*) filter (where ${complaints.status} not in ('RESOLVED', 'REJECTED'))::int`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(complaints)
        .groupBy(complaints.assignedDepartmentId);

      const statsMap = new Map(stats.map((s) => [s.departmentId, s]));

      const data = depts.map((d) => ({
        ...d,
        openComplaints: statsMap.get(d.id)?.openCount || 0,
        totalComplaints: statsMap.get(d.id)?.totalCount || 0,
      }));

      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("List departments error:", err);
      res.status(500).json({ success: false, message: "Failed to list departments" });
    }
  }

  static async createDepartment(req: Request, res: Response): Promise<void> {
    try {
      const { name, code, contactEmail, headName } = req.body;

      const [dept] = await db
        .insert(departments)
        .values({
          name,
          code: code.toUpperCase(),
          contactEmail: contactEmail || null,
          headName: headName || null,
        })
        .returning();

      res.status(201).json({
        success: true,
        message: "Department created successfully",
        data: dept,
      });
    } catch (err) {
      console.error("Create department error:", err);
      res.status(500).json({ success: false, message: "Failed to create department" });
    }
  }
}
