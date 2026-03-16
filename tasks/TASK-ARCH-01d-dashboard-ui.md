# TASK ARCH-01d — Dashboard UI (multi-sponsor)

**Status: TODO — Do after ARCH-01c**

## Campaign Detail — new "Sponsors" tab
- List all sponsors in campaign (from campaign_sponsors)
- Each card: logo, name, color swatch, role badge (Engagement/Shoppable/Full)
- "+ Add Sponsor" → select from existing sponsors + assign role
- Remove sponsor action

## Broadcast Detail — "Shoppable Ads" section redesign
Replace current "Commerce Product ID" text input with:

### Pre-programmed slots panel
- List of configured slots: sponsor logo, product name, trigger type/value, status badge, "▶ Fire Now" button
- "+ Add Slot" → opens slot config:
  - Sponsor selector (sponsors from this campaign)
  - Product selector (fetched from Commerce for that sponsor — show images + prices)
  - Trigger type: Manual | Match Minute (number) | Absolute Time (datetime)
  - Auto-execute toggle (saves config, not implemented yet)

### Ad-hoc trigger panel
- Quick fire: Sponsor dropdown → Product grid → "Trigger Ad" button
- This is the existing behavior, just improved UI

## Notes
- Sponsor selector should show sponsor logo + name + color swatch
- Product selector should show product image + title + price (NOK)
- After firing ad: show toast + log entry with timestamp in the slots list
