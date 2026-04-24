# iOS SDK — v2 Migration Gap

> **Purpose**: list every legacy HTTP call the iOS SDK (`VioSwiftSDK`) still makes
> at runtime despite the "direct cut v1→v2" decision (2026-04-24). The Postman
> collection treats these as NOT part of the v2 contract — this doc tracks them
> as technical debt to resolve before the SDK is considered clean.
>
> **Rule locked** (2026-04-24): _no legacy in SDK_. Every row below needs to be
> migrated to a `/v2/*` equivalent or removed from the SDK code path.
>
> **Branch**: `feature/api-v2-urls` (VioSwiftSDK, off develop). Initial 3
> renames landed in commit `88320c5`; the 9 remaining are tracked here.

## Already killed (2026-04-24, commit `748aeac` on `feature/api-v2-urls`)

4 legacy calls that conflicted with multi-sponsor state have been removed from iOS:

| # | Endpoint | File:line (pre-change) | Replacement |
|---|---|---|---|
| ~~1~~ | `GET /v1/sdk/campaigns?apiKey=` | `CampaignManager.swift:1082` | `GET /v2/mobile/config` (now populates `currentCampaign + activeCampaigns` in `fetchAndApplySdkBootstrapNow`) |
| ~~2~~ | `GET /v1/sdk/config?apiKey=&campaignId=` | `CampaignManager.swift:816` | deleted — `/v2/mobile/config` is the single bootstrap, no fallback |
| ~~6~~ | `GET /v1/offers?apiKey=&campaignId=` | `CampaignManager.swift:1369` | deleted — components come from WS `component_status_changed` + `GET /v2/mobile/broadcasts/:id/components` |
| ~~7~~ | `GET /api/campaigns/:id/active-components` | `OfferBannerModels.swift:567` | deleted — WS events are authoritative |

Net: iOS no longer leaks apiKey in query params for any multi-sponsor-related call. `VioConfiguration.primarySponsor + secondarySponsors + commerce` is only populated from `/v2/mobile/config`.

## Calls the iOS SDK still makes (9 remaining — deferred)

| # | Endpoint | iOS file:line | Purpose in code | Migration plan |
|---|---|---|---|---|
| 1 | `GET /v1/sdk/campaigns?apiKey=` | `Sources/VioCore/Managers/CampaignManager.swift:1082` | Zero-config campaign discovery on app launch | **Replace with `/v2/mobile/config`** — that endpoint already returns the campaign. Refactor `discoverCampaigns` to consume the v2 shape. |
| 2 | `GET /v1/sdk/config?apiKey=&campaignId=` | `Sources/VioCore/Managers/CampaignManager.swift:816` | Legacy commerce fallback when v2 config fails | **Delete the fallback**. Direct cut — if v2 fails the SDK logs an error; no legacy safety net. |
| 3 | `GET /v1/campaigns/:id/config?apiKey=` | `Sources/VioCore/Network/ConfigAPIClient.swift:20` | Per-campaign brand/theme/checkout config | **Fold into `/v2/mobile/config`** (extend response with theme + checkout blocks) or create `/v2/mobile/campaigns/:id/config`. |
| 4 | `GET /v1/engagement/config?apiKey=&broadcastId=` | `Sources/VioCore/Network/ConfigAPIClient.swift:64` | Engagement-specific config (poll durations, demo mode) | **Fold into `/v2/mobile/broadcasts/:id/capabilities`** (extend with engagement settings). |
| 5 | `GET /v1/localization/:lang?apiKey=` | `Sources/VioCore/Network/ConfigAPIClient.swift:107` | UI translations (no, en, sv, es, de, fr, da, fi) | **Create `/v2/mobile/localization/:lang`** (same handler, v2 path). Or bundle translations locally in the SDK if Vio shouldn't host them. |
| 6 | `GET /v1/offers?apiKey=&campaignId=` | `Sources/VioCore/Managers/CampaignManager.swift:1369` | Legacy banner offers — duplicate of components | **Delete**. Superseded by `/v2/mobile/broadcasts/:id/components` (which now carries sponsor.id + commerce block). Remove `CampaignManager.fetchOffers` entirely. |
| 7 | `GET /api/campaigns/:id/active-components` | `Sources/VioCore/Models/OfferBannerModels.swift:567` | Alternative polling-based components discovery (offer-banner subsystem) | **Delete**. Replace with WS `component_status_changed` (already implemented) + initial fetch via `/v2/mobile/broadcasts/:id/components`. Retire the offer-banner polling code path. |
| 8 | `GET /v1/sdk/broadcasts/:id/lineup?apiKey=` | `Sources/VioCastingUI/Managers/Match/LineupService.swift:58` | Match lineup from Sportmonks | **Create `/v2/mobile/broadcasts/:id/lineup`** — same handler, v2 path. |
| 9 | `GET /v1/sdk/broadcast?contentId=&country=&apiKey=` | `Sources/VioCore/Services/BroadcastValidationService.swift:24` | `contentId` → `broadcastId` resolver (Viaplay flow) | **Create `/v2/mobile/broadcasts/resolve?contentId=`** OR drop the contentId flow entirely if only Viaplay uses it and they're willing to send broadcastId directly. |

Plus 4 engagement endpoints (polls + contests) in
`Sources/VioEngagementSystem/Data/BackendEngagementRepository.swift`:

| # | Endpoint | File | Migration plan |
|---|---|---|---|
| 10 | `GET /v1/engagement/polls?broadcastId=` | BackendEngagementRepository.swift (multiple) | **Migrate to `/v2/mobile/engagement/broadcasts/:id/polls`**. Create new backend handler (thin wrapper over existing). |
| 11 | `POST /v1/engagement/polls/:pollId/vote` | idem | **Migrate to `/v2/mobile/engagement/polls/:id/vote`**. |
| 12 | `GET /v1/engagement/contests?broadcastId=` | idem | **Migrate to `/v2/mobile/engagement/broadcasts/:id/contests`**. |
| 13 | `POST /v1/engagement/contests/:contestId/participate` | idem | **Migrate to `/v2/mobile/engagement/contests/:id/participate`**. |

## Scope / impact

- **For the cart-intent smoke test (Phase 5)**: none of these are blockers. The
  cart-intent receive pipeline only needs `/v2/mobile/config` + WS +
  `/v2/commerce/sponsors/:id/catalog` + direct GraphQL. The iOS demo works
  even if the 9 legacy calls fail (they currently don't — backend still has
  them). But the demo would show missing features (no polls, no lineup,
  no localization, no offer banners) if we delete the handlers prematurely.
- **For "clean v2 SDK"**: all 13 must be migrated or deleted.
- **Risk of deleting without migrating**: feature regressions in host apps
  that depend on polls/contests/lineup/localization.

## Proposed execution order (follow-up PRs, after smoke test passes)

1. **PR A — delete redundant legacy** (items 2, 6, 7). Low risk: these are
   duplicates or fallbacks. 1 iOS commit.
2. **PR B — migrate discovery + per-campaign config** (items 1, 3). Refactor
   `CampaignManager.discoverCampaigns` + `ConfigAPIClient.fetchCampaignConfig`
   to consume `/v2/mobile/config`. May require backend to extend the v2
   config response with theme + checkout.
3. **PR C — v2 endpoints for lineup + broadcast resolver + engagement config**
   (items 4, 8, 9). Backend adds 3 new routes; iOS renames URL strings.
4. **PR D — localization** (item 5). Decide: hosted under `/v2/mobile/localization/:lang`
   or bundle locally. Small PR either way.
5. **PR E — engagement migration** (items 10-13). Backend adds 4 `/v2/mobile/engagement/*`
   routes as aliases of the v1 handlers; iOS renames. When iOS is on v2, retire v1.

Total estimate: ~1.5 days of work across backend + iOS.

## Backend legacy handlers (not yet touched)

These still exist in `server/routes.ts` and serve the iOS SDK today. After
the 5 follow-up PRs above ship, each can respond `410 Gone` with a
`Link: </v2/mobile/...>; rel="successor-version"` header:

- `/v1/sdk/campaigns` (line 5562)
- `/v1/sdk/config` (line 5783)
- `/v1/sdk/broadcast` (line 5665)
- `/v1/campaigns/:id/config` (line 5859)
- `/v1/engagement/config` (line 6005)
- `/v1/localization/:lang` (line 6056)
- `/v1/offers` (line 6143)
- `/v1/sdk/broadcasts/:id/lineup` (line 4597)
- `/v1/engagement/polls|contests` (5 routes, lines 3489-3637)
- `/api/campaigns/:id/active-components` (line 2802)
- `/v1/sdk/broadcasts/:id/{chat,score,stats}` (if iOS still calls — not
  verified yet)
- `/v1/sdk/livescores` (if iOS still calls — not verified yet)
- `/v1/sdk/components` (if iOS still calls — not verified yet)

## How this doc dies

Merge the 5 PRs above, then:

1. Re-grep iOS `Sources/` for `/v1/` — should return empty (or only comments).
2. Backend legacy routes respond `410 Gone`.
3. Delete this file in the same commit that retires the last legacy handler.
