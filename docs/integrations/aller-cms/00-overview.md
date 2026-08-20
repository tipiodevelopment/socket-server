# Vio × Mote & Livsstil — integration overview

**Audience**: the team building the CMS (React 18 + Vite, TypeScript, pnpm monorepo).
**Goal**: an editor picks a brand and its products while writing an article; the
reader buys inside the article; revenue is attributed per article.

Read this file first, then `01-admin-editor.md`, then `02-frontend-and-checkout.md`.
`03-api-reference.md` is lookup material. `04-rollout-checklist.md` is the order
of work and what to wait for.

---

## 1. What changes, in one table

Today a shopping article is affiliate-based: the editor searches 7 networks or
scrapes a shop URL, types the price by hand, and the reader leaves the site.
Revenue is an estimate (`affiliate_clicks × 2.5 NOK`).

| Today (`staticProducts` / `products`) | With Vio |
|---|---|
| Editor scrapes or searches affiliate networks | Editor picks from a connected brand's real catalogue |
| Price typed by hand, frozen | Price resolved live from the brand's channel |
| Affiliate link — reader leaves | Cart + checkout **inside the article** |
| Revenue estimated from clicks | Revenue **measured**: real orders, real amounts |

Vio does not replace anything. It is a third product block next to the two that
exist, and with the feature flag off it does not exist at all.

## 2. The model — three words

- **Surface** — the property where Vio runs. *Mote & Livsstil* is one surface.
  It holds one API key.
- **Brand** (`sponsor` in the API) — a brand as sold through **one commerce
  channel**. *Fredrik & Louisa* is one. A brand that has no channel connected
  cannot sell, and the API marks it `connected: false`.
- **Article** — your article. It carries **one brand** (`vioSponsorId`), and its
  Vio blocks inherit it.

> **Naming**: your CMS already has *Kampanjer* (affiliate deal cards) and
> *Karuseller*. Vio's internal "campaign" is a different thing and editors never
> see it — they pick a **brand** (`merkevare`). Call the new block **"Vio
> karusell"** to keep it distinct from your existing carousels.

## 3. End-to-end flow

```
ADMIN (once)
  VIO_ENABLED=true + VIO_API_KEY in Replit Secrets
      → Vio module active

EDITOR (per article)
  1. Article settings panel → pick brand         (GET /v2/web/brands)
  2. Block palette now offers "Vio karusell"
  3. Insert block → "Velg produkter" → modal      (GET /v2/commerce/sponsors/:id/catalog)
  4. Pick products → Confirm
     block stores { type, productRefs, variant } — REFERENCES ONLY
  5. Preview renders the real cards with live prices
  6. Publish

READER (public article)
  sees live products → adds to cart → checkout (Stripe / Klarna / Vipps)
  → buys without leaving the article

ANALYTICS
  your events keep running unchanged
  Vio adds add_to_cart / begin_checkout / purchase,
  each carrying articleId + path + your sessionId
```

## 4. Reference, never snapshot

This is the one rule that matters most, and it is the opposite of
`staticProducts`.

```jsonc
// ✅ what the Vio block stores
{ "type": "vioProducts", "productRefs": [408909, 408910], "variant": "carousel" }

// ❌ what it must NOT store
{ "title": "Lait Corporel", "price": 189, "image": "https://…" }
```

No price, no title, no image, no brand id (the article owns the brand). Every
one of those is resolved live at render time. That is what keeps prices honest,
stock real, and checkout possible.

## 5. What Vio delivers, so you don't build it

- `@vio-live/web-sdk` (npm) — product, carousel, detail, cart and checkout
  components, plus React wrappers (`@vio-live/web-sdk/react`).
- **Payment methods resolved automatically.** You never configure Stripe,
  Klarna or Vipps. The SDK asks the brand's channel what is enabled and renders
  accordingly.
- **Norwegian labels by default** (`Kasse`, `Handlekurv`, …), all overridable.
- Analytics with the funnel your system cannot see (cart → checkout → purchase).

## 6. Prerequisites before any code

1. **Vio API base URL** — configurable from day one, never hardcoded. You will
   start against one URL and move to another; see `04-rollout-checklist.md`.
2. **Surface API key** for *Mote & Livsstil*, in Replit Secrets.
3. A brand with a connected commerce channel. *Fredrik & Louisa* is ready:
   9 products, Stripe (test) + Klarna + Vipps enabled.
