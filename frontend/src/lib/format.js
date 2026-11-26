export const STATUSES = ["SUBMITTED", "IN_PROGRESS", "RESOLVED", "REJECTED", "ESCALATED"];
export const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
export const SLA_HOURS = { CRITICAL: 6, HIGH: 12, MEDIUM: 24, LOW: 48 };

// Categories the ML service predicts (mirrors backend routingService)
export const CATEGORIES = [
  "Electrical Maintenance", "Plumbing & Sanitation", "IT & Digital Services",
  "Hostel & Accommodation", "Academic & Courses", "Exams & Assessment", "Library",
  "Internships & Placements", "Administration & Documents", "Student Activities & Events",
  "Transport & Parking", "Campus Facilities & Maintenance",
];

export const statusLabel = (s) =>
  ({ SUBMITTED: "Submitted", IN_PROGRESS: "In progress", RESOLVED: "Resolved", REJECTED: "Rejected", ESCALATED: "Escalated" }[s] || s);

export const priorityLabel = (p) => (p ? p[0] + p.slice(1).toLowerCase() : "—");

export const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;

export function timeAgo(date) {
  if (!date) return "";
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(date).toLocaleDateString();
}

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** Fraction of the SLA window still left, 0..1 */
export function slaLeft(c) {
  if (!c?.slaDeadlineAt || !c?.slaHours) return 0;
  const left = new Date(c.slaDeadlineAt).getTime() - Date.now();
  return Math.max(0, Math.min(1, left / (c.slaHours * 3600 * 1000)));
}

export function slaCountdown(deadline) {
  const ms = new Date(deadline).getTime() - Date.now();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  return { overdue: ms < 0, text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
}

export const firstName = (n = "") => n.split(" ")[0];
export const initials = (n = "") => n.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
export const isClosed = (s) => s === "RESOLVED" || s === "REJECTED";
