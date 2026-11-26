import bcrypt from "bcryptjs";
import { db, pool } from "../config/database";
import { users, departments, complaints, complaintTimeline, gbuStudentRoster } from "./schema";
import { AiService } from "../services/aiService";
import { RoutingService } from "../services/routingService";
import { SlaService } from "../services/slaService";

async function seed() {
  console.log("=================================================");
  console.log("🌱 SEEDING GBU SMART CAMPUS COMPLAINT SYSTEM");
  console.log("=================================================");

  // Ensure pgvector extension exists
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
  } catch (err) {
    console.warn("Notice: Could not automatically enable pgvector extension in seed script:", (err as Error).message);
  }

  // 1. Seed GBU Departments
  console.log("1. Seeding GBU Departments...");
  const deptList = [
    {
      name: "GBU Central Electrical Maintenance Division",
      code: "ELEC",
      contactEmail: "electrical@gbu.ac.in",
      headName: "Er. Ramesh Sharma (Executive Engineer)",
    },
    {
      name: "GBU Campus Sanitation & Water Works",
      code: "PLUMB",
      contactEmail: "waterworks@gbu.ac.in",
      headName: "Mr. Suresh Verma (Superintendent)",
    },
    {
      name: "GBU Computer Center & Campus IT Cell (SOICT)",
      code: "IT",
      contactEmail: "itcell@gbu.ac.in",
      headName: "Dr. Ananya Roy (Director, IT)",
    },
    {
      name: "GBU Council of Wardens & Hostel Administration",
      code: "HOSTEL",
      contactEmail: "chiefwarden@gbu.ac.in",
      headName: "Prof. Rajesh Nair (Chief Warden)",
    },
    {
      name: "GBU Academic & Examination Affairs",
      code: "ACAD",
      contactEmail: "exam@gbu.ac.in",
      headName: "Dean of Academic Affairs",
    },
    {
      name: "GBU Central Administration (Registrar Office)",
      code: "GEN",
      contactEmail: "registrar@gbu.ac.in",
      headName: "Registrar, GBU",
    },
  ];

  await db
    .insert(departments)
    .values(deptList)
    .onConflictDoNothing({ target: departments.code });

  const allDepts = await db.select().from(departments);
  const deptMap = new Map(allDepts.map((d) => [d.code, d.id]));

  // 2. Seed GBU CSMS / Samarth Master Student Roster
  console.log("2. Seeding GBU CSMS / Samarth Student Roster...");
  const rosterList = [
    {
      enrollmentNo: "22/ICS/045",
      fullName: "Abhishek Sajwan",
      school: "School of ICT (SOICT)",
      program: "B.Tech Computer Science & Engineering",
      hostelBlock: "Birsa Munda Hostel",
      roomNo: "B-204",
      registeredEmail: "abhishek.sajwan@gbu.ac.in",
      isClaimed: true, // Pre-activated for demo
    },
    {
      enrollmentNo: "22/ICS/012",
      fullName: "Aarav Sharma",
      school: "School of ICT (SOICT)",
      program: "B.Tech Computer Science & Engineering",
      hostelBlock: "Sant Kabir Hostel",
      roomNo: "A-108",
      registeredEmail: "aarav.sharma@gbu.ac.in",
      isClaimed: true, // Pre-activated for demo
    },
    {
      enrollmentNo: "23/SOE/034",
      fullName: "Priya Patel",
      school: "School of Engineering (SOE)",
      program: "B.Tech Mechanical Engineering",
      hostelBlock: "Mahamaya Hostel",
      roomNo: "C-302",
      registeredEmail: "priya.patel@gbu.ac.in",
      isClaimed: true, // Pre-activated for demo
    },
    {
      // Unclaimed profile for testing onboarding
      enrollmentNo: "23/SOBT/019",
      fullName: "Rohan Verma",
      school: "School of Biotechnology (SOBT)",
      program: "B.Tech Biotechnology",
      hostelBlock: "Birsa Munda Hostel",
      roomNo: "B-110",
      registeredEmail: "rohan.verma@gbu.ac.in",
      isClaimed: false, // Testing profile for new student registration
    },
    {
      // Unclaimed profile for testing onboarding
      enrollmentNo: "22/SOM/008",
      fullName: "Sneha Rao",
      school: "School of Management (SOM)",
      program: "MBA (Finance & Analytics)",
      hostelBlock: "Rani Laxmibai Hostel",
      roomNo: "D-104",
      registeredEmail: "sneha.rao@gbu.ac.in",
      isClaimed: false,
    },
  ];

  await db
    .insert(gbuStudentRoster)
    .values(rosterList)
    .onConflictDoNothing({ target: gbuStudentRoster.enrollmentNo });

  // 3. Seed Users (Admin, Staff, and Verified GBU Students)
  console.log("3. Seeding User Accounts (Admin, Staff, Students)...");
  const passwordHash = await bcrypt.hash("Password@123", 10);

  const usersList = [
    {
      name: "GBU Chief Proctor / Admin",
      email: "admin@gbu.ac.in",
      passwordHash,
      role: "ADMIN" as const,
      departmentId: deptMap.get("GEN"),
      phone: "+91 120 2344000",
    },
    {
      name: "Er. Ramesh Sharma (Electrical Staff)",
      email: "staff.elec@gbu.ac.in",
      passwordHash,
      role: "STAFF" as const,
      departmentId: deptMap.get("ELEC"),
      phone: "+91 120 2344001",
    },
    {
      name: "Abhishek Sajwan",
      email: "abhishek.sajwan@gbu.ac.in",
      passwordHash,
      role: "STUDENT" as const,
      enrollmentNo: "22/ICS/045",
      school: "School of ICT (SOICT)",
      hostelBlock: "Birsa Munda Hostel",
      roomNo: "B-204",
      phone: "+91 9876543210",
    },
    {
      name: "Aarav Sharma",
      email: "aarav.sharma@gbu.ac.in",
      passwordHash,
      role: "STUDENT" as const,
      enrollmentNo: "22/ICS/012",
      school: "School of ICT (SOICT)",
      hostelBlock: "Sant Kabir Hostel",
      roomNo: "A-108",
      phone: "+91 9876543211",
    },
    {
      name: "Priya Patel",
      email: "priya.patel@gbu.ac.in",
      passwordHash,
      role: "STUDENT" as const,
      enrollmentNo: "23/SOE/034",
      school: "School of Engineering (SOE)",
      hostelBlock: "Mahamaya Hostel",
      roomNo: "C-302",
      phone: "+91 9876543212",
    },
  ];

  await db
    .insert(users)
    .values(usersList)
    .onConflictDoNothing({ target: users.email });

  const allUsers = await db.select().from(users);
  const adminUser = allUsers.find((u) => u.role === "ADMIN")!;
  const abhishekUser = allUsers.find((u) => u.email === "abhishek.sajwan@gbu.ac.in")!;
  const priyaUser = allUsers.find((u) => u.email === "priya.patel@gbu.ac.in")!;

  // 4. Seed Realistic GBU Campus Complaints
  console.log("4. Seeding Realistic GBU Campus Complaints...");

  const sampleComplaints = [
    {
      ticketNumber: "GBU-2026-EL01",
      title: "Ceiling fan stopped working in Room B-204",
      description: "The ceiling fan in Room B-204 stopped spinning yesterday evening. It is making a loud humming noise. Caretaker was notified twice.",
      location: "Room B-204, Birsa Munda Hostel",
      studentId: abhishekUser.id,
      status: "IN_PROGRESS" as const,
    },
    {
      ticketNumber: "GBU-2026-EL02",
      title: "Ceiling fan completely halted in Room B-204",
      description: "Fan in room 204 has halted and regulator dial is unresponsive. Capacitor needs replacement.",
      location: "Room B-204, Birsa Munda Hostel",
      studentId: priyaUser.id,
      status: "SUBMITTED" as const, // Duplicate match for EL01 (Demonstrates Similarity Search!)
    },
    {
      ticketNumber: "GBU-2026-CR01",
      title: "Exposed junction wire sparking near Lab 3 switchboard",
      description: "Severe hazard! High-voltage sparking with burning smell near Workbench 4 in SOICT Lab 3. Please cut main breaker immediately!",
      location: "SOICT Building, 1st Floor, Computer Lab 3",
      studentId: abhishekUser.id,
      status: "SUBMITTED" as const, // Critical priority (6-hour SLA)
    },
    {
      ticketNumber: "GBU-2026-PL01",
      title: "Water tap leakage causing flooding on 2nd floor",
      description: "Washroom tap on 2nd floor is broken and continuously running, causing water accumulation and slippery floor.",
      location: "Mahamaya Girls Hostel, 2nd Floor Washroom",
      studentId: priyaUser.id,
      status: "SUBMITTED" as const,
    },
    {
      ticketNumber: "GBU-2026-IT01",
      title: "Campus Wi-Fi AP disconnected before midterm exams",
      description: "No internet connection in SOICT Central Library Reading Hall. GBU-WiFi SSID is inaccessible on all student laptops.",
      location: "Central Library 1st Floor Reading Room",
      studentId: abhishekUser.id,
      status: "SUBMITTED" as const,
    },
    {
      ticketNumber: "GBU-2026-OV01",
      title: "Drinking water dispenser filter smells dusty",
      description: "Filter water in Birsa Munda Hostel mess dining hall dispenser has stale odor, needs cartridge replacement.",
      location: "Birsa Munda Hostel Mess Dining Hall",
      studentId: priyaUser.id,
      status: "IN_PROGRESS" as const,
      forceOverride: true, // Demonstrates Admin Human-in-the-Loop Override!
    },
  ];

  for (const item of sampleComplaints) {
    const text = `${item.title}. ${item.description}. Location: ${item.location}`;
    const ai = AiService.simulateAiResponse(text);

    let finalCategory = ai.category.value;
    let finalPriority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = ai.priority.value;
    let isAiOverridden = false;
    let overrideReason: string | null = null;
    let overriddenById: string | null = null;
    let overriddenAt: Date | null = null;

    if (item.forceOverride) {
      isAiOverridden = true;
      finalCategory = "Plumbing & Sanitation";
      finalPriority = "MEDIUM";
      overrideReason = "Water filtration cartridge sanitation falls under Campus Water Works protocol";
      overriddenById = adminUser.id;
      overriddenAt = new Date();
    }

    const deptCode = RoutingService.getDepartmentCodeForCategory(finalCategory);
    const targetDeptId = deptMap.get(deptCode) || deptMap.get("GEN")!;

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
          action: "SUBMITTED" as const,
          note: `Complaint filed by verified GBU student at ${item.location}`,
        },
        {
          complaintId: created.id,
          actorId: null,
          action: "AI_ANALYZED" as const,
          note: `AI classified as "${ai.category.value}" (${(ai.category.confidence * 100).toFixed(0)}%) with priority "${ai.priority.value}". SLA set to ${slaHours}h.`,
        },
        ...(isAiOverridden
          ? [
              {
                complaintId: created.id,
                actorId: adminUser.id,
                action: "AI_OVERRIDDEN" as const,
                note: `Admin override applied: "${overrideReason}"`,
              },
            ]
          : []),
      ]);
    }
  }

  console.log("=================================================");
  console.log("✅ GBU DATABASE SEED COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
  console.log("📋 Verified GBU Test Credentials:");
  console.log("  Admin:     admin@gbu.ac.in        / Password@123");
  console.log("  Staff:     staff.elec@gbu.ac.in   / Password@123");
  console.log("  Student 1: abhishek.sajwan@gbu.ac.in (22/ICS/045) / Password@123");
  console.log("  Student 2: priya.patel@gbu.ac.in     (23/SOE/034) / Password@123");
  console.log("-------------------------------------------------");
  console.log("💡 Unclaimed GBU Enrollment for Testing Onboarding:");
  console.log("  Enrollment No: 23/SOBT/019 (Rohan Verma, School of Biotech)");
  console.log("  Default OTP:   123456 (or check terminal log)");
  console.log("=================================================");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  pool.end();
  process.exit(1);
});
