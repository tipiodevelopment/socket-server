import { WebSocketEvent } from "@shared/schema";

export interface IStorage {
  addEvent(event: WebSocketEvent): Promise<void>;
  getRecentEvents(limit?: number): Promise<WebSocketEvent[]>;
  getConnectedClientsCount(): number;
  incrementClientsCount(): void;
  decrementClientsCount(): void;
}

export class MemStorage implements IStorage {
  private events: WebSocketEvent[] = [];
  private connectedClients: number = 0;

  async addEvent(event: WebSocketEvent): Promise<void> {
    this.events.unshift(event);
    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events = this.events.slice(0, 100);
    }
  }

  async getRecentEvents(limit: number = 50): Promise<WebSocketEvent[]> {
    return this.events.slice(0, limit);
  }

  getConnectedClientsCount(): number {
    return this.connectedClients;
  }

  incrementClientsCount(): void {
    this.connectedClients++;
  }

  decrementClientsCount(): void {
    this.connectedClients = Math.max(0, this.connectedClients - 1);
  }
}

export const storage = new MemStorage();
