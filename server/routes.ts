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
    
    console.log(`Client connected to campaign ${campaignId}`);

    ws.on('close', () => {
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
      console.error('WebSocket error:', error);
      const clients = campaignClients.get(campaignId);
      if (clients) {
        clients.delete(ws);
      }
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

  // Scheduled Components Routes
  
  // Get scheduled components for a campaign
  app.get('/api/campaigns/:id/scheduled-components', async (req, res) => {
    try {
      const components = await storage.getCampaignScheduledComponents(parseInt(req.params.id));
      res.json(components);
    } catch (error) {
      console.error('Error fetching scheduled components:', error);
      res.status(500).json({ message: 'Error fetching scheduled components' });
    }
  });

  // Create scheduled component
  app.post('/api/campaigns/:id/scheduled-components', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { type, scheduledTime, data } = req.body;

      if (!type || !scheduledTime || !data) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const component = await storage.createScheduledComponent({
        campaignId,
        type,
        scheduledTime: new Date(scheduledTime),
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
        const campaignComponents = await storage.getCampaignComponents(campaign.id);
        const isUsed = campaignComponents.some(cc => cc.componentId === req.params.id);
        
        if (isUsed) {
          broadcastToCampaign(campaign.id, JSON.stringify({
            type: 'component_config_updated',
            campaignId: campaign.id,
            componentId: req.params.id,
            config: updates.config || component.config
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

  // Add component to campaign
  app.post('/api/campaigns/:id/components', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { componentId, status } = req.body;
      
      if (!componentId) {
        return res.status(400).json({ message: 'Missing required field: componentId' });
      }

      // Validate component availability if status is active
      if (status === 'active') {
        const availability = await storage.validateComponentAvailability(componentId, campaignId);
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

      // Validate component availability if activating
      if (status === 'active') {
        const availability = await storage.validateComponentAvailability(componentId, campaignId);
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

      // Broadcast status change via WebSocket
      broadcastToCampaign(campaignId, JSON.stringify({
        type: 'component_status_changed',
        campaignId,
        componentId,
        status
      }));
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating campaign component status:', error);
      res.status(500).json({ message: 'Error updating campaign component status' });
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
      
      const availability = await storage.validateComponentAvailability(componentId, campaignId);
      res.json(availability);
    } catch (error) {
      console.error('Error validating component availability:', error);
      res.status(500).json({ message: 'Error validating component availability' });
    }
  });

  return httpServer;
}
