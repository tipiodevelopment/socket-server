import { z } from "zod";
import { pgTable, serial, varchar, text, timestamp, json, integer, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Database Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  reachuUserId: varchar("reachu_user_id", { length: 255 }).notNull().unique(),
  email: text("email"),
  name: text("name"),
  firebaseToken: text("firebase_token"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const clientApps = pgTable("client_apps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  bundleId: varchar("bundle_id", { length: 255 }).notNull().unique(),
  apiKey: text("api_key").notNull().unique(),
  reachuApiKey: text("reachu_api_key"),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default('active'),
  iconUrl: text("icon_url"),
  bannerUrl: text("banner_url"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  clientAppId: integer("client_app_id").references(() => clientApps.id, { onDelete: 'set null' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  dynamicConfig: json("dynamic_config"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const sponsors = pgTable("sponsors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  avatarUrl: text("avatar_url"),
  primaryColor: varchar("primary_color", { length: 20 }),
  secondaryColor: varchar("secondary_color", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientAppId: integer("client_app_id").references(() => clientApps.id, { onDelete: 'cascade' }),
  channelId: integer("channel_id").references(() => channels.id, { onDelete: 'cascade' }),
  sponsorId: integer("sponsor_id").references(() => sponsors.id, { onDelete: 'set null' }),
  name: varchar("name", { length: 255 }).notNull(),
  logo: text("logo"),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isPaused: varchar("is_paused", { length: 10 }).notNull().default('false'),
  reachuChannelId: varchar("reachu_channel_id", { length: 255 }),
  reachuApiKey: text("reachu_api_key"),
  tipioLivestreamData: json("tipio_livestream_data"),
  isSegmented: varchar("is_segmented", { length: 10 }).notNull().default('false'),
  targetCountries: text("target_countries").array(),
  targetPercentage: integer("target_percentage"),
  matchId: varchar("match_id", { length: 255 }),
  matchName: varchar("match_name", { length: 255 }),
  matchStartTime: timestamp("match_start_time"),
  brandName: varchar("brand_name", { length: 255 }),
  brandIconAsset: varchar("brand_icon_asset", { length: 255 }),
  brandIconUrl: text("brand_icon_url"),
  brandLogoUrl: text("brand_logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Campaign Translations - for sponsorBadgeText and other campaign-specific translations
export const campaignTranslations = pgTable("campaign_translations", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  languageCode: varchar("language_code", { length: 10 }).notNull(),
  sponsorBadgeText: varchar("sponsor_badge_text", { length: 255 })
});

// Campaign Engagement Config - engagement settings per campaign
export const campaignEngagementConfig = pgTable("campaign_engagement_config", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  demoMode: varchar("demo_mode", { length: 10 }).notNull().default('false'),
  defaultPollDuration: integer("default_poll_duration").notNull().default(300),
  defaultContestDuration: integer("default_contest_duration").notNull().default(600),
  maxVotesPerPoll: integer("max_votes_per_poll").notNull().default(1),
  maxContestsPerMatch: integer("max_contests_per_match").notNull().default(10),
  enableRealTimeUpdates: varchar("enable_real_time_updates", { length: 10 }).notNull().default('true'),
  updateInterval: integer("update_interval").notNull().default(1000)
});

// Campaign UI Config - UI theme settings per campaign
export const campaignUiConfig = pgTable("campaign_ui_config", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  primaryColor: varchar("primary_color", { length: 7 }).notNull().default('#007AFF'),
  secondaryColor: varchar("secondary_color", { length: 7 }).notNull().default('#5856D6'),
  componentConfigs: json("component_configs")
});

// Campaign Feature Flags - feature toggles per campaign
export const campaignFeatureFlags = pgTable("campaign_feature_flags", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  enableLiveStreaming: varchar("enable_live_streaming", { length: 10 }).notNull().default('true'),
  enableProductCatalog: varchar("enable_product_catalog", { length: 10 }).notNull().default('true'),
  enableEngagement: varchar("enable_engagement", { length: 10 }).notNull().default('true'),
  enablePolls: varchar("enable_polls", { length: 10 }).notNull().default('true'),
  enableContests: varchar("enable_contests", { length: 10 }).notNull().default('true')
});

// SDK Translations - global/campaign/match-specific translations
export const sdkTranslations = pgTable("sdk_translations", {
  id: serial("id").primaryKey(),
  languageCode: varchar("language_code", { length: 10 }).notNull(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }),
  matchId: varchar("match_id", { length: 255 }),
  translationKey: varchar("translation_key", { length: 100 }).notNull(),
  translationValue: text("translation_value").notNull(),
  dateFormat: varchar("date_format", { length: 50 }).notNull().default('dd.MM.yyyy'),
  timeFormat: varchar("time_format", { length: 50 }).notNull().default('HH:mm')
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  type: varchar("type", { length: 50 }).notNull(),
  data: json("data").notNull(),
  campaignLogo: text("campaign_logo"),
  timestamp: timestamp("timestamp").defaultNow().notNull()
});

export const campaignFormState = pgTable("campaign_form_state", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  formType: varchar("form_type", { length: 50 }).notNull(),
  formData: json("form_data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const scheduledComponents = pgTable("scheduled_components", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  type: varchar("type", { length: 50 }).notNull(), // carousel, store_view, product_spotlight, liveshow_trigger
  scheduledTime: timestamp("scheduled_time").notNull(),
  endTime: timestamp("end_time"), // Optional end time for component display
  data: json("data").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'), // pending, sent, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Dynamic Components - Reusable UI components library
export const components = pgTable("components", {
  id: varchar("id", { length: 50 }).primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull(), // banner, countdown, carousel_auto, carousel_manual, product_spotlight, offer_badge
  name: varchar("name", { length: 255 }).notNull(),
  config: json("config").notNull(), // Type-specific configuration
  isTemplate: varchar("is_template", { length: 10 }).notNull().default('false'), // 'true' = base template, 'false' = regular component
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Campaign Components - Links components to campaigns with status and custom config
// Can be manual toggle OR scheduled OR both
// Supports multiple instances of the same component template with different instanceNames
export const campaignComponents = pgTable("campaign_components", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  componentId: varchar("component_id", { length: 50 }).notNull().references(() => components.id, { onDelete: 'cascade' }),
  instanceName: varchar("instance_name", { length: 255 }), // Optional: Name for this instance (e.g., "Vitamins Carousel", "Omega-3 Banner")
  status: varchar("status", { length: 20 }).notNull().default('inactive'), // active, inactive
  customConfig: json("custom_config"), // Campaign-specific config override (optional)
  scheduledTime: timestamp("scheduled_time"), // Optional: auto-activate at this time (null = manual toggle only)
  endTime: timestamp("end_time"), // Optional: auto-deactivate at this time (null = no end)
  activatedAt: timestamp("activated_at"),
  matchId: varchar("match_id", { length: 255 }),
  locationId: varchar("location_id", { length: 100 }), // SDK slot identifier e.g. "top-banner", "sidebar-carousel"
  videoStartTime: integer("video_start_time"),
  videoEndTime: integer("video_end_time"),
  scheduledStartTime: timestamp("scheduled_start_time"),
  scheduledEndTime: timestamp("scheduled_end_time"),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// App Components - Links components to apps (components are shared across all app campaigns)
export const appComponents = pgTable("app_components", {
  id: serial("id").primaryKey(),
  clientAppId: integer("client_app_id").notNull().references(() => clientApps.id, { onDelete: 'cascade' }),
  componentId: varchar("component_id", { length: 50 }).notNull().references(() => components.id, { onDelete: 'cascade' }),
  customConfig: json("custom_config"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Broadcasts - represents live events/matches that campaigns are associated with
export const broadcasts = pgTable("broadcasts", {
  broadcastId: varchar("broadcast_id", { length: 255 }).primaryKey(),
  broadcastName: varchar("broadcast_name", { length: 255 }).notNull(),
  description: text("description"),
  externalId: varchar("external_id", { length: 255 }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'cascade' }),
  channelId: integer("channel_id").references(() => channels.id, { onDelete: 'set null' }),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  status: varchar("status", { length: 20 }).notNull().default('upcoming'),
  viewerCount: integer("viewer_count").default(0),
  peakViewers: integer("peak_viewers").default(0),
  metadata: json("metadata"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  externalIdCampaignIdx: index("idx_broadcasts_external_id_campaign").on(table.externalId, table.campaignId),
}));

// Polls - engagement polls associated with broadcasts
export const polls = pgTable("polls", {
  id: serial("id").primaryKey(),
  broadcastId: varchar("broadcast_id", { length: 255 }).notNull().references(() => broadcasts.broadcastId, { onDelete: 'cascade' }),
  question: text("question").notNull(),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  isActive: boolean("is_active").notNull().default(true),
  totalVotes: integer("total_votes").notNull().default(0),
  duration: integer("duration"),
  videoStartTime: integer("video_start_time"),
  videoEndTime: integer("video_end_time"),
  broadcastStartTime: timestamp("broadcast_start_time"),
  scheduledStartTime: timestamp("scheduled_start_time"),
  scheduledEndTime: timestamp("scheduled_end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => [
  index("idx_polls_broadcast_id").on(table.broadcastId),
  index("idx_polls_is_active").on(table.isActive),
  index("idx_polls_scheduled").on(table.scheduledStartTime, table.scheduledEndTime),
]);

// Poll Options - choices for each poll
export const pollOptions = pgTable("poll_options", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull().references(() => polls.id, { onDelete: 'cascade' }),
  text: varchar("text", { length: 500 }).notNull(),
  voteCount: integer("vote_count").notNull().default(0),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("idx_poll_options_poll_id").on(table.pollId),
]);

// Poll Votes - individual vote records
export const pollVotes = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").notNull().references(() => polls.id, { onDelete: 'cascade' }),
  optionId: integer("option_id").notNull().references(() => pollOptions.id, { onDelete: 'cascade' }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  broadcastId: varchar("broadcast_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  uniqueIndex("unique_user_poll").on(table.pollId, table.userId),
  index("idx_poll_votes_poll_id").on(table.pollId),
  index("idx_poll_votes_broadcast_id").on(table.broadcastId),
]);

// Contests - engagement contests associated with broadcasts
export const contests = pgTable("contests", {
  id: serial("id").primaryKey(),
  broadcastId: varchar("broadcast_id", { length: 255 }).notNull().references(() => broadcasts.broadcastId, { onDelete: 'cascade' }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  prize: varchar("prize", { length: 500 }),
  contestType: varchar("contest_type", { length: 50 }).notNull(),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  isActive: boolean("is_active").notNull().default(true),
  imageUrl: varchar("image_url", { length: 1000 }),
  videoStartTime: integer("video_start_time"),
  videoEndTime: integer("video_end_time"),
  broadcastStartTime: timestamp("broadcast_start_time"),
  scheduledStartTime: timestamp("scheduled_start_time"),
  scheduledEndTime: timestamp("scheduled_end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => [
  index("idx_contests_broadcast_id").on(table.broadcastId),
  index("idx_contests_is_active").on(table.isActive),
  index("idx_contests_scheduled").on(table.scheduledStartTime, table.scheduledEndTime),
]);

// Contest Participations - individual participation records
export const contestParticipations = pgTable("contest_participations", {
  id: serial("id").primaryKey(),
  contestId: integer("contest_id").notNull().references(() => contests.id, { onDelete: 'cascade' }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  broadcastId: varchar("broadcast_id", { length: 255 }).notNull(),
  answers: json("answers"),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  uniqueIndex("unique_user_contest").on(table.contestId, table.userId),
  index("idx_contest_participations_contest_id").on(table.contestId),
  index("idx_contest_participations_broadcast_id").on(table.broadcastId),
]);

// Broadcast Ads — scheduled/active ads linked to a broadcast
export const broadcastAds = pgTable("broadcast_ads", {
  id: serial("id").primaryKey(),
  broadcastId: varchar("broadcast_id", { length: 255 }).notNull().references(() => broadcasts.broadcastId, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  ctaUrl: text("cta_url"),
  startTime: varchar("start_time", { length: 20 }),
  duration: varchar("duration", { length: 20 }),
  adType: varchar("ad_type", { length: 50 }).notNull().default('banner'),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("idx_broadcast_ads_broadcast_id").on(table.broadcastId),
]);

// Broadcast Products — shoppable products linked to a broadcast
export const broadcastProducts = pgTable("broadcast_products", {
  id: serial("id").primaryKey(),
  broadcastId: varchar("broadcast_id", { length: 255 }).notNull().references(() => broadcasts.broadcastId, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  subtitle: text("subtitle"),
  price: varchar("price", { length: 20 }).notNull().default('0'),
  originalPrice: varchar("original_price", { length: 20 }),
  imageUrl: text("image_url"),
  buyUrl: text("buy_url"),
  status: varchar("status", { length: 20 }).notNull().default('available'),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("idx_broadcast_products_broadcast_id").on(table.broadcastId),
]);

// Chat Messages — live chat messages per broadcast
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  broadcastId: varchar("broadcast_id", { length: 255 }).notNull().references(() => broadcasts.broadcastId, { onDelete: 'cascade' }),
  username: varchar("username", { length: 100 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull().default('message'), // 'message' | 'tweet'
  metadata: json("metadata"), // For tweets: { tweetId, via, metrics: { likes, retweets } }
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("idx_chat_messages_broadcast_id").on(table.broadcastId),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  campaigns: many(campaigns),
  clientApps: many(clientApps),
  sponsors: many(sponsors)
}));

export const sponsorsRelations = relations(sponsors, ({ one, many }) => ({
  user: one(users, {
    fields: [sponsors.userId],
    references: [users.id]
  }),
  campaigns: many(campaigns)
}));

export const clientAppsRelations = relations(clientApps, ({ one, many }) => ({
  user: one(users, {
    fields: [clientApps.userId],
    references: [users.id]
  }),
  channels: many(channels),
  campaigns: many(campaigns),
  appComponents: many(appComponents)
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  clientApp: one(clientApps, {
    fields: [channels.clientAppId],
    references: [clientApps.id]
  }),
  campaigns: many(campaigns)
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id]
  }),
  clientApp: one(clientApps, {
    fields: [campaigns.clientAppId],
    references: [clientApps.id]
  }),
  channel: one(channels, {
    fields: [campaigns.channelId],
    references: [channels.id]
  }),
  sponsor: one(sponsors, {
    fields: [campaigns.sponsorId],
    references: [sponsors.id]
  }),
  events: many(events),
  formStates: many(campaignFormState),
  scheduledComponents: many(scheduledComponents),
  campaignComponents: many(campaignComponents),
  translations: many(campaignTranslations),
  engagementConfig: many(campaignEngagementConfig),
  uiConfig: many(campaignUiConfig),
  featureFlags: many(campaignFeatureFlags),
  broadcasts: many(broadcasts)
}));

export const campaignTranslationsRelations = relations(campaignTranslations, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignTranslations.campaignId],
    references: [campaigns.id]
  })
}));

export const campaignEngagementConfigRelations = relations(campaignEngagementConfig, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignEngagementConfig.campaignId],
    references: [campaigns.id]
  })
}));

export const campaignUiConfigRelations = relations(campaignUiConfig, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignUiConfig.campaignId],
    references: [campaigns.id]
  })
}));

export const campaignFeatureFlagsRelations = relations(campaignFeatureFlags, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignFeatureFlags.campaignId],
    references: [campaigns.id]
  })
}));

export const sdkTranslationsRelations = relations(sdkTranslations, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [sdkTranslations.campaignId],
    references: [campaigns.id]
  })
}));

export const eventsRelations = relations(events, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [events.campaignId],
    references: [campaigns.id]
  })
}));

export const campaignFormStateRelations = relations(campaignFormState, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignFormState.campaignId],
    references: [campaigns.id]
  })
}));

export const scheduledComponentsRelations = relations(scheduledComponents, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [scheduledComponents.campaignId],
    references: [campaigns.id]
  })
}));

export const componentsRelations = relations(components, ({ many }) => ({
  campaignComponents: many(campaignComponents),
  appComponents: many(appComponents)
}));

export const appComponentsRelations = relations(appComponents, ({ one }) => ({
  clientApp: one(clientApps, {
    fields: [appComponents.clientAppId],
    references: [clientApps.id]
  }),
  component: one(components, {
    fields: [appComponents.componentId],
    references: [components.id]
  })
}));

export const campaignComponentsRelations = relations(campaignComponents, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignComponents.campaignId],
    references: [campaigns.id]
  }),
  component: one(components, {
    fields: [campaignComponents.componentId],
    references: [components.id]
  })
}));

export const broadcastsRelations = relations(broadcasts, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [broadcasts.campaignId],
    references: [campaigns.id]
  }),
  channel: one(channels, {
    fields: [broadcasts.channelId],
    references: [channels.id]
  }),
  creator: one(users, {
    fields: [broadcasts.createdBy],
    references: [users.id]
  }),
  polls: many(polls),
  contests: many(contests),
  ads: many(broadcastAds),
  products: many(broadcastProducts),
  chatMessages: many(chatMessages)
}));

export const broadcastAdsRelations = relations(broadcastAds, ({ one }) => ({
  broadcast: one(broadcasts, {
    fields: [broadcastAds.broadcastId],
    references: [broadcasts.broadcastId]
  })
}));

export const broadcastProductsRelations = relations(broadcastProducts, ({ one }) => ({
  broadcast: one(broadcasts, {
    fields: [broadcastProducts.broadcastId],
    references: [broadcasts.broadcastId]
  })
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  broadcast: one(broadcasts, {
    fields: [chatMessages.broadcastId],
    references: [broadcasts.broadcastId]
  })
}));

export const pollsRelations = relations(polls, ({ one, many }) => ({
  broadcast: one(broadcasts, {
    fields: [polls.broadcastId],
    references: [broadcasts.broadcastId]
  }),
  options: many(pollOptions),
  votes: many(pollVotes)
}));

export const pollOptionsRelations = relations(pollOptions, ({ one }) => ({
  poll: one(polls, {
    fields: [pollOptions.pollId],
    references: [polls.id]
  })
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  poll: one(polls, {
    fields: [pollVotes.pollId],
    references: [polls.id]
  }),
  option: one(pollOptions, {
    fields: [pollVotes.optionId],
    references: [pollOptions.id]
  })
}));

export const contestsRelations = relations(contests, ({ one, many }) => ({
  broadcast: one(broadcasts, {
    fields: [contests.broadcastId],
    references: [broadcasts.broadcastId]
  }),
  participations: many(contestParticipations)
}));

export const contestParticipationsRelations = relations(contestParticipations, ({ one }) => ({
  contest: one(contests, {
    fields: [contestParticipations.contestId],
    references: [contests.id]
  })
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true,
  createdAt: true 
});

export const insertSponsorSchema = createInsertSchema(sponsors).omit({ 
  id: true,
  createdAt: true 
});

export const insertClientAppSchema = createInsertSchema(clientApps).omit({ 
  id: true,
  createdAt: true 
});

export const insertChannelSchema = createInsertSchema(channels).omit({ 
  id: true,
  createdAt: true 
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({ 
  id: true,
  createdAt: true 
});

// Update schema for campaign - accepts ISO date strings instead of Date objects
export const updateCampaignSchema = insertCampaignSchema.partial().extend({
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  targetCountries: z.array(z.string()).nullable().optional(),
  targetPercentage: z.number().min(1).max(100).nullable().optional(),
  isSegmented: z.string().optional(),
  matchId: z.string().nullable().optional(),
  matchName: z.string().nullable().optional(),
  matchStartTime: z.string().datetime().nullable().optional()
});

export const insertEventSchema = createInsertSchema(events).omit({ 
  id: true,
  timestamp: true 
});

export const insertFormStateSchema = createInsertSchema(campaignFormState).omit({ 
  id: true,
  updatedAt: true 
});

export const insertScheduledComponentSchema = createInsertSchema(scheduledComponents).omit({ 
  id: true,
  createdAt: true 
});

export const insertComponentSchema = createInsertSchema(components).omit({ 
  id: true,
  createdAt: true 
});

export const insertCampaignComponentSchema = createInsertSchema(campaignComponents).omit({ 
  id: true,
  updatedAt: true 
});

export const insertAppComponentSchema = createInsertSchema(appComponents).omit({ 
  id: true,
  createdAt: true 
});

export const insertCampaignTranslationSchema = createInsertSchema(campaignTranslations).omit({ 
  id: true 
});

export const insertCampaignEngagementConfigSchema = createInsertSchema(campaignEngagementConfig).omit({ 
  id: true 
});

export const insertCampaignUiConfigSchema = createInsertSchema(campaignUiConfig).omit({ 
  id: true 
});

export const insertCampaignFeatureFlagsSchema = createInsertSchema(campaignFeatureFlags).omit({ 
  id: true 
});

export const insertSdkTranslationSchema = createInsertSchema(sdkTranslations).omit({ 
  id: true 
});

export const insertBroadcastSchema = createInsertSchema(broadcasts).omit({
  createdAt: true,
  updatedAt: true
});

export const insertBroadcastAdSchema = createInsertSchema(broadcastAds).omit({
  id: true,
  createdAt: true
});

export const insertBroadcastProductSchema = createInsertSchema(broadcastProducts).omit({
  id: true,
  createdAt: true
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true
});

export const updateBroadcastSchema = insertBroadcastSchema.partial().extend({
  startTime: z.string().datetime().nullable().optional(),
  endTime: z.string().datetime().nullable().optional()
});

export const insertPollSchema = createInsertSchema(polls).omit({
  id: true,
  totalVotes: true,
  createdAt: true,
  updatedAt: true
});

export const insertPollOptionSchema = createInsertSchema(pollOptions).omit({
  id: true,
  voteCount: true,
  createdAt: true
});

export const insertPollVoteSchema = createInsertSchema(pollVotes).omit({
  id: true,
  createdAt: true
});

export const insertContestSchema = createInsertSchema(contests).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertContestParticipationSchema = createInsertSchema(contestParticipations).omit({
  id: true,
  createdAt: true
});

// API Input Validation Schemas
export const createPollInputSchema = z.object({
  question: z.string().min(1, "Question is required").max(500),
  options: z.array(z.union([z.string().min(1), z.object({ text: z.string().min(1) })])).min(2, "At least 2 options are required").max(20),
  duration: z.number().int().min(1).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isActive: z.boolean().optional().default(true),
  videoStartTime: z.number().int().min(0).optional(),
  videoEndTime: z.number().int().min(0).optional(),
  broadcastStartTime: z.string().datetime().optional(),
});

export const createContestInputSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(2000).optional(),
  prize: z.string().max(500).optional(),
  contestType: z.string().min(1, "Contest type is required").max(50),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isActive: z.boolean().optional().default(true),
  videoStartTime: z.number().int().min(0).optional(),
  videoEndTime: z.number().int().min(0).optional(),
  broadcastStartTime: z.string().datetime().optional(),
});

export const voteInputSchema = z.object({
  optionId: z.number().int().positive("optionId is required"),
  userId: z.string().min(1, "userId is required").max(255),
  broadcastId: z.string().min(1, "broadcastId is required").max(255),
});

export const participateInputSchema = z.object({
  userId: z.string().min(1, "userId is required").max(255),
  broadcastId: z.string().min(1, "broadcastId is required").max(255),
  answers: z.record(z.any()).optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Sponsor = typeof sponsors.$inferSelect;
export type InsertSponsor = z.infer<typeof insertSponsorSchema>;
export type ClientApp = typeof clientApps.$inferSelect;
export type InsertClientApp = z.infer<typeof insertClientAppSchema>;
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type UpdateCampaign = z.infer<typeof updateCampaignSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type CampaignFormState = typeof campaignFormState.$inferSelect;
export type InsertFormState = z.infer<typeof insertFormStateSchema>;
export type ScheduledComponent = typeof scheduledComponents.$inferSelect;
export type InsertScheduledComponent = z.infer<typeof insertScheduledComponentSchema>;
export type Component = typeof components.$inferSelect;
export type InsertComponent = z.infer<typeof insertComponentSchema>;
export type CampaignComponent = typeof campaignComponents.$inferSelect;
export type InsertCampaignComponent = z.infer<typeof insertCampaignComponentSchema>;
export type AppComponent = typeof appComponents.$inferSelect;
export type InsertAppComponent = z.infer<typeof insertAppComponentSchema>;
export type CampaignTranslation = typeof campaignTranslations.$inferSelect;
export type InsertCampaignTranslation = z.infer<typeof insertCampaignTranslationSchema>;
export type CampaignEngagementConfig = typeof campaignEngagementConfig.$inferSelect;
export type InsertCampaignEngagementConfig = z.infer<typeof insertCampaignEngagementConfigSchema>;
export type CampaignUiConfig = typeof campaignUiConfig.$inferSelect;
export type InsertCampaignUiConfig = z.infer<typeof insertCampaignUiConfigSchema>;
export type CampaignFeatureFlags = typeof campaignFeatureFlags.$inferSelect;
export type InsertCampaignFeatureFlags = z.infer<typeof insertCampaignFeatureFlagsSchema>;
export type SdkTranslation = typeof sdkTranslations.$inferSelect;
export type InsertSdkTranslation = z.infer<typeof insertSdkTranslationSchema>;
export type Broadcast = typeof broadcasts.$inferSelect;
export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;
export type UpdateBroadcast = z.infer<typeof updateBroadcastSchema>;
export type Poll = typeof polls.$inferSelect;
export type InsertPoll = z.infer<typeof insertPollSchema>;
export type PollOptionRecord = typeof pollOptions.$inferSelect;
export type InsertPollOption = z.infer<typeof insertPollOptionSchema>;
export type PollVote = typeof pollVotes.$inferSelect;
export type InsertPollVote = z.infer<typeof insertPollVoteSchema>;
export type Contest = typeof contests.$inferSelect;
export type InsertContest = z.infer<typeof insertContestSchema>;
export type ContestParticipation = typeof contestParticipations.$inferSelect;
export type InsertContestParticipation = z.infer<typeof insertContestParticipationSchema>;
export type BroadcastAd = typeof broadcastAds.$inferSelect;
export type InsertBroadcastAd = z.infer<typeof insertBroadcastAdSchema>;
export type BroadcastProduct = typeof broadcastProducts.$inferSelect;
export type InsertBroadcastProduct = z.infer<typeof insertBroadcastProductSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Event schemas
export const productEventSchema = z.object({
  id: z.number().optional(),
  type: z.literal("product"),
  data: z.object({
    id: z.string(),
    productId: z.string(),
    name: z.string(),
    description: z.string(),
    price: z.string(),
    currency: z.string().default("USD"),
    imageUrl: z.string().url().optional()
  }),
  campaignLogo: z.string().optional(),
  timestamp: z.number()
});

export const pollOptionSchema = z.object({
  text: z.string(),
  imageUrl: z.string().optional()
});

export const pollEventSchema = z.object({
  id: z.number().optional(),
  type: z.literal("poll"),
  broadcastId: z.string().optional(),
  data: z.object({
    id: z.string(),
    question: z.string(),
    options: z.array(pollOptionSchema),
    duration: z.number(),
    imageUrl: z.string().url().optional()
  }),
  campaignLogo: z.string().optional(),
  timestamp: z.number()
});

export const contestEventSchema = z.object({
  id: z.number().optional(),
  type: z.literal("contest"),
  broadcastId: z.string().optional(),
  data: z.object({
    id: z.string(),
    name: z.string(),
    prize: z.string(),
    deadline: z.string(),
    maxParticipants: z.number()
  }),
  campaignLogo: z.string().optional(),
  timestamp: z.number()
});

export const webSocketEventSchema = z.union([
  productEventSchema,
  pollEventSchema,
  contestEventSchema
]);

// Types
export type PollOption = z.infer<typeof pollOptionSchema>;
export type ProductEvent = z.infer<typeof productEventSchema>;
export type PollEvent = z.infer<typeof pollEventSchema>;
export type ContestEvent = z.infer<typeof contestEventSchema>;
export type WebSocketEvent = z.infer<typeof webSocketEventSchema>;

// Connection status type
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

// Scheduled Component Schemas
export const carouselComponentSchema = z.object({
  type: z.literal("carousel"),
  productIds: z.array(z.string()), // IDs de productos de Reachu
  autoRotate: z.boolean().default(true),
  intervalSeconds: z.number().default(5)
});

export const storeViewComponentSchema = z.object({
  type: z.literal("store_view"),
  categoryId: z.string().optional(),
  layout: z.enum(["grid", "list"]).default("grid"),
  maxItems: z.number().default(20)
});

export const productSpotlightComponentSchema = z.object({
  type: z.literal("product_spotlight"),
  productId: z.string(),
  highlightText: z.string().optional(),
  durationSeconds: z.number().default(30)
});

export const liveshowTriggerComponentSchema = z.object({
  type: z.literal("liveshow_trigger"),
  liveshowId: z.string(),
  autoStart: z.boolean().default(true)
});

export const customComponentSchema = z.object({
  type: z.literal("custom_component"),
  componentId: z.string() // References components table
});

export const scheduledComponentDataSchema = z.union([
  carouselComponentSchema,
  storeViewComponentSchema,
  productSpotlightComponentSchema,
  liveshowTriggerComponentSchema,
  customComponentSchema
]);

// Scheduled Component Types
export type CarouselComponent = z.infer<typeof carouselComponentSchema>;
export type StoreViewComponent = z.infer<typeof storeViewComponentSchema>;
export type ProductSpotlightComponent = z.infer<typeof productSpotlightComponentSchema>;
export type LiveshowTriggerComponent = z.infer<typeof liveshowTriggerComponentSchema>;
export type CustomComponent = z.infer<typeof customComponentSchema>;
export type ScheduledComponentData = z.infer<typeof scheduledComponentDataSchema>;


// Reachu Channel Schema (for API responses)
export const reachuChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  productCount: z.number()
});

export type ReachuChannel = z.infer<typeof reachuChannelSchema>;

// Dynamic Component Config Schemas
export const bannerComponentConfigSchema = z.object({
  imageUrl: z.string().url(),
  title: z.string(),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().url().optional()
});

export const countdownComponentConfigSchema = z.object({
  // Core (requeridos)
  endDate: z.string(), // ISO timestamp
  title: z.string(),
  
  // Visuales (opcionales)
  logoUrl: z.string().url().optional(),
  subtitle: z.string().optional(),
  backgroundImageUrl: z.string().url().optional(),
  backgroundColor: z.string().default("#FF6F61").optional(), // Default coral color
  discountBadgeText: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().url().optional(),
  deeplink: z.string().optional(), // Priority over ctaLink for in-app navigation
  overlayOpacity: z.number().min(0).max(1).default(0.6).optional(),
  buttonColor: z.string().default("#FFFFFF").optional() // Default white
});

export const carouselAutoComponentConfigSchema = z.object({
  channelId: z.string(), // Reachu channel ID
  displayCount: z.number().default(5)
});

export const carouselManualComponentConfigSchema = z.object({
  productIds: z.array(z.string()),
  displayCount: z.number().default(5)
});

export const productSpotlightConfigSchema = z.object({
  productId: z.string(),
  highlightText: z.string().optional()
});

export const offerBadgeConfigSchema = z.object({
  text: z.string(),
  color: z.enum(["red", "blue", "green", "gold"]).default("red")
});

export const offerBannerConfigSchema = z.object({
  logoUrl: z.string().url(),
  title: z.string(),
  subtitle: z.string().optional(),
  backgroundImageUrl: z.string().url(),
  countdownEndDate: z.string(), // ISO timestamp
  discountBadgeText: z.string(),
  ctaText: z.string(),
  ctaLink: z.string().url().optional(),
  overlayOpacity: z.number().min(0).max(1).default(0.4).optional()
});

export const productCarouselConfigSchema = z.object({
  productIds: z.array(z.string()).optional(), // Optional: if empty/undefined, SDK fetches all channel products
  autoPlay: z.boolean().default(false),
  interval: z.number().default(3000)
});

export const productBannerConfigSchema = z.object({
  // Content
  productId: z.string(),
  backgroundImageUrl: z.string().url(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().url().optional(),
  deeplink: z.string().optional(),
  
  // Visual Customization (all optional with defaults)
  // Colors
  titleColor: z.string().default("#FFFFFF").optional(),
  subtitleColor: z.string().default("#F0F0F0").optional(),
  buttonBackgroundColor: z.string().default("#007AFF").optional(), // iOS blue
  buttonTextColor: z.string().default("#FFFFFF").optional(),
  backgroundColor: z.string().default("rgba(0, 0, 0, 0.3)").optional(), // Background color with alpha
  
  // Layout
  overlayOpacity: z.number().min(0).max(1).default(0.5).optional(),
  bannerHeight: z.number().default(200).optional(),
  titleFontSize: z.number().default(24).optional(),
  subtitleFontSize: z.number().default(16).optional(),
  buttonFontSize: z.number().default(14).optional(),
  
  // Alignment
  textAlignment: z.enum(["left", "center", "right"]).default("center").optional(),
  contentVerticalAlignment: z.enum(["top", "center", "bottom"]).default("center").optional()
});

export const productStoreConfigSchema = z.object({
  mode: z.enum(["all", "filtered"]).default("all"),
  productIds: z.array(z.string()).optional(),
  displayType: z.enum(["grid", "list"]).default("grid"),
  columns: z.number().default(2)
});

export const componentConfigSchema = z.union([
  bannerComponentConfigSchema,
  countdownComponentConfigSchema,
  carouselAutoComponentConfigSchema,
  carouselManualComponentConfigSchema,
  productSpotlightConfigSchema,
  offerBadgeConfigSchema,
  offerBannerConfigSchema,
  productCarouselConfigSchema,
  productBannerConfigSchema,
  productStoreConfigSchema
]);

// Dynamic Component Config Types
export type BannerComponentConfig = z.infer<typeof bannerComponentConfigSchema>;
export type CountdownComponentConfig = z.infer<typeof countdownComponentConfigSchema>;
export type CarouselAutoComponentConfig = z.infer<typeof carouselAutoComponentConfigSchema>;
export type CarouselManualComponentConfig = z.infer<typeof carouselManualComponentConfigSchema>;
export type ProductSpotlightConfig = z.infer<typeof productSpotlightConfigSchema>;
export type OfferBadgeConfig = z.infer<typeof offerBadgeConfigSchema>;
export type OfferBannerConfig = z.infer<typeof offerBannerConfigSchema>;
export type ProductCarouselConfig = z.infer<typeof productCarouselConfigSchema>;
export type ProductBannerConfig = z.infer<typeof productBannerConfigSchema>;
export type ProductStoreConfig = z.infer<typeof productStoreConfigSchema>;
export type ComponentConfig = z.infer<typeof componentConfigSchema>;

// Component types enum for validation
export const componentTypes = [
  'banner',
  'countdown',
  'carousel_auto',
  'carousel_manual',
  'product_spotlight',
  'offer_badge',
  'offer_banner',
  'product_carousel',
  'product_banner',
  'product_store'
] as const;

export type ComponentType = typeof componentTypes[number];

// SDK component name mapping for UI display
export const componentSDKNames: Record<ComponentType, string> = {
  'banner': 'RBanner',
  'countdown': 'RCountdown',
  'carousel_auto': 'RCarousel',
  'carousel_manual': 'RCarousel',
  'product_spotlight': 'RProductSpotlight',
  'offer_badge': 'ROfferBadge',
  'offer_banner': 'ROfferBannerDynamic',
  'product_carousel': 'RProductCarousel',
  'product_banner': 'RProductBanner',
  'product_store': 'RProductStore'
};
