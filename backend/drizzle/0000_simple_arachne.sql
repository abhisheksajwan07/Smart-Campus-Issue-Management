CREATE TYPE "public"."complaint_status" AS ENUM('SUBMITTED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'ESCALATED');--> statement-breakpoint
CREATE TYPE "public"."priority_level" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."timeline_action" AS ENUM('SUBMITTED', 'AI_ANALYZED', 'ASSIGNED', 'STATUS_UPDATED', 'AI_OVERRIDDEN', 'RESOLVED', 'ESCALATED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('STUDENT', 'ADMIN', 'STAFF');--> statement-breakpoint
CREATE TABLE "complaint_timeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"complaint_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" timeline_action NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"location" varchar(255) NOT NULL,
	"image_url" text,
	"status" "complaint_status" DEFAULT 'SUBMITTED' NOT NULL,
	"student_id" uuid NOT NULL,
	"assigned_department_id" uuid,
	"assigned_staff_id" uuid,
	"predicted_category" varchar(100),
	"predicted_priority" "priority_level",
	"ai_confidence_category" real,
	"ai_confidence_priority" real,
	"ai_summary" text,
	"suggested_action" text,
	"embedding" vector(384),
	"final_category" varchar(100) NOT NULL,
	"final_priority" "priority_level" NOT NULL,
	"is_ai_overridden" boolean DEFAULT false NOT NULL,
	"overridden_by_id" uuid,
	"overridden_at" timestamp,
	"override_reason" text,
	"sla_hours" integer DEFAULT 48 NOT NULL,
	"sla_deadline_at" timestamp NOT NULL,
	"is_sla_breached" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "complaints_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(32) NOT NULL,
	"contact_email" varchar(255),
	"head_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name"),
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "gbu_student_roster" (
	"enrollment_no" varchar(50) PRIMARY KEY NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"school" varchar(100) NOT NULL,
	"program" varchar(100),
	"hostel_block" varchar(100),
	"room_no" varchar(50),
	"registered_email" varchar(255) NOT NULL,
	"is_claimed" boolean DEFAULT false NOT NULL,
	"active_otp" varchar(10),
	"otp_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'STUDENT' NOT NULL,
	"enrollment_no" varchar(50),
	"school" varchar(100),
	"hostel_block" varchar(100),
	"room_no" varchar(50),
	"department_id" uuid,
	"phone" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_enrollment_no_unique" UNIQUE("enrollment_no")
);
--> statement-breakpoint
ALTER TABLE "complaint_timeline" ADD CONSTRAINT "complaint_timeline_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_timeline" ADD CONSTRAINT "complaint_timeline_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assigned_department_id_departments_id_fk" FOREIGN KEY ("assigned_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_overridden_by_id_users_id_fk" FOREIGN KEY ("overridden_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_enrollment_no_gbu_student_roster_enrollment_no_fk" FOREIGN KEY ("enrollment_no") REFERENCES "public"."gbu_student_roster"("enrollment_no") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "complaints_embedding_hnsw_idx" ON "complaints" USING hnsw ("embedding" vector_cosine_ops);