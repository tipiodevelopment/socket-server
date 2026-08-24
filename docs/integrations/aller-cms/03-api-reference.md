# API reference

Three endpoints. Everything is authenticated with the **surface API key** —
never a brand's key, never a user token.

```
Header:  x-api-key: <surface key>
Base:    configurable (VIO_API_BASE)
```

---

## `GET /v2/web/brands`

The brands an editor may pick for an article: every brand taking part in one of
this surface's **active** campaigns, deduplicated.

**Response** (real, from *Mote & Livsstil*)

```json
{
  "surface": { "id": 26, "name": "Møte & Livsstil" },
  "brands": [
    {
      "id": 14,
      "name": "fredrikoglouisa",
      "avatarUrl": null,
      "logoUrl": null,
      "primaryColor": "#3d8b7a",
      "secondaryColor": "#141824",
      "commerce": { "apiKey": "…", "channelId": null, "paymentMethods": [] },
      "connected": true,
      "campaigns": [{ "id": 45, "name": "Summer 20026", "role": "primary" }]
    }
  ]
}
```

| Field | Use |
|---|---|
| `id` | store as `vioSponsorId` on the article |
| `name`, `logoUrl`, `primaryColor` | label the option in the selector |
| **`connected`** | `false` → **disable the option**. No commerce channel: it cannot sell |
| `campaigns` | informational; editors do not need to see it |

**Empty `brands` is normal** — it means no campaign is currently active for this
surface. Show "Ingen merkevarer tilgjengelig", not an error.

**Errors**: `401` missing/unknown key.

---

## `GET /v2/commerce/sponsors/{sponsorId}/catalog`

The brand's products — for the picker modal. Vio calls the brand's commerce
channel server-side.

**Query**: `limit` (default 100, max 200) · `offset` · `currency` (default
`NOK`) · `shippingCountryCode` (default `NO`)

**Response**

```json
{
  "sponsor": { "id": 14, "name": "fredrikoglouisa" },
  "products": [
    {
      "id": 408909,
      "name": "Lait Corporel Body Lotion",
      "sku": null,
      "description": "…",
      "imageUrl": "https://…",
      "price": 189,
      "currency": "NOK"
    }
  ],
  "total": 9,
  "limit": 100,
  "offset": 0,
  "hasMore": false
}
```

`products[].id` is what you store in `productRefs`.

**Errors**

| Code | Meaning | What to show |
|---|---|---|
| `404` | unknown sponsor | "Merkevaren finnes ikke" |
| `422` `SPONSOR_MISSING_COMMERCE_KEY` | brand has no channel | "Merkevaren er ikke tilkoblet" |
| `5xx` / timeout | commerce upstream unavailable | see below |

> ⚠️ **Treat this call as slow and fallible.** It reaches Vio Commerce, which is
> an upstream we do not control — and whose **dev environment shuts down
> automatically at 01:00**, after which this call hangs and then returns
> `total: 0`. We have measured it answering in under a second
> normally, and hanging for **40+ seconds** while Commerce was degraded. In the
> picker: show a spinner, set your own client timeout (10s is reasonable), and
> render a retry rather than an endless spinner. Never block saving the article
> on this call.

---

## `GET /v2/mobile/config`

Bootstrap used by the SDK itself — you normally do not call it directly. It
returns the surface's currently active campaign, its primary brand (including
the commerce credentials the components need) and the endpoints to use.

Named `mobile` for historical reasons; it serves web surfaces too. Do not
depend on its single-campaign behaviour — for "which brands may I pick?", use
`/v2/web/brands`.

---

## Things worth knowing

- **`sponsorId` is scoped to a channel, not a brand name.** Product ids only
  mean something inside their own channel — this is why changing an article's
  brand must clear `productRefs` (`01-admin-editor.md` §7).
- **Payment methods are not in this API.** The SDK asks the brand's channel
  directly at checkout time, so enabling Klarna or Vipps needs no change here.
- **`total: 0` with `200 OK`** means the channel has no products for that
  market/currency — a legitimate answer, not a failure.
