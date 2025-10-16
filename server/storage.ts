import { WebSocketEvent, Campaign, InsertCampaign, Event, InsertEvent, CampaignFormState, InsertFormState, ScheduledComponent, InsertScheduledComponent } from "@shared/schema";
import { db } from "./db";
import { campaigns, events, campaignFormState, scheduledComponents } from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export interface IStorage {
  addEvent(event: WebSocketEvent): Promise<void>;
  getRecentEvents(limit?: number): Promise<WebSocketEvent[]>;
  
  // Campaign methods
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  getAllCampaigns(): Promise<Campaign[]>;
  updateCampaign(id: number, campaign: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: number): Promise<void>;
  
  // Campaign events methods
  addCampaignEvent(event: InsertEvent): Promise<Event>;
  getCampaignEvents(campaignId: number, limit?: number): Promise<Event[]>;
  
  // Form state methods
  saveFormState(state: InsertFormState): Promise<CampaignFormState>;
  getFormState(campaignId: number, formType: string): Promise<CampaignFormState | undefined>;
  getAllFormStates(campaignId: number): Promise<CampaignFormState[]>;
  
  // Scheduled component methods
  createScheduledComponent(component: InsertScheduledComponent): Promise<ScheduledComponent>;
  getScheduledComponent(id: number): Promise<ScheduledComponent | undefined>;
  getCampaignScheduledComponents(campaignId: number): Promise<ScheduledComponent[]>;
  getPendingScheduledComponents(campaignId: number): Promise<ScheduledComponent[]>;
  updateScheduledComponent(id: number, component: Partial<InsertScheduledComponent>): Promise<ScheduledComponent | undefined>;
  deleteScheduledComponent(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private events: WebSocketEvent[] = [];

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

  // Form state methods (database-backed)
  async saveFormState(state: InsertFormState): Promise<CampaignFormState> {
    // Check if form state already exists
    const [existing] = await db.select()
      .from(campaignFormState)
      .where(
        and(
          eq(campaignFormState.campaignId, state.campaignId),
          eq(campaignFormState.formType, state.formType)
        )
      );

    if (existing) {
      // Update existing
      const [updated] = await db.update(campaignFormState)
        .set({ formData: state.formData, updatedAt: new Date() })
        .where(
          and(
            eq(campaignFormState.campaignId, state.campaignId),
            eq(campaignFormState.formType, state.formType)
          )
        )
        .returning();
      return updated;
    } else {
      // Create new
      const [newState] = await db.insert(campaignFormState).values(state).returning();
      return newState;
    }
  }

  async getFormState(campaignId: number, formType: string): Promise<CampaignFormState | undefined> {
    const [state] = await db.select()
      .from(campaignFormState)
      .where(
        and(
          eq(campaignFormState.campaignId, campaignId),
          eq(campaignFormState.formType, formType)
        )
      );
    return state || undefined;
  }

  async getAllFormStates(campaignId: number): Promise<CampaignFormState[]> {
    return await db.select()
      .from(campaignFormState)
      .where(eq(campaignFormState.campaignId, campaignId));
  }

  // Scheduled component methods (database-backed)
  async createScheduledComponent(component: InsertScheduledComponent): Promise<ScheduledComponent> {
    const [newComponent] = await db.insert(scheduledComponents).values(component).returning();
    return newComponent;
  }

  async getScheduledComponent(id: number): Promise<ScheduledComponent | undefined> {
    const [component] = await db.select().from(scheduledComponents).where(eq(scheduledComponents.id, id));
    return component || undefined;
  }

  async getCampaignScheduledComponents(campaignId: number): Promise<ScheduledComponent[]> {
    return await db.select()
      .from(scheduledComponents)
      .where(eq(scheduledComponents.campaignId, campaignId))
      .orderBy(scheduledComponents.scheduledTime);
  }

  async getPendingScheduledComponents(campaignId: number): Promise<ScheduledComponent[]> {
    const now = new Date();
    return await db.select()
      .from(scheduledComponents)
      .where(
        and(
          eq(scheduledComponents.campaignId, campaignId),
          eq(scheduledComponents.status, 'pending'),
          gte(scheduledComponents.scheduledTime, now)
        )
      )
      .orderBy(scheduledComponents.scheduledTime);
  }

  async updateScheduledComponent(id: number, component: Partial<InsertScheduledComponent>): Promise<ScheduledComponent | undefined> {
    const [updated] = await db.update(scheduledComponents)
      .set(component)
      .where(eq(scheduledComponents.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteScheduledComponent(id: number): Promise<void> {
    await db.delete(scheduledComponents).where(eq(scheduledComponents.id, id));
  }
}

export const storage = new MemStorage();
