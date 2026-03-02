# TASKS_NOW — socket-server

_Actualizado: 2026-03-02 · Viobot_

---

## 🔴 URGENTE — #160: WebSocket: añadir broadcastId a eventos poll/contest/score

### Contexto
El SDK Swift necesita saber a qué broadcast corresponde cada evento WebSocket.
Actualmente los eventos `poll` y `contest` no llevan `broadcastId` — el SDK no puede filtrar.

### Cambios requeridos

#### 1. `shared/schema.ts` — añadir broadcastId al schema
\`\`\`ts
export const pollEventSchema = z.object({
  id: z.number().optional(),
  type: z.literal("poll"),
  broadcastId: z.string().optional(), // ← AÑADIR
  data: z.object({ ... }),
  campaignLogo: z.string().optional(),
  timestamp: z.number()
});

// Igual para contestEventSchema y score events
\`\`\`

#### 2. `server/routes.ts` — incluir broadcastId al emitir poll
\`\`\`ts
const pollEvent: WebSocketEvent = {
  type: 'poll',
  broadcastId: req.body.broadcastId, // ← AÑADIR
  data: { ... },
  campaignLogo: ...,
  timestamp: Date.now()
};
\`\`\`

#### 3. Al conectar WebSocket — emitir estado inicial
Cuando un cliente conecta a `/ws/:campaignId`, si hay un broadcast activo,
emitir los polls/contests activos de ese broadcast para que el SDK tenga estado inicial:
\`\`\`ts
// En wss.on('connection', ...)
const activeBroadcast = await storage.getActiveBroadcastForCampaign(campaignId);
if (activeBroadcast) {
  const polls = await storage.getBroadcastPolls(activeBroadcast.broadcastId);
  polls.forEach(poll => {
    ws.send(JSON.stringify({
      type: 'poll',
      broadcastId: activeBroadcast.broadcastId,
      data: poll,
      timestamp: Date.now()
    }));
  });
}
\`\`\`

### Criterio de aceptación
- [ ] Evento `poll` incluye `broadcastId`
- [ ] Evento `contest` incluye `broadcastId`
- [ ] Al conectar, cliente recibe polls/contests activos del broadcast actual
- [ ] Tests pasan

---

## 🟡 #162 [BACKEND] Mover sponsorBadgeText de brand a sponsor

### Contexto
El SDK usa `sponsor.badgeText` para mostrar "Sponset av" / "Sponsored by" en el badge.
Actualmente el texto está en `brand.sponsorBadgeText` — debería estar en `sponsor` también
para que toda la data del sponsor esté en un único lugar.

### Cambio requerido en `server/routes.ts` o donde se construya el config

Añadir `badgeText` a la sección `sponsor` en la respuesta de `/v1/campaigns/:id/config`:

```json
"sponsor": {
    "id": 3,
    "name": "Elkjøp",
    "logoUrl": "...",
    "avatarUrl": "...",
    "primaryColor": "#f7b23b",
    "secondaryColor": "#f7b23b",
    "badgeText": {            ← AÑADIR ESTO
        "no": "Sponset av",
        "en": "Sponsored by",
        "sv": "Sponsrad av"
    }
}
```

### Notas
- Mantener `brand.sponsorBadgeText` también (no romper compatibilidad)
- El SDK ya tiene el fallback: lee `sponsor.badgeText` primero, fallback a `brand.sponsorBadgeText`
- Solo necesita añadirse al serializador/builder del config endpoint

### Criterio de aceptación
- [ ] `GET /v1/campaigns/35/config` devuelve `sponsor.badgeText` con textos localizados

---

## ℹ️ Contexto arquitectura sponsor (para referencia)

El SDK Swift usa una estructura `SponsorAssets` que centraliza todos los datos del sponsor:
- `sponsor.logoUrl` → badge "Sponset av Elkjøp"
- `sponsor.avatarUrl` → avatar circular en polls, contests, tweets
- `sponsor.primaryColor` → color acento (bordes, botones) — el SDK calcula contraste automáticamente
- `sponsor.secondaryColor` → color secundario
- `sponsor.badgeText` → texto localizado del badge

El app se despliega una sola vez y puede correr múltiples campañas con sponsors diferentes.
Todos los colores y assets del sponsor vienen del backend — nada hardcodeado en el SDK.

---

## 🔴 #163 [BACKEND+DASHBOARD] Activar Commerce + ProductCarousel para demo TV2

### Contexto
El SDK tiene `VProductCarousel` que ya escucha `activeComponents` via WS.
Para que funcione necesita: commerce habilitado en la campaña + componente activo.

---

### PASO 1 — Actualizar integrations.commerce en campaña 35

Endpoint: `PATCH /api/campaigns/35` (o el que corresponda para actualizar config)

```json
"integrations": {
  "commerce": {
    "enabled": true,
    "apiKey": "KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S",
    "channelId": null
  }
}
```

Si no hay endpoint para esto, añadir: `PATCH /api/campaigns/:id/integrations`

---

### PASO 2 — Crear component template en biblioteca

`POST /api/components`

```json
{
  "type": "product_carousel",
  "name": "Elkjøp Product Carousel",
  "isTemplate": "true",
  "config": {
    "productIds": ["408841", "408874", "408895", "408896"],
    "autoPlay": false,
    "interval": 3000
  }
}
```

Guardar el `id` que devuelve (lo necesitamos para el paso 3).

---

### PASO 3 — Añadir el componente a campaña 35 y activarlo

`POST /api/campaigns/35/components`
```json
{
  "componentId": "<id del paso 2>",
  "status": "active"
}
```

---

### PASO 4 — ComponentsTab.tsx: añadir forms faltantes

En `CampaignComponentConfigForm.renderConfigFields()` faltan estos casos:

**`carousel_auto`** — añadir:
```tsx
case 'carousel_auto':
  return (
    <>
      <Label>Reachu Channel ID</Label>
      <Input value={config.channelId || ''} onChange={...} placeholder="465" />
      <Label>Display Count</Label>
      <Input type="number" value={config.displayCount || 5} onChange={...} />
    </>
  );
```

**`product_carousel`** — añadir campo `channelId` (para modo auto sin productIds específicos):
```tsx
<Label>Channel ID (opcional, para cargar todo el canal)</Label>
<Input value={config.channelId || ''} onChange={...} placeholder="465" />
```

**`product_store`** — añadir (igual que en ComponentLibraryTab):
```tsx
case 'product_store':
  // selector mode (all/filtered) + productIds si filtered
```

---

### Criterio de aceptación
- [ ] `GET /v1/campaigns/35/config` devuelve `integrations.commerce.enabled: true`
- [ ] `GET /v1/sdk/components?campaignId=35` devuelve el carousel con status `active`
- [ ] Dashboard ComponentsTab muestra forms para `carousel_auto` y `product_store`


---

## 🔴 #164 [DASHBOARD] ProductBanner — activar en campaña 35 + UI productId

### Contexto
`VProductBanner` en el SDK muestra un banner con imagen de fondo, texto editorial y botón CTA.
Al hacer tap → abre modal con datos del producto (nombre, precio, variantes) desde Commerce GraphQL.
El `title` y `subtitle` son editoriales (los escribe el operador), NO del producto.

### Arquitectura de campos
| Campo | Quién lo controla | Notas |
|---|---|---|
| `productId` | Operador en dashboard | ID de Commerce (408841, 408895, etc.) |
| `backgroundImageUrl` | Operador en dashboard | Imagen de fondo del banner |
| `title` | Operador en dashboard | Copy editorial — NO el nombre del producto |
| `subtitle` | Operador en dashboard | Copy secundario |
| `ctaText` | Operador en dashboard | Texto del botón |
| `ctaLink` / `deeplink` | Operador en dashboard | Destino del botón |
| Colores/estilos | Operador en dashboard | Con defaults del sponsor |

### PASO 1 — Actualizar product-banner-template

`PATCH /api/components/product-banner-template`

```json
{
  "config": {
    "productId": "408895",
    "backgroundImageUrl": "/objects/uploads/326707ae-4430-41c8-a417-dad29cea3602",
    "title": "Kampanjepris — Samsung Neo QLED",
    "subtitle": "Kun under kampen",
    "ctaText": "Se produkt",
    "buttonBackgroundColor": "#f7b23b",
    "buttonTextColor": "#000000",
    "overlayOpacity": 0.5,
    "bannerHeight": 200,
    "textAlignment": "left",
    "contentVerticalAlignment": "center"
  }
}
```

### PASO 2 — Activar en campaña 35

`POST /api/campaigns/35/components`
```json
{
  "componentId": "product-banner-template",
  "status": "active"
}
```

### PASO 3 — Verificar UI en ComponentsTab.tsx

El form de `product_banner` en `ComponentsTab.tsx` ya tiene campo `productId`.
Confirmar que:
- El campo `productId` tiene placeholder con ejemplo: `"408895"`
- Hay nota explicativa: "ID del producto en Commerce. El título del banner es editorial (no se toma del producto)."
- El campo `backgroundImageUrl` usa `ImageUploadWithPreview`

Si alguno falta, añadirlo.

### Criterio de aceptación
- [ ] `GET /v1/sdk/components?campaignId=35` devuelve `product_banner` con status active
- [ ] Config tiene `productId: "408895"` y textos en noruego
- [ ] Dashboard muestra el componente activo en campaña 35


---

## 🔴 #165 [DASHBOARD] locationId — slot system para componentes

### Contexto
El desarrollador implementa slots fijos en la UI con nombres semánticos (`locationId`).
El operador en el dashboard asigna qué componente va en cada slot.
Así el código Swift nunca cambia — solo el dashboard cambia el contenido.

### Ejemplo
```
Developer (código Swift, una vez):
  VProductBanner(locationId: "sport-detail-banner")
  VProductCarousel(locationId: "sport-detail-carousel")

Operador (dashboard, cada campaña):
  Componente "Samsung TV Banner" → locationId: "sport-detail-banner"
  Componente "Elkjøp Carousel"  → locationId: "sport-detail-carousel"
```

### LocationIds estándar (definidos por el SDK)
```
sport-detail-banner      → Banner debajo del header en SportDetailView
sport-detail-carousel    → Carousel de productos en SportDetailView
sport-home-banner        → Banner en la home de deportes
sport-home-carousel      → Carousel en la home de deportes
casting-overlay-banner   → Banner durante el stream
```

### Cambios requeridos en Dashboard

**1. Añadir campo locationId al añadir componente a campaña**

En `ComponentsTab.tsx` → Dialog "Add Component to Campaign":
```tsx
<Label>Location Slot (opcional)</Label>
<Select value={locationId} onValueChange={setLocationId}>
  <SelectItem value="">Ninguno (activación manual)</SelectItem>
  <SelectItem value="sport-detail-banner">sport-detail-banner</SelectItem>
  <SelectItem value="sport-detail-carousel">sport-detail-carousel</SelectItem>
  <SelectItem value="sport-home-banner">sport-home-banner</SelectItem>
  <SelectItem value="sport-home-carousel">sport-home-carousel</SelectItem>
  <SelectItem value="casting-overlay-banner">casting-overlay-banner</SelectItem>
</Select>
<p className="text-xs">El SDK busca el componente activo para este slot</p>
```

**2. Incluir locationId en POST /api/campaigns/:id/components**
```json
{ "componentId": "...", "locationId": "sport-detail-banner", "status": "active" }
```

**3. Actualizar los componentes de campaña 35**
- product-banner-template → locationId: "sport-detail-banner"
- Elkjøp Product Carousel (6f6c5337-...) → locationId: "sport-detail-carousel"

**4. Verificar que GET /v1/sdk/components?campaignId=35&locationId=sport-detail-banner devuelve el banner**

### Criterio de aceptación
- [ ] Dashboard muestra selector de locationId al añadir componente
- [ ] GET /v1/sdk/components?campaignId=35&locationId=sport-detail-banner → devuelve product_banner
- [ ] GET /v1/sdk/components?campaignId=35&locationId=sport-detail-carousel → devuelve product_carousel
