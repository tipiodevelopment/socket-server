import { Campaign } from "@shared/schema";

/**
 * Check if a campaign is currently active based on its endDate
 * @param campaign The campaign to check
 * @returns true if campaign is active (endDate is null or in the future)
 */
export function isCampaignActive(campaign: Campaign): boolean {
  if (!campaign.endDate) {
    return true; // No end date means campaign runs indefinitely
  }
  
  const now = new Date();
  const endDate = new Date(campaign.endDate);
  
  return endDate > now;
}
