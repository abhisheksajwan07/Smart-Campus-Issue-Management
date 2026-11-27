import crypto from "crypto";
import { Response } from "express";
import { z } from "zod";
import { db } from "../config/database";
import { complaints, complaintTimeline, departments, users } from "../db/schema";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";
import { AuthenticatedRequest, PriorityLevel, ComplaintStatus } from "../types";
import { AiService } from "../services/aiService";
import { SlaService } from "../services/slaService";
import { RoutingService } from "../services/routingService";
import { findSimilarComplaints, SimilarComplaintMatch, DEFAULT_SIMILARITY_THRESHOLD } from "../services/similarityService";
import { SSEService } from "../services/sseService";

const VALID_STATUSES: readonly ComplaintStatus[] = [
  "SUBMITTED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
  "ESCALATED",
];
const VALID_PRIORITIES: readonly PriorityLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const uuidSchema = z.string().uuid();

function stripEmbedding<T extends { embedding?: unknown }>(complaint: T): Omit<T, "embedding"> {
  const { embedding: _embedding, ...safeComplaint } = complaint;
  return safeComplaint;
}

export const createComplaintSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  location: z.string().min(3, "Location is required (e.g. Room 204, Hostel C)"),
  imageUrl: z.string().nullable().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["SUBMITTED", "IN_PROGRESS", "RESOLVED", "REJECTED", "ESCALATED"]),
  note: z.string().optional(),
});

export const overrideAiSchema = z.object({
  category: z.string().trim().min(1, "Category cannot be empty").max(100, "Category too long").optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  overrideReason: z.string().min(3, "Please provide an explanation for overriding the AI result"),
});

export class ComplaintController {
  /**
   * Submit a new complaint:
   * 1. Runs AI analysis (classification + priority + summary + embedding)
   * 2. Auto-routes to department
   * 3. Calculates dynamic SLA timer
   * 4. Stores initial prediction vs final triage values
   */
  static async createComplaint(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const currentUser = req.user;
      const { title, description, location, imageUrl } = req.body;
      const combinedText = `${title}. ${description}. Location: ${location}`;

      // 1. AI Analysis Orchestration (Protected with Fallback)
      const aiResult = await AiService.analyzeComplaint({
        text: combinedText,
        location,
      });

      const predictedCategory = aiResult.category.value;
      const predictedPriority = aiResult.priority.value;

      // 2. Department Auto-Routing
      const assignedDepartmentId = await RoutingService.resolveDepartmentId(predictedCategory);

      // 3. SLA Calculation
      const slaHours = SlaService.getSlaHours(predictedPriority);
      const slaDeadlineAt = SlaService.computeDeadline(predictedPriority);

      // 4. Generate unique Ticket Number with cryptographic randomness (e.g. CMP-2026-A8F3B2)
      const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      const ticketNumber = `CMP-${new Date().getFullYear()}-${randomSuffix}`;

      // 5 & 6. Atomic Database Transaction: Insert Complaint + Audit Timeline
      const newComplaint = await db.transaction(async (tx) => {
        const [complaint] = await tx
          .insert(complaints)
          .values({
            ticketNumber,
            title,
            description,
            location,
            imageUrl: imageUrl || null,
            status: "SUBMITTED",
            studentId: currentUser.userId,
            assignedDepartmentId,

            // AI prediction fields
            predictedCategory,
            predictedPriority,
            aiConfidenceCategory: aiResult.category.confidence,
            aiConfidencePriority: aiResult.priority.confidence,
            aiSummary: aiResult.summary,
            suggestedAction: aiResult.suggestedAction,
            embedding: aiResult.embedding,

            // Initial triage mirrors AI prediction
            finalCategory: predictedCategory,
            finalPriority: predictedPriority,
            isAiOverridden: false,

            // SLA fields
            slaHours,
            slaDeadlineAt,
            isSlaBreached: false,
          })
          .returning();

        await tx.insert(complaintTimeline).values([
          {
            complaintId: complaint.id,
            actorId: currentUser.userId,
            action: "SUBMITTED" as const,
            note: `Complaint filed by student at ${location}`,
          },
          {
            complaintId: complaint.id,
            actorId: null, // System / AI Actor
            action: "AI_ANALYZED" as const,
            note: `AI classified as "${predictedCategory}" (${(aiResult.category.confidence * 100).toFixed(0)}%) with priority "${predictedPriority}". SLA set to ${slaHours}h.`,
          },
        ]);

        return complaint;
      });

      // 7. Find Semantically Similar / Duplicate Suggestions (Non-critical enrichment)
      let similarComplaints: SimilarComplaintMatch[] = [];
      try {
        if (aiResult.embedding && aiResult.embedding.length > 0) {
          similarComplaints = await findSimilarComplaints(
            aiResult.embedding,
            newComplaint.id,
            DEFAULT_SIMILARITY_THRESHOLD,
            3
          );
        }
      } catch (simErr) {
        console.warn("Non-critical: Similarity search failed, continuing without duplicate suggestions:", simErr);
      }

      const safeComplaint = stripEmbedding(newComplaint);

      // 8. Broadcast Real-Time SSE Event to All Connected Admin Dashboards
      SSEService.broadcast("NEW_COMPLAINT", {
        complaint: safeComplaint,
        similarComplaints,
      });

      res.status(201).json({
        success: true,
        message: "Complaint registered and analyzed by AI successfully",
        data: {
          complaint: safeComplaint,
          aiAnalysis: {
            predictedCategory,
            predictedPriority,
            categoryConfidence: aiResult.category.confidence,
            priorityConfidence: aiResult.priority.confidence,
            summary: aiResult.summary,
            suggestedAction: aiResult.suggestedAction,
          },
          similarComplaints,
        },
      });
    } catch (err) {
      console.error("Create complaint error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to create complaint",
      });
    }
  }

  /**
   * List complaints with filtering, search, and role isolation
   */
  static async getComplaints(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { status, priority, category, departmentId, search } = req.query;

      const conditions = [];

      // Students can only view their own complaints
      if (req.user.role === "STUDENT") {
        conditions.push(eq(complaints.studentId, req.user.userId));
      } else if (req.user.role === "STAFF") {
        // Staff see complaints assigned to their department (or directly assigned to them)
        if (req.user.departmentId) {
          conditions.push(eq(complaints.assignedDepartmentId, req.user.departmentId));
        } else {
          conditions.push(eq(complaints.assignedStaffId, req.user.userId));
        }
      }

      if (status) {
        const normalizedStatus = String(status).trim().toUpperCase() as ComplaintStatus;
        if (!VALID_STATUSES.includes(normalizedStatus)) {
          res.status(400).json({
            success: false,
            message: `Invalid status filter. Allowed values: ${VALID_STATUSES.join(", ")}`,
          });
          return;
        }
        conditions.push(eq(complaints.status, normalizedStatus));
      }
      if (priority) {
        const normalizedPriority = String(priority).trim().toUpperCase() as PriorityLevel;
        if (!VALID_PRIORITIES.includes(normalizedPriority)) {
          res.status(400).json({
            success: false,
            message: `Invalid priority filter. Allowed values: ${VALID_PRIORITIES.join(", ")}`,
          });
          return;
        }
        conditions.push(eq(complaints.finalPriority, normalizedPriority));
      }
      if (category) {
        const normalizedCategory = String(category).trim();
        conditions.push(sql`lower(${complaints.finalCategory}) = lower(${normalizedCategory})`);
      }
      if (departmentId) {
        const deptIdStr = String(departmentId).trim();
        if (!uuidSchema.safeParse(deptIdStr).success) {
          res.status(400).json({ success: false, message: "Invalid departmentId format" });
          return;
        }
        conditions.push(eq(complaints.assignedDepartmentId, deptIdStr));
      }
      if (search) {
        conditions.push(
          or(
            ilike(complaints.title, `%${search}%`),
            ilike(complaints.ticketNumber, `%${search}%`),
            ilike(complaints.location, `%${search}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const list = await db
        .select({
          id: complaints.id,
          ticketNumber: complaints.ticketNumber,
          title: complaints.title,
          description: complaints.description,
          location: complaints.location,
          imageUrl: complaints.imageUrl,
          status: complaints.status,
          finalCategory: complaints.finalCategory,
          finalPriority: complaints.finalPriority,
          predictedCategory: complaints.predictedCategory,
          predictedPriority: complaints.predictedPriority,
          isAiOverridden: complaints.isAiOverridden,
          aiConfidenceCategory: complaints.aiConfidenceCategory,
          aiConfidencePriority: complaints.aiConfidencePriority,
          aiSummary: complaints.aiSummary,
          suggestedAction: complaints.suggestedAction,
          slaHours: complaints.slaHours,
          slaDeadlineAt: complaints.slaDeadlineAt,
          isSlaBreached: complaints.isSlaBreached,
          resolvedAt: complaints.resolvedAt,
          createdAt: complaints.createdAt,
          departmentName: departments.name,
          studentName: users.name,
          studentEmail: users.email,
        })
        .from(complaints)
        .leftJoin(departments, eq(complaints.assignedDepartmentId, departments.id))
        .leftJoin(users, eq(complaints.studentId, users.id))
        .where(whereClause)
        .orderBy(desc(complaints.createdAt));

      // Append live SLA remaining info
      const enriched = list.map((item) => {
        const slaInfo = SlaService.getRemainingTimeInfo(
          item.slaDeadlineAt,
          item.status === "RESOLVED" || item.status === "REJECTED"
        );
        return {
          ...item,
          slaRemaining: slaInfo.formatted,
          isSlaBreached: slaInfo.isBreached || item.isSlaBreached,
        };
      });

      res.status(200).json({
        success: true,
        count: enriched.length,
        data: enriched,
      });
    } catch (err) {
      console.error("Get complaints error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch complaints" });
    }
  }

  /**
   * Get single complaint with full details, audit timeline, and duplicate detection
   */
  static async getComplaintById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!uuidSchema.safeParse(id).success) {
        res.status(400).json({ success: false, message: "Invalid complaint ID format" });
        return;
      }

      const [complaint] = await db
        .select({
          id: complaints.id,
          ticketNumber: complaints.ticketNumber,
          title: complaints.title,
          description: complaints.description,
          location: complaints.location,
          imageUrl: complaints.imageUrl,
          status: complaints.status,
          studentId: complaints.studentId,
          assignedDepartmentId: complaints.assignedDepartmentId,
          assignedStaffId: complaints.assignedStaffId,
          predictedCategory: complaints.predictedCategory,
          predictedPriority: complaints.predictedPriority,
          aiConfidenceCategory: complaints.aiConfidenceCategory,
          aiConfidencePriority: complaints.aiConfidencePriority,
          aiSummary: complaints.aiSummary,
          suggestedAction: complaints.suggestedAction,
          finalCategory: complaints.finalCategory,
          finalPriority: complaints.finalPriority,
          isAiOverridden: complaints.isAiOverridden,
          overriddenById: complaints.overriddenById,
          overriddenAt: complaints.overriddenAt,
          overrideReason: complaints.overrideReason,
          slaHours: complaints.slaHours,
          slaDeadlineAt: complaints.slaDeadlineAt,
          isSlaBreached: complaints.isSlaBreached,
          resolvedAt: complaints.resolvedAt,
          createdAt: complaints.createdAt,
          updatedAt: complaints.updatedAt,
          embedding: complaints.embedding,
          departmentName: departments.name,
          departmentCode: departments.code,
          studentName: users.name,
          studentEmail: users.email,
        })
        .from(complaints)
        .leftJoin(departments, eq(complaints.assignedDepartmentId, departments.id))
        .leftJoin(users, eq(complaints.studentId, users.id))
        .where(eq(complaints.id, id))
        .limit(1);

      if (!complaint) {
        res.status(404).json({ success: false, message: "Complaint not found" });
        return;
      }

      // Check permission for student or department-scoped staff
      if (req.user?.role === "STUDENT" && complaint.studentId !== req.user.userId) {
        res.status(403).json({ success: false, message: "Access forbidden" });
        return;
      }
      if (
        req.user?.role === "STAFF" &&
        req.user.departmentId &&
        complaint.assignedDepartmentId !== req.user.departmentId
      ) {
        res.status(403).json({ success: false, message: "Access forbidden for this department" });
        return;
      }

      // Fetch Timeline
      const timeline = await db
        .select({
          id: complaintTimeline.id,
          action: complaintTimeline.action,
          note: complaintTimeline.note,
          createdAt: complaintTimeline.createdAt,
          actorName: users.name,
          actorRole: users.role,
        })
        .from(complaintTimeline)
        .leftJoin(users, eq(complaintTimeline.actorId, users.id))
        .where(eq(complaintTimeline.complaintId, id))
        .orderBy(desc(complaintTimeline.createdAt));

      // Fetch Similar / Duplicate Complaints (Non-critical enrichment)
      let similarComplaints: SimilarComplaintMatch[] = [];
      try {
        if (complaint.embedding && Array.isArray(complaint.embedding)) {
          similarComplaints = await findSimilarComplaints(
            complaint.embedding,
            complaint.id,
            DEFAULT_SIMILARITY_THRESHOLD,
            3
          );
        }
      } catch (simErr) {
        console.warn("Non-critical: Similarity search failed in getComplaintById:", simErr);
      }

      const slaInfo = SlaService.getRemainingTimeInfo(
        complaint.slaDeadlineAt,
        complaint.status === "RESOLVED" || complaint.status === "REJECTED"
      );

      // Omit 384-dimensional raw embedding vector from client JSON to save bandwidth
      const { embedding, ...safeComplaint } = complaint;

      res.status(200).json({
        success: true,
        data: {
          ...safeComplaint,
          slaRemaining: slaInfo.formatted,
          isSlaBreached: slaInfo.isBreached || complaint.isSlaBreached,
          timeline,
          similarComplaints,
        },
      });
    } catch (err) {
      console.error("Get complaint by ID error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch complaint details" });
    }
  }

  /**
   * Update complaint status (SUBMITTED -> IN_PROGRESS -> RESOLVED / REJECTED / ESCALATED)
   */
  static async updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!uuidSchema.safeParse(id).success) {
        res.status(400).json({ success: false, message: "Invalid complaint ID format" });
        return;
      }
      const { status, note } = req.body;

      const [existing] = await db
        .select()
        .from(complaints)
        .where(eq(complaints.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ success: false, message: "Complaint not found" });
        return;
      }

      if (
        req.user?.role === "STAFF" &&
        req.user.departmentId &&
        existing.assignedDepartmentId !== req.user.departmentId
      ) {
        res.status(403).json({ success: false, message: "Access forbidden for this department" });
        return;
      }

      const resolvedAt = status === "RESOLVED" ? new Date() : null;
      const timelineAction =
        status === "RESOLVED"
          ? ("RESOLVED" as const)
          : status === "ESCALATED"
          ? ("ESCALATED" as const)
          : ("STATUS_UPDATED" as const);

      // Atomic Transaction: Update complaint status + write audit timeline entry
      const updated = await db.transaction(async (tx) => {
        const [complaintRow] = await tx
          .update(complaints)
          .set({
            status,
            resolvedAt,
            updatedAt: new Date(),
          })
          .where(eq(complaints.id, id))
          .returning();

        await tx.insert(complaintTimeline).values({
          complaintId: id,
          actorId: req.user?.userId || null,
          action: timelineAction,
          note: note || `Status transitioned to "${status}"`,
        });

        return complaintRow;
      });

      const safeUpdated = stripEmbedding(updated);

      // Broadcast Real-Time SSE Event
      SSEService.broadcast("STATUS_UPDATED", {
        complaintId: id,
        ticketNumber: safeUpdated.ticketNumber,
        status: safeUpdated.status,
        resolvedAt: safeUpdated.resolvedAt,
        note: note || `Status transitioned to "${status}"`,
      });

      res.status(200).json({
        success: true,
        message: `Status updated to ${status}`,
        data: safeUpdated,
      });
    } catch (err) {
      console.error("Update status error:", err);
      res.status(500).json({ success: false, message: "Failed to update complaint status" });
    }
  }

  /**
   * Human-in-the-Loop Override Endpoint
   * Admin or Staff corrects an erroneous AI prediction.
   * Recalculates SLA & Department routing automatically.
   */
  static async overrideAi(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      if (!uuidSchema.safeParse(id).success) {
        res.status(400).json({ success: false, message: "Invalid complaint ID format" });
        return;
      }
      const { category, priority, overrideReason } = req.body;

      const [existing] = await db
        .select()
        .from(complaints)
        .where(eq(complaints.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ success: false, message: "Complaint not found" });
        return;
      }

      if (
        req.user?.role === "STAFF" &&
        req.user.departmentId &&
        existing.assignedDepartmentId !== req.user.departmentId
      ) {
        res.status(403).json({ success: false, message: "Access forbidden for this department" });
        return;
      }

      const newCategory = category || existing.finalCategory;
      const newPriority = (priority as PriorityLevel) || existing.finalPriority;

      // If category changed, re-route department
      let assignedDepartmentId = existing.assignedDepartmentId;
      if (category && category !== existing.finalCategory) {
        assignedDepartmentId = await RoutingService.resolveDepartmentId(newCategory);
      }

      // If priority changed, recalculate SLA deadline from original complaint time
      let slaHours = existing.slaHours;
      let slaDeadlineAt = existing.slaDeadlineAt;
      let isSlaBreached = existing.isSlaBreached;
      if (priority && priority !== existing.finalPriority) {
        slaHours = SlaService.getSlaHours(newPriority);
        slaDeadlineAt = SlaService.computeDeadline(newPriority, existing.createdAt);
        isSlaBreached = SlaService.isBreached(slaDeadlineAt, existing.status, existing.resolvedAt);
      }

      // Atomic Transaction: Update overridden fields + write audit timeline entry
      const updated = await db.transaction(async (tx) => {
        const [complaintRow] = await tx
          .update(complaints)
          .set({
            finalCategory: newCategory,
            finalPriority: newPriority,
            isAiOverridden: true,
            overriddenById: req.user?.userId || null,
            overriddenAt: new Date(),
            overrideReason,
            assignedDepartmentId,
            slaHours,
            slaDeadlineAt,
            isSlaBreached,
            updatedAt: new Date(),
          })
          .where(eq(complaints.id, id))
          .returning();

        await tx.insert(complaintTimeline).values({
          complaintId: id,
          actorId: req.user?.userId || null,
          action: "AI_OVERRIDDEN" as const,
          note: `AI prediction overridden by Admin. Reason: "${overrideReason}". Final: [Category: ${newCategory}, Priority: ${newPriority}]`,
        });

        return complaintRow;
      });

      const safeUpdated = stripEmbedding(updated);

      // Broadcast Real-Time SSE Event
      SSEService.broadcast("AI_OVERRIDDEN", {
        complaintId: id,
        ticketNumber: safeUpdated.ticketNumber,
        finalCategory: safeUpdated.finalCategory,
        finalPriority: safeUpdated.finalPriority,
        isAiOverridden: true,
        slaHours: safeUpdated.slaHours,
        slaDeadlineAt: safeUpdated.slaDeadlineAt,
        overrideReason,
      });

      res.status(200).json({
        success: true,
        message: "AI prediction successfully overridden. Routing and SLA recalculated.",
        data: safeUpdated,
      });
    } catch (err) {
      console.error("Override AI error:", err);
      res.status(500).json({ success: false, message: "Failed to override AI prediction" });
    }
  }

  /**
   * REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
   * Unidirectional live event stream for Admin and Staff Dashboards
   */
  static streamEvents(req: AuthenticatedRequest, res: Response): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    (res as any).flushHeaders?.();

    // Initial handshake message
    res.write(
      `event: CONNECTED\ndata: ${JSON.stringify({
        message: "Live SSE connection established",
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    SSEService.addClient(res);

    req.on("close", () => {
      SSEService.removeClient(res);
    });
  }
}
