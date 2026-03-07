
---

## ✅ TASK B09 — Añadir `campaignId` al payload WS `shoppable_ad` (COMPLETADO)

**Contexto:**
Estamos refactorizando InteractiveAds-vio (Apple TV) hacia un SDK real (`VioTVSDK`). La arquitectura nueva requiere que cada evento `shoppable_ad` sea **autosuficiente** — el SDK no almacena campaignId globalmente porque puede haber múltiples campañas activas en un mismo broadcast (ej. Elkjøp + Torshov Sport disparando anuncios distintos).

**Cambio requerido en `routes.ts`:**

Busca la sección que construye `wsEvent` para `shoppable_ad` (alrededor de `type: 'shoppable_ad'`):

```typescript
// ACTUAL:
const wsEvent = {
  type: 'shoppable_ad',
  broadcastId,
  product,
  ...(sponsor ? { sponsor } : {}),
  timestamp: Date.now(),
};

// DEBE SER:
const wsEvent = {
  type: 'shoppable_ad',
  broadcastId,
  campaignId: campaign.id,   // ← AÑADIR ESTO
  product,
  ...(sponsor ? { sponsor } : {}),
  timestamp: Date.now(),
};
```

**Por qué:**
- El SDK usa `campaignId` del evento para el POST `cart-intent`
- Permite múltiples campañas en un broadcast sin config previa en el SDK
- El broadcaster solo hace `VioTV.configure(apiKey:)` — sin campaignId hardcodeado

**cart-intent body también debe incluir campaignId:**
```typescript
// POST /api/broadcasts/:id/cart-intent
// Body esperado por el SDK:
{ productId, userId, campaignId }
```
Verificar que el endpoint `cart-intent` acepta y usa `campaignId` del body.

**Prioridad:** Alta — bloquea arquitectura VioTVSDK
**Branch sugerida:** `fix/shoppable-ad-campaign-id`

