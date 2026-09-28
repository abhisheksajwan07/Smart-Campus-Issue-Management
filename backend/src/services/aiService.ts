import axios from "axios";
import { ENV } from "../config/env";
import { AiAnalyzeRequest, AiAnalyzeResponse, PriorityLevel } from "../types";

export class AiService {
  /**
   * Main AI Orchestration entrypoint.
   * Calls Python FastAPI /analyze with resilient fallback try/catch.
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
      const response = await axios.post<AiAnalyzeResponse>(
        `${ENV.FASTAPI_URL}/analyze`,
        req,
        { timeout: ENV.FASTAPI_TIMEOUT_MS }
      );

      return response.data;
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
   * Resilient fallback if ML service is down
   */
  private static getFallbackResponse(text: string): AiAnalyzeResponse {
    return {
      category: {
        value: "General",
        confidence: 0.5,
      },
      priority: {
        value: "MEDIUM",
        confidence: 0.5,
      },
      summary: text.length > 120 ? `${text.slice(0, 117)}...` : text,
      suggestedAction: "Awaiting staff manual review and triage.",
      embedding: this.generateDummyEmbedding(text),
    };
  }

  /**
   * High-fidelity Mock AI Simulator for rapid local testing
   * before or alongside the Python FastAPI service.
   */
  public static simulateAiResponse(text: string): AiAnalyzeResponse {
    const lower = text.toLowerCase();

    // 1. Category Detection
    let category = "General";
    let catConfidence = 0.88;

    if (
      lower.includes("fan") ||
      lower.includes("light") ||
      lower.includes("wire") ||
      lower.includes("plug") ||
      lower.includes("electric") ||
      lower.includes("power") ||
      lower.includes("switch") ||
      lower.includes("spark")
    ) {
      category = "Electrical";
      catConfidence = 0.94;
    } else if (
      lower.includes("water") ||
      lower.includes("tap") ||
      lower.includes("pipe") ||
      lower.includes("drain") ||
      lower.includes("leak") ||
      lower.includes("toilet") ||
      lower.includes("sink") ||
      lower.includes("flush")
    ) {
      category = "Plumbing";
      catConfidence = 0.92;
    } else if (
      lower.includes("wifi") ||
      lower.includes("internet") ||
      lower.includes("lan") ||
      lower.includes("network") ||
      lower.includes("router") ||
      lower.includes("portal") ||
      lower.includes("website")
    ) {
      category = "IT / Network";
      catConfidence = 0.95;
    } else if (
      lower.includes("mess") ||
      lower.includes("food") ||
      lower.includes("room") ||
      lower.includes("bed") ||
      lower.includes("hostel") ||
      lower.includes("warden") ||
      lower.includes("clean")
    ) {
      category = "Hostel / Mess";
      catConfidence = 0.89;
    }

    // 2. Priority Detection
    let priority: PriorityLevel = "MEDIUM";
    let priConfidence = 0.82;

    if (
      lower.includes("spark") ||
      lower.includes("smoke") ||
      lower.includes("fire") ||
      lower.includes("shock") ||
      lower.includes("burst") ||
      lower.includes("flood") ||
      lower.includes("emergency") ||
      lower.includes("danger")
    ) {
      priority = "CRITICAL";
      priConfidence = 0.98;
    } else if (
      lower.includes("exam") ||
      lower.includes("stopped working") ||
      lower.includes("urgent") ||
      lower.includes("broken") ||
      lower.includes("entire floor") ||
      lower.includes("no water")
    ) {
      priority = "HIGH";
      priConfidence = 0.89;
    } else if (
      lower.includes("paint") ||
      lower.includes("dust") ||
      lower.includes("minor") ||
      lower.includes("creak") ||
      lower.includes("suggestion")
    ) {
      priority = "LOW";
      priConfidence = 0.85;
    }

    // 3. Summarization
    const summary =
      text.length > 80
        ? `Issue reported: ${text.slice(0, 75).trim()}... [Auto-summarized]`
        : text;

    // 4. Action Recommendation
    let suggestedAction = "Conduct standard maintenance check.";
    if (category === "Electrical" && priority === "CRITICAL") {
      suggestedAction =
        "Immediately isolate electrical main switch and dispatch duty electrician with hazard kit.";
    } else if (category === "Electrical") {
      suggestedAction = "Inspect wiring, capacitor, and switchboard connections.";
    } else if (category === "Plumbing" && priority === "CRITICAL") {
      suggestedAction = "Shut off riser valve immediately to prevent structural water damage.";
    } else if (category === "Plumbing") {
      suggestedAction = "Replace washer/cartridge and test water pressure.";
    } else if (category === "IT / Network") {
      suggestedAction = "Check access point telemetry and cycle switch port.";
    } else if (category === "Hostel / Mess") {
      suggestedAction = "Notify hostel supervisor for physical inspection and report.";
    }

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
   * Generates a 384-dimensional normalized float embedding vector
   * based on the input text for cosine similarity testing.
   */
  private static generateDummyEmbedding(text: string): number[] {
    const dims = 384;
    const vector: number[] = new Array(dims);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    let norm = 0;
    for (let i = 0; i < dims; i++) {
      const val = Math.sin(hash + i * 1.618);
      vector[i] = val;
      norm += val * val;
    }

    norm = Math.sqrt(norm);
    for (let i = 0; i < dims; i++) {
      vector[i] = parseFloat((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}
