# TASK ARCH-01a — DB Migration (multi-sponsor)

**Status: TODO — Do this FIRST**

## New tables

```sql
-- 1. Sponsors in a campaign
CREATE TABLE campaign_sponsors (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sponsor_id INTEGER NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'shoppable', -- 'engagement' | 'shoppable' | 'full'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, sponsor_id)
);

-- 2. Many-to-many broadcasts <-> campaigns
CREATE TABLE broadcast_campaigns (
  id SERIAL PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(broadcast_id, campaign_id)
);

-- 3. Sponsor slots per broadcast (the ad schedule)
CREATE TABLE broadcast_sponsor_slots (
  id SERIAL PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  sponsor_id INTEGER NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id),
  role TEXT NOT NULL DEFAULT 'shoppable',
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'match_minute' | 'absolute_time'
  trigger_value TEXT,
  auto_execute BOOLEAN DEFAULT FALSE,
  product_ids INTEGER[] DEFAULT '{}',
  status TEXT DEFAULT 'scheduled', -- 'scheduled' | 'active' | 'completed'
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. sponsor_id on components
ALTER TABLE campaign_components ADD COLUMN IF NOT EXISTS sponsor_id INTEGER REFERENCES sponsors(id);
```

## Migrate existing data
```sql
INSERT INTO broadcast_campaigns (broadcast_id, campaign_id, is_primary)
SELECT id, campaign_id, TRUE FROM broadcasts WHERE campaign_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

## DO NOT drop broadcasts.campaign_id — keep for backward compat

## Seed demo data
```sql
-- Campaign 35 (Viaplay): Elkjøp (full) + Torshov Sport (shoppable)
INSERT INTO campaign_sponsors (campaign_id, sponsor_id, role) VALUES (35, 3, 'full'), (35, 4, 'shoppable') ON CONFLICT DO NOTHING;
-- Campaign 36 (TV2): Torshov Sport (full)
INSERT INTO campaign_sponsors (campaign_id, sponsor_id, role) VALUES (36, 4, 'full') ON CONFLICT DO NOTHING;
```
