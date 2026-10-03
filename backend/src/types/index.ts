import { Request } from "express";

export type UserRole = "STUDENT" | "ADMIN" | "STAFF";

export type ComplaintStatus =
  | "SUBMITTED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED"
  | "ESCALATED";

export type PriorityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  departmentId?: string | null;
  enrollmentNo?: string | null;
  school?: string | null;
  hostelBlock?: string | null;
  roomNo?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  token?: string;
}

export interface AiAnalyzeRequest {
  complaintId?: string;
  text: string;
  location?: string;
}

export interface AiAnalyzeResponse {
  category: {
    value: string;
    confidence: number;
  };
  priority: {
    value: PriorityLevel;
    confidence: number;
  };
  summary: string;
  suggestedAction: string;
  embedding: number[];
}
