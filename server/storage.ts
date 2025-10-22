import { WebSocketEvent, Campaign, InsertCampaign, Event, InsertEvent, CampaignFormState, InsertFormState, ScheduledComponent, InsertScheduledComponent, Component, InsertComponent, CampaignComponent, InsertCampaignComponent, User, InsertUser } from "@shared/schema";
import { db } from "./db";
import { campaigns, events, campaignFormState, scheduledComponents, components, campaignComponents, users } from "@shared/schema";
import { eq, desc, and, gte, ne } from "drizzle-orm";

export interface IStorage {
  addEvent(event: WebSocketEvent): Promise<void>;
  getRecentEvents(limit?: number): Promise<WebSocketEvent[]>;
  
  // User methods
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByReachuId(reachuUserId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  
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
  
  // Dynamic component methods
  createComponent(component: InsertComponent): Promise<Component>;
  getComponents(): Promise<Component[]>;
  getComponentById(id: string): Promise<Component | undefined>;
  updateComponent(id: string, component: Partial<InsertComponent>): Promise<Component | undefined>;
  deleteComponent(id: string): Promise<void>;
  getComponentUsage(): Promise<Record<string, Array<{ campaignId: number; campaignName: string }>>>;
  
  // Campaign component methods
  getCampaignComponents(campaignId: number): Promise<Array<CampaignComponent & { component: Component }>>;
  addComponentToCampaign(campaignComponent: InsertCampaignComponent): Promise<CampaignComponent>;
  updateCampaignComponentStatus(campaignId: number, componentId: string, status: 'active' | 'inactive'): Promise<CampaignComponent | undefined>;
  removeComponentFromCampaign(campaignId: number, componentId: string): Promise<void>;
  validateComponentAvailability(componentId: string, campaignId?: number): Promise<{ available: boolean; activeCampaignId?: number }>;
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

  // User methods (database-backed)
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByReachuId(reachuUserId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.reachuUserId, reachuUserId));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
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

  // Dynamic component methods (database-backed)
  async createComponent(component: InsertComponent): Promise<Component> {
    const [newComponent] = await db.insert(components).values(component).returning();
    return newComponent;
  }

  async getComponents(): Promise<Component[]> {
    return await db.select().from(components).orderBy(desc(components.createdAt));
  }

  async getComponentById(id: string): Promise<Component | undefined> {
    const [component] = await db.select().from(components).where(eq(components.id, id));
    return component || undefined;
  }

  async updateComponent(id: string, component: Partial<InsertComponent>): Promise<Component | undefined> {
    const [updated] = await db.update(components)
      .set(component)
      .where(eq(components.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteComponent(id: string): Promise<void> {
    await db.delete(components).where(eq(components.id, id));
  }

  async getComponentUsage(): Promise<Record<string, Array<{ campaignId: number; campaignName: string }>>> {
    const results = await db.select({
      componentId: campaignComponents.componentId,
      campaignId: campaigns.id,
      campaignName: campaigns.name
    })
      .from(campaignComponents)
      .innerJoin(campaigns, eq(campaignComponents.campaignId, campaigns.id));
    
    // Group by componentId
    const usage: Record<string, Array<{ campaignId: number; campaignName: string }>> = {};
    
    for (const row of results) {
      if (!usage[row.componentId]) {
        usage[row.componentId] = [];
      }
      usage[row.componentId].push({
        campaignId: row.campaignId,
        campaignName: row.campaignName
      });
    }
    
    return usage;
  }

  // Campaign component methods (database-backed)
  async getCampaignComponents(campaignId: number): Promise<Array<CampaignComponent & { component: Component }>> {
    const results = await db.select()
      .from(campaignComponents)
      .leftJoin(components, eq(campaignComponents.componentId, components.id))
      .where(eq(campaignComponents.campaignId, campaignId));
    
    return results.map(row => ({
      ...row.campaign_components,
      component: row.components!
    }));
  }

  async addComponentToCampaign(campaignComponent: InsertCampaignComponent): Promise<CampaignComponent> {
    const [newCampaignComponent] = await db.insert(campaignComponents).values(campaignComponent).returning();
    return newCampaignComponent;
  }

  async updateCampaignComponentStatus(campaignId: number, componentId: string, status: 'active' | 'inactive'): Promise<CampaignComponent | undefined> {
    const updateData: any = { 
      status,
      updatedAt: new Date()
    };
    
    // Set activatedAt when activating
    if (status === 'active') {
      updateData.activatedAt = new Date();
    }
    
    const [updated] = await db.update(campaignComponents)
      .set(updateData)
      .where(
        and(
          eq(campaignComponents.campaignId, campaignId),
          eq(campaignComponents.componentId, componentId)
        )
      )
      .returning();
    return updated || undefined;
  }

  async removeComponentFromCampaign(campaignId: number, componentId: string): Promise<void> {
    await db.delete(campaignComponents)
      .where(
        and(
          eq(campaignComponents.campaignId, campaignId),
          eq(campaignComponents.componentId, componentId)
        )
      );
  }

  async validateComponentAvailability(componentId: string, campaignId?: number): Promise<{ available: boolean; activeCampaignId?: number }> {
    // Check if component is active in any other campaign
    const conditions = [
      eq(campaignComponents.componentId, componentId),
      eq(campaignComponents.status, 'active')
    ];
    
    // Exclude the current campaign if specified
    if (campaignId !== undefined) {
      conditions.push(ne(campaignComponents.campaignId, campaignId));
    }
    
    const [activeInOtherCampaign] = await db.select()
      .from(campaignComponents)
      .where(and(...conditions))
      .limit(1);
    
    if (activeInOtherCampaign) {
      return {
        available: false,
        activeCampaignId: activeInOtherCampaign.campaignId
      };
    }
    
    return { available: true };
  }
}

export const storage = new MemStorage();
