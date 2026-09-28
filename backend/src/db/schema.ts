import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// -------------------------------------------------------------
// 1. DEPARTMENTS TABLE
// -------------------------------------------------------------
export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  code: varchar("code", { length: 32 }).notNull().unique(), // e.g. ELEC, PLUMB, IT, HOSTEL, ADMIN
  contactEmail: varchar("contact_email", { length: 255 }),
  headName: varchar("head_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// -------------------------------------------------------------
// 2. USERS TABLE
// -------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 32 }).default("STUDENT").notNull(), // STUDENT | ADMIN | STAFF
  departmentId: uuid("department_id").references(() => departments.id),
  phone: varchar("phone", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -------------------------------------------------------------
// 3. COMPLAINTS TABLE (Core with AI & Human-in-the-Loop fields)
// -------------------------------------------------------------
export const complaints = pgTable("complaints", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 32 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  location: varchar("location", { length: 255 }).notNull(), // e.g. "Room 204, Hostel C"
  
  // Status lifecycle: SUBMITTED | IN_PROGRESS | RESOLVED | REJECTED | ESCALATED
  status: varchar("status", { length: 32 }).default("SUBMITTED").notNull(),

  // Associations
  studentId: uuid("student_id").references(() => users.id).notNull(),
  assignedDepartmentId: uuid("assigned_department_id").references(() => departments.id),
  assignedStaffId: uuid("assigned_staff_id").references(() => users.id),

  // -----------------------------------------------------------
  // AI PREDICTION OUTPUTS (from Python ML FastAPI /analyze)
  // -----------------------------------------------------------
  predictedCategory: varchar("predicted_category", { length: 100 }),
  predictedPriority: varchar("predicted_priority", { length: 50 }), // CRITICAL | HIGH | MEDIUM | LOW
  aiConfidenceCategory: real("ai_confidence_category"),
  aiConfidencePriority: real("ai_confidence_priority"),
  aiSummary: text("ai_summary"),
  suggestedAction: text("suggested_action"),
  // Stored as 384-dimensional float vector array in JSONB for universal compatibility
  embedding: jsonb("embedding").$type<number[]>(),

  // -----------------------------------------------------------
  // HUMAN OVERRIDE (CRITICAL VIVA KILLER FEATURE)
  // -----------------------------------------------------------
  finalCategory: varchar("final_category", { length: 100 }).notNull(),
  finalPriority: varchar("final_priority", { length: 50 }).notNull(),
  isAiOverridden: boolean("is_ai_overridden").default(false).notNull(),
  overriddenById: uuid("overridden_by_id").references(() => users.id),
  overriddenAt: timestamp("overridden_at"),
  overrideReason: text("override_reason"),

  // -----------------------------------------------------------
  // SLA & ESCALATION MANAGEMENT
  // -----------------------------------------------------------
  slaHours: integer("sla_hours").default(48).notNull(),
  slaDeadlineAt: timestamp("sla_deadline_at").notNull(),
  isSlaBreached: boolean("is_sla_breached").default(false).notNull(),
  resolvedAt: timestamp("resolved_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// -------------------------------------------------------------
// 4. COMPLAINT TIMELINE / AUDIT TRAIL
// -------------------------------------------------------------
export const complaintTimeline = pgTable("complaint_timeline", {
  id: uuid("id").defaultRandom().primaryKey(),
  complaintId: uuid("complaint_id")
    .references(() => complaints.id, { onDelete: "cascade" })
    .notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(), // SUBMITTED | AI_ANALYZED | ASSIGNED | STATUS_UPDATED | AI_OVERRIDDEN | RESOLVED | ESCALATED
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// -------------------------------------------------------------
// RELATIONS
// -------------------------------------------------------------
export const departmentsRelations = relations(departments, ({ many }) => ({
  staff: many(users),
  complaints: many(complaints),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  complaints: many(complaints, { relationName: "studentComplaints" }),
  assignedComplaints: many(complaints, { relationName: "assignedComplaints" }),
}));

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  student: one(users, {
    fields: [complaints.studentId],
    references: [users.id],
    relationName: "studentComplaints",
  }),
  assignedDepartment: one(departments, {
    fields: [complaints.assignedDepartmentId],
    references: [departments.id],
  }),
  assignedStaff: one(users, {
    fields: [complaints.assignedStaffId],
    references: [users.id],
    relationName: "assignedComplaints",
  }),
  overriddenBy: one(users, {
    fields: [complaints.overriddenById],
    references: [users.id],
  }),
  timeline: many(complaintTimeline),
}));

export const complaintTimelineRelations = relations(complaintTimeline, ({ one }) => ({
  complaint: one(complaints, {
    fields: [complaintTimeline.complaintId],
    references: [complaints.id],
  }),
  actor: one(users, {
    fields: [complaintTimeline.actorId],
    references: [users.id],
  }),
}));
