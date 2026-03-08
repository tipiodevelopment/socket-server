# TASK ARCH-01c — Commerce integration (real products)

**Status: TODO — Do after ARCH-01b**

## Goal
Replace all hardcoded fake products in the dashboard with real products from Commerce GraphQL.

## Commerce API
- URL: `https://graph-ql-dev.vio.live/graphql`
- Auth: `Authorization: KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S`
- Store key as `COMMERCE_API_KEY` in Replit Secrets — NEVER hardcode

## Query
```graphql
query GetProductsByIds($product_ids: [Int]!) {
  GetProductsByIds(product_ids: $product_ids) {
    id
    title
    images { url order }
    price { amount amount_incl_taxes currency_code }
  }
}
```

## New backend endpoint
```
GET /api/commerce/products?campaignId=:id
```
1. Read product IDs from `broadcast_sponsor_slots.product_ids` for this campaign's broadcasts
2. Fallback: use known demo product IDs [408841, 408874, 408895, 408896, 408898]
3. Query Commerce GraphQL
4. Return normalized product list

## Dashboard changes
In broadcast detail "Shoppable Products" section:
- Remove ALL hardcoded fake products (Official Team Jersey, Match Day Scarf, etc.)
- Replace with real products from `GET /api/commerce/products?campaignId=:id`
- Show: product image, title, price in NOK, sponsor logo, "Fire Ad" button
- Remove hardcoded "Products Active: 3 / Total Listed: 4" counters
