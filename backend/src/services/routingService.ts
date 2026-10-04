import { db } from "../config/database";
import { departments } from "../db/schema";
import { eq, ilike } from "drizzle-orm";

// Explicit mapping from Python ML categories to PostgreSQL department codes
const ML_CATEGORY_TO_DEPT_CODE: Record<string, string> = {
  // Python ML classes & immediate hazard checks
  "Electrical Maintenance": "ELEC",
  "Plumbing & Sanitation": "PLUMB",
  "IT & Digital Services": "IT",
  "Hostel & Accommodation": "HOSTEL",
  "Academic & Courses": "ACAD",
  "Exams & Assessment": "ACAD",
  "Library": "ACAD",
  "Internships & Placements": "ACAD",
  "Administration & Documents": "GEN",
  "Student Activities & Events": "GEN",
  "Transport & Parking": "GEN",
  "Campus Facilities & Maintenance": "GEN",

  // Simulator / Fallback categories
  "Electrical": "ELEC",
  "Plumbing": "PLUMB",
  "IT / Network": "IT",
  "Hostel / Mess": "HOSTEL",
  "Academic": "ACAD",
  "General": "GEN",
};

export class RoutingService {
  /**
   * Maps an ML predicted complaint category to the appropriate department code (e.g. "ELEC", "PLUMB", "IT")
   */
  static getDepartmentCodeForCategory(category: string): string {
    const trimmed = (category || "").trim();

    // 1. Direct dictionary match (case-insensitive)
    for (const [mlName, code] of Object.entries(ML_CATEGORY_TO_DEPT_CODE)) {
      if (mlName.toLowerCase() === trimmed.toLowerCase()) {
        return code;
      }
    }

    // 2. Substring fallback for category variations
    const lower = trimmed.toLowerCase();
    if (lower.includes("electric")) return "ELEC";
    if (lower.includes("plumb")) return "PLUMB";
    if (lower.includes("it") || lower.includes("digital") || lower.includes("network")) return "IT";
    if (lower.includes("hostel") || lower.includes("mess") || lower.includes("accommod")) return "HOSTEL";
    if (
      lower.includes("acad") ||
      lower.includes("exam") ||
      lower.includes("course") ||
      lower.includes("library") ||
      lower.includes("placement")
    ) {
      return "ACAD";
    }

    // Default to Central Administration
    return "GEN";
  }

  /**
   * Find matching department ID in database by category name
   */
  static async resolveDepartmentId(category: string): Promise<string | null> {
    try {
      const code = this.getDepartmentCodeForCategory(category);
      const [dept] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.code, code))
        .limit(1);

      if (dept) return dept.id;

      // Fallback: search by name ilike
      const [fallback] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(ilike(departments.name, `%${category}%`))
        .limit(1);

      return fallback ? fallback.id : null;
    } catch (err) {
      console.error("Error resolving department:", err);
      return null;
    }
  }
}
