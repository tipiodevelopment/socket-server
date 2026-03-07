# REPLIT_TASKS.md — Dashboard UI/UX Fixes

> Generated from unified audit (Viobot + Replit). All items below are approved for implementation.

---

## DASHBOARD HOME `/`

- [ ] **Stats ↑12%/↑8%**: Replace hardcoded values with real calculated deltas from DB. Create demo data in DB so numbers look meaningful.
- [ ] **Active Viewers / Engagement Rate `--`**: Implement real data. Use demo data in DB to populate these values.
- [ ] **"New Campaign" button**: Navigate directly to campaign creation form, not to the list.
- [ ] **"Upcoming Campaigns" section**: Only show campaigns with startDate within next 7 days. If none, show empty state "No upcoming campaigns".
- [ ] **App cards without images** (VG, Pregnancy): Add a random placeholder image/gradient so all cards are visually balanced.
- [ ] **Progress bar label**: Keep current logic but add a visible label explaining what the percentage represents.
- [ ] **Filter/Sort buttons**: Make them functional (filter by status, sort by name/date).
- [ ] **"Components" in campaign cards**: Implement the real count from DB.
- [ ] **Gap between KPI cards and "Client Apps"**: Increase spacing between sections.
- [ ] **Empty state "Live Broadcasts"**: Make it more compact.

---

## APPS `/apps`

- [ ] **"Total Viewers"**: Implement real data from DB with demo data seeded. No more 0.
- [ ] **"Edit" + "Settings" buttons**: Remove one, keep only "Manage".
- [ ] **Bundle ID in card**: Remove from list view — move to detail page only.
- [ ] **Progress bar**: Remove it entirely.
- [ ] **APP_GRADIENTS**: Remove gradients entirely. Use flat dark backgrounds.
- [ ] **API key**: Show masked API key in card (e.g. viaplay_api_*****).

---

## APP DETAIL `/apps/:id`

- [ ] **engagementRate hardcoded 75%**: Implement real engagement rate. Seed demo data.
- [ ] **"0 broadcasts" hardcoded**: Fix to show real broadcast count per campaign.
- [ ] **"Live Broadcasts" stat**: Use only broadcasts with status live, not total count.
- [ ] **Users icon next to date**: Replace with Calendar icon.
- [ ] **Status badge**: Add color differentiation — Active=green, Paused=yellow, Archived=gray.
- [ ] **Stat cards background**: Make consistent with other pages.
- [ ] **"Edit Details" + "App Settings" duplicates**: Remove one, keep one entry point.

---

## CAMPAIGNS `/campaigns`

- [ ] **Country ISO codes**: Display full country name or add tooltip on hover.
- [ ] **Sponsor label**: Show sponsor name as text next to the logo.
- [ ] **Add columns**: Add "Sponsor" and "Total Engagement" to list view.
- [ ] **Badge differentiation**: Active=green, Ended=dark gray, Upcoming=blue, Paused=yellow.
- [ ] **Sort list**: Add sorting controls (by date, name, status).
- [ ] **Pause/Resume inline**: Add toggle button in the list row.

---

## CAMPAIGN DETAIL `/campaigns/:id`

- [ ] **locationId visible**: Show locationId in components list without entering edit mode.
- [ ] **Broadcast filter counters**: Show count per state: All (6) · Live (1) · Upcoming (3) · Ended (2).
- [ ] **Sportmonks consistency**: Add Sportmonks fixture selector to "New Broadcast" in /broadcasts global page too.
- [ ] **"Go Live" button**: Rename to "Start Broadcast".
- [ ] **Poll results**: Show absolute count alongside percentage: "45% (234 votes)".
- [ ] **Analytics lazy load**: Pre-fetch analytics when campaign page opens.
- [ ] **"Danger Zone" collapse**: Collapse by default, expand on click.
- [ ] **Commerce API key save**: Unify into same save pattern as rest of form.

---

## BROADCASTS `/broadcasts`

- [ ] **Viewers field**: Read from broadcast.viewerCount, not from metadata JSON.
- [ ] **"Metadata JSON" field**: Remove from Create Broadcast modal.
- [ ] **Sportmonks in Create Broadcast**: Add fixture selector same as Campaign Detail.
- [ ] **Team logos in list**: Show home/away team logos from Sportmonks in broadcast list row.
- [ ] **Start time in upcoming**: Show date + time of broadcast start in upcoming rows.
- [ ] **Ended opacity**: Remove opacity-60 from Ended broadcast cards.
- [ ] **BarChart3 icon**: Use Users for viewers, BarChart3 for polls — differentiate.
- [ ] **Filter button**: Implement or remove.
- [ ] **Duplicate search bars**: Keep only the contextual "Search broadcasts..." bar.

---

## BROADCAST DETAIL `/broadcasts/:id`

- [ ] **Timeline progress bar**: Replace hardcoded 50% with real progress (events fired / total scheduled).
- [ ] **Timeline buttons** (Play/Skip/Maximize): Implement — Play simulates event sequence, Skip jumps to next, Maximize expands view.
- [ ] **topValues array**: Remove the decorative hardcoded array.
- [ ] **Live Chat on Ended**: Disable input/send. Show banner "This broadcast has ended — chat is read-only".
- [ ] **ext: ID in header**: Remove from header. Move to collapsed "Developer" section.
- [ ] **Shoppable Ads section**: Add section with product selector, sponsor selector, "Trigger Ad" button (POST /api/broadcasts/:id/shoppable-ad), and session log of triggered ads with timestamps.
- [ ] **Shoppable Ads without Commerce**: Show warning "Commerce not configured for this campaign" if integrations.commerce.enabled is false.
- [ ] **ENDED state**: Replace "No polls yet" with post-broadcast summary (total votes, participations, duration).
- [ ] **viewerCount / peakViewers = 0**: Show N/A instead of 0.
- [ ] **"Load Demo" CTA**: Keep but deprioritize — not the primary CTA when status is Ended.

---

## SPONSORS `/sponsors`

- [ ] **Sponsor detail page**: Create /sponsors/:id with profile, associated campaigns, usage history.
- [ ] **Default colors on create**: Change from blue/purple to neutral or Vio accent.
- [ ] **Color swatch labels**: Add "Primary" and "Secondary" text labels.
- [ ] **SDK badge preview**: Add small preview of sponsor badge as it appears in SDK overlay.
- [ ] **Active campaigns count**: Show "X active campaigns" on each card.
- [ ] **Description read mode**: Allow expanding without entering edit mode.

---

## COMPONENTS `/components`

- [ ] **Configuration preview**: Show key config in card — Banner: image preview, Countdown: target date, Carousel: product count.
- [ ] **Test component tag**: Add "Test" tag/filter for test-named components.
- [ ] **Card height**: Change from fixed h-48 to dynamic height.
- [ ] **Filter set**: Add filters for offer_banner, product_store, product_banner.
- [ ] **isTemplate type**: Fix comparison from string 'true' to boolean true.
- [ ] **"New Component" button**: Replace native button with shadcn/ui Button component.

---

## ANALYTICS `/analytics`

- [ ] **Sponsor Performance "engagement"**: Add tooltip defining what engagement means (votes + contest participations).
- [ ] **Geographic Distribution**: Clarify metric — rename to "Campaigns by target country".
- [ ] **"Top Campaigns" table**: Sort by total engagement descending. Move zero-engagement to bottom.
- [ ] **useChartTheme()**: Refactor to use React state for theme detection.
- [ ] **Drill-down "Back" button**: Show destination name — "← TV2 Demo App" not just "Back".
- [ ] **Empty chart**: Show "No broadcast activity in the last 30 days" message.
- [ ] **Time period selector**: Add Today / 7 days / 30 days / Custom range.
- [ ] **Chart contrast**: Increase bar contrast on dark background.
- [ ] **KPI "Components" and "Sponsors"**: Add subtext (e.g. "X templates").

---

## DEMO DATA (seed in DB)

Seed realistic data for TV2 and Viaplay apps so dashboard looks credible in demos:
- TV2: ~34K total viewers, engagement rate ~4.2%, 1 active campaign, 3 broadcasts (1 ended with data)
- Viaplay: ~72K total viewers, engagement rate ~6.8%, 3 campaigns, 6 broadcasts
- Broadcast activity for last 30 days with realistic daily distribution
- Sponsor performance: Elkjøp with real vote/participation counts

---

## DO NOT TOUCH

- "Load Demo" button: keep, just deprioritize visually
- Naming of test campaigns/components: operator task, out of scope
- ext: field in DB: keep in DB, only remove from visible UI
