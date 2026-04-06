# Testing Cart-Intent Flow (E2E)

## E2E SDK (TV2 iPhone + Apple TV)

Para **`cart_intent` por WebSocket**, REST y WS del iPhone deben ser **el mismo backend** que recibe el `POST .../cart-intent` del TV (`wsUserMap` vive ahí).

- **Apple TV** (`InteractiveAds-vio`): por defecto `https://api-dev.vio.live` / `wss://api-dev.vio.live/ws/...`.
- **TV2 iPhone** (`VioSwiftSDK` demo, `environment: development`): el repo apunta a **socket-server en local** — `devRestAPIBaseURL` y **`devWsBaseURL`** en `http://127.0.0.1:5001` y `ws://127.0.0.1:5001` (mismo puerto que Express + WS). Usa `api-dev` en ambos solo si pruebas contra el TV en `api-dev`.
- **Regla:** no mezcles REST local con WS remoto; si no, el TV puede ver 200 y el iPhone no recibe `cart_intent` por WS.

Mismo **`userId`** en ambos lados (`tv2_demo_user` en los demos) y la **misma campaña** que devuelve el backend para la API key TV2 (p. ej. id **36** vía `GET /v1/sdk/campaigns`).

**TV2 iPhone (`register-device`, zero-config):** la app llama `CampaignManager.shared.submitApnsDeviceTokenForVioRegister(hex)` desde `AppDelegate`; el manager hace `POST .../register-device` **solo cuando ya hay `currentCampaign`** tras `discoverCampaigns` (misma fuente que el WS). Sin `campaignId` en `vio-config.json`.

### Verificación api-dev (API pública, sin DB)

- `GET https://api-dev.vio.live/v1/sdk/campaigns?apiKey=<TV2>` devuelve **`campaignId`: 36** ("Tv2 Demo Campaign", `isActive: true`) — comprobado vía curl.
- **`webhookUrl` / `partnerDeviceRegisterUrl`:** no están en respuestas SDK; revisar ClientApp TV2 en dashboard o DB (`partner_device_register_url` tras migración).
- **Mismo host WS + REST** en el iPhone que el proceso donde corre `cart-intent` (local: `127.0.0.1:5001`; remoto con TV: `api-dev` en ambos).

## Resumen de cambios implementados

### ✅ Fase 1: Firebase/FCM eliminado
- Eliminados: `server/firebase.ts`, `server/services/android-flow.ts`
- Limpiados: imports y endpoint test webhook en `server/routes.ts`
- Removido: `firebase-admin` de package.json (-61 paquetes)
- **Resultado**: Servidor arranca sin Firebase

### ✅ Fase 2: Validación 403 campaign ↔ clientApp
**Endpoints protegidos:**
- `POST /api/campaigns/:campaignId/cart-intent`
- `GET /v1/campaigns/:campaignId/config`
- `GET /v1/sdk/broadcasts/:broadcastId/chat`
- `GET /v1/sdk/broadcasts/:broadcastId/score`
- `GET /v1/sdk/broadcasts/:broadcastId/stats`

**Lógica**: Si `campaign.clientAppId !== clientApp.id` → 403

---

## Datos de prueba

### ClientApps
```
Viaplay (ID 17)
API Key: viaplay_api_key_0c611e983b314ff8

TV2 (ID 18)
API Key: tv2_api_key_91b4fbf634af4bc5
```

### Campaigns
```
Campaign 35: "Mars 2026"
  - ClientAppId: 17 (Viaplay)
  - Estado: Activa

Campaign 36: "Tv2 Demo Campaign"
  - ClientAppId: 18 (TV2)
  - Estado: Activa (2026-04-06 hasta 2026-04-20)
```

### Webhook Configuration
```
Viaplay (ClientApp 17):
  WebhookUrl: https://viopartnermockv2.azurewebsites.net/api/v1/partner/webhook

TV2 (ClientApp 18):
  WebhookUrl: https://viopartnermockv2.azurewebsites.net/api/v1/partner/webhook

Nota: Ambas apps usan el mismo mock partner de Azure
```

---

## Pasos para testing

### 1. Obtener URL de webhook.site

```bash
# Opción A: Manual
# Ve a https://webhook.site y copia tu URL única

# Opción B: Usando curl para obtener una URL temporal
curl -X POST https://webhook.site/token \
  -H "Content-Type: application/json" \
  | jq -r '.uuid' | xargs -I {} echo "https://webhook.site/{}"
```

### 2. Configurar webhook en ClientApp (NO en Campaign)

**IMPORTANTE**: El webhook se configura a nivel de ClientApp (partner), no de Campaign individual.

✅ **YA CONFIGURADO**: Ambas apps (Viaplay y TV2) apuntan al mock de Azure:
```
https://viopartnermockv2.azurewebsites.net/api/v1/partner/webhook
```

Configurado via script:
```bash
npx tsx scripts/setup-webhook-clientapps.ts
```

Para cambiar la URL (opcional):
1. Ir a http://localhost:5001/apps/17 (Viaplay) o /apps/18 (TV2)
2. Click "Settings" → Tab "Integrations"
3. Modificar "Partner Webhook URL"
4. Save

### 3. Test 1: API key correcto (Viaplay → Campaign 35) ✅

**Debe enviar POST al webhook**

```bash
curl -X POST http://localhost:5001/api/campaigns/35/cart-intent \
  -H "x-api-key: viaplay_api_key_0c611e983b314ff8" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "productId": "456",
    "productName": "Nike Air Max"
  }'
```

**Resultado esperado:**
- Status: 200 OK
- Response: `{"success": true, "mode": "websocket", "userConnected": false}`
- **En webhook.site**: Deberías ver un POST con el **payload canónico** (Vio Notification Envelope):
```json
{
  "vio_notification_version": 1,
  "vio_event_type": "cart_intent",
  "action": "cart_intent",
  "userId": "test_user_123",
  "campaignId": 35,
  "productId": "456",
  "productName": "Nike Air Max",
  "event": "cart_intent"
}
```

**Nota**: Este mismo formato de envelope se usa para TODOS los eventos offline:
- `cart_intent`: Usuario agregó producto al carrito
- `poll_created`: Nueva poll disponible
- `contest_started`: Nuevo contest iniciado
- `broadcast_live`: Broadcast en vivo
- etc.

El partner identifica el tipo de evento con `vio_event_type` y `action`.

### 4. Test 2: API key incorrecto (TV2 → Campaign 35) ❌

**Debe dar 403 Forbidden**

```bash
curl -X POST http://localhost:5001/api/campaigns/35/cart-intent \
  -H "x-api-key: tv2_api_key_91b4fbf634af4bc5" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "productId": "456",
    "productName": "Nike Air Max"
  }'
```

**Resultado esperado:**
- Status: 403 Forbidden
- Response: `{"error": "Campaign does not belong to this API key"}`
- **En webhook.site**: NO debe aparecer ningún POST

### 5. Test 3: Campaign inexistente

```bash
curl -X POST http://localhost:5001/api/campaigns/99999/cart-intent \
  -H "x-api-key: viaplay_api_key_0c611e983b314ff8" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "productId": "456"
  }'
```

**Resultado esperado:**
- Status: 404 Not Found
- Response: `{"error": "Campaign not found"}`

---

## Criterios de éxito

- [ ] API key de Viaplay puede acceder Campaign 35 → envía webhook
- [ ] API key de TV2 NO puede acceder Campaign 35 → 403
- [ ] Webhook payload contiene formato canónico (`vio_notification_version`, `vio_event_type`, etc.)
- [ ] Servidor arranca sin Firebase
- [ ] Sin imports rotos ni errores en consola

---

## Limpieza después del testing

```bash
# Opcional: Remover webhook URL de Campaign 35
npx tsx scripts/setup-webhook.ts ""
```

---

## E2E: notificación real en iPhone (product overlay) + partner mock Azure

Flujo: **Apple TV** (`InteractiveAds-vio` tv2demo-appletv) envía `cart-intent` con `userId: tv2_demo_user` → **Vio** (si el usuario no tiene WS con ese id) → **POST** al `webhookUrl` del ClientApp → **partner-mock-backend** (Azure Function) busca tokens en Table Storage y envía **APNs** → **iPhone** (VioSwiftSDK `Demo/tv2demo`) muestra overlay vía `CampaignManager.handlePushNotificationUserInfo` → `CartIntentProductDetailHost`.

### Infra Azure (partner mock)

- Tabla `DeviceRegistration` en Azure Table Storage; variables `STORAGE_ACCOUNT_NAME`, `STORAGE_ACCOUNT_KEY`.
- APNs: `APNS_P8_CONTENT`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID` = bundle de la app iOS demo (`viodev.tv2demo`), entorno coherente con sandbox/producción del mock.
- **Vio ClientApp (TV2)**: `webhookUrl` = `https://viopartnermockv2.azurewebsites.net/api/v1/partner/webhook` y `partnerDeviceRegisterUrl` = `https://viopartnermockv2.azurewebsites.net/api/v1/partner/devices/register` (Apps → Settings → Integrations, o `npx tsx scripts/setup-webhook-clientapps.ts`).

### iPhone (tv2demo)

- Tras el primer lanzamiento, la app solicita permiso de notificaciones y registra el token APNs; el demo enruta el hex a **`CampaignManager.submitApnsDeviceTokenForVioRegister`**, que llama a `VioCampaignPartnerAPI.registerDevice` cuando **`discoverCampaigns`** ya fijó la campaña (zero-config).
- Vio persiste en `device_tokens` y, si el ClientApp tiene **`partnerDeviceRegisterUrl`**, hace un POST server-to-server al partner con el mismo cuerpo (`userId`, `deviceToken`, `platform`). Si el forward falla, la API sigue respondiendo **200** tras el upsert (solo se loguea el error).
- Sin `webhookUrl`, Vio puede usar `device_tokens` para **APNs directo** en `cart-intent` offline. Con `webhookUrl` + `partnerDeviceRegisterUrl`, el push suele ir desde el partner tras el webhook de `cart_intent`.

### Forzar rama webhook en Vio (no solo WebSocket)

Si el iPhone tiene WebSocket de campaña identificado con el mismo `userId`, Vio puede entregar `cart_intent` por WS y **no** llamar al partner. Para probar push: cerrar la app en iPhone o evitar sesión WS con ese usuario antes de disparar desde el TV.

### Apple TV

- `VioTV.configure(..., userId: "tv2_demo_user")` alineado con iPhone.
- `vio-config.json` (iPhone): `apiKey` TV2 y URLs; **sin** `campaignId` fijo para register-device. Apple TV sigue pudiendo llevar `campaignId` en su JSON para el POST `cart-intent`.

### Checklist

| Paso | Verificación |
|------|----------------|
| Registro Vio | Log `[RegisterDevice]` y fila en `device_tokens` (mismo `campaignId` + `userId`) |
| Forward partner | Log `Partner device register forward → ... HTTP` |
| Registro mock (Table) | Con `partnerDeviceRegisterUrl` configurada: fila `PartitionKey = tv2_demo_user` |
| TV → Vio | Log: `[CartIntent] Partner webhook called ... → 2xx` |
| Mock | Log Azure: APNs enviado / `devices_notified` > 0 |
| iPhone | Banner; overlay de producto al abrir o en foreground (`TV2NotificationCenterDelegate`) |

---

## Próximos pasos

Después de validar el flow:
1. Documentación formal: `API_CONTRACT.md` + curls definitivos
2. Actualizar `openapi.yaml` alineado con comportamiento probado
3. `register-device` en Vio: `POST /api/campaigns/:campaignId/register-device` (SDK: `VioCampaignPartnerAPI.registerDevice`)
4. Integración con Azure mock partner (webhook + APNs desde Table) — ver sección E2E arriba; registro de token en Table es independiente del registro en Vio

## Patrón para eventos futuros

Cuando se implementen otros eventos offline (polls, contests, broadcasts, etc.), usar el MISMO patrón:

```typescript
// 1. Check if user is connected (WS or Redis cluster)
const isUserConnected = checkConnection(userId);

if (isUserConnected) {
  // Send via WebSocket
  ws.send(JSON.stringify(event));
} else {
  // User offline → Partner webhook (Partner-first)
  const webhookUrl = clientApp.webhookUrl;
  if (webhookUrl) {
    const envelope = {
      vio_notification_version: 1,
      vio_event_type: 'poll_created',  // or 'contest_started', etc.
      action: 'poll_created',
      userId,
      campaignId,
      ...eventSpecificData  // pollId, contestId, etc.
    };
    await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(envelope) });
  }
}
```

**IMPORTANTE**: NO implementar APNs/FCM directamente desde Vio. Los partners manejan sus propias notificaciones.
