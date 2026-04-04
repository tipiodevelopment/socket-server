---
name: seed-demo
description: Ejecuta seed de datos demo y verifica que Campaign 35 (Viaplay) este correctamente configurada
user-invocable: true
---

Prepara y verifica los datos de demo para presentaciones.

## Pasos

1. Verifica que el servidor este corriendo (curl /health)
2. Ejecuta `POST /api/seed-demo` en el servidor local
3. Verifica Campaign 35 (Viaplay demo):
   - `GET /v1/sdk/campaigns?apiKey=viaplay_api_key_0c611e983b314ff8` — debe retornar campaign 35
   - `GET /v1/campaigns/35/config?apiKey=viaplay_api_key_0c611e983b314ff8` — debe incluir:
     - `brand` con datos de sponsor Elkjop
     - `integrations.commerce.enabled: true`
     - `integrations.commerce.apiKey` presente
   - `GET /v1/sdk/broadcast?apiKey=viaplay_api_key_0c611e983b314ff8&contentId=real-madrid-barcelona-2025-01-24` — debe resolver a broadcast
   - `GET /v1/engagement/polls?apiKey=viaplay_api_key_0c611e983b314ff8&broadcastId=real-madrid-vs-barcelona-2026-02-25` — debe retornar polls activos
   - `GET /v1/sdk/components?apiKey=viaplay_api_key_0c611e983b314ff8&campaignId=35&locationId=sport-detail-banner` — debe retornar ProductBanner
4. Tambien verifica Campaign 28 (XXL):
   - `GET /v1/sdk/campaigns?apiKey=xxl_api_key_507d4014243d8360` — debe retornar campaign 28
5. Genera reporte:
   - Datos de demo OK / con problemas
   - Endpoints que fallaron
   - Datos faltantes (polls sin opciones, broadcasts sin teams, etc.)
