CREATE TABLE "app_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_app_id" integer NOT NULL,
	"component_id" varchar(50) NOT NULL,
	"custom_config" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_ads" (
	"id" serial PRIMARY KEY NOT NULL,
	"broadcast_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"image_url" text,
	"cta_url" text,
	"start_time" varchar(20),
	"duration" varchar(20),
	"ad_type" varchar(50) DEFAULT 'banner' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"broadcast_id" varchar(255) NOT NULL,
	"campaign_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"broadcast_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"subtitle" text,
	"price" varchar(20) DEFAULT '0' NOT NULL,
	"original_price" varchar(20),
	"image_url" text,
	"buy_url" text,
	"status" varchar(20) DEFAULT 'available' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_sponsor_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"broadcast_id" varchar(255) NOT NULL,
	"sponsor_id" integer NOT NULL,
	"campaign_id" integer,
	"role" varchar(50) DEFAULT 'shoppable' NOT NULL,
	"type" varchar(50) DEFAULT 'product' NOT NULL,
	"config" json DEFAULT '{}'::json,
	"trigger_type" varchar(50) DEFAULT 'manual' NOT NULL,
	"trigger_value" text,
	"auto_execute" boolean DEFAULT false,
	"product_ids" integer[] DEFAULT '{}',
	"status" varchar(20) DEFAULT 'scheduled',
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"broadcast_id" varchar(255) PRIMARY KEY NOT NULL,
	"broadcast_name" varchar(255) NOT NULL,
	"description" text,
	"external_id" varchar(255),
	"campaign_id" integer,
	"channel_id" integer,
	"start_time" timestamp,
	"end_time" timestamp,
	"status" varchar(20) DEFAULT 'upcoming' NOT NULL,
	"viewer_count" integer DEFAULT 0,
	"peak_viewers" integer DEFAULT 0,
	"metadata" json,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sportmonks_fixture_id" integer,
	"home_team_name" varchar(255),
	"home_team_logo" varchar(512),
	"away_team_name" varchar(255),
	"away_team_logo" varchar(512),
	"match_starting_at" timestamp,
	"league_name" varchar(255),
	"show_lineup" boolean DEFAULT false NOT NULL,
	"started_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "campaign_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"component_id" varchar(50) NOT NULL,
	"instance_name" varchar(255),
	"status" varchar(20) DEFAULT 'inactive' NOT NULL,
	"custom_config" json,
	"scheduled_time" timestamp,
	"end_time" timestamp,
	"activated_at" timestamp,
	"match_id" varchar(255),
	"location_id" varchar(100),
	"video_start_time" integer,
	"video_end_time" integer,
	"scheduled_start_time" timestamp,
	"scheduled_end_time" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_engagement_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"demo_mode" varchar(10) DEFAULT 'false' NOT NULL,
	"default_poll_duration" integer DEFAULT 300 NOT NULL,
	"default_contest_duration" integer DEFAULT 600 NOT NULL,
	"max_votes_per_poll" integer DEFAULT 1 NOT NULL,
	"max_contests_per_match" integer DEFAULT 10 NOT NULL,
	"enable_real_time_updates" varchar(10) DEFAULT 'true' NOT NULL,
	"update_interval" integer DEFAULT 1000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_feature_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"enable_live_streaming" varchar(10) DEFAULT 'true' NOT NULL,
	"enable_product_catalog" varchar(10) DEFAULT 'true' NOT NULL,
	"enable_engagement" varchar(10) DEFAULT 'true' NOT NULL,
	"enable_polls" varchar(10) DEFAULT 'true' NOT NULL,
	"enable_contests" varchar(10) DEFAULT 'true' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_form_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"form_type" varchar(50) NOT NULL,
	"form_data" json NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_sponsors" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"sponsor_id" integer NOT NULL,
	"role" varchar(50) DEFAULT 'shoppable' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"language_code" varchar(10) NOT NULL,
	"sponsor_badge_text" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "campaign_ui_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"primary_color" varchar(7) DEFAULT '#007AFF' NOT NULL,
	"secondary_color" varchar(7) DEFAULT '#5856D6' NOT NULL,
	"component_configs" json
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"client_app_id" integer,
	"channel_id" integer,
	"sponsor_id" integer,
	"name" varchar(255) NOT NULL,
	"logo" text,
	"description" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"is_paused" varchar(10) DEFAULT 'false' NOT NULL,
	"reachu_channel_id" varchar(255),
	"reachu_api_key" text,
	"tipio_livestream_data" json,
	"is_segmented" varchar(10) DEFAULT 'false' NOT NULL,
	"target_countries" text[],
	"target_percentage" integer,
	"match_id" varchar(255),
	"match_name" varchar(255),
	"match_start_time" timestamp,
	"brand_name" varchar(255),
	"brand_icon_asset" varchar(255),
	"brand_icon_url" text,
	"brand_logo_url" text,
	"payment_methods" json,
	"webhook_url" varchar(512),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_app_id" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"dynamic_config" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"broadcast_id" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(50) DEFAULT 'message' NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"bundle_id" varchar(255) NOT NULL,
	"api_key" text NOT NULL,
	"reachu_api_key" text,
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"icon_url" text,
	"banner_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_apps_bundle_id_unique" UNIQUE("bundle_id"),
	CONSTRAINT "client_apps_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" varchar(50) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"config" json NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest_participations" (
	"id" serial PRIMARY KEY NOT NULL,
	"contest_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"broadcast_id" varchar(255) NOT NULL,
	"answers" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" serial PRIMARY KEY NOT NULL,
	"broadcast_id" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"prize" varchar(500),
	"contest_type" varchar(50) NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" varchar(1000),
	"video_start_time" integer,
	"video_end_time" integer,
	"broadcast_start_time" timestamp,
	"scheduled_start_time" timestamp,
	"scheduled_end_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"device_token" varchar(512) NOT NULL,
	"platform" varchar(20) DEFAULT 'ios' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"data" json NOT NULL,
	"campaign_logo" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"text" varchar(500) NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"broadcast_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"broadcast_id" varchar(255) NOT NULL,
	"question" text NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"total_votes" integer DEFAULT 0 NOT NULL,
	"duration" integer,
	"video_start_time" integer,
	"video_end_time" integer,
	"broadcast_start_time" timestamp,
	"scheduled_start_time" timestamp,
	"scheduled_end_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"scheduled_time" timestamp NOT NULL,
	"end_time" timestamp,
	"data" json NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdk_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"language_code" varchar(10) NOT NULL,
	"campaign_id" integer,
	"match_id" varchar(255),
	"translation_key" varchar(100) NOT NULL,
	"translation_value" text NOT NULL,
	"date_format" varchar(50) DEFAULT 'dd.MM.yyyy' NOT NULL,
	"time_format" varchar(50) DEFAULT 'HH:mm' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"logo_url" text,
	"avatar_url" text,
	"primary_color" varchar(20),
	"secondary_color" varchar(20),
	"commerce_api_key" text,
	"commerce_channel_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sportmonks_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_type" varchar(50) NOT NULL,
	"league_id" integer,
	"date_from" varchar(20),
	"date_to" varchar(20),
	"data" json NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"reachu_user_id" varchar(255) NOT NULL,
	"email" text,
	"name" text,
	"firebase_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_reachu_user_id_unique" UNIQUE("reachu_user_id")
);
--> statement-breakpoint
ALTER TABLE "app_components" ADD CONSTRAINT "app_components_client_app_id_client_apps_id_fk" FOREIGN KEY ("client_app_id") REFERENCES "public"."client_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_components" ADD CONSTRAINT "app_components_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_ads" ADD CONSTRAINT "broadcast_ads_broadcast_id_broadcasts_broadcast_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("broadcast_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_campaigns" ADD CONSTRAINT "broadcast_campaigns_broadcast_id_broadcasts_broadcast_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("broadcast_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_campaigns" ADD CONSTRAINT "broadcast_campaigns_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_products" ADD CONSTRAINT "broadcast_products_broadcast_id_broadcasts_broadcast_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("broadcast_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_sponsor_slots" ADD CONSTRAINT "broadcast_sponsor_slots_broadcast_id_broadcasts_broadcast_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("broadcast_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_sponsor_slots" ADD CONSTRAINT "broadcast_sponsor_slots_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_sponsor_slots" ADD CONSTRAINT "broadcast_sponsor_slots_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_components" ADD CONSTRAINT "campaign_components_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_components" ADD CONSTRAINT "campaign_components_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_engagement_config" ADD CONSTRAINT "campaign_engagement_config_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_feature_flags" ADD CONSTRAINT "campaign_feature_flags_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_form_state" ADD CONSTRAINT "campaign_form_state_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_sponsors" ADD CONSTRAINT "campaign_sponsors_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_sponsors" ADD CONSTRAINT "campaign_sponsors_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_translations" ADD CONSTRAINT "campaign_translations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_ui_config" ADD CONSTRAINT "campaign_ui_config_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_client_app_id_client_apps_id_fk" FOREIGN KEY ("client_app_id") REFERENCES "public"."client_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_client_app_id_client_apps_id_fk" FOREIGN KEY ("client_app_id") REFERENCES "public"."client_apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_broadcast_id_broadcasts_broadcast_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("broadcast_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_apps" ADD CONSTRAINT "client_apps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_participations" ADD CONSTRAINT "contest_participations_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_broadcast_id_broadcasts_broadcast_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("broadcast_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_broadcast_id_broadcasts_broadcast_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("broadcast_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_components" ADD CONSTRAINT "scheduled_components_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdk_translations" ADD CONSTRAINT "sdk_translations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_broadcast_ads_broadcast_id" ON "broadcast_ads" USING btree ("broadcast_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_broadcast_campaign" ON "broadcast_campaigns" USING btree ("broadcast_id","campaign_id");--> statement-breakpoint
CREATE INDEX "idx_broadcast_products_broadcast_id" ON "broadcast_products" USING btree ("broadcast_id");--> statement-breakpoint
CREATE INDEX "idx_broadcasts_external_id_campaign" ON "broadcasts" USING btree ("external_id","campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_campaign_sponsor" ON "campaign_sponsors" USING btree ("campaign_id","sponsor_id");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_broadcast_id" ON "chat_messages" USING btree ("broadcast_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_contest" ON "contest_participations" USING btree ("contest_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_contest_participations_contest_id" ON "contest_participations" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "idx_contest_participations_broadcast_id" ON "contest_participations" USING btree ("broadcast_id");--> statement-breakpoint
CREATE INDEX "idx_contests_broadcast_id" ON "contests" USING btree ("broadcast_id");--> statement-breakpoint
CREATE INDEX "idx_contests_is_active" ON "contests" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_contests_scheduled" ON "contests" USING btree ("scheduled_start_time","scheduled_end_time");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_device_tokens_campaign_user" ON "device_tokens" USING btree ("campaign_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_poll_options_poll_id" ON "poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_poll" ON "poll_votes" USING btree ("poll_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_poll_id" ON "poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_broadcast_id" ON "poll_votes" USING btree ("broadcast_id");--> statement-breakpoint
CREATE INDEX "idx_polls_broadcast_id" ON "polls" USING btree ("broadcast_id");--> statement-breakpoint
CREATE INDEX "idx_polls_is_active" ON "polls" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_polls_scheduled" ON "polls" USING btree ("scheduled_start_time","scheduled_end_time");