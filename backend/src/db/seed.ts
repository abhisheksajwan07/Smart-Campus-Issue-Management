import bcrypt from "bcryptjs";
import { db, pool } from "../config/database";
import { users, departments, complaints, complaintTimeline } from "./schema";
import { AiService } from "../services/aiService";
import { SlaService } from "../services/slaService";

async function seed() {
  console.log("🌱 Starting Smart Campus Database Seeding...");

  // 1. Seed Departments
  console.log("Creating departments...");
  const deptList = [
    {
      name: "Electrical & Power Infrastructure",
      code: "ELEC",
      contactEmail: "electrical@campus.edu",
      headName: "Er. Ramesh Sharma",
    },
    {
      name: "Plumbing & Sanitation",
      code: "PLUMB",
      contactEmail: "plumbing@campus.edu",
      headName: "Mr. Suresh Verma",
    },
    {
      name: "IT & Campus Network Services",
      code: "IT",
      contactEmail: "itsupport@campus.edu",
      headName: "Dr. Ananya Roy",
    },
    {
      name: "Hostel & Mess Administration",
      code: "HOSTEL",
      contactEmail: "hosteladmin@campus.edu",
      headName: "Col. Rajesh Nair",
    },
    {
      name: "General Campus Administration",
      code: "GEN",
      contactEmail: "admin@campus.edu",
      headName: "Dean of Student Affairs",
    },
  ];

  const seededDepts = await db
    .insert(departments)
    .values(deptList)
    .onConflictDoNothing({ target: departments.code })
    .returning();

  const allDepts = await db.select().from(departments);
  const deptMap = new Map(allDepts.map((d) => [d.code, d.id]));

  // 2. Seed Users
  console.log("Creating default seed users...");
  const passwordHash = await bcrypt.hash("Password@123", 10);

  const usersList = [
    {
      name: "Admin Officer",
      email: "admin@campus.edu",
      passwordHash,
      role: "ADMIN",
      departmentId: deptMap.get("GEN"),
      phone: "+91 9876543210",
    },
    {
      name: "Electrical Supervisor",
      email: "staff.elec@campus.edu",
      passwordHash,
      role: "STAFF",
      departmentId: deptMap.get("ELEC"),
      phone: "+91 9876543211",
    },
    {
      name: "Aarav Sharma",
      email: "student@campus.edu",
      passwordHash,
      role: "STUDENT",
      phone: "+91 9876543212",
    },
    {
      name: "Priya Patel",
      email: "priya@campus.edu",
      passwordHash,
      role: "STUDENT",
      phone: "+91 9876543213",
    },
  ];

  await db
    .insert(users)
    .values(usersList)
    .onConflictDoNothing({ target: users.email });

  const allUsers = await db.select().from(users);
  const adminUser = allUsers.find((u) => u.role === "ADMIN")!;
  const studentUser = allUsers.find((u) => u.email === "student@campus.edu")!;
  const priyaUser = allUsers.find((u) => u.email === "priya@campus.edu")!;

  // 3. Seed Realistic Complaints
  console.log("Seeding realistic sample complaints...");

  const sampleComplaints = [
    {
      ticketNumber: "CMP-2026-EL01",
      title: "Ceiling fan stopped working in Room 204",
      description: "The fan in room 204 stopped working yesterday afternoon. Regulating speed does not work either. We already reported twice to caretaker.",
      location: "Room 204, Boys Hostel B",
      studentId: studentUser.id,
      status: "IN_PROGRESS",
    },
    {
      ticketNumber: "CMP-2026-EL02",
      title: "Ceiling fan in room 204 has completely halted",
      description: "Fan in room 204 stopped spinning and making humming noise. Needs urgent replacement or capacitor repair.",
      location: "Room 204, Boys Hostel B",
      studentId: priyaUser.id,
      status: "SUBMITTED", // Duplicate match for EL01!
    },
    {
      ticketNumber: "CMP-2026-CR01",
      title: "Exposed wire sparking in Physics Lab 3",
      description: "Severe hazard! The junction box near workbench 4 is sparking with visible smoke and burnt smell. Please cut the power!",
      location: "Physics Lab 3, Science Block Ground Floor",
      studentId: studentUser.id,
      status: "SUBMITTED",
    },
    {
      ticketNumber: "CMP-2026-PL01",
      title: "Continuous water tap leakage in 2nd floor washroom",
      description: "Tap is broken and leaking continuously for 3 days, causing floor flooding and slippery conditions.",
      location: "2nd Floor Washroom, Academic Block C",
      studentId: priyaUser.id,
      status: "SUBMITTED",
    },
    {
      ticketNumber: "CMP-2026-IT01",
      title: "Wi-Fi access point dead before midterm examinations",
      description: "No internet connection in Library reading room for past 6 hours. SSIDs are not visible on any student device.",
      location: "Central Library 1st Floor Reading Room",
      studentId: studentUser.id,
      status: "SUBMITTED",
    },
    {
      ticketNumber: "CMP-2026-OV01",
      title: "Room water dispenser filter smells dusty",
      description: "Filter water in dispenser has stale smell, needs cartridge replacement and sanitization.",
      location: "Hostel Mess Dining Hall",
      studentId: priyaUser.id,
      status: "IN_PROGRESS",
      // We will override this one to demonstrate Human-in-the-Loop!
      forceOverride: true,
    },
  ];

  for (const item of sampleComplaints) {
    const text = `${item.title}. ${item.description}. Location: ${item.location}`;
    const ai = AiService.simulateAiResponse(text);

    let finalCategory = ai.category.value;
    let finalPriority = ai.priority.value;
    let isAiOverridden = false;
    let overrideReason = null;
    let overriddenById = null;
    let overriddenAt = null;

    if (item.forceOverride) {
      // Human overrides AI from General/Hostel to Plumbing & Sanitation
      isAiOverridden = true;
      finalCategory = "Plumbing";
      finalPriority = "MEDIUM";
      overrideReason = "Water filter sanitation falls under Plumbing & Sanitation division protocol";
      overriddenById = adminUser.id;
      overriddenAt = new Date();
    }

    const targetDeptId =
      finalCategory === "Electrical"
        ? deptMap.get("ELEC")
        : finalCategory === "Plumbing"
        ? deptMap.get("PLUMB")
        : finalCategory === "IT / Network"
        ? deptMap.get("IT")
        : deptMap.get("HOSTEL");

    const slaHours = SlaService.getSlaHours(finalPriority);
    const slaDeadlineAt = SlaService.computeDeadline(finalPriority);

    const [created] = await db
      .insert(complaints)
      .values({
        ticketNumber: item.ticketNumber,
        title: item.title,
        description: item.description,
        location: item.location,
        status: item.status,
        studentId: item.studentId,
        assignedDepartmentId: targetDeptId || deptMap.get("GEN")!,
        predictedCategory: ai.category.value,
        predictedPriority: ai.priority.value,
        aiConfidenceCategory: ai.category.confidence,
        aiConfidencePriority: ai.priority.confidence,
        aiSummary: ai.summary,
        suggestedAction: ai.suggestedAction,
        embedding: ai.embedding,
        finalCategory,
        finalPriority,
        isAiOverridden,
        overrideReason,
        overriddenById,
        overriddenAt,
        slaHours,
        slaDeadlineAt,
        isSlaBreached: false,
      })
      .onConflictDoNothing({ target: complaints.ticketNumber })
      .returning();

    if (created) {
      await db.insert(complaintTimeline).values([
        {
          complaintId: created.id,
          actorId: item.studentId,
          action: "SUBMITTED",
          note: "Complaint submitted via student portal",
        },
        {
          complaintId: created.id,
          actorId: null,
          action: "AI_ANALYZED",
          note: `AI classified as "${ai.category.value}" (${(ai.category.confidence * 100).toFixed(0)}%) with priority "${ai.priority.value}". SLA set to ${slaHours}h.`,
        },
        ...(isAiOverridden
          ? [
              {
                complaintId: created.id,
                actorId: adminUser.id,
                action: "AI_OVERRIDDEN",
                note: `Admin override applied: "${overrideReason}"`,
              },
            ]
          : []),
      ]);
    }
  }

  console.log("✅ Seed completed successfully!");
  console.log("-------------------------------------------------");
  console.log("Default credentials to test:");
  console.log("  Admin:   admin@campus.edu   / Password@123");
  console.log("  Student: student@campus.edu / Password@123");
  console.log("  Staff:   staff.elec@campus.edu / Password@123");
  console.log("=================================================");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  pool.end();
  process.exit(1);
});
