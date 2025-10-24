import { storage } from "./storage";
import { isCampaignActive, normalizeUrls } from "./utils";
import { broadcastToCampaign } from "./routes";

// Configurable interval in minutes (default: 1 minute)
const SCHEDULER_INTERVAL_MINUTES = parseInt(process.env.SCHEDULER_INTERVAL_MINUTES || '1', 10);

let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (schedulerInterval) {
    console.log('[Scheduler] Already running');
    return;
  }

  const intervalMs = SCHEDULER_INTERVAL_MINUTES * 60 * 1000;
  console.log(`[Scheduler] Starting with interval of ${SCHEDULER_INTERVAL_MINUTES} minute(s)`);

  // Run immediately on startup
  checkScheduledComponents();

  // Then run on interval
  schedulerInterval = setInterval(() => {
    checkScheduledComponents();
  }, intervalMs);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Stopped');
  }
}

async function checkScheduledComponents() {
  try {
    const now = new Date();
    console.log(`[Scheduler] Checking scheduled components at ${now.toISOString()}`);

    // Get all campaigns
    const campaigns = await storage.getAllCampaigns();

    for (const campaign of campaigns) {
      // Skip inactive campaigns
      if (!isCampaignActive(campaign)) {
        continue;
      }

      // Get all campaign components (including those with scheduling)
      const components = await storage.getCampaignComponents(campaign.id);

      for (const cc of components) {
        // Skip if no scheduling defined
        if (!cc.scheduledTime) {
          continue;
        }

        const scheduledTime = new Date(cc.scheduledTime);
        const endTime = cc.endTime ? new Date(cc.endTime) : null;

        // Check if component should be activated
        if (cc.status === 'inactive' && now >= scheduledTime) {
          // If there's an end time and we're past it, don't activate
          if (endTime && now >= endTime) {
            continue;
          }

          console.log(`[Scheduler] Activating component ${cc.component.name} (${cc.component.type}) in campaign ${campaign.id}`);
          
          // Activate the component
          const updated = await storage.updateCampaignComponentStatus(campaign.id, cc.componentId, 'active');
          
          if (updated) {
            // Broadcast activation via WebSocket
            broadcastToCampaign(campaign.id, JSON.stringify({
              type: 'component_status_changed',
              campaignId: campaign.id,
              componentId: cc.componentId,
              status: 'active',
              component: {
                id: cc.component.id,
                type: cc.component.type,
                name: cc.component.name,
                config: normalizeUrls(cc.customConfig || cc.component.config)
              }
            }));
          }
        }

        // Check if component should be deactivated
        if (cc.status === 'active' && endTime && now >= endTime) {
          console.log(`[Scheduler] Deactivating component ${cc.component.name} (${cc.component.type}) in campaign ${campaign.id}`);
          
          // Deactivate the component
          const updated = await storage.updateCampaignComponentStatus(campaign.id, cc.componentId, 'inactive');
          
          if (updated) {
            // Broadcast deactivation via WebSocket
            broadcastToCampaign(campaign.id, JSON.stringify({
              type: 'component_status_changed',
              campaignId: campaign.id,
              componentId: cc.componentId,
              status: 'inactive',
              component: {
                id: cc.component.id,
                type: cc.component.type,
                name: cc.component.name,
                config: normalizeUrls(cc.customConfig || cc.component.config)
              }
            }));
          }
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error checking scheduled components:', error);
  }
}
