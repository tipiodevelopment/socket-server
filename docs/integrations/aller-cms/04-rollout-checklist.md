# Rollout — what first, what to wait for

Work top to bottom. Anything marked **⏸ waiting on Vio** cannot start until we
hand you something; everything else you can build immediately.

---

## Phase 0 — Before writing code

| # | Task | Owner | Blocking? |
|---|---|---|---|
| 0.1 | Receive **Vio API base URL** + **surface API key** for *Mote & Livsstil* | ⏸ Vio | yes |
| 0.2 | Put the key in Replit Secrets; make the base URL an env var | you | — |
| 0.3 | Verify with one curl: `GET {base}/v2/web/brands` returns `fredrikoglouisa` | you | — |

> **The base URL will change.** The first integration runs against a temporary
> endpoint while the Vio work is being deployed; you will then move to staging,
> and later to production. Treat it as configuration from line one — never a
> constant in the source.

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
| 3.1 | `pnpm add @vio-live/web-sdk`; init from seeded config | front §1–2 |
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
3. The env vars — pointing at **production** Vio, with production brands.

Nothing in the module reads anything project-specific beyond your article model,
so the port is a copy plus configuration.

---

## Known unknowns — tell us if you hit these

- **Commerce can be slow.** The catalogue call goes through to Vio Commerce; we
  have seen sub-second responses and also 40s+ during an upstream outage. Put a
  client timeout on the picker and never block saving on it.
- **An empty brand list is valid** (no active campaign), not an error state.
- **Expired campaigns**: if a brand's campaign ends, it stops appearing in
  `/v2/web/brands`. What should happen to already-published articles using that
  brand is still an open product decision — flag it if you hit it before we
  resolve it.
