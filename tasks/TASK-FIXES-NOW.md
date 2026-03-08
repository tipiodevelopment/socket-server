# TASK FIXES-NOW — Critical fixes + demo data (do immediately)

**Priority: CRITICAL — needed before Viaplay sees the dashboard**

---

## FIX-01 — Commerce API key must live on Sponsor, not Campaign

### Problem
`routes.ts` reads `campaign.reachuApiKey` in 5 places instead of `sponsor.commerceApiKey`.
`sponsors` table has no `commerce_api_key` column yet.

### Fix

**1. Add columns to sponsors table:**
```sql
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS commerce_api_key TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS commerce_channel_id TEXT;
```

**2. Add to sponsors schema in `shared/schema.ts`:**
```typescript
commerceApiKey: text("commerce_api_key"),
commerceChannelId: text("commerce_channel_id"),
```

**3. Migrate existing keys:**
```sql
-- Elkjøp (id=3) and Torshov Sport (id=4) get the demo key
UPDATE sponsors SET commerce_api_key = 'KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S' WHERE id IN (3, 4);
```

**4. Update ALL 5 places in `routes.ts` that read `campaign.reachuApiKey`:**
Replace pattern:
```typescript
const commerceApiKey = campaign.reachuApiKey || process.env.COMMERCE_API_KEY || '...';
```
With:
```typescript
// Get sponsorId from request body or slot config
const sponsor = await db.query.sponsors.findFirst({ where: eq(sponsors.id, sponsorId) });
const commerceApiKey = sponsor?.commerceApiKey;
if (!commerceApiKey) return res.status(400).json({ error: 'Commerce not configured for this sponsor' });
```

**5. Add Commerce fields to Sponsor create/edit form in dashboard:**
- "Commerce API Key" — password input, masked
- "Commerce Channel ID" — text input, optional

---

## FIX-02 — Shoppable Ads Quick Fire — sponsor dropdown empty

### Problem
The "Sponsor" dropdown in Quick Fire shows "No sponsor" and no options.
It needs to show sponsors from the broadcast's campaign(s).

### Fix
In `broadcast-detail.tsx`, the Quick Fire sponsor dropdown should:
1. Fetch `GET /api/campaigns/:id/sponsors` using the broadcast's primary campaign ID
2. Populate dropdown with those sponsors
3. When sponsor selected → fetch `GET /api/commerce/products?sponsorId=:id` → populate Product dropdown
4. "Trigger Ad" fires `POST /api/broadcasts/:id/shoppable-ad` with `{ productId, sponsorId }`

---

## FIX-03 — Campaigns not linked to Client Apps

### Problem
"Tv2 Demo Campaign" and "Viaplay Demo 2025" show "No app" in dashboard.
TV2 and Viaplay app cards show "0 Campaigns".

### Fix
```sql
-- Link campaigns to their apps
UPDATE campaigns SET client_app_id = (SELECT id FROM client_apps WHERE name ILIKE '%tv2%' LIMIT 1)
WHERE name ILIKE '%tv2%' AND client_app_id IS NULL;

UPDATE campaigns SET client_app_id = (SELECT id FROM client_apps WHERE name ILIKE '%viaplay%' LIMIT 1)
WHERE name ILIKE '%viaplay%' AND client_app_id IS NULL;
```

---

## FIX-04 — Live Broadcasts viewers show `--` in list

### Problem
Dashboard home "Live Broadcasts" table shows `--` for viewers on all live broadcasts.

### Fix
Read `viewerCount` from the broadcast record directly (not from metadata JSON).
Update the live broadcasts query to include `viewerCount` field.

---

## DEMO-01 — Timeline redesign + realistic match data

### Part A — Seed demo data for past broadcasts

**Barcelona vs PSG (barcelona-psg-2026-03-03):**
- Update: viewerCount=34200, peakViewers=41000, status=ended
- Polls (already exist, update vote counts to be realistic):
  - "¿Quién marcará el primer gol?" — Lewandowski 67% (5,628 votes), Mbappé 33% (2,772 votes), total 8,400
  - "¿Acabará así el partido?" — Yes 61% (7,381), No 39% (4,719), total 12,100
  - "¿Llegará el 2-1?" — Yes 74% (11,692), No 26% (4,108), total 15,800
- Add metadata:
```json
{
  "matchEvents": [
    {"minute": 0, "type": "kickoff", "label": "Kickoff"},
    {"minute": 39, "type": "goal", "label": "Lewandowski 1-0 ⚽", "team": "home"},
    {"minute": 67, "type": "goal", "label": "Mbappé 1-1 ⚽", "team": "away"},
    {"minute": 84, "type": "goal", "label": "Ferran Torres 2-1 ⚽", "team": "home"},
    {"minute": 90, "type": "fulltime", "label": "Full Time — Barcelona 2-1 PSG"}
  ],
  "homeTeam": "FC Barcelona", "awayTeam": "PSG",
  "homeScore": 2, "awayScore": 1,
  "duration": 90
}
```

**Atlético Madrid vs PSG (viaplay-atletico-psg-2026-03-08):**
- Update: viewerCount=19600, peakViewers=24000
- Update poll vote counts to be realistic
- Add metadata:
```json
{
  "matchEvents": [
    {"minute": 0, "type": "kickoff", "label": "Kickoff"},
    {"minute": 67, "type": "goal", "label": "Griezmann 1-0 ⚽", "team": "home"},
    {"minute": 90, "type": "fulltime", "label": "Full Time — Atlético 1-0 PSG"}
  ],
  "homeTeam": "Atlético Madrid", "awayTeam": "PSG",
  "homeScore": 1, "awayScore": 0,
  "duration": 90
}
```

**Real Madrid vs Barcelona (existing El Clásico broadcast):**
- Add metadata:
```json
{
  "matchEvents": [
    {"minute": 0, "type": "kickoff", "label": "Kickoff"},
    {"minute": 23, "type": "goal", "label": "Vinícius Jr 1-0 ⚽", "team": "home"},
    {"minute": 42, "type": "goal", "label": "Lewandowski 1-1 ⚽", "team": "away"},
    {"minute": 77, "type": "goal", "label": "Bellingham 2-1 ⚽", "team": "home"},
    {"minute": 90, "type": "fulltime", "label": "Full Time — Real Madrid 2-1 Barcelona"}
  ],
  "homeTeam": "Real Madrid", "awayTeam": "FC Barcelona",
  "homeScore": 2, "awayScore": 1,
  "duration": 90
}
```

---

### Part B — Timeline visual redesign

Replace the current "dots floating in a box" with a proper horizontal match timeline:

**Design:**
```
[⚽ 0']——[📊 12']——[⚽ 39']——[📊 45']——[🏆 52']——[⚽ 67']——[📊 71']——[🛍️ 79']——[⚽ 84']——[⏹ 90']
```

**Implementation:**
- Read `broadcast.metadata.matchEvents` for goal/kickoff/fulltime markers
- Overlay polls (blue), contests (purple), shoppable ads (green) at their timestamps
- Each marker: colored circle + icon + minute label below
- Hover tooltip: event name + result (e.g. "Lewandowski 1-0 ⚽")
- For ended broadcasts: timeline shows full match story
- For live broadcasts: progress indicator at current minute
- Click marker → scroll to that event in Active Engagement

**Color coding:**
- ⚽ Goal/match event: white
- 📊 Poll: `#3d8b7a` (Vio green)
- 🏆 Contest: purple
- 🛍️ Shoppable ad: `#f7b23b` (Elkjøp gold) or sponsor primary color
- ⚽ Kickoff/FT: gray

---

## ORDER OF EXECUTION
1. FIX-01 (Commerce on sponsor) 
2. FIX-02 (sponsor dropdown)
3. FIX-03 (campaign → app links)
4. FIX-04 (viewers in list)
5. DEMO-01 Part A (seed match data)
6. DEMO-01 Part B (timeline redesign)

