import { Request, Response } from "express";
import { db } from "../config/database";
import { complaints, departments } from "../db/schema";
import { SlaService } from "../services/slaService";

export class AnalyticsController {
  static async getDashboardMetrics(_req: Request, res: Response): Promise<void> {
    try {
      // 1. Overall counts
      const allComplaints = await db
        .select({
          id: complaints.id,
          status: complaints.status,
          finalPriority: complaints.finalPriority,
          finalCategory: complaints.finalCategory,
          isAiOverridden: complaints.isAiOverridden,
          aiConfidenceCategory: complaints.aiConfidenceCategory,
          aiConfidencePriority: complaints.aiConfidencePriority,
          slaDeadlineAt: complaints.slaDeadlineAt,
          resolvedAt: complaints.resolvedAt,
          isSlaBreached: complaints.isSlaBreached,
          departmentId: complaints.assignedDepartmentId,
        })
        .from(complaints);

      const total = allComplaints.length;
      let submitted = 0;
      let inProgress = 0;
      let resolved = 0;
      let rejected = 0;
      let escalated = 0;
      let slaBreachedCount = 0;
      let overriddenCount = 0;

      const categoryCounts: Record<string, number> = {};
      const priorityCounts: Record<string, number> = {};

      for (const item of allComplaints) {
        if (item.status === "SUBMITTED") submitted++;
        else if (item.status === "IN_PROGRESS") inProgress++;
        else if (item.status === "RESOLVED") resolved++;
        else if (item.status === "REJECTED") rejected++;
        else if (item.status === "ESCALATED") escalated++;

        // Live SLA breach check
        const isBreached = SlaService.isBreached(
          item.slaDeadlineAt,
          item.status,
          item.resolvedAt
        );
        if (isBreached || item.isSlaBreached) {
          slaBreachedCount++;
        }

        if (item.isAiOverridden) {
          overriddenCount++;
        }

        categoryCounts[item.finalCategory] = (categoryCounts[item.finalCategory] || 0) + 1;
        priorityCounts[item.finalPriority] = (priorityCounts[item.finalPriority] || 0) + 1;
      }

      // AI Accuracy / Acceptance Metric
      const aiAcceptedCount = total - overriddenCount;
      const aiAccuracyRate = total > 0
        ? parseFloat(((aiAcceptedCount / total) * 100).toFixed(1))
        : 100;

      // Department Workload Distribution
      const allDepts = await db.select().from(departments);
      const deptCounts: Record<string, number> = {};
      for (const item of allComplaints) {
        if (item.departmentId) {
          deptCounts[item.departmentId] = (deptCounts[item.departmentId] || 0) + 1;
        }
      }

      const departmentWorkload = allDepts.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        complaintsCount: deptCounts[d.id] || 0,
      }));

      res.status(200).json({
        success: true,
        data: {
          summary: {
            totalComplaints: total,
            activeComplaints: submitted + inProgress,
            resolvedComplaints: resolved,
            rejectedComplaints: rejected,
            escalatedComplaints: escalated,
            slaBreachedComplaints: slaBreachedCount,
          },
          aiMetrics: {
            totalAnalyzed: total,
            aiAcceptedCount,
            aiOverriddenCount: overriddenCount,
            aiAccuracyRate: `${aiAccuracyRate}%`,
            explanation: "Percentage of AI predictions accepted without human admin override",
          },
          categoryDistribution: Object.entries(categoryCounts).map(([category, count]) => ({
            category,
            count,
          })),
          priorityDistribution: Object.entries(priorityCounts).map(([priority, count]) => ({
            priority,
            count,
          })),
          departmentWorkload,
        },
      });
    } catch (err) {
      console.error("Dashboard metrics error:", err);
      res.status(500).json({ success: false, message: "Failed to fetch analytics metrics" });
    }
  }
}
