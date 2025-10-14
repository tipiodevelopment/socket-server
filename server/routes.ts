import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { webSocketEventSchema, type WebSocketEvent } from "@shared/schema";
import { randomUUID } from "crypto";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";

// Helper function to convert relative paths to absolute URLs
function toAbsoluteUrl(pathOrUrl: string | undefined, req: Request): string | undefined {
  if (!pathOrUrl) return undefined;
  
  // If already a full URL, return as is
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  
  // Convert relative path to absolute URL
  const protocol = req.protocol || 'https';
  const host = req.get('host') || 'localhost:5000';
  return `${protocol}://${host}${pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Create WebSocket server with noServer mode for custom path handling
  const wss = new WebSocketServer({ noServer: true });

  // Store connected clients organized by campaign ID
  const campaignClients = new Map<number, Set<WebSocket>>();
  
  // Store campaign ID for each WebSocket
  const clientCampaigns = new WeakMap<WebSocket, number>();

  // Handle WebSocket upgrade requests
  httpServer.on('upgrade', (request, socket, head) => {
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
  });

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocket, request: any, campaignId: number) => {
    // Add client to campaign room
    if (!campaignClients.has(campaignId)) {
      campaignClients.set(campaignId, new Set());
    }
    campaignClients.get(campaignId)!.add(ws);
    storage.incrementClientsCount();
    
    console.log(`Client connected to campaign ${campaignId}. Total clients: ${storage.getConnectedClientsCount()}`);

    // Send current client count to all clients in this campaign
    broadcastClientCountToCampaign(campaignId);

    ws.on('close', () => {
      const clients = campaignClients.get(campaignId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          campaignClients.delete(campaignId);
        }
      }
      storage.decrementClientsCount();
      console.log(`Client disconnected from campaign ${campaignId}. Total clients: ${storage.getConnectedClientsCount()}`);
      broadcastClientCountToCampaign(campaignId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      const clients = campaignClients.get(campaignId);
      if (clients) {
        clients.delete(ws);
      }
      storage.decrementClientsCount();
    });
  });

  // Function to broadcast to clients in a specific campaign
  function broadcastToCampaign(campaignId: number, message: string) {
    const clients = campaignClients.get(campaignId);
    if (clients) {
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  // Function to broadcast client count to a specific campaign
  function broadcastClientCountToCampaign(campaignId: number) {
    const clients = campaignClients.get(campaignId);
    const count = clients ? clients.size : 0;
    const countMessage = JSON.stringify({
      type: 'client_count',
      data: { count },
      timestamp: Date.now()
    });
    broadcastToCampaign(campaignId, countMessage);
  }
  
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

  // Function to broadcast client count to all campaigns
  function broadcastClientCount() {
    campaignClients.forEach((clients, campaignId) => {
      broadcastClientCountToCampaign(campaignId);
    });
  }

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
          timestamp: new Date(dbEvent.createdAt).getTime()
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

  // Get connection status
  app.get('/api/status', (req, res) => {
    res.json({
      server: 'running',
      connectedClients: storage.getConnectedClientsCount(),
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
          imageUrl: req.body.imageUrl
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
        broadcastToCampaign(campaignId, JSON.stringify(productEvent));
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
        broadcastToCampaign(campaignId, JSON.stringify(pollEvent));
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
        broadcastToCampaign(campaignId, JSON.stringify(contestEvent));
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

  // Campaign CRUD endpoints
  
  // Create campaign
  app.post('/api/campaigns', async (req, res) => {
    try {
      const campaign = await storage.createCampaign(req.body);
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
      const campaign = await storage.updateCampaign(parseInt(req.params.id), req.body);
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

  return httpServer;
}
