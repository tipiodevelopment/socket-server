import { WebSocketEvent, Campaign, InsertCampaign, Event, InsertEvent, CampaignFormState, InsertFormState, ScheduledComponent, InsertScheduledComponent, Component, InsertComponent, CampaignComponent, InsertCampaignComponent, AppComponent, InsertAppComponent, User, InsertUser, ClientApp, InsertClientApp, Channel, InsertChannel, CampaignTranslation, InsertCampaignTranslation, CampaignEngagementConfig, InsertCampaignEngagementConfig, CampaignUiConfig, InsertCampaignUiConfig, CampaignFeatureFlags, InsertCampaignFeatureFlags, SdkTranslation, InsertSdkTranslation, Broadcast, InsertBroadcast, Poll, InsertPoll, PollOptionRecord, InsertPollOption, PollVote, InsertPollVote, Contest, InsertContest, ContestParticipation, InsertContestParticipation, Sponsor, InsertSponsor, BroadcastAd, InsertBroadcastAd, BroadcastProduct, InsertBroadcastProduct, ChatMessage, InsertChatMessage } from "@shared/schema";
import { db } from "./db";
import { campaigns, events, campaignFormState, scheduledComponents, components, campaignComponents, appComponents, users, clientApps, channels, campaignTranslations, campaignEngagementConfig, campaignUiConfig, campaignFeatureFlags, sdkTranslations, broadcasts, polls, pollOptions, pollVotes, contests, contestParticipations, sponsors, broadcastAds, broadcastProducts, chatMessages } from "@shared/schema";
import { eq, desc, and, or, gte, ne, isNull, sql, lte, inArray } from "drizzle-orm";

export interface IStorage {
  addEvent(event: WebSocketEvent): Promise<void>;
  getRecentEvents(limit?: number): Promise<WebSocketEvent[]>;
  
  // User methods
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByReachuId(reachuUserId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  
  // Client App methods
  createClientApp(clientApp: InsertClientApp): Promise<ClientApp>;
  getClientApp(id: number): Promise<ClientApp | undefined>;
  getClientAppByApiKey(apiKey: string): Promise<ClientApp | undefined>;
  getClientAppByBundleId(bundleId: string): Promise<ClientApp | undefined>;
  getUserClientApps(userId: number): Promise<ClientApp[]>;
  getAllClientApps(): Promise<ClientApp[]>;
  updateClientApp(id: number, clientApp: Partial<InsertClientApp>): Promise<ClientApp | undefined>;
  deleteClientApp(id: number): Promise<void>;
  
  // Sponsor methods
  createSponsor(sponsor: InsertSponsor): Promise<Sponsor>;
  getSponsor(id: number): Promise<Sponsor | undefined>;
  getUserSponsors(userId: number): Promise<Sponsor[]>;
  updateSponsor(id: number, sponsor: Partial<InsertSponsor>): Promise<Sponsor | undefined>;
  deleteSponsor(id: number): Promise<void>;

  // Channel methods
  createChannel(channel: InsertChannel): Promise<Channel>;
  getChannel(id: number): Promise<Channel | undefined>;
  getClientAppChannels(clientAppId: number): Promise<Channel[]>;
  getUserChannels(userId: number): Promise<Channel[]>;
  getAllChannels(): Promise<Channel[]>;
  updateChannel(id: number, channel: Partial<InsertChannel>): Promise<Channel | undefined>;
  deleteChannel(id: number): Promise<void>;
  
  // Campaign methods
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  getAllCampaigns(): Promise<Campaign[]>;
  getChannelCampaigns(channelId: number): Promise<Campaign[]>;
  getUserCampaigns(userId: number): Promise<Campaign[]>;
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
  updateCampaignComponentConfig(campaignId: number, componentId: string, customConfig: any): Promise<CampaignComponent | undefined>;
  removeComponentFromCampaign(campaignId: number, componentId: string): Promise<void>;
  validateComponentAvailability(componentId: string, isTemplate: boolean, campaignId?: number): Promise<{ available: boolean; activeCampaignId?: number }>;
  
  // App component methods
  getAppComponents(clientAppId: number): Promise<Array<AppComponent & { component: Component }>>;
  addComponentToApp(appComponent: InsertAppComponent): Promise<AppComponent>;
  removeComponentFromApp(clientAppId: number, componentId: string): Promise<void>;

  // Campaign translation methods
  getCampaignTranslations(campaignId: number): Promise<CampaignTranslation[]>;
  upsertCampaignTranslation(translation: InsertCampaignTranslation): Promise<CampaignTranslation>;
  deleteCampaignTranslation(campaignId: number, languageCode: string): Promise<void>;
  
  // Campaign engagement config methods
  getCampaignEngagementConfig(campaignId: number): Promise<CampaignEngagementConfig | undefined>;
  upsertCampaignEngagementConfig(config: InsertCampaignEngagementConfig): Promise<CampaignEngagementConfig>;
  
  // Campaign UI config methods
  getCampaignUiConfig(campaignId: number): Promise<CampaignUiConfig | undefined>;
  upsertCampaignUiConfig(config: InsertCampaignUiConfig): Promise<CampaignUiConfig>;
  
  // Campaign feature flags methods
  getCampaignFeatureFlags(campaignId: number): Promise<CampaignFeatureFlags | undefined>;
  upsertCampaignFeatureFlags(flags: InsertCampaignFeatureFlags): Promise<CampaignFeatureFlags>;
  
  // SDK translations methods
  getSdkTranslations(languageCode: string, campaignId?: number, matchId?: string): Promise<SdkTranslation[]>;
  upsertSdkTranslation(translation: InsertSdkTranslation): Promise<SdkTranslation>;
  deleteSdkTranslation(id: number): Promise<void>;
  
  // Full campaign config for SDK endpoints
  getFullCampaignConfig(campaignId: number): Promise<{
    campaign: Campaign;
    translations: CampaignTranslation[];
    engagementConfig: CampaignEngagementConfig | null;
    uiConfig: CampaignUiConfig | null;
    featureFlags: CampaignFeatureFlags | null;
  } | null>;
  
  // Broadcast methods
  createBroadcast(broadcast: InsertBroadcast): Promise<Broadcast>;
  getBroadcast(broadcastId: string): Promise<Broadcast | undefined>;
  getBroadcastByExternalId(externalId: string, clientAppId: number): Promise<Broadcast | undefined>;
  getAllBroadcasts(filters?: { status?: string; campaignId?: number }): Promise<Broadcast[]>;
  getCampaignBroadcasts(campaignId: number): Promise<Broadcast[]>;
  updateBroadcast(broadcastId: string, data: Partial<InsertBroadcast>): Promise<Broadcast | undefined>;
  deleteBroadcast(broadcastId: string): Promise<void>;
  getBroadcastsByStatus(status: string): Promise<Broadcast[]>;

  // Poll methods  
  createPoll(poll: InsertPoll): Promise<Poll>;
  getPoll(id: number): Promise<Poll | undefined>;
  getBroadcastPolls(broadcastId: string): Promise<Array<Poll & { options: PollOptionRecord[] }>>;
  updatePoll(id: number, data: Partial<InsertPoll>): Promise<Poll | undefined>;
  deletePoll(id: number): Promise<void>;

  // Poll option methods
  createPollOption(option: InsertPollOption): Promise<PollOptionRecord>;
  updatePollOptionVoteCount(optionId: number, increment: number): Promise<void>;

  // Poll vote methods
  createPollVote(vote: InsertPollVote): Promise<PollVote>;
  createPollVoteWithCountUpdate(vote: InsertPollVote, optionId: number): Promise<PollVote>;
  hasUserVoted(pollId: number, userId: string): Promise<boolean>;
  getPollResults(pollId: number): Promise<{ poll: Poll; options: PollOptionRecord[] } | null>;

  // Contest methods
  createContest(contest: InsertContest): Promise<Contest>;
  getContest(id: number): Promise<Contest | undefined>;
  getBroadcastContests(broadcastId: string): Promise<Contest[]>;
  updateContest(id: number, data: Partial<InsertContest>): Promise<Contest | undefined>;
  deleteContest(id: number): Promise<void>;

  // Contest participation methods
  createContestParticipation(participation: InsertContestParticipation): Promise<ContestParticipation>;
  createContestParticipationAtomic(participation: InsertContestParticipation): Promise<ContestParticipation>;
  hasUserParticipated(contestId: number, userId: string): Promise<boolean>;
  getContestParticipations(contestId: number): Promise<ContestParticipation[]>;

  // Pagination support
  getBroadcastPollsPaginated(broadcastId: string, options: { limit: number; offset: number }): Promise<Array<Poll & { options: PollOptionRecord[] }>>;
  getBroadcastPollsCount(broadcastId: string): Promise<number>;
  getBroadcastContestsPaginated(broadcastId: string, options: { limit: number; offset: number }): Promise<Contest[]>;
  getBroadcastContestsCount(broadcastId: string): Promise<number>;

  // Enrichment: poll/contest counts for multiple broadcasts
  getBroadcastEngagementCounts(broadcastIds: string[]): Promise<Map<string, { pollCount: number; activePollCount: number; contestCount: number }>>;

  // Broadcast Ads methods
  getBroadcastAds(broadcastId: string): Promise<BroadcastAd[]>;
  createBroadcastAd(ad: InsertBroadcastAd): Promise<BroadcastAd>;
  updateBroadcastAd(id: number, data: Partial<InsertBroadcastAd>): Promise<BroadcastAd | undefined>;
  deleteBroadcastAd(id: number): Promise<void>;

  // Broadcast Products methods
  getBroadcastProducts(broadcastId: string): Promise<BroadcastProduct[]>;
  createBroadcastProduct(product: InsertBroadcastProduct): Promise<BroadcastProduct>;
  updateBroadcastProduct(id: number, data: Partial<InsertBroadcastProduct>): Promise<BroadcastProduct | undefined>;
  deleteBroadcastProduct(id: number): Promise<void>;

  // Chat Messages methods
  getChatMessages(broadcastId: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
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

  // Client App methods (database-backed)
  async createClientApp(clientApp: InsertClientApp): Promise<ClientApp> {
    const [newClientApp] = await db.insert(clientApps).values(clientApp).returning();
    return newClientApp;
  }

  async getClientApp(id: number): Promise<ClientApp | undefined> {
    const [clientApp] = await db.select().from(clientApps).where(eq(clientApps.id, id));
    return clientApp || undefined;
  }

  async getClientAppByApiKey(apiKey: string): Promise<ClientApp | undefined> {
    const [clientApp] = await db.select().from(clientApps).where(eq(clientApps.apiKey, apiKey));
    return clientApp || undefined;
  }

  async getClientAppByBundleId(bundleId: string): Promise<ClientApp | undefined> {
    const [clientApp] = await db.select().from(clientApps).where(eq(clientApps.bundleId, bundleId));
    return clientApp || undefined;
  }

  async getUserClientApps(userId: number): Promise<ClientApp[]> {
    return await db.select().from(clientApps)
      .where(eq(clientApps.userId, userId))
      .orderBy(desc(clientApps.createdAt));
  }

  async getAllClientApps(): Promise<ClientApp[]> {
    return await db.select().from(clientApps).orderBy(desc(clientApps.createdAt));
  }

  async updateClientApp(id: number, clientApp: Partial<InsertClientApp>): Promise<ClientApp | undefined> {
    const [updated] = await db.update(clientApps)
      .set(clientApp)
      .where(eq(clientApps.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteClientApp(id: number): Promise<void> {
    await db.delete(clientApps).where(eq(clientApps.id, id));
  }

  // Sponsor methods (database-backed)
  async createSponsor(sponsor: InsertSponsor): Promise<Sponsor> {
    const [newSponsor] = await db.insert(sponsors).values(sponsor).returning();
    return newSponsor;
  }

  async getSponsor(id: number): Promise<Sponsor | undefined> {
    const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, id));
    return sponsor || undefined;
  }

  async getUserSponsors(userId: number): Promise<Sponsor[]> {
    return await db.select().from(sponsors)
      .where(eq(sponsors.userId, userId))
      .orderBy(desc(sponsors.createdAt));
  }

  async updateSponsor(id: number, data: Partial<InsertSponsor>): Promise<Sponsor | undefined> {
    const [updated] = await db.update(sponsors)
      .set(data)
      .where(eq(sponsors.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSponsor(id: number): Promise<void> {
    await db.delete(sponsors).where(eq(sponsors.id, id));
  }

  // Channel methods (database-backed)
  async createChannel(channel: InsertChannel): Promise<Channel> {
    const [newChannel] = await db.insert(channels).values(channel).returning();
    return newChannel;
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id));
    return channel || undefined;
  }

  async getClientAppChannels(clientAppId: number): Promise<Channel[]> {
    return await db.select().from(channels)
      .where(eq(channels.clientAppId, clientAppId))
      .orderBy(desc(channels.createdAt));
  }

  async getUserChannels(userId: number): Promise<Channel[]> {
    const userApps = await db.select().from(clientApps)
      .where(eq(clientApps.userId, userId));
    const appIds = userApps.map(app => app.id);
    if (appIds.length === 0) return [];
    
    const results = await db.select().from(channels)
      .orderBy(desc(channels.createdAt));
    return results.filter(ch => appIds.includes(ch.clientAppId));
  }

  async getAllChannels(): Promise<Channel[]> {
    return await db.select().from(channels).orderBy(desc(channels.createdAt));
  }

  async updateChannel(id: number, channel: Partial<InsertChannel>): Promise<Channel | undefined> {
    const [updated] = await db.update(channels)
      .set(channel)
      .where(eq(channels.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteChannel(id: number): Promise<void> {
    await db.delete(channels).where(eq(channels.id, id));
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

  async getChannelCampaigns(channelId: number): Promise<Campaign[]> {
    return await db.select().from(campaigns)
      .where(eq(campaigns.channelId, channelId))
      .orderBy(desc(campaigns.createdAt));
  }

  async getUserCampaigns(userId: number): Promise<Campaign[]> {
    return await db.select().from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt));
  }

  async getBroadcastCountsForCampaigns(campaignIds: number[]): Promise<Map<number, number>> {
    if (campaignIds.length === 0) return new Map();
    const rows = await db
      .select({ campaignId: broadcasts.campaignId, count: sql<number>`count(*)::int` })
      .from(broadcasts)
      .where(inArray(broadcasts.campaignId, campaignIds))
      .groupBy(broadcasts.campaignId);
    return new Map(rows.map(r => [r.campaignId!, r.count]));
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

  async updateCampaignComponentConfig(campaignId: number, componentId: string, customConfig: any): Promise<CampaignComponent | undefined> {
    const [updated] = await db.update(campaignComponents)
      .set({ 
        customConfig,
        updatedAt: new Date()
      })
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
    // componentId is actually the campaign component instance ID (from campaignComponents.id)
    await db.delete(campaignComponents)
      .where(
        and(
          eq(campaignComponents.campaignId, campaignId),
          eq(campaignComponents.id, parseInt(componentId))
        )
      );
  }

  /**
   * Validates if a component is available to be activated in a campaign.
   * 
   * Preconditions:
   * - Caller must provide the true isTemplate value from the component
   * - Caller is responsible for verifying component exists before calling this
   * 
   * Rules:
   * - Template components (isTemplate=true) can be active in multiple campaigns simultaneously
   * - Regular components (isTemplate=false) can only be active in one campaign at a time
   * 
   * @param componentId - ID of the component to validate
   * @param isTemplate - Whether the component is a template (must be truthful value from component.isTemplate === 'true')
   * @param campaignId - Optional campaign ID to exclude from the check (when updating existing component)
   * @returns Object with available flag and optional activeCampaignId if not available
   */
  async validateComponentAvailability(componentId: string, isTemplate: boolean, campaignId?: number): Promise<{ available: boolean; activeCampaignId?: number }> {
    // Templates can be used in multiple campaigns - always available
    if (isTemplate) {
      return { available: true };
    }
    
    // Regular components: check if active in any other campaign
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
  
  // App component methods
  async getAppComponents(clientAppId: number): Promise<Array<AppComponent & { component: Component }>> {
    const results = await db.select()
      .from(appComponents)
      .innerJoin(components, eq(appComponents.componentId, components.id))
      .where(eq(appComponents.clientAppId, clientAppId));
    return results.map(r => ({ ...r.app_components, component: r.components }));
  }

  async addComponentToApp(appComponent: InsertAppComponent): Promise<AppComponent> {
    const [result] = await db.insert(appComponents).values(appComponent).returning();
    return result;
  }

  async removeComponentFromApp(clientAppId: number, componentId: string): Promise<void> {
    await db.delete(appComponents)
      .where(and(
        eq(appComponents.clientAppId, clientAppId),
        eq(appComponents.componentId, componentId)
      ));
  }

  // Campaign translation methods
  async getCampaignTranslations(campaignId: number): Promise<CampaignTranslation[]> {
    return db.select()
      .from(campaignTranslations)
      .where(eq(campaignTranslations.campaignId, campaignId));
  }
  
  async upsertCampaignTranslation(translation: InsertCampaignTranslation): Promise<CampaignTranslation> {
    const existing = await db.select()
      .from(campaignTranslations)
      .where(and(
        eq(campaignTranslations.campaignId, translation.campaignId),
        eq(campaignTranslations.languageCode, translation.languageCode)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db.update(campaignTranslations)
        .set(translation)
        .where(eq(campaignTranslations.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(campaignTranslations).values(translation).returning();
    return created;
  }
  
  async deleteCampaignTranslation(campaignId: number, languageCode: string): Promise<void> {
    await db.delete(campaignTranslations)
      .where(and(
        eq(campaignTranslations.campaignId, campaignId),
        eq(campaignTranslations.languageCode, languageCode)
      ));
  }
  
  // Campaign engagement config methods
  async getCampaignEngagementConfig(campaignId: number): Promise<CampaignEngagementConfig | undefined> {
    const [config] = await db.select()
      .from(campaignEngagementConfig)
      .where(eq(campaignEngagementConfig.campaignId, campaignId))
      .limit(1);
    return config;
  }
  
  async upsertCampaignEngagementConfig(config: InsertCampaignEngagementConfig): Promise<CampaignEngagementConfig> {
    const existing = await db.select()
      .from(campaignEngagementConfig)
      .where(eq(campaignEngagementConfig.campaignId, config.campaignId))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db.update(campaignEngagementConfig)
        .set(config)
        .where(eq(campaignEngagementConfig.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(campaignEngagementConfig).values(config).returning();
    return created;
  }
  
  // Campaign UI config methods
  async getCampaignUiConfig(campaignId: number): Promise<CampaignUiConfig | undefined> {
    const [config] = await db.select()
      .from(campaignUiConfig)
      .where(eq(campaignUiConfig.campaignId, campaignId))
      .limit(1);
    return config;
  }
  
  async upsertCampaignUiConfig(config: InsertCampaignUiConfig): Promise<CampaignUiConfig> {
    const existing = await db.select()
      .from(campaignUiConfig)
      .where(eq(campaignUiConfig.campaignId, config.campaignId))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db.update(campaignUiConfig)
        .set(config)
        .where(eq(campaignUiConfig.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(campaignUiConfig).values(config).returning();
    return created;
  }
  
  // Campaign feature flags methods
  async getCampaignFeatureFlags(campaignId: number): Promise<CampaignFeatureFlags | undefined> {
    const [flags] = await db.select()
      .from(campaignFeatureFlags)
      .where(eq(campaignFeatureFlags.campaignId, campaignId))
      .limit(1);
    return flags;
  }
  
  async upsertCampaignFeatureFlags(flags: InsertCampaignFeatureFlags): Promise<CampaignFeatureFlags> {
    const existing = await db.select()
      .from(campaignFeatureFlags)
      .where(eq(campaignFeatureFlags.campaignId, flags.campaignId))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db.update(campaignFeatureFlags)
        .set(flags)
        .where(eq(campaignFeatureFlags.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(campaignFeatureFlags).values(flags).returning();
    return created;
  }
  
  // SDK translations methods - with priority: match > campaign > global
  async getSdkTranslations(languageCode: string, campaignId?: number, matchId?: string): Promise<SdkTranslation[]> {
    let translations: SdkTranslation[] = [];
    
    // First get global translations (where campaignId and matchId are null)
    const globalTranslations = await db.select()
      .from(sdkTranslations)
      .where(and(
        eq(sdkTranslations.languageCode, languageCode),
        isNull(sdkTranslations.campaignId),
        isNull(sdkTranslations.matchId)
      ));
    translations = globalTranslations;
    
    // Then get campaign-specific translations if campaignId provided
    if (campaignId) {
      const campaignTranslationsResult = await db.select()
        .from(sdkTranslations)
        .where(and(
          eq(sdkTranslations.languageCode, languageCode),
          eq(sdkTranslations.campaignId, campaignId),
          isNull(sdkTranslations.matchId)
        ));
      
      // Merge campaign translations (override global)
      for (const ct of campaignTranslationsResult) {
        const idx = translations.findIndex(t => t.translationKey === ct.translationKey);
        if (idx >= 0) {
          translations[idx] = ct;
        } else {
          translations.push(ct);
        }
      }
    }
    
    // Finally get match-specific translations if matchId provided
    if (matchId && campaignId) {
      const matchTranslations = await db.select()
        .from(sdkTranslations)
        .where(and(
          eq(sdkTranslations.languageCode, languageCode),
          eq(sdkTranslations.campaignId, campaignId),
          eq(sdkTranslations.matchId, matchId)
        ));
      
      // Merge match translations (override campaign and global)
      for (const mt of matchTranslations) {
        const idx = translations.findIndex(t => t.translationKey === mt.translationKey);
        if (idx >= 0) {
          translations[idx] = mt;
        } else {
          translations.push(mt);
        }
      }
    }
    
    return translations;
  }
  
  async upsertSdkTranslation(translation: InsertSdkTranslation): Promise<SdkTranslation> {
    // Build conditions for finding existing translation
    const conditions = [
      eq(sdkTranslations.languageCode, translation.languageCode),
      eq(sdkTranslations.translationKey, translation.translationKey)
    ];
    
    if (translation.campaignId) {
      conditions.push(eq(sdkTranslations.campaignId, translation.campaignId));
    } else {
      conditions.push(isNull(sdkTranslations.campaignId));
    }
    
    if (translation.matchId) {
      conditions.push(eq(sdkTranslations.matchId, translation.matchId));
    } else {
      conditions.push(isNull(sdkTranslations.matchId));
    }
    
    const existing = await db.select()
      .from(sdkTranslations)
      .where(and(...conditions))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db.update(sdkTranslations)
        .set(translation)
        .where(eq(sdkTranslations.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(sdkTranslations).values(translation).returning();
    return created;
  }
  
  async deleteSdkTranslation(id: number): Promise<void> {
    await db.delete(sdkTranslations).where(eq(sdkTranslations.id, id));
  }
  
  // Full campaign config for SDK endpoints
  async getFullCampaignConfig(campaignId: number): Promise<{
    campaign: Campaign;
    translations: CampaignTranslation[];
    engagementConfig: CampaignEngagementConfig | null;
    uiConfig: CampaignUiConfig | null;
    featureFlags: CampaignFeatureFlags | null;
  } | null> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) return null;
    
    const [translations, engagementConfig, uiConfig, featureFlagsResult] = await Promise.all([
      this.getCampaignTranslations(campaignId),
      this.getCampaignEngagementConfig(campaignId),
      this.getCampaignUiConfig(campaignId),
      this.getCampaignFeatureFlags(campaignId)
    ]);
    
    return {
      campaign,
      translations,
      engagementConfig: engagementConfig || null,
      uiConfig: uiConfig || null,
      featureFlags: featureFlagsResult || null
    };
  }

  // Broadcast methods (database-backed)
  async createBroadcast(broadcast: InsertBroadcast): Promise<Broadcast> {
    const [newBroadcast] = await db.insert(broadcasts).values(broadcast).returning();
    return newBroadcast;
  }

  async getBroadcast(broadcastId: string): Promise<Broadcast | undefined> {
    const [broadcast] = await db.select().from(broadcasts).where(eq(broadcasts.broadcastId, broadcastId));
    return broadcast || undefined;
  }

  async getBroadcastByExternalId(externalId: string, clientAppId: number): Promise<Broadcast | undefined> {
    const result = await db
      .select({ broadcast: broadcasts })
      .from(broadcasts)
      .innerJoin(campaigns, eq(broadcasts.campaignId, campaigns.id))
      .leftJoin(channels, eq(campaigns.channelId, channels.id))
      .where(and(
        eq(broadcasts.externalId, externalId),
        or(
          eq(channels.clientAppId, clientAppId),
          eq(campaigns.clientAppId, clientAppId)
        )
      ))
      .limit(1);
    return result[0]?.broadcast || undefined;
  }

  async getAllBroadcasts(filters?: { status?: string; campaignId?: number }): Promise<Broadcast[]> {
    const conditions: any[] = [];
    if (filters?.status) {
      conditions.push(eq(broadcasts.status, filters.status));
    }
    if (filters?.campaignId) {
      conditions.push(eq(broadcasts.campaignId, filters.campaignId));
    }
    if (conditions.length > 0) {
      return await db.select().from(broadcasts).where(and(...conditions)).orderBy(desc(broadcasts.createdAt));
    }
    return await db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt));
  }

  async getCampaignBroadcasts(campaignId: number): Promise<Broadcast[]> {
    return await db.select().from(broadcasts)
      .where(eq(broadcasts.campaignId, campaignId))
      .orderBy(desc(broadcasts.createdAt));
  }

  async updateBroadcast(broadcastId: string, data: Partial<InsertBroadcast>): Promise<Broadcast | undefined> {
    const [updated] = await db.update(broadcasts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(broadcasts.broadcastId, broadcastId))
      .returning();
    return updated || undefined;
  }

  async deleteBroadcast(broadcastId: string): Promise<void> {
    await db.delete(broadcasts).where(eq(broadcasts.broadcastId, broadcastId));
  }

  async getBroadcastsByStatus(status: string): Promise<Broadcast[]> {
    return await db.select().from(broadcasts)
      .where(eq(broadcasts.status, status))
      .orderBy(desc(broadcasts.createdAt));
  }

  // Poll methods (database-backed)
  async createPoll(poll: InsertPoll): Promise<Poll> {
    const [newPoll] = await db.insert(polls).values(poll).returning();
    return newPoll;
  }

  async getPoll(id: number): Promise<Poll | undefined> {
    const [poll] = await db.select().from(polls).where(eq(polls.id, id));
    return poll || undefined;
  }

  async getBroadcastPolls(broadcastId: string): Promise<Array<Poll & { options: PollOptionRecord[] }>> {
    const broadcastPolls = await db.select().from(polls)
      .where(eq(polls.broadcastId, broadcastId))
      .orderBy(desc(polls.createdAt));
    
    const result: Array<Poll & { options: PollOptionRecord[] }> = [];
    for (const poll of broadcastPolls) {
      const options = await db.select().from(pollOptions)
        .where(eq(pollOptions.pollId, poll.id))
        .orderBy(pollOptions.displayOrder);
      result.push({ ...poll, options });
    }
    return result;
  }

  async updatePoll(id: number, data: Partial<InsertPoll>): Promise<Poll | undefined> {
    const [updated] = await db.update(polls)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(polls.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePoll(id: number): Promise<void> {
    await db.delete(polls).where(eq(polls.id, id));
  }

  // Poll option methods (database-backed)
  async createPollOption(option: InsertPollOption): Promise<PollOptionRecord> {
    const [newOption] = await db.insert(pollOptions).values(option).returning();
    return newOption;
  }

  async updatePollOptionVoteCount(optionId: number, increment: number): Promise<void> {
    await db.update(pollOptions)
      .set({ voteCount: sql`${pollOptions.voteCount} + ${increment}` })
      .where(eq(pollOptions.id, optionId));
  }

  // Poll vote methods (database-backed)
  async createPollVote(vote: InsertPollVote): Promise<PollVote> {
    const [newVote] = await db.insert(pollVotes).values(vote).returning();
    await db.update(polls)
      .set({ totalVotes: sql`${polls.totalVotes} + 1` })
      .where(eq(polls.id, vote.pollId));
    return newVote;
  }

  async createPollVoteWithCountUpdate(vote: InsertPollVote, optionId: number): Promise<PollVote> {
    return await db.transaction(async (tx) => {
      const [newVote] = await tx.insert(pollVotes).values(vote).returning();
      await tx.update(pollOptions)
        .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
        .where(eq(pollOptions.id, optionId));
      await tx.update(polls)
        .set({ totalVotes: sql`${polls.totalVotes} + 1` })
        .where(eq(polls.id, vote.pollId));
      return newVote;
    });
  }

  async hasUserVoted(pollId: number, userId: string): Promise<boolean> {
    const [vote] = await db.select().from(pollVotes)
      .where(and(
        eq(pollVotes.pollId, pollId),
        eq(pollVotes.userId, userId)
      ))
      .limit(1);
    return !!vote;
  }

  async getPollResults(pollId: number): Promise<{ poll: Poll; options: PollOptionRecord[] } | null> {
    const [poll] = await db.select().from(polls).where(eq(polls.id, pollId));
    if (!poll) return null;
    const options = await db.select().from(pollOptions)
      .where(eq(pollOptions.pollId, pollId))
      .orderBy(pollOptions.displayOrder);
    return { poll, options };
  }

  // Contest methods (database-backed)
  async createContest(contest: InsertContest): Promise<Contest> {
    const [newContest] = await db.insert(contests).values(contest).returning();
    return newContest;
  }

  async getContest(id: number): Promise<Contest | undefined> {
    const [contest] = await db.select().from(contests).where(eq(contests.id, id));
    return contest || undefined;
  }

  async getBroadcastContests(broadcastId: string): Promise<Contest[]> {
    return await db.select().from(contests)
      .where(eq(contests.broadcastId, broadcastId))
      .orderBy(desc(contests.createdAt));
  }

  async updateContest(id: number, data: Partial<InsertContest>): Promise<Contest | undefined> {
    const [updated] = await db.update(contests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contests.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteContest(id: number): Promise<void> {
    await db.delete(contests).where(eq(contests.id, id));
  }

  // Contest participation methods (database-backed)
  async createContestParticipation(participation: InsertContestParticipation): Promise<ContestParticipation> {
    const [newParticipation] = await db.insert(contestParticipations).values(participation).returning();
    return newParticipation;
  }

  async createContestParticipationAtomic(participation: InsertContestParticipation): Promise<ContestParticipation> {
    return await db.transaction(async (tx) => {
      const [newParticipation] = await tx.insert(contestParticipations).values(participation).returning();
      return newParticipation;
    });
  }

  async hasUserParticipated(contestId: number, userId: string): Promise<boolean> {
    const [participation] = await db.select().from(contestParticipations)
      .where(and(
        eq(contestParticipations.contestId, contestId),
        eq(contestParticipations.userId, userId)
      ))
      .limit(1);
    return !!participation;
  }

  async getContestParticipations(contestId: number): Promise<ContestParticipation[]> {
    return await db.select().from(contestParticipations)
      .where(eq(contestParticipations.contestId, contestId))
      .orderBy(desc(contestParticipations.createdAt));
  }

  // Pagination support methods
  async getBroadcastPollsPaginated(broadcastId: string, options: { limit: number; offset: number }): Promise<Array<Poll & { options: PollOptionRecord[] }>> {
    const broadcastPolls = await db.select().from(polls)
      .where(eq(polls.broadcastId, broadcastId))
      .orderBy(desc(polls.createdAt))
      .limit(options.limit)
      .offset(options.offset);

    const result: Array<Poll & { options: PollOptionRecord[] }> = [];
    for (const poll of broadcastPolls) {
      const opts = await db.select().from(pollOptions)
        .where(eq(pollOptions.pollId, poll.id))
        .orderBy(pollOptions.displayOrder);
      result.push({ ...poll, options: opts });
    }
    return result;
  }

  async getBroadcastPollsCount(broadcastId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(polls)
      .where(eq(polls.broadcastId, broadcastId));
    return result?.count ?? 0;
  }

  async getBroadcastContestsPaginated(broadcastId: string, options: { limit: number; offset: number }): Promise<Contest[]> {
    return await db.select().from(contests)
      .where(eq(contests.broadcastId, broadcastId))
      .orderBy(desc(contests.createdAt))
      .limit(options.limit)
      .offset(options.offset);
  }

  async getBroadcastContestsCount(broadcastId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(contests)
      .where(eq(contests.broadcastId, broadcastId));
    return result?.count ?? 0;
  }

  async getBroadcastEngagementCounts(broadcastIds: string[]): Promise<Map<string, { pollCount: number; activePollCount: number; contestCount: number }>> {
    const result = new Map<string, { pollCount: number; activePollCount: number; contestCount: number }>();
    if (broadcastIds.length === 0) return result;

    const pollCounts = await db
      .select({
        broadcastId: polls.broadcastId,
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${polls.isActive} = true)::int`,
      })
      .from(polls)
      .where(inArray(polls.broadcastId, broadcastIds))
      .groupBy(polls.broadcastId);

    const contestCounts = await db
      .select({
        broadcastId: contests.broadcastId,
        total: sql<number>`count(*)::int`,
      })
      .from(contests)
      .where(inArray(contests.broadcastId, broadcastIds))
      .groupBy(contests.broadcastId);

    const contestMap = new Map(contestCounts.map(c => [c.broadcastId, c.total]));

    for (const id of broadcastIds) {
      const pollRow = pollCounts.find(p => p.broadcastId === id);
      result.set(id, {
        pollCount: pollRow?.total ?? 0,
        activePollCount: pollRow?.active ?? 0,
        contestCount: contestMap.get(id) ?? 0,
      });
    }

    return result;
  }

  // Broadcast Ads
  async getBroadcastAds(broadcastId: string): Promise<BroadcastAd[]> {
    return db.select().from(broadcastAds)
      .where(eq(broadcastAds.broadcastId, broadcastId))
      .orderBy(broadcastAds.displayOrder, broadcastAds.createdAt);
  }

  async createBroadcastAd(ad: InsertBroadcastAd): Promise<BroadcastAd> {
    const [created] = await db.insert(broadcastAds).values(ad).returning();
    return created;
  }

  async updateBroadcastAd(id: number, data: Partial<InsertBroadcastAd>): Promise<BroadcastAd | undefined> {
    const [updated] = await db.update(broadcastAds).set(data).where(eq(broadcastAds.id, id)).returning();
    return updated;
  }

  async deleteBroadcastAd(id: number): Promise<void> {
    await db.delete(broadcastAds).where(eq(broadcastAds.id, id));
  }

  // Broadcast Products
  async getBroadcastProducts(broadcastId: string): Promise<BroadcastProduct[]> {
    return db.select().from(broadcastProducts)
      .where(eq(broadcastProducts.broadcastId, broadcastId))
      .orderBy(broadcastProducts.displayOrder, broadcastProducts.createdAt);
  }

  async createBroadcastProduct(product: InsertBroadcastProduct): Promise<BroadcastProduct> {
    const [created] = await db.insert(broadcastProducts).values(product).returning();
    return created;
  }

  async updateBroadcastProduct(id: number, data: Partial<InsertBroadcastProduct>): Promise<BroadcastProduct | undefined> {
    const [updated] = await db.update(broadcastProducts).set(data).where(eq(broadcastProducts.id, id)).returning();
    return updated;
  }

  async deleteBroadcastProduct(id: number): Promise<void> {
    await db.delete(broadcastProducts).where(eq(broadcastProducts.id, id));
  }

  // Chat Messages
  async getChatMessages(broadcastId: string, limit = 50): Promise<ChatMessage[]> {
    const messages = await db.select().from(chatMessages)
      .where(eq(chatMessages.broadcastId, broadcastId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return messages.reverse();
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(message).returning();
    return created;
  }
}

export const storage = new MemStorage();
