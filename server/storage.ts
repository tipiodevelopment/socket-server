import { WebSocketEvent, Campaign, InsertCampaign, Event, InsertEvent } from "@shared/schema";
import { db } from "./db";
import { campaigns, events } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  addEvent(event: WebSocketEvent): Promise<void>;
  getRecentEvents(limit?: number): Promise<WebSocketEvent[]>;
  getConnectedClientsCount(): number;
  incrementClientsCount(): void;
  decrementClientsCount(): void;
  
  // Campaign methods
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  getAllCampaigns(): Promise<Campaign[]>;
  updateCampaign(id: number, campaign: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: number): Promise<void>;
  
  // Campaign events methods
  addCampaignEvent(event: InsertEvent): Promise<Event>;
  getCampaignEvents(campaignId: number, limit?: number): Promise<Event[]>;
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

  // Campaign methods (database-backed)
  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async getAllCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async updateCampaign(id: number, campaign: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [updated] = await db.update(campaigns)
      .set(campaign)
      .where(eq(campaigns.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCampaign(id: number): Promise<void> {
    await db.delete(campaigns).where(eq(campaigns.id, id));
  }

  // Campaign events methods (database-backed)
  async addCampaignEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async getCampaignEvents(campaignId: number, limit: number = 50): Promise<Event[]> {
    return await db.select()
      .from(events)
      .where(eq(events.campaignId, campaignId))
      .orderBy(desc(events.timestamp))
      .limit(limit);
  }
}

export const storage = new MemStorage();
