import { PriorityLevel } from "../types";

export const SLA_HOURS_MAP: Record<PriorityLevel, number> = {
  CRITICAL: 6,
  HIGH: 12,
  MEDIUM: 24,
  LOW: 48,
};

export class SlaService {
  /**
   * Determine SLA hours based on priority
   */
  static getSlaHours(priority: string): number {
    const normalized = (priority || "MEDIUM").toUpperCase() as PriorityLevel;
    return SLA_HOURS_MAP[normalized] || 24;
  }

  /**
   * Compute SLA deadline from a reference start time
   */
  static computeDeadline(priority: string, startDate: Date = new Date()): Date {
    const hours = this.getSlaHours(priority);
    return new Date(startDate.getTime() + hours * 60 * 60 * 1000);
  }

  /**
   * Check if an active complaint has breached its SLA
   */
  static isBreached(deadline: Date, status: string, resolvedAt?: Date | null): boolean {
    if (status === "RESOLVED" || status === "REJECTED") {
      if (resolvedAt) {
        return resolvedAt.getTime() > deadline.getTime();
      }
      return false;
    }
    return Date.now() > deadline.getTime();
  }

  /**
   * Format human-readable SLA remaining time / overdue time
   */
  static getRemainingTimeInfo(deadline: Date, isResolved: boolean = false) {
    const diffMs = deadline.getTime() - Date.now();
    const isPast = diffMs < 0;
    const absDiffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
    const hours = Math.floor(absDiffMinutes / 60);
    const minutes = absDiffMinutes % 60;

    return {
      isBreached: isPast && !isResolved,
      diffMinutes: Math.floor(diffMs / (1000 * 60)),
      formatted: isPast
        ? `Overdue by ${hours}h ${minutes}m`
        : `${hours}h ${minutes}m remaining`,
    };
  }
}
