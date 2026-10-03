import { Response } from "express";

export class SSEService {
  private static clients: Set<Response> = new Set();
  private static heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Register a new client connection for Server-Sent Events
   */
  static addClient(res: Response): void {
    this.clients.add(res);
    console.log(`[SSE] Client connected. Active listeners: ${this.clients.size}`);

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

  /**
   * Broadcast an event to all connected dashboard clients
   */
  static broadcast(eventName: string, payload: any): void {
    if (this.clients.size === 0) return;

    const message = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const client of this.clients) {
      try {
        client.write(message);
      } catch (err) {
        console.error("[SSE] Failed to write to client, removing...", err);
        this.clients.delete(client);
      }
    }
  }
}
