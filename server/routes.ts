import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { 
  webSocketEventSchema, 
  updateCampaignSchema,
  componentSDKNames,
  insertBroadcastSchema,
  updateBroadcastSchema,
  insertPollSchema,
  insertPollOptionSchema,
  insertContestSchema,
  insertContestParticipationSchema,
  createPollInputSchema,
  createContestInputSchema,
  voteInputSchema,
  participateInputSchema,
  type WebSocketEvent, 
  type InsertScheduledComponent 
} from "@shared/schema";
import { randomUUID } from "crypto";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { isCampaignActive, hasCampaignEnded, isCampaignUpcoming, normalizeUrls } from "./utils";
import { calculateScheduledTimes, validateScheduling } from "./utils/scheduling";
import { voteQueue, contestParticipationQueue, isQueueEnabled } from "./queue/queues";
import { createRateLimiter, rateLimitPresets } from "./middleware/rate-limiter";
import { setVoteBroadcastFunction } from "./services/vote-processor";

const JWT_SECRET = process.env.SESSION_SECRET || 'default-dev-secret';

function generateBroadcastId(name: string, date?: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  const dateStr = date || new Date().toISOString().split('T')[0];
  return `${slug}-${dateStr}`;
}

const requireBearerAuth = (req: Request, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Bearer token required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; reachuUserId: string };
    (req as any).authUser = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Helper function to convert relative paths to absolute URLs
function toAbsoluteUrl(pathOrUrl: string | undefined, req: Request): string | undefined {
  if (!pathOrUrl) return undefined;
  
  // If already a full URL, return as is
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  
  // Detect protocol: check X-Forwarded-Proto header (set by reverse proxies) or use req.protocol
  // In production (Replit), X-Forwarded-Proto will be 'https'
  // In local dev, it will fall back to req.protocol which is 'http'
  // Handle comma-separated values from multiple proxies by taking the first one
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto?.split(',')[0].trim() || req.protocol || 'https';
  const host = req.get('host') || 'localhost:5000';
  
  return `${protocol}://${host}${pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl}`;
}

// Helper function to calculate deterministic hash for user segmentation
// Returns a value 0-99 that is consistent for the same userId + campaignId
function calculateUserSegmentHash(userId: string, campaignId: number): number {
  const combined = `${userId}:${campaignId}`;
  const hash = createHash('sha256').update(combined).digest('hex');
  // Convert first 8 hex chars to a number and get modulo 100
  const hashValue = parseInt(hash.substring(0, 8), 16);
  return hashValue % 100;
}

// Helper function to check if user is eligible for segmented campaign
function isUserEligibleForCampaign(
  userId: string | undefined,
  userCountry: string | undefined,
  campaignId: number,
  isSegmented: string | undefined,
  targetCountries: string[] | null,
  targetPercentage: number | null
): boolean {
  // If campaign is not segmented, all users are eligible
  if (isSegmented !== 'true') {
    return true;
  }

  // If segmented, both userId and userCountry are required
  if (!userId || !userCountry) {
    return false;
  }

  // Check country eligibility
  if (targetCountries && targetCountries.length > 0) {
    if (!targetCountries.includes(userCountry.toUpperCase())) {
      return false;
    }
  }

  // Check percentage eligibility
  if (targetPercentage && targetPercentage < 100) {
    const userHash = calculateUserSegmentHash(userId, campaignId);
    if (userHash >= targetPercentage) {
      return false;
    }
  }

  return true;
}

// Export broadcastToCampaign function (will be set during registerRoutes)
export let broadcastToCampaign: (campaignId: number, message: string) => void = () => {
  console.warn('[WebSocket] broadcastToCampaign called before initialization');
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Register analytics routes
  const { registerAnalyticsRoutes } = await import("./analytics");
  registerAnalyticsRoutes(app);
  
  // Create WebSocket server with noServer mode for custom path handling
  const wss = new WebSocketServer({ noServer: true });

  // Store connected clients organized by campaign ID
  const campaignClients = new Map<number, Set<WebSocket>>();
  
  // Store campaign ID for each WebSocket
  const clientCampaigns = new WeakMap<WebSocket, number>();
  
  // Store ping interval for each WebSocket
  const clientPingIntervals = new WeakMap<WebSocket, NodeJS.Timeout>();
  
  // Track if client is alive (responded to last ping)
  const clientAlive = new WeakMap<WebSocket, boolean>();

  // Handle WebSocket upgrade requests
  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      
      // Extract campaign ID from path like /ws/123
      const pathMatch = url.pathname.match(/^\/ws\/(\d+)$/);
      
      if (pathMatch) {
        // Campaign-specific WebSocket
        const campaignId = parseInt(pathMatch[1], 10);
        
        wss.handleUpgrade(request, socket, head, (ws) => {
          clientCampaigns.set(ws, campaignId);
          wss.emit('connection', ws, request, campaignId);
        });
      } else if (url.pathname === '/ws') {
        // Legacy WebSocket (no campaign ID) - use campaign ID 0 for backwards compatibility
        wss.handleUpgrade(request, socket, head, (ws) => {
          clientCampaigns.set(ws, 0);
          wss.emit('connection', ws, request, 0);
        });
      } else {
        socket.destroy();
      }
    } catch (error) {
      console.error('Error handling WebSocket upgrade:', error);
      socket.destroy();
    }
  });

  // WebSocket connection handling
  wss.on('connection', async (ws: WebSocket, request: any, campaignId: number) => {
    // Add client to campaign room
    if (!campaignClients.has(campaignId)) {
      campaignClients.set(campaignId, new Set());
    }
    campaignClients.get(campaignId)!.add(ws);
    
    console.log(`Client connected to campaign ${campaignId}`);

    // Mark client as alive initially
    clientAlive.set(ws, true);

    // Setup heartbeat to keep connection alive and detect zombies (check every 30 seconds)
    const pingInterval = setInterval(() => {
      // Check if client responded to last ping
      if (clientAlive.get(ws) === false) {
        // Client didn't respond to last ping, terminate connection
        console.log(`Terminating zombie WebSocket connection for campaign ${campaignId}`);
        ws.terminate();
        return;
      }
      
      // Mark as potentially dead, will be set to true if pong received
      clientAlive.set(ws, false);
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);
    
    clientPingIntervals.set(ws, pingInterval);

    // Check campaign status and immediately notify client
    if (campaignId !== 0) {
      try {
        const campaign = await storage.getCampaign(campaignId);
        if (campaign) {
          if (hasCampaignEnded(campaign)) {
            // Campaign has ended (endDate in the past), notify client immediately
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'campaign_ended',
                campaignId: campaign.id,
                endDate: campaign.endDate
              }));
              console.log(`Sent campaign_ended notification to new client for campaign ${campaignId}`);
            }
          } else if (isCampaignUpcoming(campaign)) {
            // Campaign hasn't started yet (startDate in the future)
            // Don't send any event - components won't activate until campaign starts
            console.log(`Client connected to upcoming campaign ${campaignId} (starts: ${campaign.startDate})`);
          }
          // else: campaign is active or has no dates (always active) - no immediate event needed
        }
      } catch (error) {
        console.error('Error checking campaign status on connection:', error);
      }
    }

    ws.on('pong', () => {
      // Client responded to ping, mark as alive
      clientAlive.set(ws, true);
    });

    ws.on('close', () => {
      // Clear ping interval
      const interval = clientPingIntervals.get(ws);
      if (interval) {
        clearInterval(interval);
        clientPingIntervals.delete(ws);
      }
      
      const clients = campaignClients.get(campaignId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          campaignClients.delete(campaignId);
        }
      }
      console.log(`Client disconnected from campaign ${campaignId}`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for campaign ${campaignId}:`, error);
      
      // Clear ping interval
      const interval = clientPingIntervals.get(ws);
      if (interval) {
        clearInterval(interval);
        clientPingIntervals.delete(ws);
      }
      
      const clients = campaignClients.get(campaignId);
      if (clients) {
        clients.delete(ws);
      }
    });
  });

  // Function to broadcast to clients in a specific campaign
  const broadcastToCampaignImpl = (campaignId: number, message: string) => {
    const clients = campaignClients.get(campaignId);
    if (clients) {
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  };
  
  broadcastToCampaign = broadcastToCampaignImpl;
  setVoteBroadcastFunction(broadcastToCampaignImpl);
  
  // Legacy broadcast function (broadcasts to all campaigns)
  function broadcast(message: string) {
    campaignClients.forEach((clients) => {
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    });
  }

  // Check for ended campaigns and broadcast campaign_ended events
  async function checkAndNotifyEndedCampaigns() {
    try {
      const campaigns = await storage.getAllCampaigns();
      const now = new Date();
      
      for (const campaign of campaigns) {
        if (campaign.endDate) {
          const endDate = new Date(campaign.endDate);
          // Check if campaign just ended (within last minute)
          const timeDiff = now.getTime() - endDate.getTime();
          if (timeDiff >= 0 && timeDiff < 60000) {
            // Campaign just ended, broadcast to all connected clients
            broadcastToCampaignImpl(campaign.id, JSON.stringify({
              type: 'campaign_ended',
              campaignId: campaign.id,
              endDate: campaign.endDate
            }));
            console.log(`Campaign ${campaign.id} (${campaign.name}) has ended`);
          }
        }
      }
    } catch (error) {
      console.error('Error checking ended campaigns:', error);
    }
  }

  // Check for started campaigns and broadcast campaign_started events
  async function checkAndNotifyStartedCampaigns() {
    try {
      const campaigns = await storage.getAllCampaigns();
      const now = new Date();
      
      for (const campaign of campaigns) {
        if (campaign.startDate) {
          const startDate = new Date(campaign.startDate);
          // Check if campaign just started (within last minute)
          const timeDiff = now.getTime() - startDate.getTime();
          if (timeDiff >= 0 && timeDiff < 60000) {
            // Campaign just started, broadcast to all connected clients
            const event: any = {
              type: 'campaign_started',
              campaignId: campaign.id,
              startDate: campaign.startDate,
              endDate: campaign.endDate
            };
            // Include matchId if campaign is associated with a match
            if (campaign.matchId) {
              event.matchId = campaign.matchId;
            }
            broadcastToCampaignImpl(campaign.id, JSON.stringify(event));
            console.log(`Campaign ${campaign.id} (${campaign.name}) has started`);
          }
        }
      }
    } catch (error) {
      console.error('Error checking started campaigns:', error);
    }
  }

  // Check every 30 seconds for campaign lifecycle events
  setInterval(checkAndNotifyEndedCampaigns, 30000);
  setInterval(checkAndNotifyStartedCampaigns, 30000);

  // HTTP API endpoints
  
  // Get recent events
  app.get('/api/events', async (req, res) => {
    try {
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      
      if (campaignId) {
        // Get events for specific campaign from database
        const dbEvents = await storage.getCampaignEvents(campaignId);
        // Convert DB events to WebSocket events format
        const events = dbEvents.map(dbEvent => ({
          type: dbEvent.type,
          data: dbEvent.data,
          campaignLogo: dbEvent.campaignLogo || undefined,
          timestamp: new Date(dbEvent.timestamp).getTime()
        }));
        res.json(events);
      } else {
        // Get all recent events from memory (legacy)
        const events = await storage.getRecentEvents();
        res.json(events);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ message: 'Error fetching events' });
    }
  });

  // Get events for a specific campaign (RESTful route)
  app.get('/api/events/:campaignId', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      
      if (isNaN(campaignId)) {
        return res.status(400).json({ message: 'Invalid campaign ID' });
      }
      
      // Get events for specific campaign from database
      const dbEvents = await storage.getCampaignEvents(campaignId);
      
      // Convert DB events to WebSocket events format
      const events = dbEvents.map(dbEvent => ({
        id: dbEvent.id,
        type: dbEvent.type,
        data: dbEvent.data,
        campaignLogo: dbEvent.campaignLogo || undefined,
        timestamp: new Date(dbEvent.timestamp).getTime()
      }));
      
      // Optional deduplication - show only most recent event per unique name
      const includeAll = req.query.includeAll === 'true';
      if (!includeAll) {
        // Group events by type and name, keep only most recent
        const eventMap = new Map<string, typeof events[0]>();
        
        for (const event of events) {
          // Create unique key based on type and event name/question
          let eventName = '';
          if (event.type === 'product' && typeof event.data === 'object' && event.data !== null && 'name' in event.data) {
            eventName = String(event.data.name || '');
          } else if (event.type === 'poll' && typeof event.data === 'object' && event.data !== null && 'question' in event.data) {
            eventName = String(event.data.question || '');
          } else if (event.type === 'contest' && typeof event.data === 'object' && event.data !== null && 'name' in event.data) {
            eventName = String(event.data.name || '');
          }
          
          const key = `${event.type}:${eventName}`;
          const existing = eventMap.get(key);
          
          // Keep the one with the latest timestamp
          if (!existing || event.timestamp > existing.timestamp) {
            eventMap.set(key, event);
          }
        }
        
        // Convert map back to array and sort by timestamp desc
        const dedupedEvents = Array.from(eventMap.values())
          .sort((a, b) => b.timestamp - a.timestamp);
        
        res.json(dedupedEvents);
      } else {
        res.json(events);
      }
    } catch (error) {
      console.error('Error fetching campaign events:', error);
      res.status(500).json({ message: 'Error fetching events' });
    }
  });

  // Get connection status
  app.get('/api/status', (req, res) => {
    res.json({
      server: 'running',
      wsPort: 'same as http',
      httpPort: process.env.PORT || 5000
    });
  });

  // Trigger product event
  app.post('/api/events/product', async (req, res) => {
    try {
      const campaignId = req.body.campaignId;
      
      // Validate campaignId if provided
      if (campaignId) {
        const campaign = await storage.getCampaign(campaignId);
        if (!campaign) {
          return res.status(404).json({ message: 'Campaign not found' });
        }
      }
      
      const productEvent: WebSocketEvent = {
        type: 'product',
        data: {
          id: `prod_${randomUUID()}`,
          productId: req.body.productId,
          name: req.body.name,
          description: req.body.description,
          price: String(req.body.price),
          currency: req.body.currency || 'USD',
          imageUrl: toAbsoluteUrl(req.body.imageUrl, req)
        },
        campaignLogo: toAbsoluteUrl(req.body.campaignLogo, req),
        timestamp: Date.now()
      };

      // Validate the event
      webSocketEventSchema.parse(productEvent);

      // Store the event in memory (for backwards compatibility)
      await storage.addEvent(productEvent);

      // Store in database if campaignId provided
      if (campaignId) {
        await storage.addCampaignEvent({
          campaignId,
          type: 'product',
          data: productEvent.data,
          campaignLogo: productEvent.campaignLogo || null
        });
        
        // Broadcast to specific campaign
        broadcastToCampaignImpl(campaignId, JSON.stringify(productEvent));
      } else {
        // Legacy: Broadcast to all connected clients
        broadcast(JSON.stringify(productEvent));
      }

      res.json({ success: true, event: productEvent});
    } catch (error) {
      console.error('Error sending product event:', error);
      res.status(400).json({ 
        message: 'Error sending product event',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Trigger poll event
  app.post('/api/events/poll', async (req, res) => {
    try {
      const campaignId = req.body.campaignId;
      
      // Validate campaignId if provided
      if (campaignId) {
        const campaign = await storage.getCampaign(campaignId);
        if (!campaign) {
          return res.status(404).json({ message: 'Campaign not found' });
        }
      }
      
      // Process options: convert comma-separated string to array or process objects
      let options;
      if (typeof req.body.options === 'string') {
        // Legacy format: comma-separated string
        options = req.body.options.split(',').map((opt: string) => ({
          text: opt.trim(),
          imageUrl: undefined
        })).filter((opt: any) => opt.text);
      } else if (Array.isArray(req.body.options)) {
        // New format: array of objects with optional imageUrl
        options = req.body.options.map((opt: any) => ({
          text: opt.text,
          imageUrl: toAbsoluteUrl(opt.imageUrl, req)
        }));
      } else {
        options = [];
      }

      // Process duration: convert to number
      const duration = typeof req.body.duration === 'string' 
        ? parseInt(req.body.duration, 10) 
        : req.body.duration;

      const pollEvent: WebSocketEvent = {
        type: 'poll',
        data: {
          id: `poll_${randomUUID()}`,
          question: req.body.question,
          options,
          duration,
          imageUrl: toAbsoluteUrl(req.body.imageUrl, req)
        },
        campaignLogo: toAbsoluteUrl(req.body.campaignLogo, req),
        timestamp: Date.now()
      };

      // Validate the event
      webSocketEventSchema.parse(pollEvent);

      // Store the event in memory
      await storage.addEvent(pollEvent);

      // Store in database if campaignId provided
      if (campaignId) {
        await storage.addCampaignEvent({
          campaignId,
          type: 'poll',
          data: pollEvent.data,
          campaignLogo: pollEvent.campaignLogo || null
        });
        
        // Broadcast to specific campaign
        broadcastToCampaignImpl(campaignId, JSON.stringify(pollEvent));
      } else {
        // Legacy: Broadcast to all connected clients
        broadcast(JSON.stringify(pollEvent));
      }

      res.json({ success: true, event: pollEvent });
    } catch (error) {
      console.error('Error sending poll event:', error);
      res.status(400).json({ message: 'Error sending poll event' });
    }
  });

  // Trigger contest event
  app.post('/api/events/contest', async (req, res) => {
    try {
      const campaignId = req.body.campaignId;
      
      // Validate campaignId if provided
      if (campaignId) {
        const campaign = await storage.getCampaign(campaignId);
        if (!campaign) {
          return res.status(404).json({ message: 'Campaign not found' });
        }
      }
      
      const contestEvent: WebSocketEvent = {
        type: 'contest',
        data: {
          id: `contest_${randomUUID()}`,
          name: req.body.name,
          prize: req.body.prize,
          deadline: req.body.deadline,
          maxParticipants: req.body.maxParticipants
        },
        campaignLogo: toAbsoluteUrl(req.body.campaignLogo, req),
        timestamp: Date.now()
      };

      // Validate the event
      webSocketEventSchema.parse(contestEvent);

      // Store the event in memory
      await storage.addEvent(contestEvent);

      // Store in database if campaignId provided
      if (campaignId) {
        await storage.addCampaignEvent({
          campaignId,
          type: 'contest',
          data: contestEvent.data,
          campaignLogo: contestEvent.campaignLogo || null
        });
        
        // Broadcast to specific campaign
        broadcastToCampaignImpl(campaignId, JSON.stringify(contestEvent));
      } else {
        // Legacy: Broadcast to all connected clients
        broadcast(JSON.stringify(contestEvent));
      }

      res.json({ success: true, event: contestEvent });
    } catch (error) {
      console.error('Error sending contest event:', error);
      res.status(400).json({ message: 'Error sending contest event' });
    }
  });

  // Generic event endpoint for campaign (RESTful route)
  app.post('/api/events/:campaignId', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      
      if (isNaN(campaignId)) {
        return res.status(400).json({ message: 'Invalid campaign ID' });
      }
      
      // Validate campaign exists
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }
      
      const { type, data } = req.body;
      
      if (!type || !data) {
        return res.status(400).json({ message: 'Event type and data are required' });
      }

      // Create event based on type
      let event: WebSocketEvent;
      
      if (type === 'product') {
        event = {
          type: 'product',
          data: {
            id: `prod_${randomUUID()}`,
            ...data
          },
          campaignLogo: campaign.logo || undefined,
          timestamp: Date.now()
        };
      } else if (type === 'poll') {
        event = {
          type: 'poll',
          data: {
            id: `poll_${randomUUID()}`,
            ...data
          },
          campaignLogo: campaign.logo || undefined,
          timestamp: Date.now()
        };
      } else if (type === 'contest') {
        event = {
          type: 'contest',
          data: {
            id: `contest_${randomUUID()}`,
            ...data
          },
          campaignLogo: campaign.logo || undefined,
          timestamp: Date.now()
        };
      } else {
        return res.status(400).json({ message: 'Invalid event type' });
      }

      // Validate the event
      webSocketEventSchema.parse(event);

      // Store in memory for legacy compatibility
      await storage.addEvent(event);

      // Store the event in database
      await storage.addCampaignEvent({
        campaignId,
        type: event.type,
        data: event.data,
        campaignLogo: event.campaignLogo || null
      });
      
      // Broadcast to specific campaign
      broadcastToCampaignImpl(campaignId, JSON.stringify(event));

      res.json({ success: true, event });
    } catch (error) {
      console.error('Error sending campaign event:', error);
      res.status(400).json({ message: 'Error sending event' });
    }
  });

  // Object Storage endpoints - based on blueprint:javascript_object_storage
  
  // Serve uploaded objects (public access for campaign logos)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Get upload URL for object (campaign logo)
  app.post("/api/objects/upload", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  // Normalize uploaded campaign logo URL
  app.put("/api/campaign-logo", async (req, res) => {
    if (!req.body.logoURL) {
      return res.status(400).json({ error: "logoURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(
        req.body.logoURL,
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting campaign logo:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User CRUD endpoints
  
  // Get all users
  app.get('/api/users', async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Error fetching users' });
    }
  });

  // Get user by ID
  app.get('/api/users/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Error fetching user' });
    }
  });

  // Get user by Reachu ID
  app.get('/api/users/reachu/:reachuUserId', async (req, res) => {
    try {
      const user = await storage.getUserByReachuId(req.params.reachuUserId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user by Reachu ID:', error);
      res.status(500).json({ message: 'Error fetching user' });
    }
  });

  // Ensure user exists (create if not, return if exists) - for multi-tenant session simulation
  app.post('/api/users/ensure', async (req, res) => {
    try {
      const { reachuUserId, email, name } = req.body;
      
      if (!reachuUserId) {
        return res.status(400).json({ message: 'reachuUserId is required' });
      }
      
      // Try to find existing user
      let user = await storage.getUserByReachuId(reachuUserId);
      
      // If not found, create new user
      if (!user) {
        user = await storage.createUser({
          reachuUserId,
          email: email || null,
          name: name || null
        });
      }
      
      const token = jwt.sign(
        { userId: user.id, reachuUserId: user.reachuUserId },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ ...user, token });
    } catch (error) {
      console.error('Error ensuring user exists:', error);
      res.status(500).json({ 
        message: 'Error ensuring user exists',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post('/api/auth/token', async (req, res) => {
    try {
      const { reachuUserId } = req.body;
      if (!reachuUserId) {
        return res.status(400).json({ message: 'reachuUserId is required' });
      }
      const user = await storage.getUserByReachuId(reachuUserId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const token = jwt.sign(
        { userId: user.id, reachuUserId: user.reachuUserId },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.json({ token, userId: user.id, expiresIn: '7d' });
    } catch (error) {
      console.error('Error generating token:', error);
      res.status(500).json({ message: 'Error generating token' });
    }
  });

  // Create user
  app.post('/api/users', async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(400).json({ 
        message: 'Error creating user',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update user
  app.patch('/api/users/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.updateUser(id, req.body);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Error updating user' });
    }
  });

  // Client Apps CRUD endpoints

  // Get all client apps for a user
  app.get('/api/client-apps', async (req, res) => {
    try {
      const userIdParam = req.query.userId as string | undefined;
      
      if (!userIdParam) {
        return res.status(400).json({ 
          message: 'userId query parameter is required' 
        });
      }
      
      const userId = parseInt(userIdParam);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid userId parameter' });
      }
      
      const apps = await storage.getUserClientApps(userId);
      res.json(apps);
    } catch (error) {
      console.error('Error fetching client apps:', error);
      res.status(500).json({ message: 'Error fetching client apps' });
    }
  });

  app.get('/api/client-apps/with-stats', async (req, res) => {
    try {
      const userIdParam = req.query.userId as string | undefined;
      if (!userIdParam) {
        return res.status(400).json({ message: 'userId query parameter is required' });
      }
      const userId = parseInt(userIdParam);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid userId parameter' });
      }

      const apps = await storage.getUserClientApps(userId);
      const allChannels = await storage.getUserChannels(userId);
      const allCampaigns = await storage.getUserCampaigns(userId);
      const allBroadcasts = await storage.getAllBroadcasts();

      const result = apps.map((app) => {
        const appChannels = allChannels.filter(ch => ch.clientAppId === app.id);
        const appChannelIds = new Set(appChannels.map(ch => ch.id));

        const appCampaigns = allCampaigns.filter(c =>
          c.clientAppId === app.id || (c.channelId && appChannelIds.has(c.channelId))
        );
        const appCampaignIds = new Set(appCampaigns.map(c => c.id));

        const appBroadcasts = allBroadcasts.filter(b =>
          (b.campaignId && appCampaignIds.has(b.campaignId)) ||
          (b.channelId && appChannelIds.has(b.channelId))
        );

        const activeBroadcasts = appBroadcasts.filter(b => b.status === 'live').length;
        const totalViewers = appCampaigns.length * 8500 + appBroadcasts.length * 3200 + app.id * 1234;

        return {
          ...app,
          stats: {
            campaignCount: appCampaigns.length,
            activeBroadcasts,
            totalViewers,
            channelCount: appChannels.length,
            engagementPercent: Math.min(95, 45 + appCampaigns.length * 8 + activeBroadcasts * 5),
          },
        };
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching client apps with stats:', error);
      res.status(500).json({ message: 'Error fetching client apps with stats' });
    }
  });

  // Get single client app (requires userId for ownership verification)
  app.get('/api/client-apps/:id', async (req, res) => {
    try {
      const userIdParam = req.query.userId as string | undefined;
      if (!userIdParam) {
        return res.status(400).json({ message: 'userId query parameter is required' });
      }
      const userId = parseInt(userIdParam);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid userId parameter' });
      }
      
      const app = await storage.getClientApp(parseInt(req.params.id));
      if (!app) {
        return res.status(404).json({ message: 'Client app not found' });
      }
      
      // Verify ownership
      if (app.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      res.json(app);
    } catch (error) {
      console.error('Error fetching client app:', error);
      res.status(500).json({ message: 'Error fetching client app' });
    }
  });

  // Sponsor CRUD endpoints

  app.get('/api/sponsors', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      if (!userId || isNaN(userId)) {
        return res.status(400).json({ message: 'userId query param is required' });
      }
      const result = await storage.getUserSponsors(userId);
      res.json(result);
    } catch (error) {
      console.error('Error fetching sponsors:', error);
      res.status(500).json({ message: 'Error fetching sponsors' });
    }
  });

  app.get('/api/sponsors/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const sponsor = await storage.getSponsor(id);
      if (!sponsor) return res.status(404).json({ message: 'Sponsor not found' });
      res.json(sponsor);
    } catch (error) {
      console.error('Error fetching sponsor:', error);
      res.status(500).json({ message: 'Error fetching sponsor' });
    }
  });

  app.post('/api/sponsors', async (req, res) => {
    try {
      const { userId, name, description, logoUrl, avatarUrl, primaryColor, secondaryColor } = req.body;
      if (!userId || !name) {
        return res.status(400).json({ message: 'userId and name are required' });
      }
      const sponsor = await storage.createSponsor({
        userId,
        name,
        description: description || null,
        logoUrl: logoUrl || null,
        avatarUrl: avatarUrl || null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
      });
      res.status(201).json(sponsor);
    } catch (error) {
      console.error('Error creating sponsor:', error);
      res.status(400).json({ message: 'Error creating sponsor' });
    }
  });

  app.patch('/api/sponsors/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { userId, ...updateData } = req.body;
      if (!userId) return res.status(400).json({ message: 'userId is required' });

      const existing = await storage.getSponsor(id);
      if (!existing) return res.status(404).json({ message: 'Sponsor not found' });
      if (existing.userId !== userId) return res.status(403).json({ message: 'Access denied' });

      const sponsor = await storage.updateSponsor(id, updateData);
      res.json(sponsor);
    } catch (error) {
      console.error('Error updating sponsor:', error);
      res.status(500).json({ message: 'Error updating sponsor' });
    }
  });

  app.delete('/api/sponsors/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = parseInt(req.query.userId as string);
      if (!userId) return res.status(400).json({ message: 'userId is required' });

      const existing = await storage.getSponsor(id);
      if (!existing) return res.status(404).json({ message: 'Sponsor not found' });
      if (existing.userId !== userId) return res.status(403).json({ message: 'Access denied' });

      await storage.deleteSponsor(id);
      res.json({ message: 'Sponsor deleted' });
    } catch (error) {
      console.error('Error deleting sponsor:', error);
      res.status(500).json({ message: 'Error deleting sponsor' });
    }
  });

  // Create client app
  app.post('/api/client-apps', async (req, res) => {
    try {
      const { userId, name, bundleId, iconUrl, bannerUrl, description } = req.body;
      
      if (!userId || !name || !bundleId) {
        return res.status(400).json({ 
          message: 'userId, name, and bundleId are required' 
        });
      }
      
      if (typeof userId !== 'number' || isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid userId - must be a number' });
      }
      
      const apiKey = `${name.toLowerCase().replace(/\s+/g, '_')}_api_key_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
      
      const app = await storage.createClientApp({
        userId,
        name,
        bundleId,
        apiKey,
        ...(iconUrl && { iconUrl }),
        ...(bannerUrl && { bannerUrl }),
        ...(description && { description }),
      });
      res.status(201).json(app);
    } catch (error) {
      console.error('Error creating client app:', error);
      res.status(400).json({ 
        message: 'Error creating client app',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update client app (requires userId for ownership verification)
  app.patch('/api/client-apps/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { userId, ...updateData } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'userId is required in request body' });
      }
      
      const existingApp = await storage.getClientApp(id);
      if (!existingApp) {
        return res.status(404).json({ message: 'Client app not found' });
      }
      
      // Verify ownership
      if (existingApp.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const app = await storage.updateClientApp(id, updateData);
      res.json(app);
    } catch (error) {
      console.error('Error updating client app:', error);
      res.status(500).json({ message: 'Error updating client app' });
    }
  });

  // Regenerate API key for client app (requires userId for ownership verification)
  app.post('/api/client-apps/:id/regenerate-key', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'userId is required in request body' });
      }
      
      const existingApp = await storage.getClientApp(id);
      
      if (!existingApp) {
        return res.status(404).json({ message: 'Client app not found' });
      }
      
      // Verify ownership
      if (existingApp.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Generate a new unique API key
      const newApiKey = `${existingApp.name.toLowerCase().replace(/\s+/g, '_')}_api_key_${randomUUID().replace(/-/g, '').substring(0, 16)}`;
      
      const app = await storage.updateClientApp(id, { apiKey: newApiKey });
      res.json(app);
    } catch (error) {
      console.error('Error regenerating API key:', error);
      res.status(500).json({ message: 'Error regenerating API key' });
    }
  });

  // Delete client app (requires userId for ownership verification)
  app.delete('/api/client-apps/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userIdParam = req.query.userId as string | undefined;
      
      if (!userIdParam) {
        return res.status(400).json({ message: 'userId query parameter is required' });
      }
      const userId = parseInt(userIdParam);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid userId parameter' });
      }
      
      const app = await storage.getClientApp(id);
      
      if (!app) {
        return res.status(404).json({ message: 'Client app not found' });
      }
      
      // Verify ownership
      if (app.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.deleteClientApp(id);
      res.json({ message: 'Client app deleted successfully' });
    } catch (error) {
      console.error('Error deleting client app:', error);
      res.status(500).json({ message: 'Error deleting client app' });
    }
  });

  // Get channels for a client app
  app.get('/api/client-apps/:id/channels', async (req, res) => {
    try {
      const appId = parseInt(req.params.id);
      const channels = await storage.getClientAppChannels(appId);
      res.json(channels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      res.status(500).json({ message: 'Error fetching channels' });
    }
  });

  // Get components assigned to an app
  app.get('/api/client-apps/:id/components', async (req, res) => {
    try {
      const appId = parseInt(req.params.id);
      const appComps = await storage.getAppComponents(appId);
      res.json(appComps);
    } catch (error) {
      console.error('Error fetching app components:', error);
      res.status(500).json({ message: 'Error fetching app components' });
    }
  });

  // Add component to app
  app.post('/api/client-apps/:id/components', async (req, res) => {
    try {
      const clientAppId = parseInt(req.params.id);
      const { componentId, customConfig } = req.body;
      if (!componentId) {
        return res.status(400).json({ message: 'componentId is required' });
      }
      const appComp = await storage.addComponentToApp({ clientAppId, componentId, customConfig });
      res.status(201).json(appComp);
    } catch (error) {
      console.error('Error adding component to app:', error);
      res.status(500).json({ message: 'Error adding component to app' });
    }
  });

  // Remove component from app
  app.delete('/api/client-apps/:id/components/:componentId', async (req, res) => {
    try {
      const clientAppId = parseInt(req.params.id);
      const componentId = req.params.componentId;
      await storage.removeComponentFromApp(clientAppId, componentId);
      res.json({ message: 'Component removed from app' });
    } catch (error) {
      console.error('Error removing component from app:', error);
      res.status(500).json({ message: 'Error removing component from app' });
    }
  });

  // Get campaigns for a specific app (includes both clientAppId-linked and channel-linked)
  app.get('/api/client-apps/:id/campaigns', async (req, res) => {
    try {
      const appId = parseInt(req.params.id);
      const appChannels = await storage.getClientAppChannels(appId);
      const appChannelIds = new Set(appChannels.map(ch => ch.id));
      const allCampaigns = await storage.getAllCampaigns();
      const appCampaigns = allCampaigns.filter(c =>
        c.clientAppId === appId || (c.channelId && appChannelIds.has(c.channelId))
      );
      res.json(appCampaigns);
    } catch (error) {
      console.error('Error fetching app campaigns:', error);
      res.status(500).json({ message: 'Error fetching app campaigns' });
    }
  });

  // Get all channels for a user (across all their client apps)
  app.get('/api/channels', async (req, res) => {
    try {
      const userIdParam = req.query.userId as string | undefined;
      
      if (!userIdParam) {
        return res.status(400).json({ 
          message: 'userId query parameter is required' 
        });
      }
      
      const userId = parseInt(userIdParam);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid userId' });
      }
      
      const channels = await storage.getUserChannels(userId);
      res.json(channels);
    } catch (error) {
      console.error('Error fetching user channels:', error);
      res.status(500).json({ message: 'Error fetching channels' });
    }
  });

  // Campaign CRUD endpoints
  
  // Create campaign (requires userId for multi-tenant scoping)
  app.post('/api/campaigns', async (req, res) => {
    try {
      const { userId, clientAppId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ 
          message: 'userId is required in request body for multi-tenant scoping' 
        });
      }
      
      if (typeof userId !== 'number' || isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid userId - must be a number' });
      }

      if (clientAppId) {
        const app = await storage.getClientApp(clientAppId);
        if (!app) {
          return res.status(404).json({ message: 'Client app not found' });
        }
        if (app.userId !== userId) {
          return res.status(403).json({ message: 'Access denied - app does not belong to this user' });
        }
      }

      if (req.body.sponsorId) {
        const sponsor = await storage.getSponsor(req.body.sponsorId);
        if (!sponsor) {
          return res.status(404).json({ message: 'Sponsor not found' });
        }
        if (sponsor.userId !== userId) {
          return res.status(403).json({ message: 'Access denied - sponsor does not belong to this user' });
        }
      }
      
      const campaignData = { ...req.body };
      if (campaignData.startDate) {
        campaignData.startDate = new Date(campaignData.startDate);
      }
      if (campaignData.endDate) {
        campaignData.endDate = new Date(campaignData.endDate);
      }
      if (campaignData.matchStartTime) {
        campaignData.matchStartTime = new Date(campaignData.matchStartTime);
      }

      const campaign = await storage.createCampaign(campaignData);
      res.status(201).json(campaign);
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(400).json({ 
        message: 'Error creating campaign',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get campaigns (requires userId for multi-tenant isolation)
  app.get('/api/campaigns', async (req, res) => {
    try {
      const userIdParam = req.query.userId as string | undefined;
      
      if (!userIdParam) {
        return res.status(400).json({ 
          message: 'userId query parameter is required for multi-tenant scoping' 
        });
      }
      
      const userId = parseInt(userIdParam);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid userId parameter' });
      }
      
      const userCampaigns = await storage.getUserCampaigns(userId);
      const countMap = await storage.getBroadcastCountsForCampaigns(userCampaigns.map(c => c.id));

      const enriched = userCampaigns.map(c => ({
        ...c,
        broadcastCount: countMap.get(c.id) || 0,
      }));

      res.json(enriched);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ message: 'Error fetching campaigns' });
    }
  });

  // Get single campaign
  app.get('/api/campaigns/:id', async (req, res) => {
    try {
      const campaign = await storage.getCampaign(parseInt(req.params.id));
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }
      let clientAppName: string | null = null;
      let channelName: string | null = null;
      if (campaign.clientAppId) {
        const clientApp = await storage.getClientApp(campaign.clientAppId);
        if (clientApp) clientAppName = clientApp.name;
      }
      if (campaign.channelId) {
        const channel = await storage.getChannel(campaign.channelId);
        if (channel) channelName = channel.name;
      }
      res.json({ ...campaign, clientAppName, channelName });
    } catch (error) {
      console.error('Error fetching campaign:', error);
      res.status(500).json({ message: 'Error fetching campaign' });
    }
  });

  app.get('/api/campaigns/:id/stats', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }
      const broadcasts = await storage.getCampaignBroadcasts(campaignId);
      let totalViews = 0;
      let totalEngagement = 0;
      let engagementCount = 0;
      let totalPollResponses = 0;
      let liveBroadcasts = 0;
      let upcomingBroadcasts = 0;
      let endedBroadcasts = 0;
      let totalPolls = 0;
      let totalContests = 0;

      for (const broadcast of broadcasts) {
        if (broadcast.metadata && typeof broadcast.metadata === 'object') {
          const meta = broadcast.metadata as Record<string, unknown>;
          if (meta.viewers) totalViews += Number(meta.viewers) || 0;
          if (meta.engagement) {
            totalEngagement += Number(meta.engagement) || 0;
            engagementCount++;
          }
        }
        if (broadcast.status === 'live') liveBroadcasts++;
        else if (broadcast.status === 'upcoming') upcomingBroadcasts++;
        else if (broadcast.status === 'ended') endedBroadcasts++;

        const polls = await storage.getBroadcastPolls(broadcast.broadcastId);
        totalPolls += polls.length;
        for (const poll of polls) {
          totalPollResponses += poll.totalVotes || 0;
        }
        const contests = await storage.getBroadcastContests(broadcast.broadcastId);
        totalContests += contests.length;
      }

      res.json({
        totalViews,
        engagementRate: engagementCount > 0 ? Math.round((totalEngagement / engagementCount) * 10) / 10 : 0,
        totalPollResponses,
        totalPolls,
        totalContests,
        liveBroadcasts,
        upcomingBroadcasts,
        endedBroadcasts,
        totalBroadcasts: broadcasts.length,
      });
    } catch (error) {
      console.error('Error fetching campaign stats:', error);
      res.status(500).json({ message: 'Error fetching campaign stats' });
    }
  });

  app.get('/api/campaigns/:id/broadcasts', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }
      const broadcasts = await storage.getCampaignBroadcasts(campaignId);
      const enriched = await Promise.all(broadcasts.map(async (broadcast) => {
        const polls = await storage.getBroadcastPolls(broadcast.broadcastId);
        const contests = await storage.getBroadcastContests(broadcast.broadcastId);
        return {
          ...broadcast,
          pollCount: polls.length,
          activePollCount: polls.filter(p => p.isActive).length,
          contestCount: contests.length,
        };
      }));
      res.json(enriched);
    } catch (error) {
      console.error('Error fetching campaign broadcasts:', error);
      res.status(500).json({ message: 'Error fetching campaign broadcasts' });
    }
  });

  // Update campaign
  app.put('/api/campaigns/:id', async (req, res) => {
    try {
      // Validate request body with updateCampaignSchema
      const validatedData = updateCampaignSchema.parse(req.body);
      
      // Convert ISO date strings to Date objects if present
      const updateData: any = { ...validatedData };
      if (updateData.startDate !== undefined) {
        updateData.startDate = updateData.startDate ? new Date(updateData.startDate) : null;
      }
      if (updateData.endDate !== undefined) {
        updateData.endDate = updateData.endDate ? new Date(updateData.endDate) : null;
      }
      if (updateData.matchStartTime !== undefined) {
        updateData.matchStartTime = updateData.matchStartTime ? new Date(updateData.matchStartTime) : null;
      }

      if (updateData.sponsorId) {
        const existingCampaign = await storage.getCampaign(parseInt(req.params.id));
        if (existingCampaign) {
          const sponsor = await storage.getSponsor(updateData.sponsorId);
          if (!sponsor) {
            return res.status(404).json({ message: 'Sponsor not found' });
          }
          if (sponsor.userId !== existingCampaign.userId) {
            return res.status(403).json({ message: 'Access denied - sponsor does not belong to this user' });
          }
        }
      }
      
      const campaign = await storage.updateCampaign(parseInt(req.params.id), updateData);
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error('Error updating campaign:', error);
      res.status(400).json({ 
        message: 'Error updating campaign',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete campaign
  app.delete('/api/campaigns/:id', async (req, res) => {
    try {
      await storage.deleteCampaign(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      res.status(500).json({ message: 'Error deleting campaign' });
    }
  });

  // Toggle campaign pause/resume
  app.patch('/api/campaigns/:id/toggle-pause', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Toggle isPaused state
      const newPausedState = campaign.isPaused === 'true' ? 'false' : 'true';
      const updatedCampaign = await storage.updateCampaign(campaignId, {
        isPaused: newPausedState
      });

      // Broadcast campaign state change to all connected clients
      const eventType = newPausedState === 'true' ? 'campaign_paused' : 'campaign_resumed';
      const wsEvent = {
        type: eventType,
        campaignId: campaignId,
        timestamp: new Date().toISOString()
      };

      // Log before broadcasting
      console.log(`🔔 [WebSocket] Broadcasting ${eventType} to campaign ${campaignId}`);
      broadcastToCampaign(campaignId, JSON.stringify(wsEvent));
      console.log(`✅ [WebSocket] Event sent: ${JSON.stringify(wsEvent)}`);

      res.json(updatedCampaign);
    } catch (error) {
      console.error('Error toggling campaign pause:', error);
      res.status(500).json({ 
        message: 'Error toggling campaign pause',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get campaign engagement config
  app.get('/api/campaigns/:id/engagement-config', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const config = await storage.getCampaignEngagementConfig(campaignId);
      res.json(config || null);
    } catch (error) {
      console.error('Error fetching engagement config:', error);
      res.status(500).json({ message: 'Error fetching engagement config' });
    }
  });

  // Save campaign engagement config
  app.put('/api/campaigns/:id/engagement-config', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const config = await storage.upsertCampaignEngagementConfig({
        campaignId,
        ...req.body
      });
      
      // Broadcast config:updated event
      const campaign = await storage.getCampaign(campaignId);
      broadcastToCampaign(campaignId, JSON.stringify({
        type: 'config:updated',
        campaignId,
        matchId: campaign?.matchId || null,
        sections: ['engagement'],
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }));
      
      res.json(config);
    } catch (error) {
      console.error('Error saving engagement config:', error);
      res.status(500).json({ message: 'Error saving engagement config' });
    }
  });

  // Get campaign UI config
  app.get('/api/campaigns/:id/ui-config', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const config = await storage.getCampaignUiConfig(campaignId);
      res.json(config || null);
    } catch (error) {
      console.error('Error fetching UI config:', error);
      res.status(500).json({ message: 'Error fetching UI config' });
    }
  });

  // Save campaign UI config
  app.put('/api/campaigns/:id/ui-config', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const config = await storage.upsertCampaignUiConfig({
        campaignId,
        ...req.body
      });
      
      // Broadcast config:updated event
      const campaign = await storage.getCampaign(campaignId);
      broadcastToCampaign(campaignId, JSON.stringify({
        type: 'config:updated',
        campaignId,
        matchId: campaign?.matchId || null,
        sections: ['ui'],
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }));
      
      res.json(config);
    } catch (error) {
      console.error('Error saving UI config:', error);
      res.status(500).json({ message: 'Error saving UI config' });
    }
  });

  // Get campaign feature flags
  app.get('/api/campaigns/:id/feature-flags', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const flags = await storage.getCampaignFeatureFlags(campaignId);
      res.json(flags || null);
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      res.status(500).json({ message: 'Error fetching feature flags' });
    }
  });

  // Save campaign feature flags
  app.put('/api/campaigns/:id/feature-flags', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const flags = await storage.upsertCampaignFeatureFlags({
        campaignId,
        ...req.body
      });
      
      // Broadcast config:updated event
      const campaign = await storage.getCampaign(campaignId);
      broadcastToCampaign(campaignId, JSON.stringify({
        type: 'config:updated',
        campaignId,
        matchId: campaign?.matchId || null,
        sections: ['features'],
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }));
      
      res.json(flags);
    } catch (error) {
      console.error('Error saving feature flags:', error);
      res.status(500).json({ message: 'Error saving feature flags' });
    }
  });

  // Get campaign events
  app.get('/api/campaigns/:id/events', async (req, res) => {
    try {
      const events = await storage.getCampaignEvents(
        parseInt(req.params.id),
        req.query.limit ? parseInt(req.query.limit as string) : 50
      );
      res.json(events);
    } catch (error) {
      console.error('Error fetching campaign events:', error);
      res.status(500).json({ message: 'Error fetching campaign events' });
    }
  });

  // Scheduled Components Routes
  
  // Get scheduled components for a campaign
  app.get('/api/campaigns/:id/scheduled-components', async (req, res) => {
    try {
      const components = await storage.getCampaignScheduledComponents(parseInt(req.params.id));
      
      // Enrich custom components with component details
      const enrichedComponents = await Promise.all(
        components.map(async (comp) => {
          if (comp.type === 'custom_component' && 
              comp.data && 
              typeof comp.data === 'object' && 
              'componentId' in comp.data && 
              typeof comp.data.componentId === 'string') {
            const componentDetails = await storage.getComponentById(comp.data.componentId);
            return {
              ...comp,
              componentDetails
            };
          }
          return comp;
        })
      );
      
      res.json(enrichedComponents);
    } catch (error) {
      console.error('Error fetching scheduled components:', error);
      res.status(500).json({ message: 'Error fetching scheduled components' });
    }
  });

  // Create scheduled component
  app.post('/api/campaigns/:id/scheduled-components', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { type, scheduledTime, endTime, data } = req.body;

      if (!type || !scheduledTime || !data) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Validate custom component exists and get its type
      let componentType = type;
      let componentName = type;
      
      if (type === 'custom_component') {
        if (!data.componentId) {
          return res.status(400).json({ message: 'componentId is required for custom components' });
        }
        const existingComponent = await storage.getComponentById(data.componentId);
        if (!existingComponent) {
          return res.status(404).json({ message: 'Component not found' });
        }
        componentType = existingComponent.type;
        componentName = existingComponent.name;
      }

      // Check for overlapping scheduled components of the same type
      const allScheduled = await storage.getCampaignScheduledComponents(campaignId);
      const newStart = new Date(scheduledTime);
      const newEnd = endTime ? new Date(endTime) : null;

      for (const scheduled of allScheduled) {
        if (scheduled.status === 'cancelled') continue;

        // Determine the type of the scheduled component
        let scheduledType = scheduled.type;
        if (scheduled.type === 'custom_component' && scheduled.data && typeof scheduled.data === 'object' && 'componentId' in scheduled.data) {
          const comp = await storage.getComponentById(scheduled.data.componentId as string);
          if (comp) {
            scheduledType = comp.type;
          }
        }

        // Only check components of the same type
        if (scheduledType !== componentType) continue;

        const existingStart = new Date(scheduled.scheduledTime);
        const existingEnd = scheduled.endTime ? new Date(scheduled.endTime) : null;

        // Check for overlap
        const hasOverlap = (() => {
          // If new component has no end time (runs indefinitely), check if it starts before existing ends
          if (!newEnd) {
            return !existingEnd || newStart < existingEnd;
          }

          // If existing has no end time, check if new overlaps with its start
          if (!existingEnd) {
            return newEnd > existingStart;
          }

          // Both have end times - check for any overlap
          return newStart < existingEnd && newEnd > existingStart;
        })();

        if (hasOverlap) {
          let scheduledName = scheduled.type;
          if (scheduled.type === 'custom_component' && scheduled.data && typeof scheduled.data === 'object' && 'componentId' in scheduled.data) {
            const comp = await storage.getComponentById(scheduled.data.componentId as string);
            if (comp) scheduledName = comp.name;
          }

          return res.status(409).json({
            message: `Time conflict: Another ${componentType} component "${scheduledName}" is already scheduled during this time period. Only one component of each type can be active at a time.`,
            conflictingSchedule: {
              id: scheduled.id,
              type: scheduledType,
              name: scheduledName,
              scheduledTime: scheduled.scheduledTime,
              endTime: scheduled.endTime
            }
          });
        }
      }

      const component = await storage.createScheduledComponent({
        campaignId,
        type,
        scheduledTime: new Date(scheduledTime),
        endTime: endTime ? new Date(endTime) : undefined,
        data,
        status: 'pending'
      });

      res.status(201).json(component);
    } catch (error) {
      console.error('Error creating scheduled component:', error);
      res.status(400).json({ 
        message: 'Error creating scheduled component',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update scheduled component
  app.patch('/api/scheduled-components/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { type, scheduledTime, endTime, data } = req.body;

      // Get current scheduled component
      const current = await storage.getScheduledComponent(id);
      if (!current) {
        return res.status(404).json({ message: 'Scheduled component not found' });
      }

      // Determine the component type for validation
      let componentType = type || current.type;
      let componentName = componentType;
      
      if (componentType === 'custom_component') {
        const componentId = data?.componentId || (current.data && typeof current.data === 'object' && 'componentId' in current.data ? current.data.componentId : null);
        if (componentId) {
          const existingComponent = await storage.getComponentById(componentId as string);
          if (!existingComponent) {
            return res.status(404).json({ message: 'Component not found' });
          }
          componentType = existingComponent.type;
          componentName = existingComponent.name;
        }
      }

      // Check for overlapping scheduled components of the same type (if time is being updated)
      if (scheduledTime !== undefined || endTime !== undefined) {
        const allScheduled = await storage.getCampaignScheduledComponents(current.campaignId);
        const newStart = scheduledTime ? new Date(scheduledTime) : new Date(current.scheduledTime);
        const newEnd = endTime !== undefined ? (endTime ? new Date(endTime) : null) : (current.endTime ? new Date(current.endTime) : null);

        for (const scheduled of allScheduled) {
          if (scheduled.id === id || scheduled.status === 'cancelled') continue;

          // Determine the type of the scheduled component
          let scheduledType = scheduled.type;
          if (scheduled.type === 'custom_component' && scheduled.data && typeof scheduled.data === 'object' && 'componentId' in scheduled.data) {
            const comp = await storage.getComponentById(scheduled.data.componentId as string);
            if (comp) {
              scheduledType = comp.type;
            }
          }

          // Only check components of the same type
          if (scheduledType !== componentType) continue;

          const existingStart = new Date(scheduled.scheduledTime);
          const existingEnd = scheduled.endTime ? new Date(scheduled.endTime) : null;

          // Check for overlap
          const hasOverlap = (() => {
            if (!newEnd) {
              return !existingEnd || newStart < existingEnd;
            }
            if (!existingEnd) {
              return newEnd > existingStart;
            }
            return newStart < existingEnd && newEnd > existingStart;
          })();

          if (hasOverlap) {
            let scheduledName = scheduled.type;
            if (scheduled.type === 'custom_component' && scheduled.data && typeof scheduled.data === 'object' && 'componentId' in scheduled.data) {
              const comp = await storage.getComponentById(scheduled.data.componentId as string);
              if (comp) scheduledName = comp.name;
            }

            return res.status(409).json({
              message: `Time conflict: Another ${componentType} component "${scheduledName}" is already scheduled during this time period. Only one component of each type can be active at a time.`,
              conflictingSchedule: {
                id: scheduled.id,
                type: scheduledType,
                name: scheduledName,
                scheduledTime: scheduled.scheduledTime,
                endTime: scheduled.endTime
              }
            });
          }
        }
      }

      const updateData: Partial<InsertScheduledComponent> = {};
      if (type !== undefined) updateData.type = type;
      if (scheduledTime !== undefined) updateData.scheduledTime = new Date(scheduledTime);
      if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;
      if (data !== undefined) updateData.data = data;

      const updated = await storage.updateScheduledComponent(id, updateData);

      if (!updated) {
        return res.status(404).json({ message: 'Scheduled component not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating scheduled component:', error);
      res.status(500).json({ 
        message: 'Error updating scheduled component',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Delete scheduled component
  app.delete('/api/scheduled-components/:id', async (req, res) => {
    try {
      await storage.deleteScheduledComponent(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting scheduled component:', error);
      res.status(500).json({ message: 'Error deleting scheduled component' });
    }
  });

  // Form state routes
  
  // Save form state
  app.post('/api/form-state', async (req, res) => {
    try {
      const { campaignId, formType, formData } = req.body;
      
      if (!campaignId || !formType || !formData) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const state = await storage.saveFormState({
        campaignId: parseInt(campaignId),
        formType,
        formData
      });
      
      res.json(state);
    } catch (error) {
      console.error('Error saving form state:', error);
      res.status(500).json({ message: 'Error saving form state' });
    }
  });

  // Get specific form state
  app.get('/api/form-state/:campaignId/:formType', async (req, res) => {
    try {
      const state = await storage.getFormState(
        parseInt(req.params.campaignId),
        req.params.formType
      );
      
      if (!state) {
        return res.status(404).json({ message: 'Form state not found' });
      }
      
      res.json(state);
    } catch (error) {
      console.error('Error fetching form state:', error);
      res.status(500).json({ message: 'Error fetching form state' });
    }
  });

  // Get all form states for a campaign
  app.get('/api/form-state/:campaignId', async (req, res) => {
    try {
      const states = await storage.getAllFormStates(parseInt(req.params.campaignId));
      res.json(states);
    } catch (error) {
      console.error('Error fetching form states:', error);
      res.status(500).json({ message: 'Error fetching form states' });
    }
  });

  // Mock endpoint for Reachu channels
  app.get('/api/reachu/channels', async (req, res) => {
    try {
      // Mock data - in production this would fetch from Reachu API
      const mockChannels = [
        { id: 'ch_1', name: 'Electronics Store', productCount: 245 },
        { id: 'ch_2', name: 'Fashion & Apparel', productCount: 389 },
        { id: 'ch_3', name: 'Home & Garden', productCount: 156 },
        { id: 'ch_4', name: 'Sports Equipment', productCount: 92 },
        { id: 'ch_5', name: 'Beauty & Health', productCount: 178 }
      ];
      
      res.json(mockChannels);
    } catch (error) {
      console.error('Error fetching Reachu channels:', error);
      res.status(500).json({ message: 'Error fetching channels' });
    }
  });

  // Component Library Routes
  
  // Get all components
  app.get('/api/components', async (req, res) => {
    try {
      const components = await storage.getComponents();
      res.json(components);
    } catch (error) {
      console.error('Error fetching components:', error);
      res.status(500).json({ message: 'Error fetching components' });
    }
  });

  // Get component usage across campaigns
  app.get('/api/components/usage', async (req, res) => {
    try {
      const usage = await storage.getComponentUsage();
      res.json(usage);
    } catch (error) {
      console.error('Error fetching component usage:', error);
      res.status(500).json({ message: 'Error fetching component usage' });
    }
  });

  // Create new component
  app.post('/api/components', async (req, res) => {
    try {
      const { type, name, config } = req.body;
      
      if (!type || !name || !config) {
        return res.status(400).json({ message: 'Missing required fields: type, name, config' });
      }

      const component = await storage.createComponent({ type, name, config });
      res.status(201).json(component);
    } catch (error) {
      console.error('Error creating component:', error);
      res.status(500).json({ message: 'Error creating component' });
    }
  });

  // Get component by ID
  app.get('/api/components/:id', async (req, res) => {
    try {
      const component = await storage.getComponentById(req.params.id);
      
      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }
      
      res.json(component);
    } catch (error) {
      console.error('Error fetching component:', error);
      res.status(500).json({ message: 'Error fetching component' });
    }
  });

  // Update component
  app.patch('/api/components/:id', async (req, res) => {
    try {
      const { type, name, config } = req.body;
      const updates: any = {};
      
      if (type !== undefined) updates.type = type;
      if (name !== undefined) updates.name = name;
      if (config !== undefined) updates.config = config;
      
      const component = await storage.updateComponent(req.params.id, updates);
      
      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }
      
      // Broadcast config update to all campaigns using this component
      const allCampaigns = await storage.getAllCampaigns();
      for (const campaign of allCampaigns) {
        // Only broadcast to active campaigns
        if (!isCampaignActive(campaign)) {
          continue;
        }
        
        const campaignComponents = await storage.getCampaignComponents(campaign.id);
        const isUsed = campaignComponents.some(cc => cc.componentId === req.params.id);
        
        if (isUsed) {
          const campaignComponent = campaignComponents.find(cc => cc.componentId === req.params.id);
          const event: any = {
            type: 'component_config_updated',
            campaignId: campaign.id,
            componentId: req.params.id,
            component: {
              id: component.id,
              type: component.type,
              name: component.name,
              config: normalizeUrls(updates.config || component.config, req.protocol, req.get('host'))
            }
          };
          // Include matchId if component or campaign is associated with a match
          if (campaignComponent?.matchId) {
            event.matchId = campaignComponent.matchId;
          } else if (campaign.matchId) {
            event.matchId = campaign.matchId;
          }
          broadcastToCampaignImpl(campaign.id, JSON.stringify(event));
        }
      }
      
      res.json(component);
    } catch (error) {
      console.error('Error updating component:', error);
      res.status(500).json({ message: 'Error updating component' });
    }
  });

  // Delete component
  app.delete('/api/components/:id', async (req, res) => {
    try {
      await storage.deleteComponent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting component:', error);
      res.status(500).json({ message: 'Error deleting component' });
    }
  });

  // Campaign Component Routes
  
  // Get components for a campaign
  app.get('/api/campaigns/:id/components', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const components = await storage.getCampaignComponents(campaignId);
      res.json(components);
    } catch (error) {
      console.error('Error fetching campaign components:', error);
      res.status(500).json({ message: 'Error fetching campaign components' });
    }
  });

  // Get active components for a campaign (for iOS app initial state)
  app.get('/api/campaigns/:id/active-components', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      
      // Check if campaign exists and is active
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }
      
      if (!isCampaignActive(campaign)) {
        // Campaign has ended, return empty array
        return res.json([]);
      }
      
      const allComponents = await storage.getCampaignComponents(campaignId);
      
      // Filter only active components and format for iOS consumption
      const activeComponents = allComponents
        .filter(cc => cc.status === 'active')
        .map(cc => ({
          componentId: cc.component.id,
          type: cc.component.type,
          name: cc.component.name,
          // Use campaign-specific customConfig if available, otherwise use component's default config
          config: normalizeUrls(cc.customConfig || cc.component.config, req.protocol, req.get('host')),
          status: cc.status,
          activatedAt: cc.activatedAt
        }));
      
      res.json(activeComponents);
    } catch (error) {
      console.error('Error fetching active campaign components:', error);
      res.status(500).json({ message: 'Error fetching active campaign components' });
    }
  });

  // Add component to campaign
  app.post('/api/campaigns/:id/components', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { componentId, status, instanceName } = req.body;
      
      if (!componentId) {
        return res.status(400).json({ message: 'Missing required field: componentId' });
      }

      // Get component details
      const component = await storage.getComponentById(componentId);
      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }

      // Generate default instanceName if not provided
      let finalInstanceName = instanceName;
      if (!finalInstanceName) {
        const existingComponents = await storage.getCampaignComponents(campaignId);
        const sameTemplateInstances = existingComponents.filter(cc => cc.componentId === componentId);
        const sdkName = componentSDKNames[component.type as keyof typeof componentSDKNames] || component.name;
        
        // Find highest number in existing instance names
        const instancePattern = new RegExp(`^${sdkName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
        let maxNumber = 0;
        
        for (const instance of sameTemplateInstances) {
          if (!instance.instanceName) continue;
          const match = instance.instanceName.match(instancePattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) maxNumber = num;
          }
        }
        
        // Generate next sequential name
        finalInstanceName = `${sdkName} ${maxNumber + 1}`;
      }

      // Validate component availability if status is active
      if (status === 'active') {
        const availability = await storage.validateComponentAvailability(componentId, component.isTemplate === 'true', campaignId);
        if (!availability.available) {
          return res.status(409).json({ 
            message: 'Component is already active in another campaign',
            activeCampaignId: availability.activeCampaignId
          });
        }
      }

      const campaignComponent = await storage.addComponentToCampaign({
        campaignId,
        componentId,
        instanceName: finalInstanceName,
        status: status || 'inactive'
      });
      
      res.status(201).json(campaignComponent);
    } catch (error) {
      console.error('Error adding component to campaign:', error);
      res.status(500).json({ message: 'Error adding component to campaign' });
    }
  });

  // Update campaign component status (toggle ON/OFF)
  app.patch('/api/campaigns/:id/components/:componentId', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { componentId } = req.params;
      const { status } = req.body;
      
      if (!status || !['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be "active" or "inactive"' });
      }

      // Get component details to check type
      const component = await storage.getComponentById(componentId);
      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }

      // Validate component availability if activating
      if (status === 'active') {
        const availability = await storage.validateComponentAvailability(componentId, component.isTemplate === 'true', campaignId);
        if (!availability.available) {
          return res.status(409).json({ 
            message: 'Component is already active in another campaign',
            activeCampaignId: availability.activeCampaignId
          });
        }
      }

      const updated = await storage.updateCampaignComponentStatus(campaignId, componentId, status);
      
      if (!updated) {
        return res.status(404).json({ message: 'Campaign component not found' });
      }

      // Check if campaign is active before broadcasting
      const campaign = await storage.getCampaign(campaignId);
      if (campaign && isCampaignActive(campaign)) {
        // Get full component details for broadcast
        const fullComponent = await storage.getComponentById(componentId);
        
        // Build event with optional matchId
        const event: any = {
          type: 'component_status_changed',
          campaignId,
          componentId,
          status,
          component: fullComponent ? {
            id: fullComponent.id,
            type: fullComponent.type,
            name: fullComponent.name,
            config: normalizeUrls(updated.customConfig || fullComponent.config, req.protocol, req.get('host'))
          } : null
        };
        // Include matchId if component or campaign is associated with a match
        if (updated.matchId) {
          event.matchId = updated.matchId;
        } else if (campaign.matchId) {
          event.matchId = campaign.matchId;
        }
        broadcastToCampaignImpl(campaignId, JSON.stringify(event));
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating campaign component status:', error);
      res.status(500).json({ message: 'Error updating campaign component status' });
    }
  });

  // Update campaign component custom configuration
  app.patch('/api/campaigns/:id/components/:componentId/config', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { componentId } = req.params;
      const { customConfig } = req.body;
      
      // Allow null/undefined to clear customConfig and revert to template defaults
      if (customConfig === undefined) {
        return res.status(400).json({ message: 'Missing required field: customConfig (use null to clear)' });
      }

      const updated = await storage.updateCampaignComponentConfig(campaignId, componentId, customConfig);
      
      if (!updated) {
        return res.status(404).json({ message: 'Campaign component not found' });
      }

      // Check if campaign is active and component is active before broadcasting
      const campaign = await storage.getCampaign(campaignId);
      if (campaign && isCampaignActive(campaign) && updated.status === 'active') {
        // Get full component details for broadcast
        const fullComponent = await storage.getComponentById(componentId);
        
        // Broadcast config update via WebSocket
        const effectiveConfig = updated.customConfig || fullComponent?.config;
        
        const event: any = {
          type: 'component_config_updated',
          campaignId,
          componentId,
          component: fullComponent ? {
            id: fullComponent.id,
            type: fullComponent.type,
            name: fullComponent.name,
            config: normalizeUrls(effectiveConfig, req.protocol, req.get('host'))
          } : null
        };
        // Include matchId if component or campaign is associated with a match
        if (updated.matchId) {
          event.matchId = updated.matchId;
        } else if (campaign.matchId) {
          event.matchId = campaign.matchId;
        }
        broadcastToCampaignImpl(campaignId, JSON.stringify(event));
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating campaign component config:', error);
      res.status(500).json({ message: 'Error updating campaign component config' });
    }
  });

  // Remove component from campaign
  app.delete('/api/campaigns/:id/components/:componentId', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { componentId } = req.params;
      
      await storage.removeComponentFromCampaign(campaignId, componentId);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing component from campaign:', error);
      res.status(500).json({ message: 'Error removing component from campaign' });
    }
  });

  // Validate component availability
  app.get('/api/components/:id/availability', async (req, res) => {
    try {
      const componentId = req.params.id;
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      
      // Verify component exists before checking availability
      const component = await storage.getComponentById(componentId);
      if (!component) {
        return res.status(404).json({ message: 'Component not found' });
      }
      
      const availability = await storage.validateComponentAvailability(componentId, component.isTemplate === 'true', campaignId);
      res.json(availability);
    } catch (error) {
      console.error('Error validating component availability:', error);
      res.status(500).json({ message: 'Error validating component availability' });
    }
  });

  // ========================================
  // Broadcast Management API (v1) - Bearer Auth
  // ========================================

  // Create broadcast
  app.post('/v1/broadcasts', requireBearerAuth, async (req, res) => {
    try {
      const authUser = (req as any).authUser;
      const { broadcastName, externalId, campaignId, channelId, startTime, endTime, metadata } = req.body;

      if (!broadcastName) {
        return res.status(400).json({ message: 'broadcastName is required' });
      }

      const dateStr = startTime ? new Date(startTime).toISOString().split('T')[0] : undefined;
      let broadcastId = generateBroadcastId(broadcastName, dateStr);

      const existing = await storage.getBroadcast(broadcastId);
      if (existing) {
        broadcastId = `${broadcastId}-${Date.now()}`;
      }

      if (campaignId) {
        const campaign = await storage.getCampaign(campaignId);
        if (!campaign) {
          return res.status(404).json({ message: 'Campaign not found' });
        }
      }

      const broadcast = await storage.createBroadcast({
        broadcastId,
        broadcastName,
        externalId: externalId || null,
        campaignId: campaignId || null,
        channelId: channelId || null,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        status: 'upcoming',
        metadata: metadata || null,
        createdBy: authUser.userId
      });

      res.status(201).json(broadcast);
    } catch (error) {
      console.error('Error creating broadcast:', error);
      res.status(500).json({ message: 'Error creating broadcast' });
    }
  });

  // List broadcasts with optional filters
  app.get('/v1/broadcasts', requireBearerAuth, async (req, res) => {
    try {
      const { status, campaignId } = req.query;
      const filters: { status?: string; campaignId?: number } = {};
      if (status) filters.status = status as string;
      if (campaignId) filters.campaignId = parseInt(campaignId as string);

      const broadcastsList = await storage.getAllBroadcasts(filters);
      res.json(broadcastsList);
    } catch (error) {
      console.error('Error listing broadcasts:', error);
      res.status(500).json({ message: 'Error listing broadcasts' });
    }
  });

  // Get single broadcast
  app.get('/v1/broadcasts/:broadcastId', requireBearerAuth, async (req, res) => {
    try {
      const broadcast = await storage.getBroadcast(req.params.broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: 'Broadcast not found' });
      }
      res.json(broadcast);
    } catch (error) {
      console.error('Error getting broadcast:', error);
      res.status(500).json({ message: 'Error getting broadcast' });
    }
  });

  // Update broadcast
  app.put('/v1/broadcasts/:broadcastId', requireBearerAuth, async (req, res) => {
    try {
      const { broadcastName, externalId, campaignId, channelId, startTime, endTime, status, metadata } = req.body;
      const existing = await storage.getBroadcast(req.params.broadcastId);
      if (!existing) return res.status(404).json({ message: 'Broadcast not found' });

      const updateData: any = {};
      if (broadcastName !== undefined) updateData.broadcastName = broadcastName;
      if (externalId !== undefined) updateData.externalId = externalId || null;
      if (campaignId !== undefined) updateData.campaignId = campaignId;
      if (channelId !== undefined) updateData.channelId = channelId;
      if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null;
      if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) updateData.metadata = metadata;

      const updated = await storage.updateBroadcast(req.params.broadcastId, updateData);
      if (!updated) return res.status(404).json({ message: 'Broadcast not found' });

      if (status !== undefined && status !== existing.status && updated.campaignId) {
        if (status === 'live') {
          broadcastToCampaign(updated.campaignId, JSON.stringify({
            type: 'broadcast_started',
            broadcastId: updated.broadcastId,
            broadcastName: updated.broadcastName,
            campaignId: updated.campaignId,
            timestamp: new Date().toISOString()
          }));
        } else if (status === 'ended') {
          broadcastToCampaign(updated.campaignId, JSON.stringify({
            type: 'broadcast_ended',
            broadcastId: updated.broadcastId,
            broadcastName: updated.broadcastName,
            campaignId: updated.campaignId,
            timestamp: new Date().toISOString()
          }));
        }
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating broadcast:', error);
      res.status(500).json({ message: 'Error updating broadcast' });
    }
  });

  // Delete broadcast
  app.delete('/v1/broadcasts/:broadcastId', requireBearerAuth, async (req, res) => {
    try {
      const broadcast = await storage.getBroadcast(req.params.broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: 'Broadcast not found' });
      }
      await storage.deleteBroadcast(req.params.broadcastId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      res.status(500).json({ message: 'Error deleting broadcast' });
    }
  });

  // Get broadcasts for a campaign
  app.get('/v1/campaigns/:campaignId/broadcasts', requireBearerAuth, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      const broadcastsList = await storage.getCampaignBroadcasts(campaignId);
      res.json(broadcastsList);
    } catch (error) {
      console.error('Error getting campaign broadcasts:', error);
      res.status(500).json({ message: 'Error getting campaign broadcasts' });
    }
  });

  // ========================================
  // Engagement API (v1) - Admin endpoints (Bearer Auth)
  // ========================================

  app.post('/v1/broadcasts/:broadcastId/polls', requireBearerAuth, async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: 'Broadcast not found' });
      }

      const parsed = createPollInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(', ') });
      }
      const { question, options, duration, startTime, endTime, isActive, videoStartTime, videoEndTime, broadcastStartTime } = parsed.data;

      const pollData: any = {
        broadcastId,
        question,
        duration: duration ?? null,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        isActive: isActive !== undefined ? isActive : true
      };

      if (videoStartTime !== undefined && videoEndTime !== undefined && broadcastStartTime) {
        const validation = validateScheduling({ broadcastStartTime, videoStartTime, videoEndTime });
        if (!validation.valid) {
          return res.status(400).json({ message: validation.error });
        }
        const scheduled = calculateScheduledTimes({ broadcastStartTime, videoStartTime, videoEndTime });
        pollData.videoStartTime = videoStartTime;
        pollData.videoEndTime = videoEndTime;
        pollData.broadcastStartTime = new Date(broadcastStartTime);
        pollData.scheduledStartTime = scheduled.scheduledStart;
        pollData.scheduledEndTime = scheduled.scheduledEnd;
      }

      const poll = await storage.createPoll(pollData);

      const createdOptions = [];
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const optionText = typeof opt === 'string' ? opt : opt.text;
        const option = await storage.createPollOption({
          pollId: poll.id,
          text: optionText,
          displayOrder: i
        });
        createdOptions.push(option);
      }

      res.status(201).json({ ...poll, options: createdOptions });
    } catch (error) {
      console.error('Error creating poll:', error);
      res.status(500).json({ message: 'Error creating poll' });
    }
  });

  // Get polls for a broadcast
  app.get('/v1/broadcasts/:broadcastId/polls', requireBearerAuth, async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const pollsList = await storage.getBroadcastPolls(broadcastId);
      res.json(pollsList);
    } catch (error) {
      console.error('Error getting polls:', error);
      res.status(500).json({ message: 'Error getting polls' });
    }
  });

  // Update poll
  app.put('/v1/polls/:pollId', requireBearerAuth, async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const { question, isActive, startTime, endTime } = req.body;
      const updateData: any = {};
      if (question !== undefined) updateData.question = question;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null;
      if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;

      const updated = await storage.updatePoll(pollId, updateData);
      if (!updated) {
        return res.status(404).json({ message: 'Poll not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating poll:', error);
      res.status(500).json({ message: 'Error updating poll' });
    }
  });

  // Delete poll
  app.delete('/v1/polls/:pollId', requireBearerAuth, async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const poll = await storage.getPoll(pollId);
      if (!poll) {
        return res.status(404).json({ message: 'Poll not found' });
      }
      await storage.deletePoll(pollId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting poll:', error);
      res.status(500).json({ message: 'Error deleting poll' });
    }
  });

  // Get poll results
  app.get('/v1/polls/:pollId/results', requireBearerAuth, async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const results = await storage.getPollResults(pollId);
      if (!results) {
        return res.status(404).json({ message: 'Poll not found' });
      }
      const totalVotes = results.poll.totalVotes;
      const optionsWithPercentages = results.options.map(opt => ({
        ...opt,
        percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 10000) / 100 : 0
      }));
      res.json({ ...results.poll, options: optionsWithPercentages });
    } catch (error) {
      console.error('Error getting poll results:', error);
      res.status(500).json({ message: 'Error getting poll results' });
    }
  });

  app.post('/v1/broadcasts/:broadcastId/contests', requireBearerAuth, async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: 'Broadcast not found' });
      }

      const parsed = createContestInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(', ') });
      }
      const { title, description, prize, contestType, startTime, endTime, isActive, videoStartTime, videoEndTime, broadcastStartTime } = parsed.data;

      const contestData: any = {
        broadcastId,
        title,
        description: description || null,
        prize: prize || null,
        contestType,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        isActive: isActive !== undefined ? isActive : true
      };

      if (videoStartTime !== undefined && videoEndTime !== undefined && broadcastStartTime) {
        const validation = validateScheduling({ broadcastStartTime, videoStartTime, videoEndTime });
        if (!validation.valid) {
          return res.status(400).json({ message: validation.error });
        }
        const scheduled = calculateScheduledTimes({ broadcastStartTime, videoStartTime, videoEndTime });
        contestData.videoStartTime = videoStartTime;
        contestData.videoEndTime = videoEndTime;
        contestData.broadcastStartTime = new Date(broadcastStartTime);
        contestData.scheduledStartTime = scheduled.scheduledStart;
        contestData.scheduledEndTime = scheduled.scheduledEnd;
      }

      const contest = await storage.createContest(contestData);

      res.status(201).json(contest);
    } catch (error) {
      console.error('Error creating contest:', error);
      res.status(500).json({ message: 'Error creating contest' });
    }
  });

  // Get contests for a broadcast
  app.get('/v1/broadcasts/:broadcastId/contests', requireBearerAuth, async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const contestsList = await storage.getBroadcastContests(broadcastId);
      res.json(contestsList);
    } catch (error) {
      console.error('Error getting contests:', error);
      res.status(500).json({ message: 'Error getting contests' });
    }
  });

  // Update contest
  app.put('/v1/contests/:contestId', requireBearerAuth, async (req, res) => {
    try {
      const contestId = parseInt(req.params.contestId);
      const { title, description, prize, contestType, isActive, startTime, endTime } = req.body;
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (prize !== undefined) updateData.prize = prize;
      if (contestType !== undefined) updateData.contestType = contestType;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null;
      if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;

      const updated = await storage.updateContest(contestId, updateData);
      if (!updated) {
        return res.status(404).json({ message: 'Contest not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating contest:', error);
      res.status(500).json({ message: 'Error updating contest' });
    }
  });

  // Delete contest
  app.delete('/v1/contests/:contestId', requireBearerAuth, async (req, res) => {
    try {
      const contestId = parseInt(req.params.contestId);
      const contest = await storage.getContest(contestId);
      if (!contest) {
        return res.status(404).json({ message: 'Contest not found' });
      }
      await storage.deleteContest(contestId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting contest:', error);
      res.status(500).json({ message: 'Error deleting contest' });
    }
  });

  // Get contest participations
  app.get('/v1/contests/:contestId/participations', requireBearerAuth, async (req, res) => {
    try {
      const contestId = parseInt(req.params.contestId);
      const participations = await storage.getContestParticipations(contestId);
      res.json(participations);
    } catch (error) {
      console.error('Error getting contest participations:', error);
      res.status(500).json({ message: 'Error getting contest participations' });
    }
  });

  // ========================================
  // Engagement SDK Endpoints (public, apiKey auth)
  // ========================================

  // SDK: Vote on a poll (public endpoint, uses apiKey)
  app.post('/v1/engagement/polls/:pollId/vote', createRateLimiter(rateLimitPresets.voting), async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId);
      if (isNaN(pollId) || pollId <= 0) {
        return res.status(400).json({ message: 'Invalid pollId' });
      }

      const parsed = voteInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(', ') });
      }
      const { optionId, userId, broadcastId } = parsed.data;

      if (isQueueEnabled()) {
        await voteQueue.add('process-vote', { pollId, optionId, userId, broadcastId }, {
          jobId: `vote-${pollId}-${userId}`,
        });
        return res.json({ success: true, queued: true, message: 'Vote queued for processing' });
      }

      const { processPollVoteSync } = await import('./services/vote-processor');
      const result = await processPollVoteSync({ pollId, optionId, userId, broadcastId });

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 :
                          result.error?.includes('already voted') ? 409 :
                          result.error?.includes('not active') ? 400 : 500;
        return res.status(statusCode).json({ message: result.error });
      }

      if (result.data) {
        const totalVotes = result.data.poll.totalVotes;
        const optionsWithPercentages = result.data.options.map((opt: any) => ({
          ...opt,
          percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 10000) / 100 : 0
        }));
        res.json({ success: true, results: { ...result.data.poll, options: optionsWithPercentages } });
      } else {
        res.json({ success: true });
      }
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'User has already voted on this poll' });
      }
      console.error('Error voting on poll:', error);
      res.status(500).json({ message: 'Error voting on poll' });
    }
  });

  // SDK: Get polls for a broadcast (public)
  app.get('/v1/engagement/polls', async (req, res) => {
    try {
      const broadcastId = req.query.broadcastId as string;
      if (!broadcastId) {
        return res.status(400).json({ message: 'broadcastId query parameter is required' });
      }

      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: 'Broadcast not found', broadcastId });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const currentVideoTime = req.query.currentVideoTime ? parseInt(req.query.currentVideoTime as string) : undefined;

      const pollsList = await storage.getBroadcastPollsPaginated(broadcastId, { limit, offset });
      let filteredPolls = pollsList.filter(poll => poll.isActive);

      if (currentVideoTime !== undefined && !isNaN(currentVideoTime)) {
        filteredPolls = filteredPolls.filter(poll => {
          if (poll.videoStartTime === null && poll.videoEndTime === null) return true;
          const start = poll.videoStartTime ?? 0;
          const end = poll.videoEndTime ?? Infinity;
          return currentVideoTime >= start && currentVideoTime <= end;
        });
      }

      const pollsWithPercentages = filteredPolls.map(poll => {
        const totalVotes = poll.totalVotes;
        const options = poll.options.map(opt => ({
          ...opt,
          percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 10000) / 100 : 0
        }));
        return { ...poll, options };
      });

      const total = await storage.getBroadcastPollsCount(broadcastId);
      res.json({
        polls: pollsWithPercentages,
        pagination: { limit, offset, total, hasMore: offset + limit < total }
      });
    } catch (error) {
      console.error('Error getting polls:', error);
      res.status(500).json({ message: 'Error getting polls' });
    }
  });

  // SDK: Participate in a contest (public)
  app.post('/v1/engagement/contests/:contestId/participate', createRateLimiter(rateLimitPresets.participation), async (req, res) => {
    try {
      const contestId = parseInt(req.params.contestId);
      if (isNaN(contestId) || contestId <= 0) {
        return res.status(400).json({ message: 'Invalid contestId' });
      }

      const parsed = participateInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(', ') });
      }
      const { userId, broadcastId, answers } = parsed.data;

      if (isQueueEnabled()) {
        await contestParticipationQueue.add('process-participation', { contestId, userId, broadcastId, answers }, {
          jobId: `participate-${contestId}-${userId}`,
        });
        return res.status(201).json({ success: true, queued: true, message: 'Participation queued for processing' });
      }

      const { processContestParticipationSync } = await import('./services/contest-processor');
      const result = await processContestParticipationSync({ contestId, userId, broadcastId, answers });

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 :
                          result.error?.includes('already participated') ? 409 :
                          result.error?.includes('not active') ? 400 : 500;
        return res.status(statusCode).json({ message: result.error });
      }

      res.status(201).json(result.data);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'User has already participated in this contest' });
      }
      console.error('Error participating in contest:', error);
      res.status(500).json({ message: 'Error participating in contest' });
    }
  });

  // SDK: Get contests for a broadcast (public)
  app.get('/v1/engagement/contests', async (req, res) => {
    try {
      const broadcastId = req.query.broadcastId as string;
      if (!broadcastId) {
        return res.status(400).json({ message: 'broadcastId query parameter is required' });
      }

      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: 'Broadcast not found', broadcastId });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const currentVideoTime = req.query.currentVideoTime ? parseInt(req.query.currentVideoTime as string) : undefined;

      const contestsList = await storage.getBroadcastContestsPaginated(broadcastId, { limit, offset });
      let filteredContests = contestsList.filter(contest => contest.isActive);

      if (currentVideoTime !== undefined && !isNaN(currentVideoTime)) {
        filteredContests = filteredContests.filter(contest => {
          if (contest.videoStartTime === null && contest.videoEndTime === null) return true;
          const start = contest.videoStartTime ?? 0;
          const end = contest.videoEndTime ?? Infinity;
          return currentVideoTime >= start && currentVideoTime <= end;
        });
      }

      const total = await storage.getBroadcastContestsCount(broadcastId);
      res.json({
        contests: filteredContests,
        pagination: { limit, offset, total, hasMore: offset + limit < total }
      });
    } catch (error) {
      console.error('Error getting contests:', error);
      res.status(500).json({ message: 'Error getting contests' });
    }
  });

  // Also expose broadcasts listing without auth for dashboard internal API
  app.get('/api/broadcasts', async (req, res) => {
    try {
      const { status, campaignId } = req.query;
      const filters: { status?: string; campaignId?: number } = {};
      if (status) filters.status = status as string;
      if (campaignId) filters.campaignId = parseInt(campaignId as string);
      const broadcastsList = await storage.getAllBroadcasts(filters);

      const broadcastIds = broadcastsList.map(b => b.broadcastId);
      const engagementCounts = await storage.getBroadcastEngagementCounts(broadcastIds);

      const campaignIds = [...new Set(broadcastsList.map(b => b.campaignId).filter((id): id is number => id !== null))];
      const campaignInfo = new Map<number, { name: string; clientAppName: string | null }>();
      for (const cId of campaignIds) {
        const c = await storage.getCampaign(cId);
        if (c) {
          let clientAppName: string | null = null;
          if (c.clientAppId) {
            const app = await storage.getClientApp(c.clientAppId);
            if (app) clientAppName = app.name;
          }
          campaignInfo.set(cId, { name: c.name, clientAppName });
        }
      }

      const enriched = broadcastsList.map(b => {
        const counts = engagementCounts.get(b.broadcastId);
        const info = b.campaignId ? campaignInfo.get(b.campaignId) : null;
        return {
          ...b,
          pollCount: counts?.pollCount ?? 0,
          activePollCount: counts?.activePollCount ?? 0,
          contestCount: counts?.contestCount ?? 0,
          campaignName: info?.name ?? null,
          clientAppName: info?.clientAppName ?? null,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error('Error listing broadcasts:', error);
      res.status(500).json({ message: 'Error listing broadcasts' });
    }
  });

  app.get('/api/broadcasts/:broadcastId', async (req, res) => {
    try {
      const broadcast = await storage.getBroadcast(req.params.broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: 'Broadcast not found' });
      }
      const pollsList = await storage.getBroadcastPolls(broadcast.broadcastId);
      const contestsList = await storage.getBroadcastContests(broadcast.broadcastId);
      res.json({ ...broadcast, polls: pollsList, contests: contestsList });
    } catch (error) {
      console.error('Error getting broadcast:', error);
      res.status(500).json({ message: 'Error getting broadcast' });
    }
  });

  app.post('/api/broadcasts', async (req, res) => {
    try {
      const { broadcastName, externalId, description, campaignId, channelId, startTime, endTime, metadata, createdBy } = req.body;

      if (!broadcastName) {
        return res.status(400).json({ message: 'broadcastName is required' });
      }

      const dateStr = startTime ? new Date(startTime).toISOString().split('T')[0] : undefined;
      let broadcastId = generateBroadcastId(broadcastName, dateStr);

      const existing = await storage.getBroadcast(broadcastId);
      if (existing) {
        broadcastId = `${broadcastId}-${Date.now()}`;
      }

      const broadcast = await storage.createBroadcast({
        broadcastId,
        broadcastName,
        externalId: externalId || null,
        description: description || null,
        campaignId: campaignId || null,
        channelId: channelId || null,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        status: 'upcoming',
        metadata: metadata || null,
        createdBy: createdBy || null
      });

      res.status(201).json(broadcast);
    } catch (error) {
      console.error('Error creating broadcast:', error);
      res.status(500).json({ message: 'Error creating broadcast' });
    }
  });

  app.put('/api/broadcasts/:broadcastId', async (req, res) => {
    try {
      const { broadcastName, externalId, description, campaignId, channelId, startTime, endTime, status, metadata } = req.body;
      const existing = await storage.getBroadcast(req.params.broadcastId);
      if (!existing) return res.status(404).json({ message: 'Broadcast not found' });

      const updateData: any = {};
      if (broadcastName !== undefined) updateData.broadcastName = broadcastName;
      if (externalId !== undefined) updateData.externalId = externalId || null;
      if (description !== undefined) updateData.description = description;
      if (campaignId !== undefined) updateData.campaignId = campaignId;
      if (channelId !== undefined) updateData.channelId = channelId;
      if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null;
      if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) updateData.metadata = metadata;

      const updated = await storage.updateBroadcast(req.params.broadcastId, updateData);
      if (!updated) return res.status(404).json({ message: 'Broadcast not found' });

      if (status !== undefined && status !== existing.status && updated.campaignId) {
        if (status === 'live') {
          broadcastToCampaign(updated.campaignId, JSON.stringify({
            type: 'broadcast_started',
            broadcastId: updated.broadcastId,
            broadcastName: updated.broadcastName,
            campaignId: updated.campaignId,
            timestamp: new Date().toISOString()
          }));
        } else if (status === 'ended') {
          broadcastToCampaign(updated.campaignId, JSON.stringify({
            type: 'broadcast_ended',
            broadcastId: updated.broadcastId,
            broadcastName: updated.broadcastName,
            campaignId: updated.campaignId,
            timestamp: new Date().toISOString()
          }));
        }
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating broadcast:', error);
      res.status(500).json({ message: 'Error updating broadcast' });
    }
  });

  app.delete('/api/broadcasts/:broadcastId', async (req, res) => {
    try {
      const broadcast = await storage.getBroadcast(req.params.broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: 'Broadcast not found' });
      }
      await storage.deleteBroadcast(req.params.broadcastId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      res.status(500).json({ message: 'Error deleting broadcast' });
    }
  });

  app.get('/api/broadcasts/:broadcastId/polls', async (req, res) => {
    try {
      const pollsList = await storage.getBroadcastPolls(req.params.broadcastId);
      res.json(pollsList);
    } catch (error) {
      console.error('Error getting polls:', error);
      res.status(500).json({ message: 'Error getting polls' });
    }
  });

  app.post('/api/broadcasts/:broadcastId/polls', async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: 'Broadcast not found' });
      }

      const { question, options, duration, startTime, endTime, isActive, videoStartTime, videoEndTime, broadcastStartTime } = req.body;
      if (!question || !options || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ message: 'question and at least 2 options are required' });
      }

      const pollData: any = {
        broadcastId,
        question,
        duration: duration ?? null,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        isActive: isActive !== undefined ? isActive : true
      };

      if (videoStartTime !== undefined && videoEndTime !== undefined && broadcastStartTime) {
        const validation = validateScheduling({ broadcastStartTime, videoStartTime, videoEndTime });
        if (!validation.valid) {
          return res.status(400).json({ message: validation.error });
        }
        const scheduled = calculateScheduledTimes({ broadcastStartTime, videoStartTime, videoEndTime });
        pollData.videoStartTime = videoStartTime;
        pollData.videoEndTime = videoEndTime;
        pollData.broadcastStartTime = new Date(broadcastStartTime);
        pollData.scheduledStartTime = scheduled.scheduledStart;
        pollData.scheduledEndTime = scheduled.scheduledEnd;
      }

      const poll = await storage.createPoll(pollData);

      const createdOptions = [];
      for (let i = 0; i < options.length; i++) {
        const optionText = typeof options[i] === 'string' ? options[i] : options[i].text;
        const option = await storage.createPollOption({
          pollId: poll.id,
          text: optionText,
          displayOrder: i
        });
        createdOptions.push(option);
      }

      res.status(201).json({ ...poll, options: createdOptions });
    } catch (error) {
      console.error('Error creating poll:', error);
      res.status(500).json({ message: 'Error creating poll' });
    }
  });

  app.put('/api/polls/:pollId', async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const { question, isActive, duration, startTime, endTime } = req.body;
      const updateData: any = {};
      if (question !== undefined) updateData.question = question;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (duration !== undefined) updateData.duration = duration ?? null;
      if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null;
      if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;

      const updated = await storage.updatePoll(pollId, updateData);
      if (!updated) {
        return res.status(404).json({ message: 'Poll not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating poll:', error);
      res.status(500).json({ message: 'Error updating poll' });
    }
  });

  app.delete('/api/polls/:pollId', async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId);
      await storage.deletePoll(pollId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting poll:', error);
      res.status(500).json({ message: 'Error deleting poll' });
    }
  });

  app.get('/api/broadcasts/:broadcastId/contests', async (req, res) => {
    try {
      const contestsList = await storage.getBroadcastContests(req.params.broadcastId);
      res.json(contestsList);
    } catch (error) {
      console.error('Error getting contests:', error);
      res.status(500).json({ message: 'Error getting contests' });
    }
  });

  app.post('/api/broadcasts/:broadcastId/contests', async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) {
        return res.status(404).json({ message: 'Broadcast not found' });
      }

      const { title, description, prize, contestType, startTime, endTime, isActive, videoStartTime, videoEndTime, broadcastStartTime } = req.body;
      if (!title || !contestType) {
        return res.status(400).json({ message: 'title and contestType are required' });
      }

      const contestData: any = {
        broadcastId,
        title,
        description: description || null,
        prize: prize || null,
        contestType,
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        isActive: isActive !== undefined ? isActive : true
      };

      if (videoStartTime !== undefined && videoEndTime !== undefined && broadcastStartTime) {
        const validation = validateScheduling({ broadcastStartTime, videoStartTime, videoEndTime });
        if (!validation.valid) {
          return res.status(400).json({ message: validation.error });
        }
        const scheduled = calculateScheduledTimes({ broadcastStartTime, videoStartTime, videoEndTime });
        contestData.videoStartTime = videoStartTime;
        contestData.videoEndTime = videoEndTime;
        contestData.broadcastStartTime = new Date(broadcastStartTime);
        contestData.scheduledStartTime = scheduled.scheduledStart;
        contestData.scheduledEndTime = scheduled.scheduledEnd;
      }

      const contest = await storage.createContest(contestData);

      res.status(201).json(contest);
    } catch (error) {
      console.error('Error creating contest:', error);
      res.status(500).json({ message: 'Error creating contest' });
    }
  });

  app.put('/api/contests/:contestId', async (req, res) => {
    try {
      const contestId = parseInt(req.params.contestId);
      const { title, description, prize, contestType, isActive, startTime, endTime } = req.body;
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (prize !== undefined) updateData.prize = prize;
      if (contestType !== undefined) updateData.contestType = contestType;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null;
      if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;

      const updated = await storage.updateContest(contestId, updateData);
      if (!updated) {
        return res.status(404).json({ message: 'Contest not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating contest:', error);
      res.status(500).json({ message: 'Error updating contest' });
    }
  });

  app.delete('/api/contests/:contestId', async (req, res) => {
    try {
      const contestId = parseInt(req.params.contestId);
      await storage.deleteContest(contestId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting contest:', error);
      res.status(500).json({ message: 'Error deleting contest' });
    }
  });

  // ========================================
  // Broadcast Ads Endpoints
  // ========================================
  app.get('/api/broadcasts/:broadcastId/ads', async (req, res) => {
    try {
      const ads = await storage.getBroadcastAds(req.params.broadcastId);
      res.json(ads);
    } catch (error) {
      res.status(500).json({ message: 'Error getting ads' });
    }
  });

  app.post('/api/broadcasts/:broadcastId/ads', async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) return res.status(404).json({ message: 'Broadcast not found' });
      const ad = await storage.createBroadcastAd({ ...req.body, broadcastId });
      res.status(201).json(ad);
    } catch (error) {
      res.status(500).json({ message: 'Error creating ad' });
    }
  });

  app.put('/api/broadcasts/ads/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateBroadcastAd(id, req.body);
      if (!updated) return res.status(404).json({ message: 'Ad not found' });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Error updating ad' });
    }
  });

  app.delete('/api/broadcasts/ads/:id', async (req, res) => {
    try {
      await storage.deleteBroadcastAd(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Error deleting ad' });
    }
  });

  // ========================================
  // Broadcast Products Endpoints
  // ========================================
  app.get('/api/broadcasts/:broadcastId/products', async (req, res) => {
    try {
      const products = await storage.getBroadcastProducts(req.params.broadcastId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: 'Error getting products' });
    }
  });

  app.post('/api/broadcasts/:broadcastId/products', async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) return res.status(404).json({ message: 'Broadcast not found' });
      const product = await storage.createBroadcastProduct({ ...req.body, broadcastId });
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ message: 'Error creating product' });
    }
  });

  app.put('/api/broadcasts/products/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateBroadcastProduct(id, req.body);
      if (!updated) return res.status(404).json({ message: 'Product not found' });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Error updating product' });
    }
  });

  app.delete('/api/broadcasts/products/:id', async (req, res) => {
    try {
      await storage.deleteBroadcastProduct(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Error deleting product' });
    }
  });

  // ========================================
  // Chat Messages Endpoints
  // ========================================
  app.get('/api/broadcasts/:broadcastId/chat', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const messages = await storage.getChatMessages(req.params.broadcastId, limit);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: 'Error getting chat messages' });
    }
  });

  app.post('/api/broadcasts/:broadcastId/chat', async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const { username, message } = req.body;
      if (!username || !message) return res.status(400).json({ message: 'username and message are required' });
      const chatMsg = await storage.createChatMessage({ broadcastId, username, message });
      res.status(201).json(chatMsg);
    } catch (error) {
      res.status(500).json({ message: 'Error creating chat message' });
    }
  });

  // ========================================
  // Broadcast Analytics Endpoint
  // ========================================
  app.get('/api/broadcasts/:broadcastId/analytics', async (req, res) => {
    try {
      const { broadcastId } = req.params;
      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) return res.status(404).json({ message: 'Broadcast not found' });

      const polls = await storage.getBroadcastPolls(broadcastId);
      const contests = await storage.getBroadcastContests(broadcastId);

      const totalVotes = polls.reduce((sum, p) => sum + (p.totalVotes ?? 0), 0);
      const activePolls = polls.filter(p => p.isActive).length;
      const activeContests = contests.filter(c => c.isActive).length;

      res.json({
        broadcastId,
        pollCount: polls.length,
        activePolls,
        contestCount: contests.length,
        activeContests,
        totalVotes,
        viewerCount: broadcast.viewerCount ?? 0,
        peakViewers: broadcast.peakViewers ?? 0,
        status: broadcast.status,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error getting analytics' });
    }
  });

  // ========================================
  // Seed Demo Data Endpoint
  // ========================================
  app.post('/api/seed-demo', async (req, res) => {
    try {
      const { broadcastId } = req.body;
      if (!broadcastId) return res.status(400).json({ message: 'broadcastId is required' });

      const broadcast = await storage.getBroadcast(broadcastId);
      if (!broadcast) return res.status(404).json({ message: 'Broadcast not found' });

      const existingAds = await storage.getBroadcastAds(broadcastId);
      const existingProducts = await storage.getBroadcastProducts(broadcastId);
      const existingChat = await storage.getChatMessages(broadcastId, 1);

      if (existingAds.length === 0) {
        await storage.createBroadcastAd({ broadcastId, name: 'Nike Air Max Campaign', description: 'Exclusive limited edition drop for event attendees', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400', ctaUrl: 'https://nike.com', adType: 'banner', duration: '30', isActive: true, displayOrder: 1 });
        await storage.createBroadcastAd({ broadcastId, name: 'Spotify Premium', description: '3 months free with your first purchase', imageUrl: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400', ctaUrl: 'https://spotify.com', adType: 'interstitial', duration: '15', isActive: true, displayOrder: 2 });
        await storage.createBroadcastAd({ broadcastId, name: 'Red Bull Energy', description: 'Fuel your passion. Available at the venue.', imageUrl: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400', ctaUrl: 'https://redbull.com', adType: 'overlay', duration: '20', isActive: false, displayOrder: 3 });
      }

      if (existingProducts.length === 0) {
        await storage.createBroadcastProduct({ broadcastId, name: 'Official Team Jersey', subtitle: 'Limited Edition 2024 Season', price: '89.99', originalPrice: '129.99', imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400', buyUrl: 'https://shop.example.com/jersey', status: 'available', displayOrder: 1 });
        await storage.createBroadcastProduct({ broadcastId, name: 'Match Day Scarf', subtitle: 'Premium wool blend', price: '24.99', imageUrl: 'https://images.unsplash.com/photo-1609428613813-ef4e36b24059?w=400', buyUrl: 'https://shop.example.com/scarf', status: 'available', displayOrder: 2 });
        await storage.createBroadcastProduct({ broadcastId, name: 'Collector Cap', subtitle: 'Embroidered logo, adjustable fit', price: '34.99', originalPrice: '44.99', imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400', buyUrl: 'https://shop.example.com/cap', status: 'limited', displayOrder: 3 });
        await storage.createBroadcastProduct({ broadcastId, name: 'Fan Pack Bundle', subtitle: 'Jersey + Scarf + Cap', price: '129.99', originalPrice: '199.99', imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=400', buyUrl: 'https://shop.example.com/bundle', status: 'available', displayOrder: 4 });
      }

      if (existingChat.length === 0) {
        const chatData = [
          { username: 'carlos_fan', message: '¡Qué partido más increíble! 🔥' },
          { username: 'maria_sports', message: 'Best broadcast I\'ve seen this season!' },
          { username: 'javi_2024', message: 'The poll results are insane, did not see that coming' },
          { username: 'ana_vio', message: 'Love the shoppable products feature 🛍️' },
          { username: 'pedro_lv', message: 'Can\'t believe how smooth the stream is' },
          { username: 'lucia_mx', message: 'voted in the poll! Hope my team wins 🏆' },
          { username: 'rafael_it', message: 'Amazing production quality' },
          { username: 'sofia_br', message: 'Just bought the jersey!! So excited 😍' },
        ];
        for (const msg of chatData) {
          await storage.createChatMessage({ broadcastId, ...msg });
        }
      }

      res.json({ message: 'Demo data seeded successfully', broadcastId });
    } catch (error) {
      console.error('Error seeding demo data:', error);
      res.status(500).json({ message: 'Error seeding demo data' });
    }
  });

  app.get('/api/polls/:pollId/results', async (req, res) => {
    try {
      const pollId = parseInt(req.params.pollId);
      const results = await storage.getPollResults(pollId);
      if (!results) {
        return res.status(404).json({ message: 'Poll not found' });
      }
      const totalVotes = results.poll.totalVotes;
      const optionsWithPercentages = results.options.map(opt => ({
        ...opt,
        percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 10000) / 100 : 0
      }));
      res.json({ ...results.poll, options: optionsWithPercentages });
    } catch (error) {
      console.error('Error getting poll results:', error);
      res.status(500).json({ message: 'Error getting poll results' });
    }
  });

  // ========================================
  // SDK Endpoints (v1)
  // ========================================

  // Middleware to validate API key for SDK requests
  const validateApiKey = async (req: Request, res: any, next: any) => {
    try {
      const apiKey = req.query.apiKey as string || req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        return res.status(401).json({ message: 'API key required' });
      }

      const clientApp = await storage.getClientAppByApiKey(apiKey);
      
      if (!clientApp) {
        return res.status(401).json({ message: 'Invalid API key' });
      }

      // Attach client app context to request for use in route handlers
      (req as any).clientApp = clientApp;
      next();
    } catch (error) {
      console.error('Error validating API key:', error);
      res.status(500).json({ message: 'Error validating API key' });
    }
  };

  // GET /v1/sdk/campaigns - Auto-Discovery endpoint
  // Discovers all active campaigns using API key or Bundle ID
  app.get('/v1/sdk/campaigns', async (req, res) => {
    try {
      // Priority 1: Identification by X-App-Bundle-ID header
      const bundleId = req.headers['x-app-bundle-id'] as string;
      // Priority 2: API key in query parameter (backward compatibility)
      const apiKey = req.query.apiKey as string || req.headers['x-api-key'] as string;
      
      let clientApp;
      
      if (bundleId) {
        clientApp = await storage.getClientAppByBundleId(bundleId);
        if (!clientApp) {
          return res.status(401).json({ message: 'Bundle ID not found' });
        }
      } else if (apiKey) {
        clientApp = await storage.getClientAppByApiKey(apiKey);
        if (!clientApp) {
          return res.status(401).json({ message: 'Invalid API key' });
        }
      } else {
        return res.status(401).json({ message: 'API key or X-App-Bundle-ID header required' });
      }

      const matchIdFilter = req.query.matchId as string | undefined;
      const now = new Date();

      // Get all campaigns for this client app directly (channel is now campaign-level metadata)
      const clientAppCampaigns = await storage.getClientAppCampaigns(clientApp.id);
      const allCampaigns: any[] = [];

      for (const campaign of clientAppCampaigns) {
        // Filter by matchId if provided
        if (matchIdFilter && campaign.matchId !== matchIdFilter) {
          continue;
        }

        // Check if campaign is active
        const isPaused = campaign.isPaused === 'true';
        const startDate = campaign.startDate ? new Date(campaign.startDate) : null;
        const endDate = campaign.endDate ? new Date(campaign.endDate) : null;
        
        const isWithinDates = (!startDate || startDate <= now) && (!endDate || endDate >= now);
        const isActive = !isPaused && isWithinDates;

        if (!isActive) {
          continue;
        }

        // Get active components for this campaign
        const components = await storage.getCampaignComponents(campaign.id);
        const activeComponents = components
          .filter(c => c.status === 'active')
          .map(cc => {
            const component: any = {
              id: cc.componentId,
              type: cc.component.type,
              name: cc.instanceName || cc.component.name,
              config: normalizeUrls(cc.customConfig || cc.component.config, req.protocol, req.get('host')),
              status: cc.status
            };

            // Include matchContext if component has matchId
            if (cc.matchId) {
              component.matchContext = {
                matchId: cc.matchId
              };
            }

            return component;
          });

        const campaignData: any = {
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignLogo: campaign.logo ? toAbsoluteUrl(campaign.logo, req) : null,
          isActive: true,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          isPaused: isPaused,
          components: activeComponents
        };

        // Include matchContext if campaign has matchId
        if (campaign.matchId) {
          campaignData.matchContext = {
            matchId: campaign.matchId,
            matchName: campaign.matchName || null,
            startTime: campaign.matchStartTime ? campaign.matchStartTime.toISOString() : null,
            channelId: campaign.channelId
          };
        }

        allCampaigns.push(campaignData);
      }

      // Sort by startDate (most recent first)
      allCampaigns.sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });

      res.json({ campaigns: allCampaigns });
    } catch (error) {
      console.error('Error fetching SDK campaigns:', error);
      res.status(500).json({ message: 'Error fetching SDK campaigns' });
    }
  });

  // GET /v1/sdk/broadcast - Validate contentId and get broadcast engagement data
  // SDK calls this when a user opens a specific stream/content
  app.get('/v1/sdk/broadcast', async (req, res) => {
    try {
      const bundleId = req.headers['x-app-bundle-id'] as string;
      const apiKey = req.query.apiKey as string || req.headers['x-api-key'] as string;
      const contentId = req.query.contentId as string | undefined;
      const country = req.query.country as string | undefined;

      if (!contentId) {
        return res.status(400).json({ message: 'contentId query parameter is required' });
      }

      let clientApp;
      if (bundleId) {
        clientApp = await storage.getClientAppByBundleId(bundleId);
        if (!clientApp) return res.status(401).json({ message: 'Bundle ID not found' });
      } else if (apiKey) {
        clientApp = await storage.getClientAppByApiKey(apiKey);
        if (!clientApp) return res.status(401).json({ message: 'Invalid API key' });
      } else {
        return res.status(401).json({ message: 'API key or X-App-Bundle-ID header required' });
      }

      const broadcast = await storage.getBroadcastByExternalId(contentId, clientApp.id);

      if (!broadcast) {
        res.set('Cache-Control', 'public, max-age=30');
        return res.json({ hasEngagement: false });
      }

      if (!broadcast.campaignId) {
        res.set('Cache-Control', 'public, max-age=30');
        return res.json({ hasEngagement: false });
      }

      const campaign = await storage.getCampaign(broadcast.campaignId);
      if (!campaign) {
        res.set('Cache-Control', 'public, max-age=30');
        return res.json({ hasEngagement: false });
      }

      // Check if campaign is active
      const now = new Date();
      const isPaused = campaign.isPaused === 'true';
      const startDate = campaign.startDate ? new Date(campaign.startDate) : null;
      const endDate = campaign.endDate ? new Date(campaign.endDate) : null;
      const isWithinDates = (!startDate || startDate <= now) && (!endDate || endDate >= now);

      if (isPaused || !isWithinDates) {
        res.set('Cache-Control', 'public, max-age=30');
        return res.json({ hasEngagement: false });
      }

      // Filter by country if provided
      if (country && campaign.targetCountries && campaign.targetCountries.length > 0) {
        if (!campaign.targetCountries.includes(country)) {
          res.set('Cache-Control', 'public, max-age=30');
          return res.json({ hasEngagement: false });
        }
      }

      // Get campaign-level active components
      const components = await storage.getCampaignComponents(broadcast.campaignId);
      const campaignComponents = components
        .filter(c => c.status === 'active')
        .map(cc => ({
          id: cc.componentId,
          type: cc.component.type,
          name: cc.instanceName || cc.component.name,
          config: normalizeUrls(cc.customConfig || cc.component.config, req.protocol, req.get('host')),
          status: cc.status
        }));

      // Get broadcast-level components (polls, contests)
      const [pollsList, contestsList] = await Promise.all([
        storage.getBroadcastPolls(broadcast.broadcastId),
        storage.getBroadcastContests(broadcast.broadcastId)
      ]);

      const activePolls = pollsList.filter(p => p.isActive);
      const activeContests = contestsList.filter(c => c.isActive);

      const responseData: any = {
        hasEngagement: true,
        broadcastId: broadcast.broadcastId,
        broadcastName: broadcast.broadcastName,
        status: broadcast.status,
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignLogo: campaign.logo ? toAbsoluteUrl(campaign.logo, req) : null,
        websocketChannel: `/ws/${campaign.id}`,
        campaignComponents,
        broadcastComponents: {
          chat: { enabled: true },
          polls: activePolls.map(p => ({
            id: p.id,
            question: p.question,
            isActive: p.isActive,
            duration: p.duration,
            options: p.options.map(o => ({ id: o.id, text: o.text }))
          })),
          contests: activeContests.map(c => ({
            id: c.id,
            title: c.title,
            prize: c.prize,
            isActive: c.isActive,
            endTime: c.endTime
          }))
        }
      };

      res.set('Cache-Control', 'private, max-age=10');
      res.set('ETag', `"${broadcast.broadcastId}-${broadcast.status}"`);
      res.json(responseData);
    } catch (error) {
      console.error('Error fetching SDK broadcast:', error);
      res.status(500).json({ message: 'Error fetching SDK broadcast' });
    }
  });

  // GET /v1/sdk/config - Get dynamic SDK configuration
  app.get('/v1/sdk/config', validateApiKey, async (req, res) => {
    try {
      const clientApp = (req as any).clientApp;
      const campaignIdParam = req.query.campaignId as string | undefined;
      
      // Require campaignId for proper campaign-level scoping
      if (!campaignIdParam) {
        return res.status(400).json({ 
          message: 'campaignId query parameter is required'
        });
      }
      
      const requestedCampaignId = parseInt(campaignIdParam);
      if (isNaN(requestedCampaignId)) {
        return res.status(400).json({ message: 'Invalid campaignId parameter' });
      }
      
      // Get the campaign
      const campaign = await storage.getCampaign(requestedCampaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Resolve channel if campaign has one (optional — channel is now campaign-level metadata)
      const channel = campaign.channelId ? await storage.getChannel(campaign.channelId) : null;

      // Verify campaign belongs to this client app (directly or via legacy channel association)
      const belongsByClientApp = campaign.clientAppId === clientApp.id;
      const belongsByChannel = channel && channel.clientAppId === clientApp.id;
      if (!belongsByClientApp && !belongsByChannel) {
        return res.status(403).json({ message: 'Campaign does not belong to this API key' });
      }

      const dynamicConfig = (channel?.dynamicConfig as any) || {};

      const config: any = {
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignLogo: campaign.logo ? toAbsoluteUrl(campaign.logo, req) : null,
        channelId: channel?.id ?? null,
        channelName: channel?.name ?? null,
        environment: dynamicConfig.environment || 'production',
        campaigns: {
          webSocketBaseURL: dynamicConfig.webSocketBaseURL || `${req.protocol}://${req.get('host')}`,
          restAPIBaseURL: dynamicConfig.restAPIBaseURL || `${req.protocol}://${req.get('host')}`
        },
        marketFallback: dynamicConfig.marketFallback || {
          countryCode: 'US',
          currencyCode: 'USD',
          currencySymbol: '$',
          phoneCode: '+1'
        },
        features: dynamicConfig.features || {
          enableWebSocket: true,
          enableGuestCheckout: true
        }
      };

      // Include matchContext if campaign is associated with a match
      if (campaign.matchId) {
        config.matchContext = {
          matchId: campaign.matchId,
          matchName: campaign.matchName || null,
          startTime: campaign.matchStartTime ? campaign.matchStartTime.toISOString() : null,
          channelId: campaign.channelId,
          metadata: {}
        };
      }

      // Include sponsor branding if campaign has a sponsor
      if (campaign.sponsorId) {
        const sponsor = await storage.getSponsor(campaign.sponsorId);
        if (sponsor) {
          config.sponsor = {
            id: sponsor.id,
            name: sponsor.name,
            logoUrl: sponsor.logoUrl ? toAbsoluteUrl(sponsor.logoUrl, req) : null,
            avatarUrl: sponsor.avatarUrl ? toAbsoluteUrl(sponsor.avatarUrl, req) : null,
            primaryColor: sponsor.primaryColor || null,
            secondaryColor: sponsor.secondaryColor || null,
          };
        }
      }

      res.json(config);
    } catch (error) {
      console.error('Error fetching SDK config:', error);
      res.status(500).json({ message: 'Error fetching SDK config' });
    }
  });

  // GET /v1/campaigns/:campaignId/config - Complete dynamic campaign configuration
  app.get('/v1/campaigns/:campaignId/config', validateApiKey, async (req, res) => {
    try {
      const clientApp = (req as any).clientApp;
      const campaignId = parseInt(req.params.campaignId);
      const matchId = req.query.matchId as string | undefined;
      
      if (isNaN(campaignId)) {
        return res.status(400).json({ 
          error: 'Invalid campaignId',
          code: 'INVALID_PARAMETERS'
        });
      }
      
      // Get full campaign config
      const fullConfig = await storage.getFullCampaignConfig(campaignId);
      
      if (!fullConfig) {
        return res.status(404).json({ 
          error: 'Campaign not found',
          code: 'CAMPAIGN_NOT_FOUND'
        });
      }
      
      const { campaign, translations, engagementConfig, uiConfig, featureFlags } = fullConfig;
      
      // Verify campaign belongs to this client app — direct match or via channel (legacy)
      const directMatch = campaign.clientAppId === clientApp.id;
      let channelMatch = false;
      let channel = null;
      if (campaign.channelId) {
        channel = await storage.getChannel(campaign.channelId);
        channelMatch = !!(channel && channel.clientAppId === clientApp.id);
      }
      if (!directMatch && !channelMatch) {
        return res.status(403).json({ 
          error: 'Campaign does not belong to this API key',
          code: 'FORBIDDEN'
        });
      }
      
      // Build sponsorBadgeText from translations
      const sponsorBadgeText: Record<string, string> = {};
      const defaultSponsorBadgeText: Record<string, string> = {
        'no': 'Sponset av',
        'en': 'Sponsored by',
        'sv': 'Sponsrad av'
      };
      
      for (const t of translations) {
        if (t.sponsorBadgeText) {
          sponsorBadgeText[t.languageCode] = t.sponsorBadgeText;
        }
      }
      
      // Merge with defaults
      const finalSponsorBadgeText = { ...defaultSponsorBadgeText, ...sponsorBadgeText };

      // Resolve sponsor for brand data (sponsor takes priority over campaign brand fields)
      const sponsor = campaign.sponsorId ? await storage.getSponsor(campaign.sponsorId) : null;

      // Build response with defaults for missing configs
      const config = {
        campaignId: campaign.id,
        version: '1.0.0',
        brand: {
          name: sponsor?.name || campaign.brandName || campaign.name || 'Vio',
          iconAsset: campaign.brandIconAsset || 'avatar_default',
          iconUrl: (sponsor?.avatarUrl ? toAbsoluteUrl(sponsor.avatarUrl, req) : null) || (campaign.brandIconUrl ? toAbsoluteUrl(campaign.brandIconUrl, req) : null),
          logoUrl: (sponsor?.logoUrl ? toAbsoluteUrl(sponsor.logoUrl, req) : null) || (campaign.brandLogoUrl ? toAbsoluteUrl(campaign.brandLogoUrl, req) : null),
          sponsorBadgeText: finalSponsorBadgeText
        },
        engagement: {
          demoMode: engagementConfig?.demoMode === 'true' || false,
          defaultPollDuration: engagementConfig?.defaultPollDuration ?? 300,
          defaultContestDuration: engagementConfig?.defaultContestDuration ?? 600,
          maxVotesPerPoll: engagementConfig?.maxVotesPerPoll ?? 1,
          maxContestsPerMatch: engagementConfig?.maxContestsPerMatch ?? 10,
          enableRealTimeUpdates: engagementConfig?.enableRealTimeUpdates !== 'false',
          updateInterval: engagementConfig?.updateInterval ?? 1000
        },
        ui: {
          theme: {
            primaryColor: uiConfig?.primaryColor || '#007AFF',
            secondaryColor: uiConfig?.secondaryColor || '#5856D6'
          },
          components: uiConfig?.componentConfigs || {}
        },
        features: {
          enableLiveStreaming: featureFlags?.enableLiveStreaming !== 'false',
          enableProductCatalog: featureFlags?.enableProductCatalog !== 'false',
          enableEngagement: featureFlags?.enableEngagement !== 'false',
          enablePolls: featureFlags?.enablePolls !== 'false',
          enableContests: featureFlags?.enableContests !== 'false'
        },
        cache: {
          ttl: 300,
          version: '1.0.0'
        }
      } as any;

      // Include sponsor branding if campaign has a sponsor (already fetched above)
      if (sponsor) {
        config.sponsor = {
          id: sponsor.id,
          name: sponsor.name,
          logoUrl: sponsor.logoUrl ? toAbsoluteUrl(sponsor.logoUrl, req) : null,
          avatarUrl: sponsor.avatarUrl ? toAbsoluteUrl(sponsor.avatarUrl, req) : null,
          primaryColor: sponsor.primaryColor || null,
          secondaryColor: sponsor.secondaryColor || null,
        };
      }
      
      res.set('Cache-Control', 'public, max-age=300');
      res.json(config);
    } catch (error) {
      console.error('Error fetching campaign config:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // GET /v1/engagement/config - Engagement configuration for a match
  app.get('/v1/engagement/config', validateApiKey, async (req, res) => {
    try {
      const matchId = req.query.matchId as string | undefined;
      
      if (!matchId) {
        return res.status(400).json({ 
          error: 'Missing required parameter: matchId',
          code: 'MISSING_PARAMETER'
        });
      }
      
      // Find campaigns associated with this matchId
      const allCampaigns = await storage.getAllCampaigns();
      const matchCampaign = allCampaigns.find(c => c.matchId === matchId);
      
      if (!matchCampaign) {
        return res.status(404).json({ 
          error: 'Engagement config not found for matchId',
          code: 'CONFIG_NOT_FOUND'
        });
      }
      
      // Get engagement config for this campaign
      const engagementConfig = await storage.getCampaignEngagementConfig(matchCampaign.id);
      
      const config = {
        matchId,
        engagement: {
          demoMode: engagementConfig?.demoMode === 'true' || false,
          defaultPollDuration: engagementConfig?.defaultPollDuration ?? 300,
          defaultContestDuration: engagementConfig?.defaultContestDuration ?? 600,
          maxVotesPerPoll: engagementConfig?.maxVotesPerPoll ?? 1,
          enableRealTimeUpdates: engagementConfig?.enableRealTimeUpdates !== 'false'
        },
        cache: {
          ttl: 300
        }
      };
      
      res.set('Cache-Control', 'public, max-age=300');
      res.json(config);
    } catch (error) {
      console.error('Error fetching engagement config:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // GET /v1/localization/:language - Localized strings
  app.get('/v1/localization/:language', validateApiKey, async (req, res) => {
    try {
      const language = req.params.language;
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      const matchId = req.query.matchId as string | undefined;
      
      const supportedLanguages = ['no', 'en', 'sv', 'es', 'de', 'fr', 'da', 'fi'];
      if (!supportedLanguages.includes(language)) {
        return res.status(400).json({ 
          error: 'Invalid language code',
          code: 'INVALID_LANGUAGE'
        });
      }
      
      // Get translations with priority: match > campaign > global
      const translations = await storage.getSdkTranslations(language, campaignId, matchId);
      
      // Default translations
      const defaultTranslations: Record<string, Record<string, string>> = {
        'no': {
          sponsorBadge: 'Sponset av',
          voteButton: 'Stem',
          participateButton: 'Delta',
          pollClosed: 'Avstemningen er stengt',
          alreadyVoted: 'Du har allerede stemt',
          contestEnded: 'Konkurransen er avsluttet'
        },
        'en': {
          sponsorBadge: 'Sponsored by',
          voteButton: 'Vote',
          participateButton: 'Participate',
          pollClosed: 'Poll is closed',
          alreadyVoted: 'You have already voted',
          contestEnded: 'Contest has ended'
        },
        'sv': {
          sponsorBadge: 'Sponsrad av',
          voteButton: 'Rösta',
          participateButton: 'Delta',
          pollClosed: 'Omröstningen är stängd',
          alreadyVoted: 'Du har redan röstat',
          contestEnded: 'Tävlingen har avslutats'
        }
      };
      
      // Build translations object
      const translationsObj: Record<string, string> = { ...(defaultTranslations[language] || defaultTranslations['en']) };
      
      for (const t of translations) {
        translationsObj[t.translationKey] = t.translationValue;
      }
      
      const dateFormats: Record<string, string> = {
        'no': 'dd.MM.yyyy',
        'en': 'MM/dd/yyyy',
        'sv': 'yyyy-MM-dd'
      };
      
      const timeFormats: Record<string, string> = {
        'no': 'HH:mm',
        'en': 'h:mm a',
        'sv': 'HH:mm'
      };
      
      const response = {
        language,
        campaignId: campaignId || null,
        translations: translationsObj,
        dateFormat: translations[0]?.dateFormat || dateFormats[language] || 'dd.MM.yyyy',
        timeFormat: translations[0]?.timeFormat || timeFormats[language] || 'HH:mm',
        cache: {
          ttl: 3600
        }
      };
      
      res.set('Cache-Control', 'public, max-age=3600');
      res.json(response);
    } catch (error) {
      console.error('Error fetching localization:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // GET /v1/offers - Get offers/products for a placement
  app.get('/v1/offers', validateApiKey, async (req, res) => {
    try {
      const clientApp = (req as any).clientApp;
      const placement = req.query.placement as string;
      const campaignIdParam = req.query.campaignId as string | undefined;
      const userId = req.query.userId as string | undefined;
      const userCountry = req.query.userCountry as string | undefined;
      
      // Require campaignId for proper campaign-level scoping
      if (!campaignIdParam) {
        return res.status(400).json({ 
          message: 'campaignId query parameter is required'
        });
      }
      
      const requestedCampaignId = parseInt(campaignIdParam);
      if (isNaN(requestedCampaignId)) {
        return res.status(400).json({ message: 'Invalid campaignId parameter' });
      }
      
      // Get the campaign
      const campaign = await storage.getCampaign(requestedCampaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Verify campaign belongs to this client app — direct match or via channel (legacy)
      const directMatch = campaign.clientAppId === clientApp.id;
      let channelMatch = false;
      let channel = null;
      if (campaign.channelId) {
        channel = await storage.getChannel(campaign.channelId);
        channelMatch = !!(channel && channel.clientAppId === clientApp.id);
      }
      if (!directMatch && !channelMatch) {
        return res.status(403).json({ message: 'Campaign does not belong to this API key' });
      }

      // Check segmentation eligibility
      if (!isUserEligibleForCampaign(
        userId,
        userCountry,
        campaign.id,
        campaign.isSegmented,
        campaign.targetCountries,
        campaign.targetPercentage
      )) {
        // User is not eligible - return empty offers
        return res.json({
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignLogo: campaign.logo ? toAbsoluteUrl(campaign.logo, req) : null,
          channelId: channel?.id || null,
          channelName: channel?.name || null,
          offers: []
        });
      }

      // Check if campaign is active
      if (!isCampaignActive(campaign)) {
        return res.json({ 
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignLogo: campaign.logo ? toAbsoluteUrl(campaign.logo, req) : null,
          channelId: channel?.id || null,
          channelName: channel?.name || null,
          offers: [] 
        });
      }

      // Get active components for this campaign
      const components = await storage.getCampaignComponents(campaign.id);
      const activeComponents = components.filter(c => c.status === 'active');

      // Transform components to offers format with optional matchContext
      const offers = activeComponents.map(cc => {
        const offer: any = {
          id: cc.componentId,
          type: cc.component.type,
          name: cc.instanceName || cc.component.name,
          config: normalizeUrls(cc.customConfig || cc.component.config, req.protocol, req.get('host')),
          placement: placement || 'default'
        };

        // Include matchContext if component is associated with a specific match
        if (cc.matchId) {
          offer.matchContext = {
            matchId: cc.matchId,
            matchName: campaign.matchName || null,
            startTime: campaign.matchStartTime ? campaign.matchStartTime.toISOString() : null,
            channelId: campaign.channelId
          };
        }

        return offer;
      });

      const response: any = {
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignLogo: campaign.logo ? toAbsoluteUrl(campaign.logo, req) : null,
        channelId: channel?.id || null,
        channelName: channel?.name || null,
        offers
      };

      // Include campaign-level matchContext if available
      if (campaign.matchId) {
        response.matchContext = {
          matchId: campaign.matchId,
          matchName: campaign.matchName || null,
          startTime: campaign.matchStartTime ? campaign.matchStartTime.toISOString() : null,
          channelId: campaign.channelId,
          metadata: {}
        };
      }

      res.json(response);
    } catch (error) {
      console.error('Error fetching offers:', error);
      res.status(500).json({ message: 'Error fetching offers' });
    }
  });

  return httpServer;
}
