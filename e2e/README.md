# End-to-End Test Suite

This document describes the end-to-end testing strategy for the Real-Time Event Broadcasting System.

## Test Coverage

The test suite validates the following critical flows:

### 1. Component Management Flow
**File:** `components-management.spec.ts`
- Add multiple instances of the same template component (e.g., multiple Banners)
- Activate/deactivate components
- Delete specific component instance (validates bug fix - only deletes targeted instance)
- Verify component count updates correctly

### 2. Campaign Lifecycle Flow
**File:** `campaign-lifecycle.spec.ts`
- Create new campaign with User → ClientApp → Channel → Campaign hierarchy
- Configure campaign settings
- Verify campaign appears in list

### 3. Event Broadcasting Flow
**File:** `event-broadcasting.spec.ts`
- Create and broadcast Product events
- Create and broadcast Poll events
- Create and broadcast Contest events
- Verify events appear in Saved Events section
- Validate WebSocket delivery

### 4. Segmentation Flow
**File:** `segmentation.spec.ts`
- Enable/disable campaign segmentation
- Configure target countries (multi-select)
- Configure target percentage (1-100%)
- Verify settings persist correctly

### 5. SDK Integration Flow
**File:** `sdk-integration.spec.ts`
- Validate `/v1/sdk/config` endpoint returns correct JSON
- Validate `/v1/offers` endpoint with user targeting
- Test API key authentication
- Verify HTTPS URLs for assets

### 6. Campaign Control Flow
**File:** `campaign-control.spec.ts`
- Pause campaign via master control
- Verify component toggles are disabled when paused
- Resume campaign
- Verify component toggles re-enabled after resume

### 7. Segmentation Edge Cases
**File:** `segmentation-edge-cases.spec.ts`
- 0% targeting (no users qualify)
- 50% targeting (half of users)
- 100% targeting (all users in target countries)
- Geographic mismatch (user country not in target list)
- Missing userId/userCountry parameters
- Deterministic hashing (same user always gets same result)

## Running Tests

### Integrated Testing (Recommended)
Tests are executed using the integrated Playwright testing subagent via `run_test` tool in the Replit environment. This provides:
- Automatic browser context creation
- Direct database access for seeding/verification
- Screenshot capture on failures
- Detailed test reports

### Local Playwright Execution
To run Playwright tests locally:

```bash
# Prerequisites
npm install
npm run dev &  # Start the dev server in background

# Install Playwright browsers (first time only)
npx playwright install chromium

# Run all e2e tests
npx playwright test e2e/

# Run specific test file
npx playwright test e2e/components-management.spec.ts

# Run with headed browser (visible)
npx playwright test --headed

# Run with debug mode
npx playwright test --debug
```

**Environment Variables Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key

### Manual API Testing

To test SDK endpoints manually:

```bash
# Get SDK config
curl "http://localhost:5000/v1/sdk/config?apiKey=YOUR_API_KEY&campaignId=CAMPAIGN_ID"

# Get offers without targeting
curl "http://localhost:5000/v1/offers?apiKey=YOUR_API_KEY&campaignId=CAMPAIGN_ID"

# Get offers with user targeting
curl "http://localhost:5000/v1/offers?apiKey=YOUR_API_KEY&campaignId=CAMPAIGN_ID&userId=user123&userCountry=MX"
```

### Existing Unit Tests

Run segmentation unit tests:
```bash
npm test __tests__/segmentation.test.ts
```

## Test Data Conventions

### Session Simulation
Tests use `localStorage.setItem('reachu_simulated_user_id', 'reachu-admin')` to simulate authenticated user sessions.

### Unique Identifiers
Use `nanoid()` or unique timestamps for test data to avoid conflicts:
- Campaign names: `E2E Test Campaign ${nanoid(6)}`
- Component names: `Test Banner ${nanoid(6)}`

### Database Seeding
Tests may use direct DB queries to:
- Find valid campaigns with channels and API keys
- Update segmentation settings
- Verify data persistence

### Cleanup
Each test creates isolated data and should not depend on previous test state.

## Key Test IDs

The application uses `data-testid` attributes for testing:

### Navigation
- `tab-overview`, `tab-events`, `tab-components`, `tab-settings`

### Components Tab
- `button-toggle-${componentId}` - Toggle component active/inactive
- `button-remove-${componentId}` - Delete component
- `button-edit-${componentId}` - Edit component config

### Events Tab
- `saved-event-${eventId}` - Saved event cards
- `button-broadcast` - Broadcast event button

### Campaign Controls
- Campaign pause/resume buttons in Overview tab

## Database Schema Reference

### Campaigns Table
```sql
id, name, description, channel_id, user_id
is_paused, start_date, end_date
is_segmented, target_countries, target_percentage
```

### Events Table (Offers)
```sql
id, campaign_id, type, data, timestamp
-- type: 'product', 'poll', 'contest'
```

### Campaign Components
```sql
id, campaign_id, component_id, status, instance_name, custom_config
```

## Troubleshooting

### Empty Offers Array
If `/v1/offers` returns empty offers, this is expected behavior in these cases:
1. Campaign has no product events (type='product' in events table) - SDK returns empty array
2. If segmentation enabled, user may not meet targeting criteria (country/percentage)
3. Missing userId/userCountry when campaign has segmentation enabled

**Note:** Empty offers array is NOT an error - it indicates the user is either ineligible or there are no products for that campaign.

### Event Broadcasting API
The correct endpoint for creating events is `POST /api/events/:campaignId` (not `/api/events`):
```bash
curl -X POST "http://localhost:5000/api/events/CAMPAIGN_ID" \
  -H "Content-Type: application/json" \
  -d '{"type": "product", "data": {"name": "Test Product", "price": "99.99"}}'
```

### Component Deletion Issues
The bug fix ensures deletion uses `campaign_components.id` (instance ID) not `component_id` (template ID).

### WebSocket Connection
Tests may show WebSocket 502 errors in development - this is expected and doesn't affect REST API testing.
