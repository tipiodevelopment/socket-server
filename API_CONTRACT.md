# Vio SDK API Contract

> Fuente de verdad para endpoints y WebSocket events del backend.
> Este archivo es consumido por los SDKs (Swift/Kotlin) via `.cursorrules`.
> **Última actualización**: 2026-04-05

## Base URLs
- REST: `https://api-dev.vio.live`
- WebSocket: `wss://api-dev.vio.live/ws/{campaignId}`

## Autenticación SDK
- Header: `Authorization: ApiKey <vio_app_api_key>`
- O query param: `?apiKey=<vio_app_api_key>`
- O bundle ID header: `X-App-Bundle-ID: <bundle_id>`

---

## REST Endpoints

### Discovery & Config

#### GET /v1/sdk/config
Zero-config SDK initialization.
- **Auth**: ApiKey
- **Response**:
```json
{
  "clientApp": { "id": 1, "name": "Viaplay", "apiKey": "..." },
  "endpoints": { "restBase": "...", "webSocketBase": "...", "commerceGraphQL": "..." },
  "features": { "engagement": true, "adPlacements": true, "commerce": true, "lineup": true },
  "commerce": { "apiKey": "...", "endpoint": "..." },
  "theme": { "primaryColor": "#...", "accentColor": "#..." },
  "markets": []
}
```

#### GET /v1/sdk/campaigns
- **Auth**: ApiKey o Bundle ID
- **Query**: `matchId` (optional)
- **Response**:
```json
{
  "campaigns": [{
    "campaignId": 35,
    "campaignName": "...",
    "campaignLogo": "...",
    "isActive": true,
    "components": [{ "id": "uuid", "type": "banner", "name": "...", "config": {}, "status": "active", "locationId": "sport-detail-banner" }]
  }]
}
```

#### GET /v1/campaigns/:campaignId/config
- **Auth**: ApiKey
- **Query**: `matchId` (optional)
- **Response**:
```json
{
  "campaignId": 35,
  "brand": { "name": "Elkjøp", "iconAsset": "...", "iconUrl": "...", "logoUrl": "...", "sponsorBadgeText": "..." },
  "engagement": { "demoMode": false, "defaultPollDuration": 30, "defaultContestDuration": 60 },
  "ui": { "theme": { "primaryColor": "#...", "secondaryColor": "#..." } },
  "features": { "enablePolls": true, "enableContests": true, "enableChat": true },
  "integrations": {
    "commerce": { "enabled": true, "apiKey": "KCXF10Y-...", "channelId": null }
  },
  "checkout": { "paymentMethods": [] }
}
```

### Broadcast Resolution

#### GET /v1/sdk/broadcast
Resolve contentId → broadcast.
- **Auth**: ApiKey o Bundle ID
- **Query**: `contentId` (required), `country` (optional)
- **Response**:
```json
{
  "hasEngagement": true,
  "broadcastId": "real-madrid-vs-barcelona-2026-02-25",
  "broadcastName": "...",
  "status": "live",
  "campaignId": 35,
  "websocketChannel": "/ws/35",
  "broadcastComponents": {
    "polls": [{ "id": 15, "question": "...", "options": [] }],
    "contests": []
  }
}
```

### Components (Location Slots)

#### GET /v1/sdk/components
- **Auth**: ApiKey
- **Query**: `locationId` (optional), `campaignId` (optional)
- **Response**:
```json
{
  "components": [{
    "instanceId": 1,
    "campaignId": 35,
    "componentId": "uuid",
    "locationId": "sport-detail-banner",
    "type": "banner",
    "config": {}
  }],
  "count": 1
}
```

**Standard Location Slots**: `sport-detail-banner`, `sport-detail-carousel`, `sport-home-banner`, `sport-home-carousel`, `casting-overlay-banner`

### Engagement — Polls

#### GET /v1/engagement/polls
- **Auth**: None (public)
- **Query**: `broadcastId` (required), `limit` (max 100), `offset`, `currentVideoTime`
- **Response**:
```json
{
  "polls": [{
    "id": 15,
    "question": "Who will score next?",
    "options": [{ "id": 1, "text": "Messi", "voteCount": 42, "percentage": 60 }],
    "duration": 30,
    "isActive": true
  }],
  "pagination": { "limit": 20, "offset": 0, "total": 2, "hasMore": false }
}
```

#### POST /v1/engagement/polls/:pollId/vote
- **Auth**: broadcastId validation
- **Rate limit**: 30/min
- **Body**: `{ "optionId": 1, "userId": "user-123", "broadcastId": "..." }`
- **Response**: `{ "success": true, "results": { "totalVotes": 43, "options": [...] } }`

### Engagement — Contests

#### GET /v1/engagement/contests
- **Auth**: None (public)
- **Query**: `broadcastId` (required), `limit` (max 100), `offset`, `currentVideoTime`
- **Response**:
```json
{
  "contests": [{
    "id": 5,
    "title": "Win a jersey!",
    "prize": "Signed jersey",
    "isActive": true
  }],
  "pagination": { "limit": 20, "offset": 0, "total": 1, "hasMore": false }
}
```

#### POST /v1/engagement/contests/:contestId/participate
- **Auth**: broadcastId validation
- **Rate limit**: 10/min
- **Body**: `{ "userId": "user-123", "broadcastId": "...", "answers": {} }`
- **Response**: `{ "success": true }`

### Broadcast Data

#### GET /v1/sdk/broadcasts/:broadcastId/lineup
- **Auth**: None
- **Response**: Lineup data from Sportmonks

#### GET /v1/sdk/broadcasts/:broadcastId/score
- **Auth**: ApiKey
- **Response**: `{ "broadcastId": "...", "hasScore": true, "homeTeam": {...}, "awayTeam": {...}, "minute": 65, "matchStatus": "live" }`

#### GET /v1/sdk/broadcasts/:broadcastId/stats
- **Auth**: ApiKey
- **Response**: `{ "broadcastId": "...", "hasStats": true, "stats": {...} }`

#### GET /v1/sdk/livescores
- **Auth**: ApiKey
- **Response**: `{ "livescores": [{ "broadcastId": "...", "homeTeam": {...}, "awayTeam": {...}, "minute": 65 }], "count": 1 }`

#### GET /v1/sdk/broadcasts/:broadcastId/chat
- **Auth**: ApiKey
- **Query**: `limit` (default 50)
- **Response**: `{ "broadcastId": "...", "messages": [{ "id": 1, "username": "...", "message": "...", "type": "message", "createdAt": "..." }], "count": 10 }`

### Localization

#### GET /v1/localization/:language
- **Auth**: ApiKey
- **Languages**: `no`, `en`, `sv`, `es`, `de`, `fr`, `da`, `fi`
- **Query**: `campaignId`, `matchId` (optional)
- **Response**: `{ "language": "no", "translations": { "key": "value" }, "dateFormat": "...", "timeFormat": "..." }`

### Offers

#### GET /v1/offers
- **Auth**: ApiKey
- **Query**: `campaignId` (required), `placement`, `userId`, `userCountry`
- **Response**: `{ "campaignId": 35, "offers": [{ "id": "uuid", "type": "banner", "config": {} }] }`

---

## WebSocket Events

Connection: `wss://api-dev.vio.live/ws/{campaignId}`

On connect, server immediately emits active polls and contests with `broadcastId`.

### Broadcast Lifecycle

| Event | Key Fields |
|---|---|
| `broadcast_started` | `broadcastId`, `broadcastName`, `campaignId` |
| `broadcast_ended` | `broadcastId`, `broadcastName`, `campaignId` |
| `broadcast_status_changed` | `broadcastId`, `status` (upcoming/live/ended) |

### Campaign Lifecycle

| Event | Key Fields |
|---|---|
| `campaign_started` | `campaignId`, `name` |
| `campaign_ended` | `campaignId`, `endDate` |

### Polls

| Event | Key Fields |
|---|---|
| `poll` | `broadcastId`, `data: { id, question, options[], duration }` |
| `poll_activated` | `pollId`, `broadcastId` |
| `poll_deactivated` | `pollId`, `broadcastId` |
| `poll_results_updated` | `broadcastId`, `pollId`, `results` |

### Contests

| Event | Key Fields |
|---|---|
| `contest` | `broadcastId`, `id`, `title`, `description`, `prize`, `imageUrl` |
| `contest_activated` | `contestId`, `broadcastId` |
| `contest_deactivated` | `contestId`, `broadcastId` |

### Components

| Event | Key Fields |
|---|---|
| `component_status_changed` | `campaignId`, `componentId`, `status` (active/inactive), `component` |
| `component_config_updated` | `campaignId`, `componentId`, `component` |

### Match Data

| Event | Key Fields |
|---|---|
| `score_update` | `broadcastId`, `homeTeam`, `awayTeam`, `minute`, `matchStatus` |
| `lineup_show` | `broadcastId`, `videoTimestamp`, `kickoffVideoTimestamp` |

### Chat

| Event | Key Fields |
|---|---|
| `chat_message` | `data: { broadcastId, username, message, type: "message" }` |
| `tweet` | `data: { broadcastId, username, message, type: "tweet", metadata }` |

### Config

| Event | Key Fields |
|---|---|
| `config:updated` | `campaignId` |
