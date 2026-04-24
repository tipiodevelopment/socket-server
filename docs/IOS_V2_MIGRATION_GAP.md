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

Direct calls (NOT fallbacks per the locked rule) for features we haven't migrated yet. Each migrates when we advance to its feature domain.

| # | Endpoint | iOS file:line | Purpose in code | Migration plan |
|---|---|---|---|---|
| 1 | `GET /v1/campaigns/:id/config?apiKey=` | `Sources/VioCore/Network/ConfigAPIClient.swift:20` | Per-campaign brand/theme/checkout config | **Fold into `/v2/mobile/config`** (extend response with theme + checkout blocks) or create `/v2/mobile/campaigns/:id/config`. |
| 2 | `GET /v1/engagement/config?apiKey=&broadcastId=` | `Sources/VioCore/Network/ConfigAPIClient.swift:64` | Engagement-specific config (poll durations, demo mode) | **Fold into `/v2/mobile/broadcasts/:id/capabilities`** (extend with engagement settings). |
| 3 | `GET /v1/localization/:lang?apiKey=` | `Sources/VioCore/Network/ConfigAPIClient.swift:107` | UI translations (no, en, sv, es, de, fr, da, fi) | **Create `/v2/mobile/localization/:lang`** OR bundle locally in the SDK if Vio shouldn't host them. |
| 4 | `GET /v1/engagement/polls?broadcastId=` | `Sources/VioEngagementSystem/Data/BackendEngagementRepository.swift` (multiple) | Active polls for a broadcast | **Create `/v2/mobile/engagement/broadcasts/:id/polls`**. |
| 5 | `POST /v1/engagement/polls/:pollId/vote` | idem | Cast a poll vote | **Create `/v2/mobile/engagement/polls/:id/vote`**. |
| 6 | `GET /v1/engagement/contests?broadcastId=` | idem | Active contests | **Create `/v2/mobile/engagement/broadcasts/:id/contests`**. |
| 7 | `POST /v1/engagement/contests/:contestId/participate` | idem | Submit contest entry | **Create `/v2/mobile/engagement/contests/:id/participate`**. |
| 8 | `GET /v1/sdk/broadcasts/:id/lineup?apiKey=` | `Sources/VioCastingUI/Managers/Match/LineupService.swift:58` | Match lineup from Sportmonks | **Create `/v2/mobile/broadcasts/:id/lineup`** — same handler, v2 path. |
| 9 | `GET /v1/sdk/broadcast?contentId=&country=&apiKey=` | `Sources/VioCore/Services/BroadcastValidationService.swift:24` | `contentId` → `broadcastId` resolver (Viaplay flow) | **Create `/v2/mobile/broadcasts/resolve?contentId=`** OR drop the contentId flow entirely if only Viaplay uses it and they're willing to send broadcastId directly. |

**Orthogonal to multi-sponsor**: none of the 9 touch the sponsor / commerce state pipeline. Multi-sponsor routing is clean and verified with the 3-ad smoke test (see `CURRENT_STATE.md §7`).

## Scope / impact

- **Multi-sponsor smoke test (Phase 5 — passing)**: these 9 are NOT blockers. The cart-intent pipeline uses only `/v2/mobile/config` + WS + `/v2/commerce/sponsors/:id/catalog` + direct GraphQL. All verified clean.
- **For "100% v2 SDK"**: all 9 must migrate. Tracked as follow-up below.
- **Risk of deleting without migrating**: feature regressions (polls, contests, lineup, localization, brand/theme).

## Proposed execution order (post-merge of the current 3 v2 PRs)

1. **PR A — per-campaign brand/theme** (item 1). Fold `/v1/campaigns/:id/config` data (brand + theme + checkout) into the v2 config response. Refactor `ConfigAPIClient.fetchCampaignConfig` to consume v2.
2. **PR B — engagement config + capabilities** (item 2). Merge `/v1/engagement/config` fields into `/v2/mobile/broadcasts/:id/capabilities`.
3. **PR C — engagement endpoints v2** (items 4-7). Backend adds 4 `/v2/mobile/engagement/*` routes as thin wrappers; iOS renames URL strings.
4. **PR D — lineup + broadcast resolver v2** (items 8, 9). 2 new backend routes + iOS renames.
5. **PR E — localization v2** (item 3). Create `/v2/mobile/localization/:lang` or bundle locally.

Total estimate: ~1.5 days of work across backend + iOS.

## Backend legacy handlers (not yet touched)

Still live in `server/routes.ts` to serve the 9 remaining iOS calls.
Retirement plan: once PRs A-E above ship, each endpoint below responds `410 Gone`
with `Link: </v2/mobile/...>; rel="successor-version"` header.

- `/v1/campaigns/:id/config` — PR A
- `/v1/engagement/config` — PR B
- `/v1/engagement/polls|contests` (4 routes + vote/participate) — PR C
- `/v1/sdk/broadcasts/:id/lineup` — PR D
- `/v1/sdk/broadcast?contentId=` — PR D
- `/v1/localization/:lang` — PR E

**Already retirable** (iOS no longer calls, thanks to commit `748aeac`):
- `/v1/sdk/campaigns` — superseded by `/v2/mobile/config`
- `/v1/sdk/config` — superseded by `/v2/mobile/config`
- `/v1/offers` — superseded by `/v2/mobile/broadcasts/:id/components`
- `/api/campaigns/:id/active-components` — superseded by WS + `/v2/mobile/broadcasts/:id/components`

These 4 still live on the backend but no SDK consumer calls them. They can
respond `410 Gone` in the same PR cycle that merges the v2 direct cut
(feature/api-v2-cut → develop).
- `/v1/sdk/broadcasts/:id/{chat,score,stats}` (if iOS still calls — not
  verified yet)
- `/v1/sdk/livescores` (if iOS still calls — not verified yet)
- `/v1/sdk/components` (if iOS still calls — not verified yet)

## How this doc dies

Merge the 5 PRs above, then:

1. Re-grep iOS `Sources/` for `/v1/` — should return empty (or only comments).
2. Backend legacy routes respond `410 Gone`.
3. Delete this file in the same commit that retires the last legacy handler.
