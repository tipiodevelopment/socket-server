# TASK ARCH-01b — Backend API (multi-sponsor)

**Status: TODO — Do after ARCH-01a**

## New endpoints

### Campaign sponsors
```
GET    /api/campaigns/:id/sponsors
POST   /api/campaigns/:id/sponsors          body: { sponsorId, role }
DELETE /api/campaigns/:id/sponsors/:sponsorId
```

### Broadcast sponsor slots
```
GET    /api/broadcasts/:id/sponsor-slots
POST   /api/broadcasts/:id/sponsor-slots    body: { sponsorId, campaignId, role, triggerType, triggerValue, productIds }
PUT    /api/broadcasts/:id/sponsor-slots/:slotId
DELETE /api/broadcasts/:id/sponsor-slots/:slotId
POST   /api/broadcasts/:id/sponsor-slots/:slotId/execute   → fires shoppable_ad WS event
```

## Update existing endpoints

### GET /api/campaigns/:id
Add to response:
```json
{ "sponsors": [{ "id": 3, "name": "Elkjøp", "logoUrl": "...", "primaryColor": "#f7b23b", "role": "full" }] }
```

### POST /api/broadcasts/:id/shoppable-ad
Accept either:
- `{ slotId }` → use pre-configured slot data, mark as executed
- `{ productId, sponsorId }` → ad-hoc trigger (existing behavior)

Add `slotId` (optional) to WS event payload.

## Notes
- auto_execute: save config but do NOT implement scheduler yet
- Keep all existing endpoints working
