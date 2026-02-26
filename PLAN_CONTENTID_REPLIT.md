# Plan contentId — Tareas para Replit (Dashboard)

**Objetivo:** Crear campaña y broadcast en el dashboard para que el SDK VioSwiftSDK pueda validar el flujo contentId con Real Madrid - Barcelona.

**Coordinación:** Este plan se ejecuta en paralelo con el SDK (implementado en Cursor). Una vez completado, el test conjunto valida el flujo end-to-end.

---

## Referencia rápida

| Concepto | Valor |
|----------|-------|
| Backend URL | https://api-dev.vio.live |
| API Key para campaigns/SDK | `viaplay_api_key_0c611e983b314ff8` (Client App Viaplay) |
| contentId / externalId (Real Madrid - Barcelona) | `real-madrid-barcelona-2025-01-24` |
| País demo | `NO` (Noruega) |
| Endpoint validación | `GET /v1/sdk/broadcast?contentId=&country=` |

---

## Paso 1: Verificar que existe el Client App Viaplay

**Pre-requisito:** El Client App "Viaplay" debe existir en el dashboard con la API key `viaplay_api_key_0c611e983b314ff8`.

1. Ir a **Apps** (`/apps`)
2. Buscar el app con bundle ID o nombre que corresponda a Viaplay
3. Verificar que la API key sea `viaplay_api_key_0c611e983b314ff8`
4. Si no existe: crear Client App con esa API key y bundle ID compatible (ej. `com.viaplay.ios` o el que use el demo)

---

## Paso 2: Crear campaña

1. Ir a **Campaigns** → **New Campaign** (`/campaigns/new`)
2. Rellenar:
   - **Campaign Name:** "Viaplay Demo 2025" (o similar)
   - **Assign to App:** Seleccionar el app **Viaplay** (el que tiene la API key anterior)
   - **Start Date / End Date:** Fechas que incluyan hoy
   - **Target Countries:** Incluir **NO** (Noruega)
   - **Estado:** Activa (no pausada)
3. Guardar (redirect a `/campaigns/:id`)

**Importante:** La campaña debe estar asignada al mismo Client App que tiene la API key. El backend resuelve: API key → clientApp → campañas de ese app → broadcast con externalId.

---

## Paso 3: Crear broadcast en esa campaña

1. En el Campaign Dashboard, abrir la pestaña **Broadcasts**
2. Clic en **New Broadcast**
3. Rellenar:
   - **Broadcast Name:** "Real Madrid vs Barcelona"
   - **External Content ID:** `real-madrid-barcelona-2025-01-24` (debe coincidir exactamente)
   - **Status:** `upcoming` o `live` (para testing, `live` permite ver engagement inmediato)
   - **Start Time / End Time:** Opcional
4. Guardar

**Importante:** El External Content ID es el mapeo entre el ID interno del partner (Viaplay) y el broadcast en Vio. El SDK usa ese valor como `contentId` en la llamada.

---

## Paso 4: Crear al menos un poll

1. Navegar al broadcast creado: click en el nombre → `/broadcasts/:broadcastId`
2. En la sección **Active Engagement (Polls)** o similar, crear un poll:
   - **Question:** "¿Quién gana el partido?" (o similar)
   - **Options:** "Real Madrid", "Barcelona", "Empate"
   - **Duration:** 60 segundos (o el que prefieras)
   - **isActive:** true
3. Guardar

Opcional: crear un contest también en la sección Contests.

---

## Paso 5: Verificar que el backend responde correctamente

Ejecutar antes de probar el SDK:

```bash
curl "https://api-dev.vio.live/v1/sdk/broadcast?contentId=real-madrid-barcelona-2025-01-24&country=NO" \
  -H "X-Api-Key: viaplay_api_key_0c611e983b314ff8"
```

**Respuesta esperada (hasEngagement: true):**
```json
{
  "hasEngagement": true,
  "broadcastId": "...",
  "broadcastName": "Real Madrid vs Barcelona",
  "status": "live",
  "campaignId": 35,
  "websocketChannel": "/ws/35",
  "campaignComponents": [...],
  "broadcastComponents": {
    "chat": { "enabled": true },
    "polls": [{ "id": 1, "question": "...", "isActive": true, "options": [...] }],
    "contests": [...]
  }
}
```

**Si devuelve `hasEngagement: false`:** Revisar que la campaña esté asignada al app Viaplay, que el broadcast tenga el externalId exacto, y que el status del broadcast sea `live` si quieres ver engagement inmediato.

---

## Paso 6: Test conjunto (con el SDK)

Una vez el curl devuelve `hasEngagement: true`:

1. **SDK (App Viaplay):** Abrir el demo, seleccionar Real Madrid - Barcelona
2. **Esperado:** Se muestran polls, chat, contests (según lo que hayas creado)
3. **Logs:** El SDK debe mostrar `hasEngagement: true` y `broadcastId` recibido

---

## Checklist para Replit

- [ ] Client App Viaplay existe con API key `viaplay_api_key_0c611e983b314ff8`
- [ ] Campaña creada asignada al app Viaplay
- [ ] Campaña activa (no pausada), fechas incluyen hoy, targetCountries incluye NO
- [ ] Broadcast creado con External Content ID = `real-madrid-barcelona-2025-01-24`
- [ ] Broadcast en status `live` (o `upcoming` si se prueba con scheduler)
- [ ] Al menos un poll creado y activo
- [ ] Curl de verificación devuelve `hasEngagement: true`

---

## Notas de coordinación

- **SDK:** El flujo contentId ya está implementado en VioSwiftSDK (BroadcastValidationService, VioSessionContext, rama contentId en setupBroadcastContext).
- **vio-config:** El demo Viaplay usa `campaigns.campaignApiKey: viaplay_api_key_0c611e983b314ff8` para las llamadas a `/v1/sdk/broadcast`.
- **Barcelona-PSG:** Sigue usando demo estático (TimelineDataGenerator): no se llama a `/v1/sdk/broadcast` para ese partido.

---

*Documento generado para alineación con el plan contentId. Última actualización: Febrero 2026.*
