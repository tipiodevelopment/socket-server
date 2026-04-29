# Shoppable Ad Authoring (dashboard)

How an operator configures a shoppable ad slot for a broadcast and how the dashboard
talks to the backend to build it.

## Mental model

```
campaign  ──┬── primary_sponsor (FK → sponsors)
            └── campaign_sponsors[*]   (M:N → sponsors, secondaries)
                       ↑
   broadcast_sponsor_slots[*]  (one row per pre-configured ad in a broadcast)
                       │
                       ├── sponsor_id   (must be primary or one of the secondaries)
                       ├── product_ids  (Commerce product ids picked from sponsor's catalog)
                       ├── trigger_type (manual | match_minute | absolute_time)
                       └── auto_execute (fire automatically at trigger time — scheduler)
```

A slot is just a *plan* until it's executed. Execution is what fans out the
`shoppable_ad` WebSocket event to viewers and persists the activation row.

## Pages and components

- **`pages/broadcast-detail.tsx` → `ShoppableAdTriggerSection`**
  - "+ Add slot" dialog → `POST /api/broadcasts/:broadcastId/sponsor-slots`
  - Slot list → `GET /api/broadcasts/:broadcastId/sponsor-slots`
  - "Execute" button on each slot → `POST /api/broadcasts/:broadcastId/sponsor-slots/:slotId/execute`
  - Ad-hoc "Trigger Ad" form (without saving a slot) → `POST /api/broadcasts/:broadcastId/trigger-shoppable-ad`

- **`components/sponsor-catalog-picker.tsx`** — reused by both flows above.
  - Takes a `sponsorId`, fetches that sponsor's catalog via `useSponsorCatalog`
  - `multi` prop toggles between single-product (ad-hoc) and multi-product (slot) selection
  - Search input filters client-side (the upstream GraphQL has no search arg today)
  - Empty state when no sponsor is selected — keeps the form coherent

- **`hooks/use-sponsor-catalog.ts`** — typed react-query wrapper around
  `GET /api/commerce/sponsors/:sponsorId/catalog`. Disabled until a sponsor is
  picked. Caches per `(sponsorId, opts)` for 60 s.

- **`hooks/use-debounced-value.ts`** — generic 250 ms debounce for the search input.

## Sponsor scoping

The sponsor dropdown in the slot dialog is **constrained** to the campaign's
sponsors (`GET /api/campaigns/:id/sponsors`) — primary + secondaries — not the
global sponsor list. To add a new option:

1. Open campaign settings (`pages/campaign-dashboard.tsx`).
2. "+ Add sponsor" → picks from the global sponsor list, posts to
   `POST /api/campaigns/:id/sponsors`.
3. The dropdown in the slot dialog updates automatically (react-query invalidates
   `['/api/campaigns', id, 'sponsors']`).

> Future improvement: an inline "+ Add to campaign" affordance on the slot dialog
> dropdown so the operator doesn't have to navigate away.

## Backend endpoints touched

| Method | Path | Purpose |
|---|---|---|
| `GET`    | `/api/broadcasts/:broadcastId/sponsor-slots`            | list slots |
| `POST`   | `/api/broadcasts/:broadcastId/sponsor-slots`            | create slot |
| `PUT`    | `/api/broadcasts/:broadcastId/sponsor-slots/:slotId`    | update slot (no UI yet) |
| `DELETE` | `/api/broadcasts/:broadcastId/sponsor-slots/:slotId`    | remove slot |
| `POST`   | `/api/broadcasts/:broadcastId/sponsor-slots/:slotId/execute` | dispatch slot now (`source=slot-scheduler`) |
| `POST`   | `/api/broadcasts/:broadcastId/trigger-shoppable-ad`     | one-off ad-hoc dispatch (`source=dashboard`) |
| `GET`    | `/api/commerce/sponsors/:sponsorId/catalog`             | list sponsor's Commerce catalog (used by both pickers) |
| `GET`    | `/api/campaigns/:id/sponsors`                           | sponsors of this campaign (dropdown source) |

`/api/commerce/sponsors/:sponsorId/catalog` is the only catalog endpoint the
picker should call. The older `/api/commerce/products?campaignId=X` is still
used by `ShoppableProductsSection` for the "products already configured across
this campaign's slots" summary view — different concern, different endpoint.

## Validation gates the operator can hit

- `422 SPONSOR_MISSING_AVATAR` — every shoppable_ad dispatch enforces
  `sponsor.avatar_url IS NOT NULL` so the overlay never has to handle a missing
  brand mark. If the operator sees this in the toast, they need to upload an
  avatar on the sponsor's edit page.

- `422 SPONSOR_MISSING_COMMERCE_KEY` — the catalog endpoint refuses sponsors
  without a `commerce_api_key`. Visual-only sponsors can be in the campaign for
  branding (poll/contest CTAs, lead capture) but cannot back a `product` slot.

- `400 SPONSOR_NOT_IN_CAMPAIGN` — the helper rejects dispatches where the
  picked sponsor is not the campaign's primary or one of its secondaries. The
  dashboard already prevents this by scoping the dropdown, so it should only
  fire on direct API mistakes.

## Trigger types

All three trigger types are exposed in the dialog:

- `manual` — operator clicks "Execute" on the slot when ready.
- `match_minute` — minute number; the scheduler fires when the broadcast clock
  passes that minute (auto_execute=true required).
- `absolute_time` — ISO datetime; the scheduler fires at that wall-clock time
  (auto_execute=true required).

`auto_execute` is the toggle that opts the slot into scheduler dispatch; without
it, even a `match_minute` slot stays manual until the operator clicks Execute.
