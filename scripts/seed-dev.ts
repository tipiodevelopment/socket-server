// @ts-nocheck
/**
 * seed-dev.ts — Seed script for development branches
 *
 * Creates a complete, self-contained test dataset for local/dev branches.
 * Safe to run on any branch: no real API keys, no real user data.
 *
 * Usage:
 *   DATABASE_URL=<your-branch-url> npx tsx scripts/seed-dev.ts
 *
 * What it creates:
 *   - 1 user (dev admin)
 *   - 1 clientApp with predictable test API key
 *   - 1 sponsor (fake brand)
 *   - 1 channel
 *   - 1 campaign (active, with full config)
 *   - 1 broadcast (live status)
 *   - 1 poll (active, 3 options)
 *   - 1 contest (active)
 *   - campaign engagement config, ui config, feature flags
 */

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

// ─── Predictable test identifiers (safe to share) ─────────────────────────
const TEST_API_KEY = "test_kotlin_sdk_dev_key_abc123";
const TEST_BROADCAST_ID = "broadcast-kotlin-sdk-test-001";
const TEST_BUNDLE_ID = "io.vio.kotlinsdk.test";
const TEST_REACHU_USER_ID = "dev-seed-user-001";

async function main() {
  console.log("🌱 Starting seed for dev branch...\n");

  // ── 1. User ──────────────────────────────────────────────────────────────
  console.log("👤 Creating test user...");
  const [user] = await db
    .insert(schema.users)
    .values({
      reachuUserId: TEST_REACHU_USER_ID,
      email: "dev-seed@vio.live",
      name: "Dev Seed Admin",
    })
    .onConflictDoUpdate({
      target: schema.users.reachuUserId,
      set: { email: "dev-seed@vio.live" },
    })
    .returning();
  console.log(`   ✅ user id=${user.id} reachuUserId=${user.reachuUserId}`);

  // ── 2. ClientApp (the entry point for the Kotlin SDK) ────────────────────
  console.log("📱 Creating clientApp...");
  const [clientApp] = await db
    .insert(schema.clientApps)
    .values({
      userId: user.id,
      name: "Kotlin SDK Test App",
      bundleId: TEST_BUNDLE_ID,
      apiKey: TEST_API_KEY,
      description: "Dev seed — safe for sharing",
      status: "active",
    })
    .onConflictDoUpdate({
      target: schema.clientApps.bundleId,
      set: { name: "Kotlin SDK Test App", status: "active" },
    })
    .returning();
  console.log(`   ✅ clientApp id=${clientApp.id} apiKey=${TEST_API_KEY}`);

  // ── 3. Sponsor ───────────────────────────────────────────────────────────
  console.log("🏷️  Creating sponsor...");
  const [sponsor] = await db
    .insert(schema.sponsors)
    .values({
      userId: user.id,
      name: "Acme Sports",
      description: "Fake sponsor for SDK testing",
      logoUrl: "https://placehold.co/200x80?text=Acme",
      avatarUrl: "https://placehold.co/80x80?text=A",
      primaryColor: "#FF6B35",
      secondaryColor: "#1A1A2E",
    })
    .returning();
  console.log(`   ✅ sponsor id=${sponsor.id}`);

  // ── 4. Channel ───────────────────────────────────────────────────────────
  console.log("📡 Creating channel...");
  const [channel] = await db
    .insert(schema.channels)
    .values({
      name: "SDK Test Channel",
      description: "Dev seed channel",
    })
    .returning();
  console.log(`   ✅ channel id=${channel.id}`);

  // ── 5. Campaign ──────────────────────────────────────────────────────────
  console.log("🎯 Creating campaign...");
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [campaign] = await db
    .insert(schema.campaigns)
    .values({
      userId: user.id,
      clientAppId: clientApp.id,
      channelId: channel.id,
      sponsorId: sponsor.id,
      name: "Kotlin SDK Test Campaign",
      description: "Full-featured campaign for SDK integration testing",
      startDate: now,
      endDate: nextMonth,
      isPaused: "false",
      brandName: "Acme Sports",
      brandIconUrl: "https://placehold.co/40x40?text=A",
      brandLogoUrl: "https://placehold.co/200x80?text=Acme+Sports",
    })
    .returning();
  console.log(`   ✅ campaign id=${campaign.id}`);

  // ── 6. Campaign configs ──────────────────────────────────────────────────
  console.log("⚙️  Creating campaign configs...");

  await db
    .insert(schema.campaignEngagementConfig)
    .values({
      campaignId: campaign.id,
      demoMode: "false",
      defaultPollDuration: 60,
      defaultContestDuration: 120,
      maxVotesPerPoll: 1,
      maxContestsPerMatch: 5,
      enableRealTimeUpdates: "true",
      updateInterval: 1000,
    })
    .onConflictDoNothing();

  await db
    .insert(schema.campaignUiConfig)
    .values({
      campaignId: campaign.id,
      primaryColor: "#FF6B35",
      secondaryColor: "#1A1A2E",
    })
    .onConflictDoNothing();

  await db
    .insert(schema.campaignFeatureFlags)
    .values({
      campaignId: campaign.id,
      enablePolls: "true",
      enableContests: "true",
      enableLiveStreaming: "true",
      enableProductCatalog: "true",
      enableEngagement: "true",
    })
    .onConflictDoNothing();

  console.log("   ✅ engagement config, ui config, feature flags");

  // ── 7. Broadcast ─────────────────────────────────────────────────────────
  console.log("📺 Creating broadcast...");
  const broadcastStart = new Date(now.getTime() - 30 * 60 * 1000); // started 30min ago
  const broadcastEnd = new Date(now.getTime() + 60 * 60 * 1000);   // ends in 1h

  await db
    .insert(schema.broadcasts)
    .values({
      broadcastId: TEST_BROADCAST_ID,
      broadcastName: "Kotlin SDK Test Match",
      description: "Live match for SDK integration testing",
      externalId: "external-match-sdk-test-001",
      campaignId: campaign.id,
      channelId: channel.id,
      startTime: broadcastStart,
      endTime: broadcastEnd,
      status: "live",
    })
    .onConflictDoNothing();
  console.log(`   ✅ broadcast broadcastId=${TEST_BROADCAST_ID}`);

  // ── 8. Poll ──────────────────────────────────────────────────────────────
  console.log("📊 Creating poll...");
  const [poll] = await db
    .insert(schema.polls)
    .values({
      broadcastId: TEST_BROADCAST_ID,
      question: "Who will score the next goal?",
      startTime: now,
      endTime: new Date(now.getTime() + 60 * 1000),
      isActive: true,
      totalVotes: 0,
    })
    .returning();

  await db.insert(schema.pollOptions).values([
    { pollId: poll.id, text: "Player A", voteCount: 0, displayOrder: 1 },
    { pollId: poll.id, text: "Player B", voteCount: 0, displayOrder: 2 },
    { pollId: poll.id, text: "Own Goal", voteCount: 0, displayOrder: 3 },
  ]);
  console.log(`   ✅ poll id=${poll.id} with 3 options`);

  // ── 9. Contest ───────────────────────────────────────────────────────────
  console.log("🏆 Creating contest...");
  await db
    .insert(schema.contests)
    .values({
      broadcastId: TEST_BROADCAST_ID,
      title: "Predict the Final Score",
      description: "Enter the correct final score to win",
      prize: "Acme Sports Jersey",
      contestType: "prediction",
      startTime: now,
      endTime: new Date(now.getTime() + 90 * 60 * 1000),
      isActive: true,
    })
    .onConflictDoNothing();
  console.log("   ✅ contest created");

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seed complete!

SDK entry point:
  GET /v1/sdk/config?apiKey=${TEST_API_KEY}

Test broadcast:
  broadcastId: ${TEST_BROADCAST_ID}
  WS: /ws/${campaign.id}

Campaign ID: ${campaign.id}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
