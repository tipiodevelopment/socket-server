import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { webSocketEventSchema, type WebSocketEvent } from "@shared/schema";
import { randomUUID } from "crypto";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";

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
      const campaignId = parseInt(pathMatch[1], 10);
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        clientCampaigns.set(ws, campaignId);
        wss.emit('connection', ws, request, campaignId);
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
      const events = await storage.getRecentEvents();
      res.json(events);
    } catch (error) {
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
        campaignLogo: req.body.campaignLogo || undefined,
        timestamp: Date.now()
      };

      // Validate the event
      webSocketEventSchema.parse(productEvent);

      // Store the event
      await storage.addEvent(productEvent);

      // Broadcast to all connected clients
      broadcast(JSON.stringify(productEvent));

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
      // Process options: convert comma-separated string to array
      const options = typeof req.body.options === 'string' 
        ? req.body.options.split(',').map((opt: string) => opt.trim()).filter(Boolean)
        : req.body.options;

      // Process duration: convert to number
      const duration = typeof req.body.duration === 'string' 
        ? parseInt(req.body.duration, 10) 
        : req.body.duration;

      // Process imageUrl: convert relative path to absolute URL if needed
      let imageUrl = req.body.imageUrl || undefined;
      if (imageUrl && !imageUrl.startsWith('http')) {
        const protocol = req.protocol;
        const host = req.get('host');
        imageUrl = `${protocol}://${host}${imageUrl}`;
      }

      // Process campaignLogo: convert relative path to absolute URL if needed
      let campaignLogo = req.body.campaignLogo || undefined;
      if (campaignLogo && !campaignLogo.startsWith('http')) {
        const protocol = req.protocol;
        const host = req.get('host');
        campaignLogo = `${protocol}://${host}${campaignLogo}`;
      }

      const pollEvent: WebSocketEvent = {
        type: 'poll',
        data: {
          id: `poll_${randomUUID()}`,
          question: req.body.question,
          options,
          duration,
          imageUrl
        },
        campaignLogo,
        timestamp: Date.now()
      };

      // Validate the event
      webSocketEventSchema.parse(pollEvent);

      // Store the event
      await storage.addEvent(pollEvent);

      // Broadcast to all connected clients
      broadcast(JSON.stringify(pollEvent));

      res.json({ success: true, event: pollEvent });
    } catch (error) {
      console.error('Error sending poll event:', error);
      res.status(400).json({ message: 'Error sending poll event' });
    }
  });

  // Trigger contest event
  app.post('/api/events/contest', async (req, res) => {
    try {
      const contestEvent: WebSocketEvent = {
        type: 'contest',
        data: {
          id: `contest_${randomUUID()}`,
          name: req.body.name,
          prize: req.body.prize,
          deadline: req.body.deadline,
          maxParticipants: req.body.maxParticipants
        },
        campaignLogo: req.body.campaignLogo,
        timestamp: Date.now()
      };

      // Validate the event
      webSocketEventSchema.parse(contestEvent);

      // Store the event
      await storage.addEvent(contestEvent);

      // Broadcast to all connected clients
      broadcast(JSON.stringify(contestEvent));

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

  return httpServer;
}
