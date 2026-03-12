# TASK: Zero-Config SDK — Backend Support

## Estado: ✅ COMPLETADO (2026-03-12)

---

## Task 1: GET /v1/sdk/config ✅

Endpoint actualizado — ya no requiere `campaignId`. Solo necesita `apiKey`.

Lógica:
- Busca clientApp por apiKey (validateApiKey middleware)
- Auto-detecta campaña activa via `getClientAppCampaigns(clientApp.id)` — primero `status='active'` con fechas válidas, fallback a la más reciente
- Commerce apiKey: desde sponsors de la campaña (campo `commerceApiKey`), fallback a `reachuApiKey` legacy
- `endpoints.restBase` y `webSocketBase` desde `${req.protocol}://${req.get('host')}`

Response: `{ clientApp, endpoints, features, commerce, theme, markets }`

Verificado: `GET /v1/sdk/config?apiKey=viaplay_api_key_0c611e983b314ff8` →
- clientApp id=17, features.commerce=true, commerceApiKey=KCXF10Y... ✓

---

## Task 2: Rename "Shoppable Ads" → "Sponsor Moments" ✅

Cambios en `client/src/pages/broadcast-detail.tsx`:
- `ShoppableProductsSection` h2: "Shoppable Products" → "Sponsor Moments"
- `ShoppableAdTriggerSection` h2: "Shoppable Ads" → "Sponsor Moments"
- Dialog description: "Pre-program a shoppable ad" → "Pre-program a sponsor moment"

No se tocaron: nombres de componentes, data-testid, API endpoints, tablas DB.

---

## Task 3: `type` y `config` en Sponsor Moments ✅

Schema DB: columnas `type varchar(50) DEFAULT 'product'` y `config json DEFAULT '{}'` ya existían en DB.
- `shared/schema.ts`: campos añadidos al `pgTable`
- `insertBroadcastSponsorSlotSchema`: extends con `type` enum y `config: z.record(z.any()).optional()`

API:
- `GET /api/broadcasts/:id/sponsor-slots` → incluye `type` y `config` (storage select actualizado)
- `POST /api/broadcasts/:id/sponsor-slots` → acepta `type` y `config` via Zod schema

UI (slot creation dialog):
- Dropdown "Type": product / lead capture / poll CTA / contest CTA / link
- Campos dinámicos según tipo:
  - `product`: productos picker (existente)
  - `lead`: title, fields (email/phone/name), cta
  - `poll_cta` / `contest_cta`: pollId/contestId, message, cta
  - `link`: url, title, cta
- Badge de tipo en slot list

Retrocompat: slots existentes muestran `type: product`, `config: {}` ✓
