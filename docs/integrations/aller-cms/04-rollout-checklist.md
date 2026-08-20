# Rollout — what first, what to wait for

Work top to bottom. Anything marked **⏸ waiting on Vio** cannot start until we
hand you something; everything else you can build immediately.

---

## Phase 0 — Before writing code

| # | Task | Owner | Blocking? |
|---|---|---|---|
| 0.1 | Receive the **surface API key** for *Mote & Livsstil*, and the endpoint to start against | ⏸ Vio | yes |
| 0.2 | Key + `VIO_ENVIRONMENT` in Replit Secrets | you | — |
| 0.3 | Verify with one curl that `/v2/web/brands` returns `fredrikoglouisa` | you | — |

### Environments — pass a name, not URLs

`Vio.init({ environment })` accepts `development`, `testing` or `production`,
and resolves the REST API, the GraphQL endpoint **and** the analytics collector
from it. Three values that must agree, derived from one. Switching environments
is a single word, and a staging API can never end up paired with a production
collector.

```ts
Vio.init({ apiKey, environment: 'testing' })   // ✅
Vio.init({ apiKey, apiBase: 'https://…' })     // ⚠️ only for the case below
```

**The one exception — the first phase.** The Vio work backing this integration
is not deployed yet, so you will start against a **temporary endpoint** that
matches no environment name. For that phase only:

```ts
Vio.init({
  apiKey,
  environment: 'testing',
  apiBase: process.env.VIO_API_BASE_OVERRIDE,   // set only while temporary
})
```

Keep it behind an env var that is **empty everywhere else**, and delete the
override once we tell you staging is live. From then on, only
`VIO_ENVIRONMENT` changes — `testing` while integrating, `production` at
launch.

---

## Phase 1 — Foundations *(no Vio dependency — start here)*

| # | Task | Ref |
|---|---|---|
| 1.1 | Feature flag `isVioEnabled()` | admin §1 |
| 1.2 | `vio_sponsor_id` column via your boot-time ensure-schema pattern | admin §2 |
| 1.3 | Field flows through draft, save, revisions | admin §2 |

**Checkpoint** — with the flag off, the app is unchanged; with it on, nothing is
visible yet but the column persists.

---

## Phase 2 — The editor

| # | Task | Ref |
|---|---|---|
| 2.1 | Brand selector in the article settings panel | admin §3 |
| 2.2 | Disable brands with `connected: false` | admin §3 |
| 2.3 | Conditional block palette + "Velg en merkevare først" hint | admin §4 |
| 2.4 | `vioProducts` block + inline panel + unconfigured state | admin §5 |
| 2.5 | Product picker modal, committed only on Confirm | admin §6 |
| 2.6 | Brand change/clear → warn + clear `productRefs` | admin §7 |

**Checkpoint** — an editor can produce an article whose body contains
`{ "type": "vioProducts", "productRefs": [...] }`, and no autosave path can ever
persist a half-configured block.

---

## Phase 3 — The public article

| # | Task | Ref |
|---|---|---|
| 3.1 | `pnpm add @vio-live/web-sdk`; init with `environment` from seeded config | front §1–2 |
| 3.2 | Register the block renderer with the React wrappers | front §3 |
| 3.3 | Degradation: hide dead products, `null` if all fail | front §3 |
| 3.4 | Real cards in preview | front §3 |

**Checkpoint** — a published article shows live products with live prices.

---

## Phase 4 — Cart, checkout, look and feel

| # | Task | Ref |
|---|---|---|
| 4.1 | Mount `<VioCart>` / `<VioCheckout>`, controlled by your state | front §4 |
| 4.2 | Wire `vio:*` events to your drawer, toasts, badge | front §4 |
| 4.3 | Override labels to your tone | front §4 |
| 4.4 | `applyVioTheme` (or CSS vars) to match Mote & Livsstil | front §5 |
| 4.5 | **Complete a test purchase** with Stripe test | — |

**Checkpoint** — a reader buys without leaving the article, and it looks like
your site, not like ours.

---

## Phase 5 — Attribution

| # | Task | Ref |
|---|---|---|
| 5.1 | `Vio.analytics.start({ host: 'replit', sessionId })` — pass **your** session id | front §6 |
| 5.2 | Pass `contentId` (article id) and `contentUrl` (canonical path) to blocks | front §6 |
| 5.3 | Verify a `purchase` event carries all three | — |

**Checkpoint** — Vio's purchase events can be joined onto `article_events`
whenever you decide to ingest them.

> Ingesting them is *not* part of this integration. Once 5.3 passes, turning
> estimated revenue into measured revenue for Vio articles is a small, additive
> Innsikt change you can make on your own schedule.

---

## Phase 6 — Port to the original project

The module was built in the copy on purpose. Porting is:

1. The `vio_sponsor_id` column, via the same boot-time pattern.
2. The block type, its editor panel, the modal, the renderer entry.
3. The env vars — `VIO_ENVIRONMENT=production`, with production brands, and no
   base-URL override.

Nothing in the module reads anything project-specific beyond your article model,
so the port is a copy plus configuration.

---

## Known unknowns — tell us if you hit these

- **The dev Commerce environment shuts down automatically at 01:00.** Products
  stop resolving and the catalogue call hangs, then returns `total: 0`. It is a
  scheduled shutdown, not a failure — if you are testing late and everything
  suddenly returns nothing, this is why. Ask us for the current environment
  schedule before a night session.
- **Commerce can be slow even when up.** The catalogue call goes through to Vio
  Commerce; we have measured sub-second responses and also 40s+ while it was
  unavailable. Put a client timeout on the picker, show a retry, and never block
  saving the article on it.
- **An empty brand list is valid** (no active campaign), not an error state.
- **Expired campaigns**: if a brand's campaign ends, it stops appearing in
  `/v2/web/brands`. What should happen to already-published articles using that
  brand is still an open product decision — flag it if you hit it before we
  resolve it.
