import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  webSocketEventSchema, 
  updateCampaignSchema,
  componentSDKNames,
  type WebSocketEvent, 
  type InsertScheduledComponent 
} from "@shared/schema";
import { randomUUID } from "crypto";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { isCampaignActive, hasCampaignEnded, isCampaignUpcoming, normalizeUrls } from "./utils";

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

// Export broadcastToCampaign function (will be set during registerRoutes)
export let broadcastToCampaign: (campaignId: number, message: string) => void = () => {
  console.warn('[WebSocket] broadcastToCampaign called before initialization');
};

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
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
  
  // Assign to exported variable
  broadcastToCampaign = broadcastToCampaignImpl;
  
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
            broadcastToCampaignImpl(campaign.id, JSON.stringify({
              type: 'campaign_started',
              campaignId: campaign.id,
              startDate: campaign.startDate,
              endDate: campaign.endDate
            }));
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

  // Campaign CRUD endpoints
  
  // Create campaign
  app.post('/api/campaigns', async (req, res) => {
    try {
      // Ensure there's a default user - use userId = 1
      // In a real app, this would come from authentication
      const campaignData = {
        ...req.body,
        userId: 1 // Default user ID for development
      };
      
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

  // Get all campaigns
  app.get('/api/campaigns', async (req, res) => {
    try {
      const campaigns = await storage.getAllCampaigns();
      res.json(campaigns);
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
      res.json(campaign);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      res.status(500).json({ message: 'Error fetching campaign' });
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
          broadcastToCampaignImpl(campaign.id, JSON.stringify({
            type: 'component_config_updated',
            campaignId: campaign.id,
            componentId: req.params.id,
            component: {
              id: component.id,
              type: component.type,
              name: component.name,
              config: normalizeUrls(updates.config || component.config, req.protocol, req.get('host')) // Normalize URLs to absolute
            }
          }));
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
        
        // Broadcast status change via WebSocket with complete component data
        broadcastToCampaignImpl(campaignId, JSON.stringify({
          type: 'component_status_changed',
          campaignId,
          componentId,
          status,
          component: fullComponent ? {
            id: fullComponent.id,
            type: fullComponent.type,
            name: fullComponent.name,
            // Use campaign-specific customConfig if available, otherwise use component's default config
            config: normalizeUrls(updated.customConfig || fullComponent.config, req.protocol, req.get('host'))
          } : null
        }));
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
        // Use customConfig if set, otherwise fall back to component's default config
        const effectiveConfig = updated.customConfig || fullComponent?.config;
        
        broadcastToCampaignImpl(campaignId, JSON.stringify({
          type: 'component_config_updated',
          campaignId,
          componentId,
          component: fullComponent ? {
            id: fullComponent.id,
            type: fullComponent.type,
            name: fullComponent.name,
            config: normalizeUrls(effectiveConfig, req.protocol, req.get('host'))
          } : null
        }));
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

  return httpServer;
}
