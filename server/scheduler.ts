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
  updateBroadcastStatuses();

  // Then run on interval
  schedulerInterval = setInterval(() => {
    checkScheduledComponents();
    updateBroadcastStatuses();
    // TODO: Descomentar cuando se implementen los campos de scheduling en la UI
    // processScheduledPolls();
    // processScheduledContests();
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

/**
 * Procesa polls programados para activar/desactivar automáticamente
 * TODO: Activar cuando se implementen los campos scheduledStartTime/scheduledEndTime en la UI
 */
async function processScheduledPolls() {
  // TODO: Implementar cuando se use scheduling por video timing
  // const now = new Date();
  //
  // const allBroadcasts = await storage.getAllBroadcasts({ status: 'live' });
  // for (const broadcast of allBroadcasts) {
  //   const polls = await storage.getPollsByBroadcast(broadcast.broadcastId);
  //   for (const poll of polls) {
  //     if (!poll.scheduledStartTime) continue;
  //
  //     const scheduledStart = new Date(poll.scheduledStartTime);
  //     const scheduledEnd = poll.scheduledEndTime ? new Date(poll.scheduledEndTime) : null;
  //
  //     // Activate polls that should start
  //     if (!poll.isActive && now >= scheduledStart && (!scheduledEnd || now < scheduledEnd)) {
  //       await storage.updatePoll(poll.id, { isActive: true });
  //       if (broadcast.campaignId) {
  //         broadcastToCampaign(broadcast.campaignId, JSON.stringify({
  //           type: 'poll_activated',
  //           pollId: poll.id,
  //           broadcastId: broadcast.broadcastId,
  //           timestamp: now.toISOString(),
  //         }));
  //       }
  //     }
  //
  //     // Deactivate polls that should end
  //     if (poll.isActive && scheduledEnd && now >= scheduledEnd) {
  //       await storage.updatePoll(poll.id, { isActive: false });
  //       if (broadcast.campaignId) {
  //         broadcastToCampaign(broadcast.campaignId, JSON.stringify({
  //           type: 'poll_deactivated',
  //           pollId: poll.id,
  //           broadcastId: broadcast.broadcastId,
  //           timestamp: now.toISOString(),
  //         }));
  //       }
  //     }
  //   }
  // }
}

/**
 * Procesa contests programados para activar/desactivar automáticamente
 * TODO: Activar cuando se implementen los campos scheduledStartTime/scheduledEndTime en la UI
 */
async function processScheduledContests() {
  // TODO: Implementar similar a processScheduledPolls
  // const now = new Date();
  //
  // const allBroadcasts = await storage.getAllBroadcasts({ status: 'live' });
  // for (const broadcast of allBroadcasts) {
  //   const contests = await storage.getContestsByBroadcast(broadcast.broadcastId);
  //   for (const contest of contests) {
  //     if (!contest.scheduledStartTime) continue;
  //
  //     const scheduledStart = new Date(contest.scheduledStartTime);
  //     const scheduledEnd = contest.scheduledEndTime ? new Date(contest.scheduledEndTime) : null;
  //
  //     if (!contest.isActive && now >= scheduledStart && (!scheduledEnd || now < scheduledEnd)) {
  //       await storage.updateContest(contest.id, { isActive: true });
  //       if (broadcast.campaignId) {
  //         broadcastToCampaign(broadcast.campaignId, JSON.stringify({
  //           type: 'contest_activated',
  //           contestId: contest.id,
  //           broadcastId: broadcast.broadcastId,
  //           timestamp: now.toISOString(),
  //         }));
  //       }
  //     }
  //
  //     if (contest.isActive && scheduledEnd && now >= scheduledEnd) {
  //       await storage.updateContest(contest.id, { isActive: false });
  //       if (broadcast.campaignId) {
  //         broadcastToCampaign(broadcast.campaignId, JSON.stringify({
  //           type: 'contest_deactivated',
  //           contestId: contest.id,
  //           broadcastId: broadcast.broadcastId,
  //           timestamp: now.toISOString(),
  //         }));
  //       }
  //     }
  //   }
  // }
}

async function updateBroadcastStatuses() {
  try {
    const now = new Date();
    
    const upcomingBroadcasts = await storage.getBroadcastsByStatus('upcoming');
    for (const broadcast of upcomingBroadcasts) {
      if (broadcast.startTime && now >= new Date(broadcast.startTime)) {
        const newStatus = broadcast.endTime && now >= new Date(broadcast.endTime) ? 'ended' : 'live';
        await storage.updateBroadcast(broadcast.broadcastId, { status: newStatus });
        console.log(`[Scheduler] Broadcast ${broadcast.broadcastId} status: upcoming -> ${newStatus}`);
        
        if (broadcast.campaignId) {
          broadcastToCampaign(broadcast.campaignId, JSON.stringify({
            type: 'broadcast_status_changed',
            broadcastId: broadcast.broadcastId,
            status: newStatus
          }));
        }
      }
    }

    const liveBroadcasts = await storage.getBroadcastsByStatus('live');
    for (const broadcast of liveBroadcasts) {
      if (broadcast.endTime && now >= new Date(broadcast.endTime)) {
        await storage.updateBroadcast(broadcast.broadcastId, { status: 'ended' });
        console.log(`[Scheduler] Broadcast ${broadcast.broadcastId} status: live -> ended`);
        
        if (broadcast.campaignId) {
          broadcastToCampaign(broadcast.campaignId, JSON.stringify({
            type: 'broadcast_status_changed',
            broadcastId: broadcast.broadcastId,
            status: 'ended'
          }));
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error updating broadcast statuses:', error);
  }
}
