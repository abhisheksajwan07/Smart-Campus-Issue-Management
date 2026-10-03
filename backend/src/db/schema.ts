import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  real,
  timestamp,
  vector,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["STUDENT", "ADMIN", "STAFF"]);

export const complaintStatusEnum = pgEnum("complaint_status", [
  "SUBMITTED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
  "ESCALATED",
]);

export const priorityLevelEnum = pgEnum("priority_level", [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
]);

export const timelineActionEnum = pgEnum("timeline_action", [
  "SUBMITTED",
  "AI_ANALYZED",
  "ASSIGNED",
  "STATUS_UPDATED",
  "AI_OVERRIDDEN",
  "RESOLVED",
  "ESCALATED",
]);

export const gbuStudentRoster = pgTable("gbu_student_roster", {
  enrollmentNo: varchar("enrollment_no", { length: 50 }).primaryKey(), // e.g. "232/ICS/045"
  fullName: varchar("full_name", { length: 255 }).notNull(),
  school: varchar("school", { length: 100 }).notNull(), // e.g. "School of ICT (SOICT)", "School of Engineering (SOE)"
  program: varchar("program", { length: 100 }), // e.g. "B.Tech Computer Science & Engineering"
  hostelBlock: varchar("hostel_block", { length: 100 }), // e.g. "Birsa Munda Hostel", "Mahamaya Hostel"
  roomNo: varchar("room_no", { length: 50 }), // e.g. "B-204"
  registeredEmail: varchar("registered_email", { length: 255 }).notNull(),
  isClaimed: boolean("is_claimed").default(false).notNull(),
  activeOtp: varchar("active_otp", { length: 10 }),
  otpExpiresAt: timestamp("otp_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  code: varchar("code", { length: 32 }).notNull().unique(), // e.g. ELEC, PLUMB, IT, HOSTEL, ACAD
  contactEmail: varchar("contact_email", { length: 255 }),
  headName: varchar("head_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").default("STUDENT").notNull(),

  // GBU Academic & Residential Profile
  enrollmentNo: varchar("enrollment_no", { length: 50 })
    .references(() => gbuStudentRoster.enrollmentNo)
    .unique(),
  school: varchar("school", { length: 100 }),
  hostelBlock: varchar("hostel_block", { length: 100 }),
  roomNo: varchar("room_no", { length: 50 }),

  departmentId: uuid("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  phone: varchar("phone", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const complaints = pgTable(
  "complaints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketNumber: varchar("ticket_number", { length: 32 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    location: varchar("location", { length: 255 }).notNull(), // e.g. "Room 204, Hostel C"
    imageUrl: text("image_url"), // Photo evidence uploaded by student

    // Status lifecycle: SUBMITTED | IN_PROGRESS | RESOLVED | REJECTED | ESCALATED
    status: complaintStatusEnum("status").default("SUBMITTED").notNull(),

    // Associations
    studentId: uuid("student_id")
      .references(() => users.id)
      .notNull(),
    assignedDepartmentId: uuid("assigned_department_id").references(
      () => departments.id,
      { onDelete: "set null" },
    ),
    assignedStaffId: uuid("assigned_staff_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // AI PREDICTION OUTPUTS (from Python ML FastAPI /analyze)

    predictedCategory: varchar("predicted_category", { length: 100 }),
    predictedPriority: priorityLevelEnum("predicted_priority"),
    aiConfidenceCategory: real("ai_confidence_category"),
    aiConfidencePriority: real("ai_confidence_priority"),
    aiSummary: text("ai_summary"),
    suggestedAction: text("suggested_action"),
    // 384-dimensional vector embedding for native pgvector cosine similarity search
    embedding: vector("embedding", { dimensions: 384 }),

    // Human-in-the-Loop Override Tracking
    finalCategory: varchar("final_category", { length: 100 }).notNull(),
    finalPriority: priorityLevelEnum("final_priority").notNull(),
    isAiOverridden: boolean("is_ai_overridden").default(false).notNull(),
    overriddenById: uuid("overridden_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    overriddenAt: timestamp("overridden_at"),
    overrideReason: text("override_reason"),

    // SLA & ESCALATION MANAGEMENT

    slaHours: integer("sla_hours").default(48).notNull(),
    slaDeadlineAt: timestamp("sla_deadline_at").notNull(),
    isSlaBreached: boolean("is_sla_breached").default(false).notNull(),
    resolvedAt: timestamp("resolved_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("complaints_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const complaintTimeline = pgTable("complaint_timeline", {
  id: uuid("id").defaultRandom().primaryKey(),
  complaintId: uuid("complaint_id")
    .references(() => complaints.id, { onDelete: "cascade" })
    .notNull(),
  actorId: uuid("actor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  action: timelineActionEnum("action").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const departmentsRelations = relations(departments, ({ many }) => ({
  staff: many(users),
  complaints: many(complaints),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  rosterProfile: one(gbuStudentRoster, {
    fields: [users.enrollmentNo],
    references: [gbuStudentRoster.enrollmentNo],
  }),
  complaints: many(complaints, { relationName: "studentComplaints" }),
  assignedComplaints: many(complaints, { relationName: "assignedComplaints" }),
  overriddenComplaints: many(complaints, { relationName: "overriddenComplaints" }),
  timelineActions: many(complaintTimeline),
}));

export const gbuStudentRosterRelations = relations(
  gbuStudentRoster,
  ({ one }) => ({
    userAccount: one(users),
  }),
);

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
    relationName: "overriddenComplaints",
  }),
  timeline: many(complaintTimeline),
}));


export const complaintTimelineRelations = relations(
  complaintTimeline,
  ({ one }) => ({
    complaint: one(complaints, {
      fields: [complaintTimeline.complaintId],
      references: [complaints.id],
    }),
    actor: one(users, {
      fields: [complaintTimeline.actorId],
      references: [users.id],
    }),
  }),
);
