import { Response } from "express";
import { z } from "zod";
import { db } from "../config/database";
import { gbuStudentRoster } from "../db/schema";
import { AuthenticatedRequest } from "../types";
import { ilike, or, desc, sql } from "drizzle-orm";

export const rosterItemSchema = z.object({
  enrollmentNo: z.string().min(3, "Enrollment number is required"),
  fullName: z.string().min(2, "Full name is required"),
  school: z.string().min(2, "School/Department is required"),
  program: z.string().optional(),
  hostelBlock: z.string().optional(),
  roomNo: z.string().optional(),
  registeredEmail: z.string().email("Valid email required"),
});

export const bulkRosterSchema = z.object({
  students: z.array(rosterItemSchema).min(1, "At least 1 student record required in batch"),
});

export class RosterController {
  /**
   * ADMIN ONLY: Bulk import or update student records in GBU Roster
   * Called when admin uploads a CSV or JSON export from CSMS / Samarth
   */
  static async bulkUploadRoster(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { students } = req.body;

      let insertedCount = 0;
      let updatedCount = 0;

      // Upsert records into gbu_student_roster
      for (const item of students) {
        const cleanEnrollment = item.enrollmentNo.trim().toUpperCase();
        const cleanEmail = item.registeredEmail.trim().toLowerCase();

        const [existing] = await db
          .select({ enrollmentNo: gbuStudentRoster.enrollmentNo })
          .from(gbuStudentRoster)
          .where(sql`upper(${gbuStudentRoster.enrollmentNo}) = ${cleanEnrollment}`)
          .limit(1);

        if (existing) {
          await db
            .update(gbuStudentRoster)
            .set({
              fullName: item.fullName.trim(),
              school: item.school.trim(),
              program: item.program?.trim() || null,
              hostelBlock: item.hostelBlock?.trim() || null,
              roomNo: item.roomNo?.trim() || null,
              registeredEmail: cleanEmail,
            })
            .where(sql`upper(${gbuStudentRoster.enrollmentNo}) = ${cleanEnrollment}`);
          updatedCount++;
        } else {
          await db.insert(gbuStudentRoster).values({
            enrollmentNo: cleanEnrollment,
            fullName: item.fullName.trim(),
            school: item.school.trim(),
            program: item.program?.trim() || null,
            hostelBlock: item.hostelBlock?.trim() || null,
            roomNo: item.roomNo?.trim() || null,
            registeredEmail: cleanEmail,
            isClaimed: false,
          });
          insertedCount++;
        }
      }

      res.status(200).json({
        success: true,
        message: `Roster import completed successfully.`,
        data: {
          totalProcessed: students.length,
          newStudentsAdded: insertedCount,
          existingStudentsUpdated: updatedCount,
        },
      });
    } catch (err) {
      console.error("Bulk upload roster error:", err);
      res.status(500).json({ success: false, message: "Failed to import student roster" });
    }
  }

  /**
   * ADMIN ONLY: List student roster with search & claimed status filter
   */
  static async listRoster(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { search, school } = req.query;

      const conditions = [];

      if (search) {
        conditions.push(
          or(
            ilike(gbuStudentRoster.enrollmentNo, `%${search}%`),
            ilike(gbuStudentRoster.fullName, `%${search}%`),
            ilike(gbuStudentRoster.registeredEmail, `%${search}%`)
          )
        );
      }

      if (school) {
        conditions.push(ilike(gbuStudentRoster.school, `%${school}%`));
      }

      const list = await db
        .select()
        .from(gbuStudentRoster)
        .orderBy(desc(gbuStudentRoster.createdAt))
        .limit(100);

      res.status(200).json({
        success: true,
        count: list.length,
        data: list,
      });
    } catch (err) {
      console.error("List roster error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch student roster" });
    }
  }
}
