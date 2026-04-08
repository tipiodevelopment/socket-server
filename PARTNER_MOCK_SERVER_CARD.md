# Partner mock (Vio integration card)

**Base URL:** `https://viopartnermockv2.azurewebsites.net`

Use this with **Vio ClientApp** fields `webhookUrl` and `partnerDeviceRegisterUrl` (dashboard: Apps → app → Integrations, or `npx tsx scripts/setup-webhook-clientapps.ts`).

---

## 1. Device registration (server-to-server from Vio)

Vio calls this **after** saving the token in `device_tokens`, only if `partnerDeviceRegisterUrl` is set. Client still gets `200 { "success": true }` if this forward fails (Vio logs only).

| | |
| --- | --- |
| **Method / path** | `POST /api/v1/partner/devices/register` |
| **Full URL** | `https://viopartnermockv2.azurewebsites.net/api/v1/partner/devices/register` |
| **Headers** | `Content-Type: application/json` |
| **Body (JSON)** | `{ "userId": "<string>", "deviceToken": "<string>", "platform": "ios" \| … }` |

**Example**

```http
POST /api/v1/partner/devices/register HTTP/1.1
Host: viopartnermockv2.azurewebsites.net
Content-Type: application/json

{"userId":"tv2_demo_user","deviceToken":"<apns_hex>","platform":"ios"}
```

**Mock response (observed):** HTTP `200`, body text `Device registered` (first request after idle can take ~1 minute cold start).

**Triggered from Vio by:** `POST /api/campaigns/:campaignId/register-device` (API key auth, same as SDK).

---

## 2. Partner webhook (offline `cart_intent` and other events)

Vio POSTs here when the user is **not** connected on WebSocket (and `webhookUrl` is set). Payload matches `cart-intent` handling in `server/routes.ts`.

| | |
| --- | --- |
| **Method / path** | `POST /api/v1/partner/webhook` |
| **Full URL** | `https://viopartnermockv2.azurewebsites.net/api/v1/partner/webhook` |
| **Headers** | `Content-Type: application/json` |
| **`cart_intent` body (JSON)** | See below |

```json
{
  "vio_notification_version": 1,
  "vio_event_type": "cart_intent",
  "userId": "<string>",
  "productId": "<string>",
  "campaignId": <number>,
  "productName": "<string>",
  "action": "cart_intent",
  "event": "cart_intent"
}
```

**Example response (observed):** HTTP `200`, `{"status":"success","message":"Webhook processed","devices_notified":0}` (`devices_notified` may be greater than 0 if a device was registered for that user in the mock).

---

## 3. Quick curl checks

```bash
curl -sS -X POST "https://viopartnermockv2.azurewebsites.net/api/v1/partner/devices/register" \
  -H "Content-Type: application/json" \
  -d '{"userId":"smoke_user","deviceToken":"deadbeef","platform":"ios"}'

curl -sS -X POST "https://viopartnermockv2.azurewebsites.net/api/v1/partner/webhook" \
  -H "Content-Type: application/json" \
  -d '{"vio_notification_version":1,"vio_event_type":"cart_intent","userId":"smoke_user","productId":"123","campaignId":1,"productName":"Test","action":"cart_intent","event":"cart_intent"}'
```

---

## 4. Dev apps preconfigured by script

`scripts/setup-webhook-clientapps.ts` sets **both** URLs on ClientApp **17** (Viaplay) and **18** (TV2) to the endpoints above.
