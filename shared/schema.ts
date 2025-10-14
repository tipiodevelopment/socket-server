import { z } from "zod";
import { pgTable, serial, varchar, text, timestamp, json, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Database Tables
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  logo: text("logo"),
  description: text("description"),
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

// Relations
export const campaignsRelations = relations(campaigns, ({ many }) => ({
  events: many(events),
  formStates: many(campaignFormState)
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

// Insert Schemas
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

// Types
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type CampaignFormState = typeof campaignFormState.$inferSelect;
export type InsertFormState = z.infer<typeof insertFormStateSchema>;

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
