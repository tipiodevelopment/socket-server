# Public site, rendering and checkout

The guiding principle: **Vio supplies behaviour, you keep control of
presentation and UX.** Cart and checkout open when *you* say so, wear *your*
colours and fonts, and speak *your* words. Nothing here forces a Vio look onto
Mote & Livsstil.

---

## 1. Install and initialise

```bash
pnpm add @vio-live/web-sdk
```

```ts
import { Vio } from '@vio-live/web-sdk'

Vio.init({
  apiKey,                  // surface key, seeded from the server — see §2
  environment: 'testing',  // development | testing | production
})
```

That single name resolves the REST API, the GraphQL endpoint **and** the
analytics collector. Do not pass URLs: three values that must stay in step are
better derived from one. (`apiBase` / `graphQLBase` / `eventsBase` exist as
overrides for the temporary phase in `04-rollout-checklist.md` Phase 0.)

`Vio.init` is safe in a module scope: the headless core touches no DOM on
import. The **components** need a browser, so register them inside a
client-only boundary (§3).

---

## 2. Getting the key to the client without leaking it

Your render is hybrid, which lets you do this better than most hosts. The
server already seeds article data into the HTML shell — seed Vio's bit the same
way:

```ts
// server, while building the shell
if (isVioEnabled() && article.vioSponsorId) {
  seed.vio = {
    apiKey: process.env.VIO_API_KEY,
    environment: process.env.VIO_ENVIRONMENT,   // a name, not a URL
  }
}
```

Only articles that actually use Vio carry it. Articles without a brand ship
nothing.

---

## 3. Registering the block renderer

Use the **React wrappers** — cleaner with hydration and events than raw custom
elements:

```tsx
import { VioProductCarousel, VioProduct } from '@vio-live/web-sdk/react'
```

Register `vioProducts` in the same renderer map your other blocks use, so it
inherits your spacing, your container widths and your typography.

```tsx
function VioProductsBlock({ block, article }: Props) {
  if (!block.productRefs?.length) return null          // unconfigured → nothing
  const Component = block.variant === 'single' ? VioProduct : VioProductCarousel
  return (
    <Component
      productIds={block.productRefs.join(',')}
      sponsorId={article.vioSponsorId}
      heading={block.title}
    />
  )
}
```

**Rendering contract**

| Situation | Behaviour |
|---|---|
| Block has no refs | render `null` |
| Loading | skeleton cards (same as your live-search block) |
| **One** product gone or out of stock | hide that product, keep the rest |
| **All** products fail | render `null` — the article reads normally |

That middle row is where we deliberately differ from your live-search block. A
shoppable block that vanishes whole loses a sale silently; hiding one card does
not. In both failing cases the SDK emits an event, so the loss is visible to us
even though it is invisible to the reader.

**Preview**: render **real cards**, not a placeholder. Your live-search block
shows a placeholder because a *query* returns unpredictable results — here the
editor picked specific products and needs to see the real price and image before
publishing. It costs one call, the same one the picker just made.

---

## 4. Cart and checkout — you drive

The two components are **controlled**: they render nothing until you open them.
Mount them once per article (or once in your layout).

```tsx
const [cartOpen, setCartOpen] = useState(false)
const [checkoutOpen, setCheckoutOpen] = useState(false)

<VioCart
  open={cartOpen}
  heading="Handlekurv"
  emptyLabel="Handlekurven er tom"
  subtotalLabel="Sum"
/>
<VioCheckout
  open={checkoutOpen}
  heading="Kasse"
  shippingLabel="Frakt"
/>
```

**Every label is a prop.** Defaults are already Norwegian, so out of the box it
reads correctly — override any of them to match your tone.

**Hook into your UX with events.** The SDK dispatches these on `window`:

| Event | Use it to |
|---|---|
| `vio:product-click` | your own tracking, or navigate |
| `vio:added-to-cart` | open your cart drawer, show a toast, bump a badge |
| `vio:open-cart` | a component asked for the cart — `setCartOpen(true)` |
| `vio:checkout-open` | `setCheckoutOpen(true)` |
| `vio:payment-success` | confirmation UI, thank-you state, your own conversion pixel |
| `vio:cart-error` | your error surface |
| `vio:analytics` | every analytics event, if you want to mirror it |

```tsx
useEffect(() => {
  const openCart = () => setCartOpen(true)
  window.addEventListener('vio:open-cart', openCart)
  window.addEventListener('vio:added-to-cart', openCart)
  return () => { /* remove both */ }
}, [])
```

So the cart can be your existing drawer pattern, your animation, your z-index.
Vio never takes over the page.

**Payment methods are not your problem.** The SDK asks the brand's channel what
is enabled and renders exactly those. *Fredrik & Louisa* currently exposes
**Stripe (test), Klarna and Vipps**. Enabling a fourth method is a change in
Vio Commerce — no code, no deploy on your side.

---

## 5. Theming — make it look like Mote & Livsstil

Two levels, use either.

**Whole-page tokens**

```ts
import { applyVioTheme } from '@vio-live/web-sdk/ui'

applyVioTheme({
  colorAccent:  '#111111',
  colorText:    '#1a1a1a',
  colorSurface: '#ffffff',
  colorBorder:  '#e5e5e5',
  fontSerif:    'Freight Display, serif',
  fontSans:     'Inter, sans-serif',
})
```

Available keys: `colorText`, `colorTextSecondary`, `colorTextTertiary`,
`colorTextOnPrimary`, `colorAccent`, `colorSurface`, `colorSurfaceMuted`,
`colorSurfaceHover`, `colorBorder`, `colorBorderDefault`, `fontSerif`,
`fontSans`.

**Or plain CSS** — the same tokens are custom properties, so your stylesheet can
own them:

```css
:root { --vio-color-accent: #111; --vio-font-serif: 'Freight Display', serif; }
```

`applyVioTheme` also accepts a second argument to scope a theme to one subtree —
useful later if two brands ever appear on one page.

---

## 6. Analytics — the two lines that make revenue real

Your tracking keeps running untouched. Vio adds the funnel you cannot see:
`add_to_cart`, `begin_checkout`, `purchase` **with the real order value**.

For those to join onto your `article_events`, two things must be passed:

```ts
Vio.analytics.start({
  host: 'replit',
  sessionId: yourSessionId,   // the ml_analytics_sid you already store
})
```

```tsx
<VioProductCarousel
  productIds={…}
  sponsorId={article.vioSponsorId}
  contentId={article.id}       // your join key
  contentUrl={canonicalPath}   // your canonical path
/>
```

**Why `sessionId` matters**: without it the SDK mints its own id, so the
reader's article view and their purchase land in two different sessions and
cannot be joined at all. Passing yours is what later turns
`affiliate_clicks × 2.5 NOK` into a measured number for Vio-enabled articles.

Double tracking is expected for now: your `card_impression` / `card_click` fire
as always, Vio's `component_impression` fires too. If the overlap ever bothers
you, `start({ autoTrack: false })` silences Vio's impression/click listeners
while keeping cart, checkout and purchase.

---

## 7. Front-end acceptance

- [ ] Article with no brand ships zero Vio code
- [ ] Block with no refs renders nothing, page unaffected
- [ ] Cards show live prices, matching the brand's catalogue
- [ ] One dead product hides itself; the rest still render
- [ ] Cart and checkout open from **your** UI, with your labels and colours
- [ ] A test purchase completes with Stripe test
- [ ] `purchase` carries `content_id`, `content_url` and your `session_id`
