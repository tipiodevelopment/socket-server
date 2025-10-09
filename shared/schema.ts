import { z } from "zod";

// Event schemas
export const productEventSchema = z.object({
  type: z.literal("product"),
  data: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    price: z.string(),
    currency: z.string().default("USD"),
    imageUrl: z.string().url()
  }),
  timestamp: z.number()
});

export const pollEventSchema = z.object({
  type: z.literal("poll"),
  data: z.object({
    id: z.string(),
    question: z.string(),
    options: z.array(z.string()),
    duration: z.number()
  }),
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
  timestamp: z.number()
});

export const webSocketEventSchema = z.union([
  productEventSchema,
  pollEventSchema,
  contestEventSchema
]);

// Types
export type ProductEvent = z.infer<typeof productEventSchema>;
export type PollEvent = z.infer<typeof pollEventSchema>;
export type ContestEvent = z.infer<typeof contestEventSchema>;
export type WebSocketEvent = z.infer<typeof webSocketEventSchema>;

// Connection status type
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';
