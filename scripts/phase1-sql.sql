-- Phase 1: multi-sponsor schema additions (non-breaking, all nullable or with defaults).
-- Idempotent: IF NOT EXISTS where supported; ADD COLUMN IF NOT EXISTS for columns.

-- 1. end_users (new, self-contained — reachu out per decision #5)
CREATE TABLE IF NOT EXISTS end_users (
  id serial PRIMARY KEY,
  client_app_id integer NOT NULL REFERENCES client_apps(id) ON DELETE CASCADE,
  external_user_id varchar(255) NOT NULL,
  first_seen_at timestamp NOT NULL DEFAULT NOW(),
  last_seen_at timestamp NOT NULL DEFAULT NOW(),
  metadata json
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_end_users_app_external
  ON end_users(client_app_id, external_user_id);
CREATE INDEX IF NOT EXISTS idx_end_users_last_seen
  ON end_users(client_app_id, last_seen_at);

-- 2. client_apps: tv_enabled + tv_platforms
ALTER TABLE client_apps ADD COLUMN IF NOT EXISTS tv_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE client_apps ADD COLUMN IF NOT EXISTS tv_platforms text[] NOT NULL DEFAULT '{}';

-- 3. campaigns: primary_sponsor_id (nullable in phase 1)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS primary_sponsor_id integer REFERENCES sponsors(id) ON DELETE RESTRICT;

-- 4. sponsors: payment_methods
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS payment_methods json NOT NULL DEFAULT '[]';

-- 5. broadcasts: engagement_enabled
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS engagement_enabled boolean NOT NULL DEFAULT false;

-- 6. scheduled_components: sponsor_id (nullable in phase 1)
ALTER TABLE scheduled_components ADD COLUMN IF NOT EXISTS sponsor_id integer REFERENCES sponsors(id) ON DELETE RESTRICT;

-- 7. campaign_components: sponsor_id + broadcast_id (both nullable)
ALTER TABLE campaign_components ADD COLUMN IF NOT EXISTS sponsor_id integer REFERENCES sponsors(id) ON DELETE RESTRICT;
ALTER TABLE campaign_components ADD COLUMN IF NOT EXISTS broadcast_id varchar(255) REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE;

-- 8. polls: sponsor_id (nullable in phase 1)
ALTER TABLE polls ADD COLUMN IF NOT EXISTS sponsor_id integer REFERENCES sponsors(id) ON DELETE RESTRICT;

-- 9. contests: sponsor_id (nullable in phase 1)
ALTER TABLE contests ADD COLUMN IF NOT EXISTS sponsor_id integer REFERENCES sponsors(id) ON DELETE RESTRICT;

-- 10. shoppable_ad_activations (new)
CREATE TABLE IF NOT EXISTS shoppable_ad_activations (
  id serial PRIMARY KEY,
  broadcast_id varchar(255) NOT NULL REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sponsor_id integer REFERENCES sponsors(id) ON DELETE SET NULL,
  slot_id integer REFERENCES broadcast_sponsor_slots(id) ON DELETE SET NULL,
  client_app_id integer REFERENCES client_apps(id) ON DELETE SET NULL,
  product_id varchar(255) NOT NULL,
  product_snapshot json NOT NULL,
  sponsor_snapshot json,
  source varchar(30) NOT NULL,
  ws_event_sent boolean NOT NULL DEFAULT true,
  metadata json,
  triggered_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shoppable_activations_broadcast_time ON shoppable_ad_activations(broadcast_id, triggered_at);
CREATE INDEX IF NOT EXISTS idx_shoppable_activations_campaign_time ON shoppable_ad_activations(campaign_id, triggered_at);
CREATE INDEX IF NOT EXISTS idx_shoppable_activations_sponsor ON shoppable_ad_activations(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_shoppable_activations_slot ON shoppable_ad_activations(slot_id);
CREATE INDEX IF NOT EXISTS idx_shoppable_activations_source_time ON shoppable_ad_activations(source, triggered_at);

-- 11. tv_sessions (new)
CREATE TABLE IF NOT EXISTS tv_sessions (
  id serial PRIMARY KEY,
  client_app_id integer NOT NULL REFERENCES client_apps(id) ON DELETE CASCADE,
  end_user_id integer NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  tv_device_id varchar(255),
  platform varchar(20) NOT NULL,
  started_at timestamp NOT NULL DEFAULT NOW(),
  last_seen_at timestamp NOT NULL DEFAULT NOW(),
  ended_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tv_sessions_app_user_platform
  ON tv_sessions(client_app_id, end_user_id, platform);
CREATE INDEX IF NOT EXISTS idx_tv_sessions_last_seen
  ON tv_sessions(end_user_id, last_seen_at);

-- 12. cart_intents (new)
CREATE TABLE IF NOT EXISTS cart_intents (
  id serial PRIMARY KEY,
  end_user_id integer NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  client_app_id integer NOT NULL REFERENCES client_apps(id) ON DELETE CASCADE,
  tv_session_id integer REFERENCES tv_sessions(id) ON DELETE SET NULL,
  sponsor_id integer REFERENCES sponsors(id) ON DELETE SET NULL,
  product_id varchar(255) NOT NULL,
  source_activation_id integer REFERENCES shoppable_ad_activations(id) ON DELETE SET NULL,
  source_component_id integer REFERENCES campaign_components(id) ON DELETE SET NULL,
  delivery_mode varchar(20) NOT NULL,
  user_connected boolean NOT NULL,
  envelope json NOT NULL,
  metadata json,
  triggered_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cart_intents_campaign_time ON cart_intents(campaign_id, triggered_at);
CREATE INDEX IF NOT EXISTS idx_cart_intents_end_user_time ON cart_intents(end_user_id, triggered_at);
CREATE INDEX IF NOT EXISTS idx_cart_intents_source_activation ON cart_intents(source_activation_id);
CREATE INDEX IF NOT EXISTS idx_cart_intents_sponsor ON cart_intents(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_cart_intents_delivery_mode_time ON cart_intents(delivery_mode, triggered_at);
