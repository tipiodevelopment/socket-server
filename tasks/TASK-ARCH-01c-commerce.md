# TASK ARCH-01c — Commerce integration (real products, per-sponsor channel)

**Status: TODO — Do after ARCH-01b**

## Model
Each sponsor has their own Commerce channel with their own API key.
One campaign can have multiple sponsors → multiple Commerce channels.

```
Campaign
  └── Sponsor: Elkjøp
        └── commerce_api_key: "KCXF10Y-..."
        └── commerce_channel_id: "elkjop-channel" (or null if default)
        └── Products: fetched from Commerce with Elkjøp's key

  └── Sponsor: Torshov Sport
        └── commerce_api_key: "XXXXX-..."
        └── commerce_channel_id: "torshov-channel"
        └── Products: fetched from Commerce with Torshov's key
```

## DB changes
Add Commerce fields to `sponsors` table:
```sql
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS commerce_api_key TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS commerce_channel_id TEXT;
```

## Backend endpoint
```
GET /api/commerce/products?sponsorId=:id
```
1. Read `commerce_api_key` and `commerce_channel_id` from sponsor record
2. If no api_key → return empty array (Commerce not configured for this sponsor)
3. Query `https://graph-ql-dev.vio.live/graphql` with sponsor's own API key
4. Return normalized product list

## Commerce GraphQL query
```graphql
query GetProducts {
  GetProducts {
    id
    title
    images { url order }
    price { amount amount_incl_taxes currency_code }
  }
}
```
Or if channel supports filtering by IDs:
```graphql
query GetProductsByIds($product_ids: [Int]!) {
  GetProductsByIds(product_ids: $product_ids) {
    id title
    images { url order }
    price { amount amount_incl_taxes currency_code }
  }
}
```

## Sponsors page — add Commerce config
In sponsor create/edit form add:
- "Commerce API Key" field (password input, masked)
- "Commerce Channel ID" field (text input, optional)

## Demo data (seed)
```sql
UPDATE sponsors SET 
  commerce_api_key = 'KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S',
  commerce_channel_id = NULL
WHERE id = 3; -- Elkjøp

UPDATE sponsors SET
  commerce_api_key = 'KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S',
  commerce_channel_id = NULL  
WHERE id = 4; -- Torshov Sport (same key for now, different channel when available)
```

## IMPORTANT
- Commerce API keys are stored in DB per sponsor — NOT in Replit Secrets
- Never log or expose API keys in responses
- The dashboard Commerce product selector fetches products using the selected sponsor's key
