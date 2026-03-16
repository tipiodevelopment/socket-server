# Geographic Targeting & User Segmentation Guide

## Overview

This guide explains how to use the geographic targeting and user segmentation features in Reachu's campaign system to perform A/B testing and restrict campaign visibility by region.

## Features

### What You Can Do

1. **Geographic Targeting** - Restrict campaigns to specific countries
2. **User Percentage Targeting** - Show campaigns to only a percentage of users (deterministically)
3. **Combined Targeting** - Use both geographic and user percentage together

## Dashboard Configuration

### Accessing Targeting Settings

1. Go to **Campaign Dashboard** → **Settings** tab
2. Scroll to **"Targeting & Segmentation"** section
3. Enable the toggle: **"Enable segmentation for this campaign"**

### Setting Up Geographic Targeting

**Step 1: Select Countries**
- Click the search box and type a country name or code
- Examples: "Mexico", "MX", "United States", "US"
- Click checkboxes to select multiple countries
- Selected countries appear as badges below

**Step 2: Save**
- Click "Save Targeting Settings"
- The campaign is now restricted to these countries only

### Setting Up User Percentage Targeting

**Step 1: Choose Your Percentage**
- Use the slider to set the percentage (1-100%)
- Or type a number directly in the input field
- Example: 20% means only 20% of users will see this campaign

**Step 2: How It Works**
- The system uses deterministic hashing (SHA256)
- Same user always sees or doesn't see the campaign consistently
- Example: User "user123" might fall into the 20%, while "user456" doesn't

**Step 3: Save**
- Click "Save Targeting Settings"

## Use Cases

### A/B Testing
```
Campaign: "New UI Design"
Settings:
  - Segmentation: ENABLED
  - Countries: Any (or specific countries)
  - Percentage: 20%

Result: Only 20% of users see the new UI design
```

### Regional Campaign
```
Campaign: "Mexico Black Friday"
Settings:
  - Segmentation: ENABLED
  - Countries: Mexico (MX)
  - Percentage: 100%

Result: Only users in Mexico see this campaign
```

### Limited Market Test
```
Campaign: "Market Test - Brazil & Colombia"
Settings:
  - Segmentation: ENABLED
  - Countries: Brazil (BR), Colombia (CO)
  - Percentage: 50%

Result: 50% of users in Brazil and Colombia see this campaign
```

## How It Works Technically

### Backend Logic

When the Swift SDK requests offers:
```
GET /v1/offers?apiKey=xxx&campaignId=14&userId=user123&userCountry=MX
```

The backend:
1. ✅ Checks if `isSegmented` is enabled
2. ✅ Validates `userCountry` is in `targetCountries` array
3. ✅ Calculates user hash: `SHA256("user123:14") % 100`
4. ✅ Checks if hash is less than `targetPercentage`
5. ✅ Returns offers only if ALL checks pass
6. ❌ Returns empty offers array if ANY check fails

### Deterministic Hashing Example

```
User: "user123", Campaign: 14, Percentage: 20

Hash = SHA256("user123:14") → "a7f3e2b..."
Value = parseInt("a7f3e2b", 16) % 100 = 45
Check: 45 < 20? NO → User does NOT see campaign
```

Same user always gets same result because hash is deterministic.

## Database Schema

### Campaign Table Additions

```sql
-- Enable/disable segmentation
is_segmented: varchar (default 'false') -- 'true' or 'false'

-- List of countries (ISO codes)
target_countries: text[] -- ['MX', 'US', 'AR', ...]

-- User percentage (1-100)
target_percentage: integer -- null or 1-100
```

## SDK Integration (Swift)

### Passing User Data

```swift
// Get user's country and ID
let userCountry = Locale.current.region?.identifier // "MX"
let userId = UserDefaults.standard.string(forKey: "userId") // "user123"

// Request offers with targeting parameters
let url = URL(string: """
/v1/offers?apiKey=xxx&campaignId=14&userId=\(userId)&userCountry=\(userCountry)
""")
```

## Important Notes

### When Segmentation is Disabled
- All parameters are ignored
- All users see the campaign (if active)
- No geographic or percentage restrictions apply

### When Segmentation is Enabled
- Missing `userId` or `userCountry` = empty offers
- No matching country = empty offers
- User percentage hash doesn't match = empty offers

### Behavior
- No error messages - graceful degradation
- Empty offers array returned when user doesn't match
- SDK handles empty offers naturally (no UI shown)

## Supported Countries

The system supports these 18 countries:

| Code | Country | Code | Country |
|------|---------|------|---------|
| US | United States | ES | Spain |
| MX | Mexico | CA | Canada |
| AR | Argentina | DE | Germany |
| CO | Colombia | FR | France |
| BR | Brazil | GB | United Kingdom |
| IT | Italy | JP | Japan |
| AU | Australia | NZ | New Zealand |
| SG | Singapore | IN | India |
| KR | South Korea | CN | China |

## Examples

### Example 1: Test in Mexico Only (20% of users)

1. Go to Campaign Settings
2. Enable Segmentation
3. Select: Mexico (MX)
4. Set Percentage: 20%
5. Save

Result: Only users in Mexico AND in the selected 20% will see offers.

### Example 2: Global A/B Test (50/50)

1. Go to Campaign Settings
2. Enable Segmentation
3. Select: All countries (or omit country selection)
4. Set Percentage: 50%
5. Save

Result: 50% of all users worldwide will see offers.

### Example 3: Multiple Countries, Full Rollout

1. Go to Campaign Settings
2. Enable Segmentation
3. Select: US, MX, AR, BR, CO
4. Set Percentage: 100%
5. Save

Result: All users in those 5 countries will see offers.

## Troubleshooting

### Campaign Shows No Offers
- ✅ Check: Is segmentation enabled?
- ✅ Check: Is `userCountry` in the targeting list?
- ✅ Check: Does the user's hash fall within the percentage?
- ✅ Check: Are there actually active components in the campaign?

### User Always Sees Campaign
- ✅ Check: Is segmentation disabled? (Disable it if you want to show to everyone)
- ✅ Check: Is percentage set to 100%?
- ✅ Check: Are they in the selected countries?

### User Never Sees Campaign
- ✅ Check: Is percentage set too low?
- ✅ Check: Is their country not in the target list?
- ✅ Check: Is segmentation enabled? (It should be disabled for 100% rollout)

## FAQ

**Q: Can I change the percentage after launch?**
A: Yes, change it in Settings. Users' assignment will update based on the new hash calculation.

**Q: Will the same user always see the same campaign?**
A: Yes, the deterministic hash ensures consistency for the same userId + campaignId combination.

**Q: What if I don't pass userId and userCountry?**
A: If segmentation is enabled and these are missing, the endpoint returns empty offers.

**Q: Can I edit the country list after publishing?**
A: Yes, go to Settings, update the countries, and save. Changes take effect immediately.

**Q: Is there a default percentage if I don't set one?**
A: Default is null (treated as 100%) when not set. Always set explicitly for clarity.

## Related Documentation

- [Campaign Management Guide](./docs/campaigns.md) - General campaign setup
- [SDK Integration Guide](./docs/sdk-integration.md) - Swift SDK integration
- [API Reference](./docs/api.md) - Full API endpoint documentation
