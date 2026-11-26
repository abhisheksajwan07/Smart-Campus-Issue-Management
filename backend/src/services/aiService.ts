import axios from "axios";
import { ENV } from "../config/env";
import { AiAnalyzeRequest, AiAnalyzeResponse, PriorityLevel } from "../types";

export const ML_CATEGORIES = [
  "Electrical Maintenance",
  "Plumbing & Sanitation",
  "IT & Digital Services",
  "Hostel & Accommodation",
  "Academic & Courses",
  "Exams & Assessment",
  "Library",
  "Internships & Placements",
  "Administration & Documents",
  "Student Activities & Events",
  "Transport & Parking",
  "Campus Facilities & Maintenance",
] as const;

export const DEFAULT_ML_CATEGORY = "Campus Facilities & Maintenance";
export const EMBEDDING_DIMENSIONS = 384;
const VALID_PRIORITIES: readonly PriorityLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const CONCEPT_CLUSTERS: Record<string, string[]> = {
  FAN_ELECTRICAL: [
    "fan", "ceiling", "buzzing", "humming", "spinning", "rotating", "halted", "regulator",
    "sound", "noise", "blade", "tube", "light", "bulb", "flickering",
  ],
  ELECTRICAL_HAZARD: [
    "spark", "sparking", "socket", "plug", "switchboard", "switch", "shock",
    "wire", "voltage", "mcb", "fuse", "short", "burning",
  ],
  PLUMBING_LEAK: [
    "leak", "leaking", "leakage", "pipe", "basin", "sink", "washroom",
    "bathroom", "dripping", "drainage", "drain", "valve", "tap", "water", "flooding",
  ],
  PLUMBING_FIXTURE: [
    "geyser", "heating", "clogged", "flush", "button", "tank", "toilet", "dispenser", "filter",
  ],
  WIFI_INTERNET: [
    "wifi", "wi-fi", "internet", "network", "access", "connection", "router", "signal", "ssid",
  ],
  ERP_PORTAL: [
    "erp", "portal", "lms", "login", "server", "crash", "error", "credentials", "timeout", "500",
  ],
  MESS_FOOD: [
    "mess", "dinner", "lunch", "food", "chapatis", "cooked", "undercooked", "quality", "taste", "meal",
  ],
  HOSTEL_HYGIENE: [
    "dustbin", "trash", "cans", "corridor", "cleaning", "cleaned", "overflowing", "smell", "waste", "hostel",
  ],
  ACADEMIC_EXAMS: [
    "marksheet", "grade", "marks", "semester", "sem", "exam", "admit", "revaluation", "result", "score",
  ],
  ADMIN_DOCS: [
    "bonafide", "certificate", "passport", "application", "document", "migration", "transcript", "leave", "visa",
  ],
  HOSTEL_HARDWARE: [
    "lock", "key", "door", "jam", "turning", "window", "glass", "cracked", "frame", "room", "bed",
  ],
  CAMPUS_SERVICES: [
    "library", "book", "auditorium", "bus", "transport", "parking", "internship", "placement", "fest", "club", "gym",
  ],
};

export class AiService {
  /**
   * Main AI Orchestration entrypoint.
   * Calls Python FastAPI /analyze with resilient fallback try/catch and strict schema normalization.
   */
  static async analyzeComplaint(req: AiAnalyzeRequest): Promise<AiAnalyzeResponse> {
    // If mock mode is explicitly enabled, use the built-in simulator directly
    if (ENV.USE_MOCK_AI) {
      console.log(`[AI-Service] Using Mock Simulator for complaint: "${req.text.slice(0, 40)}..."`);
      return this.simulateAiResponse(req.text);
    }

    // Call external FastAPI service with try/catch fallback
    try {
      console.log(`[AI-Service] Calling FastAPI ${ENV.FASTAPI_URL}/analyze...`);
      const response = await axios.post<unknown>(
        `${ENV.FASTAPI_URL}/analyze`,
        req,
        { timeout: ENV.FASTAPI_TIMEOUT_MS }
      );

      return this.normalizeMlResponse(response.data, req.text);
    } catch (error) {
      const err = error as Error;
      console.warn(
        `[AI-Service WARNING] FastAPI unreachable or returned error (${err.message}). Activating graceful fallback.`
      );

      // Return resilient fallback so student submission NEVER fails
      return this.getFallbackResponse(req.text);
    }
  }

  /**
   * Validates and normalizes the Python FastAPI /analyze payload so mismatched types,
   * mixed-case priorities (e.g. "High" -> "HIGH"), or malformed vectors never crash DB inserts.
   */
  public static normalizeMlResponse(raw: unknown, sourceText: string): AiAnalyzeResponse {
    if (!raw || typeof raw !== "object") {
      console.warn("[AI-Service WARNING] FastAPI returned non-object payload. Using fallback.");
      return this.getFallbackResponse(sourceText);
    }

    const payload = raw as Record<string, any>;

    const rawCategory =
      typeof payload.category?.value === "string" && payload.category.value.trim()
        ? payload.category.value.trim().slice(0, 100)
        : DEFAULT_ML_CATEGORY;

    const catConfidence = this.clampConfidence(payload.category?.confidence, 0.5);

    const rawPriorityStr =
      typeof payload.priority?.value === "string"
        ? payload.priority.value.trim().toUpperCase()
        : "";
    const priority: PriorityLevel = VALID_PRIORITIES.includes(rawPriorityStr as PriorityLevel)
      ? (rawPriorityStr as PriorityLevel)
      : "MEDIUM";

    const priConfidence = this.clampConfidence(payload.priority?.confidence, 0.5);

    const summary =
      typeof payload.summary === "string" && payload.summary.trim()
        ? payload.summary.trim()
        : this.formatSummary(sourceText);

    const suggestedAction =
      typeof payload.suggestedAction === "string" && payload.suggestedAction.trim()
        ? payload.suggestedAction.trim()
        : this.getSuggestedAction(rawCategory, priority);

    const embedding = this.isValidNonZeroEmbedding(payload.embedding)
      ? payload.embedding
      : this.generateDummyEmbedding(sourceText);

    return {
      category: {
        value: rawCategory,
        confidence: catConfidence,
      },
      priority: {
        value: priority,
        confidence: priConfidence,
      },
      summary,
      suggestedAction,
      embedding,
    };
  }

  private static clampConfidence(value: unknown, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
  }

  private static isValidNonZeroEmbedding(value: unknown): value is number[] {
    if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS) {
      return false;
    }
    let normSq = 0;
    for (const item of value) {
      if (typeof item !== "number" || !Number.isFinite(item)) {
        return false;
      }
      normSq += item * item;
    }
    return normSq > 1e-12;
  }

  private static formatSummary(text: string): string {
    const trimmed = (text || "").trim();
    return trimmed.length <= 100 ? trimmed : `${trimmed.slice(0, 97).trim()}...`;
  }

  /**
   * Maps category + priority to actionable steps aligned with ml-service/main.py
   */
  public static getSuggestedAction(category: string, priority: PriorityLevel): string {
    const pUpper = priority.toUpperCase();
    const catLower = category.toLowerCase();

    if (catLower.includes("electr") && (pUpper === "CRITICAL" || pUpper === "HIGH")) {
      return "Isolate circuit breaker immediately and dispatch duty electrician.";
    }
    if (catLower.includes("electr")) {
      return "Inspect capacitor, wiring, and switchboard terminals.";
    }
    if (catLower.includes("plumb") && (pUpper === "CRITICAL" || pUpper === "HIGH")) {
      return "Shut off main riser valve to prevent flooding and replace damaged pipe/fixture.";
    }
    if (catLower.includes("plumb")) {
      return "Inspect plumbing washers, clean aerator, and check line pressure.";
    }
    if (/\bit\b/.test(catLower) || catLower.includes("digital") || catLower.includes("network")) {
      return "Check network switches/AP DHCP leases and verify student LMS portal credentials.";
    }
    if (catLower.includes("exam")) {
      return "Forward ticket with urgency to Examination & Evaluation Controller Office.";
    }
    if (catLower.includes("acad")) {
      return "Forward student ticket to Academic Dean / Department Course Coordinator.";
    }
    if (catLower.includes("hostel") || catLower.includes("accomm")) {
      return "Notify hostel warden and caretaking staff for on-site room inspection.";
    }
    if (catLower.includes("intern") || catLower.includes("placement")) {
      return "Route application to Corporate Relations & Training/Placement Cell.";
    }
    if (catLower.includes("librar")) {
      return "Refer query to Central Library circulation and digital access desk.";
    }
    if (catLower.includes("transport") || catLower.includes("parking")) {
      return "Notify campus transport officer for parking/bus schedule review.";
    }
    if (catLower.includes("admin") || catLower.includes("document")) {
      return "Forward request to Registrar Office for student verification and document issuance.";
    }
    return "Dispatch campus duty staff for standard on-site inspection and verification.";
  }

  /**
   * Resilient fallback if ML service is down
   */
  private static getFallbackResponse(text: string): AiAnalyzeResponse {
    return {
      category: {
        value: DEFAULT_ML_CATEGORY,
        confidence: 0.5,
      },
      priority: {
        value: "MEDIUM",
        confidence: 0.5,
      },
      summary: this.formatSummary(text),
      suggestedAction: "Awaiting staff manual review and triage.",
      embedding: this.generateDummyEmbedding(text),
    };
  }

  /**
   * ML-aligned Mock AI Simulator for local development and seeding.
   * Uses the exact 12 ML category names produced by ml-service/main.py.
   */
  public static simulateAiResponse(text: string): AiAnalyzeResponse {
    // Strip trailing ". Location: ..." so location names (e.g. "Hostel") do not hijack category rules
    const issueOnly = text.replace(/\.\s*Location:\s*.*$/is, "").trim() || text;
    const lower = issueOnly.toLowerCase();

    // 1. Category Detection aligned with ML service classes
    let category: string = DEFAULT_ML_CATEGORY;
    let catConfidence = 0.7;

    if (
      ["fan", "light", "wire", "switch", "electric", "power", "plug", "socket", "spark", "voltage", "mcb", "fuse"].some(
        (k) => lower.includes(k)
      )
    ) {
      category = "Electrical Maintenance";
      catConfidence = 0.95;
    } else if (
      ["water", "tap", "leak", "pipe", "toilet", "washroom", "drain", "sink", "flush", "geyser", "tank", "sewage"].some(
        (k) => lower.includes(k)
      )
    ) {
      category = "Plumbing & Sanitation";
      catConfidence = 0.95;
    } else if (
      ["wifi", "wi-fi", "internet", "lan", "network", "portal", "website", "router", "login", "server", "access point", "lms", "erp", "password"].some(
        (k) => lower.includes(k)
      )
    ) {
      category = "IT & Digital Services";
      catConfidence = 0.93;
    } else if (
      ["exam", "marksheet", "mark sheet", "admit", "revaluation", "grade", "result", "midterm"].some(
        (k) => lower.includes(k)
      )
    ) {
      category = "Exams & Assessment";
      catConfidence = 0.92;
    } else if (
      ["internship", "intern", "placement", "recruit", "interview", "campus drive"].some((k) => lower.includes(k))
    ) {
      category = "Internships & Placements";
      catConfidence = 0.9;
    } else if (
      ["library", "book", "auditorium", "reading room", "reading hall"].some((k) => lower.includes(k))
    ) {
      category = "Library";
      catConfidence = 0.9;
    } else if (
      ["bus", "transport", "shuttle", "parking", "vehicle"].some((k) => lower.includes(k))
    ) {
      category = "Transport & Parking";
      catConfidence = 0.9;
    } else if (
      ["fest", "cultural", "club", "gym", "sports", "event", "photography", "tournament"].some((k) => lower.includes(k))
    ) {
      category = "Student Activities & Events";
      catConfidence = 0.89;
    } else if (
      ["certificate", "bonafide", "migration", "id card", "identity card", "transcript", "visa", "leave", "registrar", "scholarship", "fee"].some(
        (k) => lower.includes(k)
      )
    ) {
      category = "Administration & Documents";
      catConfidence = 0.89;
    } else if (
      ["attendance", "faculty", "timetable", "class", "professor", "syllabus", "degree", "branch", "elective", "course", "project", "assignment"].some(
        (k) => lower.includes(k)
      )
    ) {
      category = "Academic & Courses";
      catConfidence = 0.9;
    } else if (
      ["mess", "food", "hostel", "warden", "room", "bed", "clean", "dustbin", "trash", "laundry", "caretaker", "chapati", "dinner", "lunch", "lock", "window", "allotment", "dispenser", "cooler"].some(
        (k) => lower.includes(k)
      )
    ) {
      category = "Hostel & Accommodation";
      catConfidence = 0.89;
    }

    // 2. Priority Detection
    let priority: PriorityLevel = "MEDIUM";
    let priConfidence = 0.82;

    if (
      ["spark", "smoke", "fire", "shock", "burst", "flood", "emergency", "danger", "burning", "high-voltage"].some(
        (k) => lower.includes(k)
      )
    ) {
      priority = "CRITICAL";
      priConfidence = 0.98;
    } else if (
      ["exam", "stopped working", "halted", "urgent", "asap", "broken", "entire floor", "no water", "disconnected", "cannot", "unable", "lost", "absent", "deadline", "mistakenly", "down"].some(
        (k) => lower.includes(k)
      )
    ) {
      priority = "HIGH";
      priConfidence = 0.89;
    } else if (
      ["paint", "dust", "minor", "creak", "suggestion", "timings", "menu", "rules", "details", "how to", "procedure"].some(
        (k) => lower.includes(k)
      )
    ) {
      priority = "LOW";
      priConfidence = 0.85;
    }

    // 3. Summarization & Action Recommendation
    const summary = this.formatSummary(issueOnly);
    const suggestedAction = this.getSuggestedAction(category, priority);

    return {
      category: {
        value: category,
        confidence: catConfidence,
      },
      priority: {
        value: priority,
        confidence: priConfidence,
      },
      summary,
      suggestedAction,
      embedding: this.generateDummyEmbedding(text),
    };
  }

  /**
   * Generates a 384-dimensional L2-normalized semantic vector for mock/fallback duplicate detection.
   * Projects campus domain concepts, room/location identifiers, and character trigrams into a unit vector.
   */
  public static generateDummyEmbedding(text: string): number[] {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    const clean = (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
    const words = clean.split(/\s+/).filter(Boolean);

    // 1. Concept Projections (dimensions 0 - 239)
    let clusterIdx = 0;
    for (const keywords of Object.values(CONCEPT_CLUSTERS)) {
      const matchCount = words.filter((w) => keywords.includes(w)).length;
      if (matchCount > 0) {
        const startDim = (clusterIdx * 20) % 240;
        for (let k = 0; k < 18; k++) {
          const angle = (clusterIdx + 1) * 1.6180339887 + k;
          vector[startDim + k] += matchCount * Math.cos(angle);
        }
      }
      clusterIdx++;
    }

    // 2. Location & Room Identifier Projection (dimensions 240 - 319)
    const roomTokens = clean.match(/\b[a-z]?\d{3,4}[a-z]?\b/g) || [];
    for (const token of roomTokens) {
      const numericPart = parseInt(token.replace(/\D/g, ""), 10) || 0;
      for (let k = 0; k < 15; k++) {
        vector[240 + ((numericPart * 7 + k) % 80)] += 3.5;
      }
    }

    if (clean.includes("library")) {
      for (let k = 0; k < 10; k++) vector[300 + k] += 2.5;
    }
    if (clean.includes("tagore") || clean.includes("birsa") || clean.includes("mahamaya")) {
      for (let k = 0; k < 10; k++) vector[310 + k] += 2.5;
    }

    // 3. Subword / Character Trigram Texture (dimensions 320 - 383)
    for (const w of words) {
      for (let i = 0; i <= w.length - 3; i++) {
        const trigramHash = (w.charCodeAt(i) * 31 + w.charCodeAt(i + 1) * 7 + w.charCodeAt(i + 2)) % 64;
        vector[320 + trigramHash] += 0.25;
      }
    }

    // 4. L2 Normalization (with deterministic sinusoidal backup if vector norm is 0)
    let norm = 0;
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm <= 1e-12) {
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
      }
      for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
        const val = Math.sin(hash + i * 1.618);
        vector[i] = val;
        norm += val * val;
      }
      norm = Math.sqrt(norm) || 1;
    }

    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      vector[i] = parseFloat((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}
