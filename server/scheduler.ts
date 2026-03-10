import { storage } from "./storage";
import { isCampaignActive, normalizeUrls } from "./utils";
import { broadcastToCampaign, lineupSentMap } from "./routes";

const SCHEDULER_INTERVAL_MINUTES = parseInt(process.env.SCHEDULER_INTERVAL_MINUTES || '1', 10);

let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (schedulerInterval) {
    console.log('[Scheduler] Already running');
    return;
  }

  const intervalMs = SCHEDULER_INTERVAL_MINUTES * 60 * 1000;
  console.log(`[Scheduler] Starting with interval of ${SCHEDULER_INTERVAL_MINUTES} minute(s)`);

  checkScheduledComponents();
  updateBroadcastStatuses();
  processScheduledPolls();
  processScheduledContests();

  schedulerInterval = setInterval(() => {
    checkScheduledComponents();
    updateBroadcastStatuses();
    processScheduledPolls();
    processScheduledContests();
    processScheduledLineups();
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

    const campaigns = await storage.getAllCampaigns();

    for (const campaign of campaigns) {
      if (!isCampaignActive(campaign)) {
        continue;
      }

      const components = await storage.getCampaignComponents(campaign.id);

      for (const cc of components) {
        if (!cc.scheduledTime) {
          continue;
        }

        const scheduledTime = new Date(cc.scheduledTime);
        const endTime = cc.endTime ? new Date(cc.endTime) : null;

        if (cc.status === 'inactive' && now >= scheduledTime) {
          if (endTime && now >= endTime) {
            continue;
          }

          console.log(`[Scheduler] Activating component ${cc.component.name} (${cc.component.type}) in campaign ${campaign.id}`);
          
          const updated = await storage.updateCampaignComponentStatus(campaign.id, cc.componentId, 'active');
          
          if (updated) {
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

        if (cc.status === 'active' && endTime && now >= endTime) {
          console.log(`[Scheduler] Deactivating component ${cc.component.name} (${cc.component.type}) in campaign ${campaign.id}`);
          
          const updated = await storage.updateCampaignComponentStatus(campaign.id, cc.componentId, 'inactive');
          
          if (updated) {
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

async function processScheduledPolls() {
  try {
    const now = new Date();
    // Single JOIN query: live broadcasts × polls with scheduledStartTime (was N+1)
    const scheduledPolls = await storage.getScheduledPollsForLiveBroadcasts();
    for (const poll of scheduledPolls) {
      const scheduledStart = new Date(poll.scheduledStartTime!);
      const scheduledEnd = poll.scheduledEndTime ? new Date(poll.scheduledEndTime) : null;

      if (!poll.isActive && now >= scheduledStart && (!scheduledEnd || now < scheduledEnd)) {
        await storage.updatePoll(poll.id, { isActive: true });
        console.log(`[Scheduler] Activated poll ${poll.id} for broadcast ${poll.broadcastId}`);
        if (poll.campaignId) {
          broadcastToCampaign(poll.campaignId, JSON.stringify({
            type: 'poll_activated',
            pollId: poll.id,
            broadcastId: poll.broadcastId,
            timestamp: now.toISOString(),
          }));
        }
      }

      if (poll.isActive && scheduledEnd && now >= scheduledEnd) {
        await storage.updatePoll(poll.id, { isActive: false });
        console.log(`[Scheduler] Deactivated poll ${poll.id} for broadcast ${poll.broadcastId}`);
        if (poll.campaignId) {
          broadcastToCampaign(poll.campaignId, JSON.stringify({
            type: 'poll_deactivated',
            pollId: poll.id,
            broadcastId: poll.broadcastId,
            timestamp: now.toISOString(),
          }));
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error processing scheduled polls:', error);
  }
}

async function processScheduledContests() {
  try {
    const now = new Date();
    // Single JOIN query: live broadcasts × contests with scheduledStartTime (was N+1)
    const scheduledContests = await storage.getScheduledContestsForLiveBroadcasts();
    for (const contest of scheduledContests) {
      const scheduledStart = new Date(contest.scheduledStartTime!);
      const scheduledEnd = contest.scheduledEndTime ? new Date(contest.scheduledEndTime) : null;

      if (!contest.isActive && now >= scheduledStart && (!scheduledEnd || now < scheduledEnd)) {
        await storage.updateContest(contest.id, { isActive: true });
        console.log(`[Scheduler] Activated contest ${contest.id} for broadcast ${contest.broadcastId}`);
        if (contest.campaignId) {
          broadcastToCampaign(contest.campaignId, JSON.stringify({
            type: 'contest_activated',
            contestId: contest.id,
            broadcastId: contest.broadcastId,
            timestamp: now.toISOString(),
          }));
        }
      }

      if (contest.isActive && scheduledEnd && now >= scheduledEnd) {
        await storage.updateContest(contest.id, { isActive: false });
        console.log(`[Scheduler] Deactivated contest ${contest.id} for broadcast ${contest.broadcastId}`);
        if (contest.campaignId) {
          broadcastToCampaign(contest.campaignId, JSON.stringify({
            type: 'contest_deactivated',
            contestId: contest.id,
            broadcastId: contest.broadcastId,
            timestamp: now.toISOString(),
          }));
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error processing scheduled contests:', error);
  }
}

async function processScheduledLineups() {
  try {
    const now = Date.now();
    const LEAD_TIME_MS = 10 * 60 * 1000; // 10 min before kickoff
    const SEND_WINDOW_MS = 60 * 60 * 1000; // stop trying 60 min after kickoff

    const liveBroadcasts = await storage.getBroadcastsByStatus('live');

    for (const broadcast of liveBroadcasts) {
      const b = broadcast as any;
      if (!b.showLineup) continue;
      if (!b.matchStartingAt) continue;
      if (!b.sportmonksFixtureId) continue;
      if (lineupSentMap.has(broadcast.broadcastId)) continue;

      const kickoffMs = new Date(b.matchStartingAt).getTime();
      const sendAt = kickoffMs - LEAD_TIME_MS;
      const cutoff = kickoffMs + SEND_WINDOW_MS;

      if (now < sendAt || now > cutoff) continue;

      // Calculate videoTimestamp relative to when the broadcast went live
      const startedAtMs = b.startedAt ? new Date(b.startedAt).getTime() : now;
      const kickoffVideoTimestamp = Math.max(0, Math.round((kickoffMs - startedAtMs) / 1000));
      const videoTimestamp = Math.max(0, kickoffVideoTimestamp - 600);

      const event = {
        type: 'lineup_show',
        videoTimestamp,
        kickoffVideoTimestamp,
        broadcastId: broadcast.broadcastId,
        leadTimeSeconds: 600,
        timestamp: new Date().toISOString(),
        source: 'scheduler',
      };

      if (broadcast.campaignId) {
        broadcastToCampaign(broadcast.campaignId, JSON.stringify(event));
        lineupSentMap.set(broadcast.broadcastId, now);
        console.log(`[Scheduler] Auto-sent lineup_show for broadcast ${broadcast.broadcastId} — videoTimestamp=${videoTimestamp}s`);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error processing scheduled lineups:', error);
  }
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
