# Phase 3 — Enforce NOT NULL on sponsor FKs

Migration playbook for applying the final Phase 3 constraint step on an
environment that has already received Phase 1 (schema additions) + Phase 2
(backfill). The test branch has already been through this end-to-end; this
doc captures what the operator needs to do on `develop` (and later on
`production`) before merging the code.

## What Phase 3 does

Flips 5 columns from nullable to `NOT NULL`:

| table | column |
|---|---|
| `campaigns` | `primary_sponsor_id` |
| `polls` | `sponsor_id` |
| `contests` | `sponsor_id` |
| `campaign_components` | `sponsor_id` |
| `scheduled_components` | `sponsor_id` |

After Phase 3 the TypeScript schema (`shared/schema.ts`) matches the DB: code
already declares `.notNull()` on these columns.

The SQL lives in `scripts/phase3-enforce-sponsor-fks.sql` and is reusable
across environments. Each `ALTER TABLE` is a one-shot — Postgres rejects it
if any row still has NULL, pointing at exactly which table needs cleanup.

## Before running

Every environment must answer: **what to do with campaigns that still have
`primary_sponsor_id IS NULL` after Phase 2 backfill?**

Those campaigns predate the multi-sponsor model and never had a sponsor
linked. The cascade is: 45 `campaign_components` + 1 `scheduled_component`
rows in the test DB hang off these orphans. On `develop` and `production`
the numbers may differ — always run the impact audit first.

### 1. Audit — which campaigns are blocking

```sql
SELECT c.id, c.name, c.is_paused, c.client_app_id,
       (SELECT COUNT(*) FROM broadcasts b WHERE b.campaign_id = c.id) AS broadcasts,
       (SELECT COUNT(*) FROM campaign_components cc WHERE cc.campaign_id = c.id) AS components,
       (SELECT COUNT(*) FROM polls p JOIN broadcasts b ON b.broadcast_id = p.broadcast_id WHERE b.campaign_id = c.id) AS polls,
       (SELECT COUNT(*) FROM contests ct JOIN broadcasts b ON b.broadcast_id = ct.broadcast_id WHERE b.campaign_id = c.id) AS contests,
       (SELECT COUNT(*) FROM shoppable_ad_activations a WHERE a.campaign_id = c.id) AS activations,
       (SELECT COUNT(*) FROM cart_intents ci WHERE ci.campaign_id = c.id) AS cart_intents
  FROM campaigns c
 WHERE c.primary_sponsor_id IS NULL
 ORDER BY c.id;
```

### 2. Decide per-row — three valid resolutions

- **Assign a sponsor** via the dashboard. Preferred for campaigns that have
  broadcasts / polls / cart_intents (real product data). Pick the sponsor
  that matches the campaign's ownership.
- **Archive** — if the campaign has no activity and shouldn't be re-used,
  set `is_paused=true` and link it to any sponsor (e.g. a "legacy" sponsor
  owned by the same user). Avoids deletion if audit trail matters.
- **Hard-delete** — only when the row is pure test residue with no activity.
  This cascades through broadcasts, components, polls, contests, activations,
  cart_intents. In the test branch we deleted all 13 orphans this way because
  they had 0 broadcasts / polls / cart_intents between them.

### 3. Verify NULLs are gone

Before running the ALTER, the counts below must all be 0:

```sql
SELECT 'campaigns'           AS t, COUNT(*) FROM campaigns WHERE primary_sponsor_id IS NULL
UNION ALL SELECT 'polls',               COUNT(*) FROM polls WHERE sponsor_id IS NULL
UNION ALL SELECT 'contests',            COUNT(*) FROM contests WHERE sponsor_id IS NULL
UNION ALL SELECT 'campaign_components', COUNT(*) FROM campaign_components WHERE sponsor_id IS NULL
UNION ALL SELECT 'scheduled_components',COUNT(*) FROM scheduled_components WHERE sponsor_id IS NULL;
```

### 4. Apply Phase 3

```bash
DATABASE_URL=<develop-uri> psql -f scripts/phase3-enforce-sponsor-fks.sql
```

Each `ALTER TABLE` acquires a brief `ACCESS EXCLUSIVE` lock — fine on a
low-write table, but schedule it outside peak hours on production.

### 5. Post-check

```sql
SELECT table_name, column_name, is_nullable
  FROM information_schema.columns
 WHERE (table_name='campaigns' AND column_name='primary_sponsor_id')
    OR (table_name IN ('polls','contests','campaign_components','scheduled_components') AND column_name='sponsor_id')
 ORDER BY table_name, column_name;
```

All 5 should show `is_nullable = NO`.

## Rollback

If Phase 3 breaks production traffic (e.g. a forgotten legacy insert path
still tries to write NULL), the immediate un-break is reversing each
constraint:

```sql
ALTER TABLE campaigns            ALTER COLUMN primary_sponsor_id DROP NOT NULL;
ALTER TABLE polls                ALTER COLUMN sponsor_id         DROP NOT NULL;
ALTER TABLE contests             ALTER COLUMN sponsor_id         DROP NOT NULL;
ALTER TABLE campaign_components  ALTER COLUMN sponsor_id         DROP NOT NULL;
ALTER TABLE scheduled_components ALTER COLUMN sponsor_id         DROP NOT NULL;
```

No data loss from the rollback itself. The TS schema will then over-declare
(`.notNull()` while DB allows NULL) until Phase 3 is re-run; in that window
be careful with reads — Drizzle-generated types will lie about nullability.

## Test branch — what we did

On `test/tv-subscribe-validation` (Neon branch `br-patient-meadow-a8dat89p`):

- 13 orphan campaigns deleted via cascade (`XXL-TV2`, `Pregnancy`, `VG demo`,
  `Power demo`, `ClientImplementationGuide`, `Elkjop`, several "Test Campaign"
  rows). Together they owned 45 campaign_components + 1 scheduled_component
  and **zero** broadcasts / polls / contests / activations / cart_intents.
- `phase3-enforce-sponsor-fks.sql` applied. All 5 columns now `is_nullable=NO`.
- Post-audit: the TV2 demo flow (campaign 36, broadcast `barcelona-psg-2026-03-03`)
  unaffected — Phase 3 only touched orphan rows.
