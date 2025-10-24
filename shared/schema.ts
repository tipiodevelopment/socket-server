import { z } from "zod";
import { pgTable, serial, varchar, text, timestamp, json, integer } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Database Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  reachuUserId: varchar("reachu_user_id", { length: 255 }).notNull().unique(),
  firebaseToken: text("firebase_token"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  logo: text("logo"),
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  reachuChannelId: varchar("reachu_channel_id", { length: 255 }),
  reachuApiKey: text("reachu_api_key"),
  tipioLiveshowId: varchar("tipio_liveshow_id", { length: 255 }),
  tipioLivestreamData: json("tipio_livestream_data"),
  createdAt: timestamp("created_at").defaultNow().notNull()
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
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Campaign Components - Links components to campaigns with status and custom config
// Can be manual toggle OR scheduled OR both
export const campaignComponents = pgTable("campaign_components", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  componentId: varchar("component_id", { length: 50 }).notNull().references(() => components.id, { onDelete: 'cascade' }),
  status: varchar("status", { length: 20 }).notNull().default('inactive'), // active, inactive
  customConfig: json("custom_config"), // Campaign-specific config override (optional)
  scheduledTime: timestamp("scheduled_time"), // Optional: auto-activate at this time (null = manual toggle only)
  endTime: timestamp("end_time"), // Optional: auto-deactivate at this time (null = no end)
  activatedAt: timestamp("activated_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  campaigns: many(campaigns)
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [campaigns.userId],
    references: [users.id]
  }),
  events: many(events),
  formStates: many(campaignFormState),
  scheduledComponents: many(scheduledComponents),
  campaignComponents: many(campaignComponents)
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
  campaignComponents: many(campaignComponents)
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

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true,
  createdAt: true 
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({ 
  id: true,
  createdAt: true 
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
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

// Event schemas
export const productEventSchema = z.object({
  type: z.literal("product"),
  data: z.object({
    id: z.string(),
    productId: z.string(),
    name: z.string(),
    description: z.string(),
    price: z.string(),
    currency: z.string().default("USD"),
    imageUrl: z.string().url()
  }),
  campaignLogo: z.string().optional(),
  timestamp: z.number()
});

export const pollOptionSchema = z.object({
  text: z.string(),
  imageUrl: z.string().optional()
});

export const pollEventSchema = z.object({
  type: z.literal("poll"),
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
  type: z.literal("contest"),
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

// Tipio Livestream Schema
export const tipioLivestreamSchema = z.object({
  id: z.number().optional(),
  title: z.string(),
  liveStreamId: z.string(),
  hls: z.string().nullable(),
  player: z.string(),
  thumbnail: z.string(),
  broadcasting: z.boolean(),
  date: z.string(),
  end_date: z.string(),
  streamDone: z.boolean().nullable(),
  videoId: z.string()
});

export type TipioLivestream = z.infer<typeof tipioLivestreamSchema>;

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
  endDate: z.string(), // ISO timestamp
  title: z.string(),
  style: z.enum(["minimal", "full"]).default("full")
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

export const componentConfigSchema = z.union([
  bannerComponentConfigSchema,
  countdownComponentConfigSchema,
  carouselAutoComponentConfigSchema,
  carouselManualComponentConfigSchema,
  productSpotlightConfigSchema,
  offerBadgeConfigSchema,
  offerBannerConfigSchema
]);

// Dynamic Component Config Types
export type BannerComponentConfig = z.infer<typeof bannerComponentConfigSchema>;
export type CountdownComponentConfig = z.infer<typeof countdownComponentConfigSchema>;
export type CarouselAutoComponentConfig = z.infer<typeof carouselAutoComponentConfigSchema>;
export type CarouselManualComponentConfig = z.infer<typeof carouselManualComponentConfigSchema>;
export type ProductSpotlightConfig = z.infer<typeof productSpotlightConfigSchema>;
export type OfferBadgeConfig = z.infer<typeof offerBadgeConfigSchema>;
export type OfferBannerConfig = z.infer<typeof offerBannerConfigSchema>;
export type ComponentConfig = z.infer<typeof componentConfigSchema>;

// Component types enum for validation
export const componentTypes = [
  'banner',
  'countdown',
  'carousel_auto',
  'carousel_manual',
  'product_spotlight',
  'offer_badge',
  'offer_banner'
] as const;

export type ComponentType = typeof componentTypes[number];
