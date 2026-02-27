# TAREA: Eliminar todo rastro de Tipio del backend

**Prioridad:** Alta — antes del miércoles  
**Motivo:** Tipio es un producto separado (livestream). No pertenece al backend de Vio.  
El backend gestiona: **Vio** (engagement) y **Commerce** (ex-Reachu, ecommerce).

---

## schema.ts — no tocar los campos DB, solo el naming público

```typescript
// shared/schema.ts línea 65
tipioLivestreamData: json("tipio_livestream_data")  ← dejar el campo DB como está
// NO hacer migración destructiva
```

Pero el tipo exportado sí debe renombrarse:
```typescript
// ANTES
export const tipioLivestreamSchema = ...
export type TipioLivestream = ...

// DESPUÉS  
export const viotivestreamSchema = ...   // o eliminar si no se usa
export type VioLivestream = ...          // o eliminar si no se usa
```

Si `tipioLivestreamData` en campaigns no se usa en ningún endpoint activo → se puede ignorar por ahora.

---

## IntegrationsTab.tsx — limpiar sección Tipio liveshow

```
client/src/components/dashboard/IntegrationsTab.tsx
```

La sección "Tipio.no Liveshow" referencia un sistema externo que no es parte de Vio.  
**Acción:** Eliminar esa sección del tab de integraciones. Si se quiere mantener un placeholder para livestream futuro, renombrarlo a "Livestream Integration (coming soon)" sin funcionalidad activa.

---

## SettingsTab.tsx — ya corregido ✅

`integrations.tipio` → `integrations.commerce` ya aplicado.

---

## advanced-campaign.tsx — limpiar

```
client/src/pages/advanced-campaign.tsx
```

Eliminar las referencias a "Tipio.no Liveshow" y "Tipio Integration".

---

## routes.ts — ya corregido ✅

`integrations.tipio` → `integrations.commerce` ya aplicado en ambos endpoints.

---

## Verificación final

```bash
grep -rn "tipio\|Tipio" server/ client/src/ shared/ --include="*.ts" --include="*.tsx"
```

Resultado esperado: solo puede quedar `tipioLivestreamData` en schema.ts (campo DB legacy — no tocar).  
Todo lo demás: **0 resultados**.
