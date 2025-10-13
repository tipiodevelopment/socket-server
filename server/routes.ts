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
  
  // Create WebSocket server on /ws path
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });

  // Store connected clients
  const clients = new Set<WebSocket>();

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    storage.incrementClientsCount();
    
    console.log(`Client connected. Total clients: ${storage.getConnectedClientsCount()}`);

    // Send current client count to all clients
    broadcastClientCount();

    ws.on('close', () => {
      clients.delete(ws);
      storage.decrementClientsCount();
      console.log(`Client disconnected. Total clients: ${storage.getConnectedClientsCount()}`);
      broadcastClientCount();
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
      storage.decrementClientsCount();
    });
  });

  // Function to broadcast to all connected clients
  function broadcast(message: string) {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Function to broadcast client count
  function broadcastClientCount() {
    const countMessage = JSON.stringify({
      type: 'client_count',
      data: { count: storage.getConnectedClientsCount() },
      timestamp: Date.now()
    });
    broadcast(countMessage);
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
      const pollEvent: WebSocketEvent = {
        type: 'poll',
        data: {
          id: `poll_${randomUUID()}`,
          question: req.body.question,
          options: req.body.options,
          duration: req.body.duration
        },
        campaignLogo: req.body.campaignLogo,
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

  return httpServer;
}
