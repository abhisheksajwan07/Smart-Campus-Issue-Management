import { Response } from "express";
import { TokenPayload, UserRole } from "../types";

interface SseClient {
  res: Response;
  userId?: string;
  role?: UserRole;
  departmentId?: string | null;
}

export interface BroadcastTarget {
  studentId?: string | null;
  departmentId?: string | null;
  previousDepartmentId?: string | null;
}

export class SSEService {
  private static clients: Map<Response, SseClient> = new Map();
  private static heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Register a new client connection for Server-Sent Events
   */
  static addClient(res: Response, user?: TokenPayload): void {
    this.clients.set(res, {
      res,
      userId: user?.userId,
      role: user?.role,
      departmentId: user?.departmentId ?? null,
    });
    console.log(`[SSE] Client connected (${user?.role || "UNKNOWN"}). Active listeners: ${this.clients.size}`);

    // Start periodic heartbeat to keep HTTP connections alive
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this.broadcast("HEARTBEAT", { timestamp: new Date().toISOString() });
      }, 30000);
    }
  }

  /**
   * Remove disconnected client
   */
  static removeClient(res: Response): void {
    this.clients.delete(res);
    console.log(`[SSE] Client disconnected. Active listeners: ${this.clients.size}`);

    if (this.clients.size === 0 && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private static shouldReceive(client: SseClient, eventName: string, target?: BroadcastTarget): boolean {
    if (eventName === "HEARTBEAT" || !target) return true;
    if (client.role === "ADMIN") return true;
    if (client.role === "STAFF") {
      if (!client.departmentId) return true;
      return (
        target.departmentId === client.departmentId ||
        target.previousDepartmentId === client.departmentId
      );
    }
    if (client.role === "STUDENT") {
      return Boolean(target.studentId && client.userId === target.studentId);
    }
    return false;
  }

  /**
   * Broadcast an event to eligible connected dashboard clients
   */
  static broadcast(eventName: string, payload: any, target?: BroadcastTarget): void {
    if (this.clients.size === 0) return;

    const message = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const [res, client] of this.clients.entries()) {
      if (!this.shouldReceive(client, eventName, target)) continue;
      try {
        res.write(message);
      } catch (err) {
        console.error("[SSE] Failed to write to client, removing...", err);
        this.clients.delete(res);
      }
    }
  }
}
