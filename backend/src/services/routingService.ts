import { db } from "../config/database";
import { departments } from "../db/schema";
import { eq, ilike } from "drizzle-orm";

export class RoutingService {
  /**
   * Maps a complaint category to the appropriate department code
   */
  static getDepartmentCodeForCategory(category: string): string {
    const cat = (category || "").toLowerCase();

    if (cat.includes("electric") || cat.includes("fan") || cat.includes("light") || cat.includes("power") || cat.includes("wire") || cat.includes("switch")) {
      return "ELEC";
    }
    if (cat.includes("plumb") || cat.includes("water") || cat.includes("tap") || cat.includes("drain") || cat.includes("toilet") || cat.includes("leak")) {
      return "PLUMB";
    }
    if (cat.includes("it") || cat.includes("network") || cat.includes("wifi") || cat.includes("internet") || cat.includes("router") || cat.includes("lan") || cat.includes("server") || cat.includes("digital")) {
      return "IT";
    }
    if (cat.includes("hostel") || cat.includes("mess") || cat.includes("food") || cat.includes("room") || cat.includes("bed") || cat.includes("cleaning") || cat.includes("accommod")) {
      return "HOSTEL";
    }
    if (cat.includes("acad") || cat.includes("exam") || cat.includes("course") || cat.includes("grade") || cat.includes("mark") || cat.includes("attend") || cat.includes("admit") || cat.includes("library") || cat.includes("placement") || cat.includes("intern")) {
      return "ACAD";
    }
    return "GEN"; // Default to General Administration

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
