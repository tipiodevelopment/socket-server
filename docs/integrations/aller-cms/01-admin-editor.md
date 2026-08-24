# Admin & editor — step by step

Eight steps, in order. Each one is shippable on its own and testable before the
next. Steps 1–4 have no Vio dependency at all; you can build them while the API
work happens.

---

## Step 1 — Feature flag and secrets

**Build**

```bash
VIO_ENABLED=true
VIO_API_KEY=<surface key>       # Replit Secrets, never in the repo
VIO_ENVIRONMENT=testing         # development | testing | production
```

**Pass the environment name, not URLs.** The SDK derives the REST API, the
GraphQL endpoint and the analytics collector from it — three values that must
agree, resolved from one. Moving between environments is then a single word.
(There is a URL override for the temporary phase in
`04-rollout-checklist.md` Phase 0; it is not the normal path.)

One helper, e.g. `isVioEnabled()` = flag on **and** key present. Every later
step hangs off it.

**Done when** — with the flag off nothing in the app changes: no palette entry,
no settings field, no network call, no import cost.

> ⚠️ The key belongs on the server. Do not ship it into the client bundle. Your
> render is hybrid, so seed what the client needs into the hydration payload
> (see `02-frontend-and-checkout.md` §2).

---

## Step 2 — The `vio_sponsor_id` column

**Build** — a nullable column on `articles`, plus optionally `vio_brand_name`
for display so the settings panel can label the brand without a round-trip.

Follow **your boot-time `CREATE … IF NOT EXISTS` pattern**, not drizzle push —
you told us push has tried to drop a state table before, and this must port
cleanly to the original project.

Thread it through the draft model, the save endpoint and revision snapshots, the
same way `category` already flows.

**Done when** — you can set the field via the existing save path, it survives
autosave, and it appears in a restored revision.

---

## Step 3 — The brand selector

**Where** — the article settings panel, next to category and tags. There is no
separate create step, so it is present from the first second of a new draft.

**Build**

```
Vio          [ Ingen ▾ ]
             ( ) Ingen
             (•) Fredrik & Louisa
             ( ) Some Brand      (disabled — "Ikke tilkoblet")
```

- Options come from `GET /v2/web/brands` (see `03-api-reference.md`).
- A brand with `connected: false` **must be disabled**, with a hint. It has no
  commerce channel; picking it would produce an article that cannot sell.
- Selecting writes `vioSponsorId` into the draft — autosaved like any metadata.

**Done when** — pick a brand, wait for autosave, reload: it is still there.

---

## Step 4 — Conditional block palette

**Build** — offer "Vio karusell" only when `isVioEnabled()` **and**
`draft.vioSponsorId` is set.

Show it **disabled with a hint** ("Velg en merkevare først") rather than hiding
it, so editors discover the feature — your suggestion, and we agree.

**Done when** — the entry is greyed out on an article with no brand, active once
a brand is picked, and absent entirely with the flag off.

---

## Step 5 — The block and its inline panel

**Block shape**

```jsonc
{
  "type": "vioProducts",
  "productRefs": [408909, 408910, 408911],
  "variant": "carousel",          // "carousel" | "single" | "grid"
  "title": "Vårens favoritter"    // optional, editorial
}
```

No `sponsorId` — the article owns the brand. No product data (see
`00-overview.md` §4).

**Inline panel** — matching your existing block editors:

```
┌ Vio karusell ─────────────────────────────┐
│ Merkevare:  Fredrik & Louisa  (fra artikkelen)
│ Tittel:     [ Vårens favoritter        ]
│ Produkter:  3 valgt                        
│             [ Velg produkter ]  ← opens the modal
│ Visning:    (•) Karusell ( ) Enkelt ( ) Rutenett
└────────────────────────────────────────────┘
```

**Unconfigured state** — a block inserted with `productRefs: []` shows an
"unconfigured" card in the editor and renders `null` publicly, exactly like your
live-search blocks. A half-finished article stays safe to publish.

**Done when** — you can insert, title, and switch variant; an empty block never
breaks the public page.

---

## Step 6 — The product picker modal

Single step: the brand is already known from the article.

**Build**

1. Button in the inline panel opens the modal.
2. Load `GET /v2/commerce/sponsors/{vioSponsorId}/catalog?limit=50&offset=0`.
3. Grid: image, title, **live price + currency**. Multi-select. Search/filter if
   the catalogue is large; paginate with `hasMore`.
4. **Cancel** discards. **Confirm** writes `productRefs` into the block.

**Autosave — the one rule that matters**

Your autosave diffs the whole draft every 5s and every input writes to the draft
immediately. So:

- Keep the modal's selection in **modal-local state**.
- Write into the block **only on Confirm**.

Then autosave can only ever observe "before" or "after", never a
half-configured block. Optionally also add "Vio modal open" as a second
autosave-suspend condition — one line, same pattern as the slug rule, and cheap
insurance.

**Done when** — open the modal, select, cancel, wait 6s, reload: nothing
changed. Repeat with Confirm: exactly the picked ids are stored.

---

## Step 7 — Changing or clearing the brand

**This is a correctness requirement, not tidiness.**

Product ids are plain numbers (`408909`) scoped to **one channel**. If the brand
changes from A to B, the ids stored in existing blocks belong to A. Against B
they either do not exist — or, worse, **exist and mean a different product**.
The article would silently show the wrong item at the wrong price under the
wrong brand.

**Build** — when `vioSponsorId` changes or is cleared, and Vio blocks exist:

1. Warn: *"Artikkelen har N Vio-blokker. Bytter du merkevare må produktene
   velges på nytt."*
2. On confirm: **clear `productRefs`** on every Vio block; keep the blocks, their
   position, title and variant.
3. They fall back to the unconfigured state from Step 5.

Never silently keep the old ids. Never delete the blocks.

**Done when** — switching brands leaves the blocks in place, empty, and the
public page renders nothing for them rather than wrong products.

---

## Step 8 — Analytics wiring (admin side)

Nothing to build here beyond making two values reachable by the renderer:
`article.id` and the canonical `path`. `02-frontend-and-checkout.md` §5 uses
them. Your own tracking is untouched.

---

## Acceptance — the whole admin side

- [ ] Flag off → the app is byte-for-byte its old self
- [ ] Brand picked in settings, autosaved, survives reload and revision restore
- [ ] Palette gated, with a discoverable disabled state
- [ ] Products picked in a modal, committed only on Confirm
- [ ] Cancel + autosave never persists a partial selection
- [ ] Changing brand clears refs, warns, keeps blocks
- [ ] Empty block renders nothing publicly and never breaks the page
