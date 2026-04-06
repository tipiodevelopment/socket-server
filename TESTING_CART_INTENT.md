# Testing Cart-Intent Flow (E2E)

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

### Campaign
```
Campaign 35: "Mars 2026"
ClientAppId: 17 (Viaplay)
WebhookUrl: (por configurar)
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

### 2. Configurar webhook en Campaign 35

```bash
# Reemplaza YOUR-UUID con el UUID de webhook.site
npx tsx scripts/setup-webhook.ts https://webhook.site/YOUR-UUID
```

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
- **En webhook.site**: Deberías ver un POST con el payload canónico:
```json
{
  "vio_notification_version": 1,
  "vio_event_type": "cart_intent",
  "userId": "test_user_123",
  "productId": "456",
  "campaignId": 35,
  "productName": "Nike Air Max",
  "action": "cart_intent",
  "event": "cart_intent"
}
```

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

## Próximos pasos

Después de validar el flow:
1. Documentación formal: `API_CONTRACT.md` + curls definitivos
2. Actualizar `openapi.yaml` alineado con comportamiento probado
3. Crear endpoint `register-device` si es necesario
4. Integración con Azure mock partner (siguiente pista)
