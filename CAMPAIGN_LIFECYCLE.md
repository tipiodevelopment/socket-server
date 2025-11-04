# Campaign Lifecycle Integration Guide for iOS

## Overview

This document explains how the campaign lifecycle system works and how to integrate it into your iOS/Swift application using WebSockets.

## How Campaign Lifecycle Works

### Campaign States

A campaign can be in one of three states based on its `startDate` and `endDate`:

1. **Upcoming** (before `startDate`)
   - Campaign hasn't started yet
   - Components CANNOT be activated, even manually
   - No events are broadcast

2. **Active** (between `startDate` and `endDate`)
   - Campaign is currently running
   - Components can be activated/deactivated via:
     - Manual toggle by administrators
     - Automatic scheduling
   - All component events are broadcast normally

3. **Ended** (after `endDate`)
   - Campaign has finished
   - All components are automatically hidden
   - `campaign_ended` event is broadcast to all connected clients

### Special Cases

- **No dates set**: Campaign is always active (legacy behavior)
- **Only startDate**: Campaign becomes active after start, never ends
- **Only endDate**: Campaign is active until end date

## WebSocket Events

### Connection Behavior

When your iOS app connects to a campaign's WebSocket (`wss://your-domain/ws/{campaignId}`):

| Campaign State | What Happens |
|---------------|--------------|
| Ended | Immediately receives `campaign_ended` event |
| Upcoming | No event sent, waits for `campaign_started` |
| Active | No event sent, can fetch and display active components |

### Event Types

#### 1. `campaign_started`

Sent when a campaign's start date is reached.

**Payload:**
```json
{
  "type": "campaign_started",
  "campaignId": 10,
  "startDate": "2024-12-25T10:00:00Z",
  "endDate": "2024-12-31T23:59:59Z"
}
```

**What to do:**
- Prepare your UI for campaign components
- Fetch active components from API
- Enable component display logic

#### 2. `campaign_ended`

Sent when a campaign's end date is reached.

**Payload:**
```json
{
  "type": "campaign_ended",
  "campaignId": 10,
  "endDate": "2024-12-31T23:59:59Z"
}
```

**What to do:**
- Immediately hide ALL campaign components
- Clear any cached component data
- Update UI to show "campaign ended" state

#### 3. `component_status_changed`

Sent when a component is manually activated or deactivated during an active campaign.

**Payload:**
```json
{
  "type": "component_status_changed",
  "campaignId": 10,
  "componentId": "banner-abc123",
  "status": "active",
  "component": {
    "id": "banner-abc123",
    "type": "banner",
    "name": "Welcome Banner",
    "config": {
      "title": "Welcome!",
      "message": "Check out our deals",
      "imageUrl": "https://...",
      "ctaText": "Shop Now",
      "ctaLink": "https://..."
    }
  }
}
```

**What to do:**
- If `status === "active"`: Show the component
- If `status === "inactive"`: Hide the component
- Use `component.type` to determine which UI component to display

#### 4. `component_config_updated`

Sent when a component's configuration is updated.

**Payload:**
```json
{
  "type": "component_config_updated",
  "campaignId": 10,
  "componentId": "banner-abc123",
  "component": {
    "id": "banner-abc123",
    "type": "banner",
    "name": "Welcome Banner",
    "config": {
      "title": "Updated Title!",
      "message": "New message"
    }
  }
}
```

**What to do:**
- Update the displayed component with new configuration
- Refresh UI to show new content

## Swift Implementation

### 1. WebSocket Manager Setup

```swift
import Foundation

class WebSocketManager: NSObject, URLSessionWebSocketDelegate {
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession!
    private let campaignId: Int
    
    // State management
    @Published var isCampaignActive: Bool = true
    @Published var activeComponents: [Component] = []
    
    init(campaignId: Int) {
        self.campaignId = campaignId
        super.init()
    }
    
    func connect() {
        urlSession = URLSession(configuration: .default, 
                               delegate: self, 
                               delegateQueue: OperationQueue())
        
        // Connect to campaign-specific WebSocket channel
        let url = URL(string: "wss://your-domain/ws/\(campaignId)")!
        webSocketTask = urlSession.webSocketTask(with: url)
        webSocketTask?.resume()
        
        receiveMessage()
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                default:
                    break
                }
                self?.receiveMessage()
            case .failure(let error):
                print("WebSocket error: \(error)")
                // Implement reconnection logic here
            }
        }
    }
}
```

### 2. Message Handler

```swift
private func handleMessage(_ text: String) {
    guard let data = text.data(using: .utf8) else { return }
    
    // Parse event type first
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let eventType = json["type"] as? String
    else { return }
    
    // Handle based on type
    do {
        switch eventType {
        case "campaign_started":
            handleCampaignStarted(json)
            
        case "campaign_ended":
            handleCampaignEnded(json)
            
        case "component_status_changed":
            handleComponentStatusChanged(json)
            
        case "component_config_updated":
            handleComponentConfigUpdated(json)
            
        case "product", "poll", "contest":
            // Handle real-time events (existing functionality)
            handleRealtimeEvent(eventType, data: data)
            
        default:
            print("Unknown event type: \(eventType)")
        }
    } catch {
        print("Error handling message: \(error)")
    }
}
```

### 3. Lifecycle Event Handlers

```swift
private func handleCampaignStarted(_ json: [String: Any]) {
    DispatchQueue.main.async {
        self.isCampaignActive = true
        
        // Fetch active components from API
        Task {
            await self.loadActiveComponents()
        }
        
        print("Campaign started, loading components...")
    }
}

private func handleCampaignEnded(_ json: [String: Any]) {
    DispatchQueue.main.async {
        self.isCampaignActive = false
        
        // Hide ALL components immediately
        self.activeComponents.removeAll()
        
        // Update UI
        NotificationCenter.default.post(
            name: .campaignEnded, 
            object: nil
        )
        
        print("Campaign ended, all components hidden")
    }
}

private func handleComponentStatusChanged(_ json: [String: Any]) {
    guard let componentData = json["component"] as? [String: Any],
          let componentId = componentData["id"] as? String,
          let status = json["status"] as? String
    else { return }
    
    DispatchQueue.main.async {
        if status == "active" {
            // Add or update component
            if let component = self.parseComponent(from: componentData) {
                self.addOrUpdateComponent(component)
            }
        } else {
            // Remove component
            self.activeComponents.removeAll { $0.id == componentId }
        }
    }
}

private func handleComponentConfigUpdated(_ json: [String: Any]) {
    guard let componentData = json["component"] as? [String: Any],
          let componentId = componentData["id"] as? String
    else { return }
    
    DispatchQueue.main.async {
        // Update existing component's config
        if let index = self.activeComponents.firstIndex(where: { $0.id == componentId }),
           let updatedComponent = self.parseComponent(from: componentData) {
            self.activeComponents[index] = updatedComponent
        }
    }
}
```

### 4. Component Model

```swift
struct Component: Codable, Identifiable {
    let id: String
    let type: String  // "banner", "offer_banner", "countdown", etc.
    let name: String
    let config: ComponentConfig
}

struct ComponentConfig: Codable {
    // Common fields
    let title: String?
    let message: String?
    let imageUrl: String?
    
    // CTA fields
    let ctaText: String?
    let ctaLink: String?
    let deeplink: String?  // Optional deeplink for in-app navigation
    
    // Component-specific fields (decode based on component type)
    // Add more fields as needed
}
```

### 5. Fetching Active Components

```swift
func loadActiveComponents() async {
    guard isCampaignActive else { return }
    
    let url = URL(string: "https://your-domain/api/campaigns/\(campaignId)/components")!
    
    do {
        let (data, _) = try await URLSession.shared.data(from: url)
        let components = try JSONDecoder().decode([Component].self, from: data)
        
        DispatchQueue.main.async {
            // Only show active components
            self.activeComponents = components.filter { $0.status == "active" }
        }
    } catch {
        print("Error loading components: \(error)")
    }
}
```

### 6. UI Integration

```swift
import SwiftUI

struct CampaignView: View {
    @StateObject private var wsManager: WebSocketManager
    
    var body: some View {
        ZStack {
            // Your main content
            MainContentView()
            
            // Campaign components overlay
            if wsManager.isCampaignActive {
                ForEach(wsManager.activeComponents) { component in
                    ComponentView(component: component)
                }
            }
        }
        .onAppear {
            wsManager.connect()
        }
    }
}

struct ComponentView: View {
    let component: Component
    
    var body: some View {
        // Render based on component type
        switch component.type {
        case "banner":
            BannerComponent(config: component.config)
        case "offer_banner":
            OfferBannerComponent(config: component.config)
        case "countdown":
            CountdownComponent(config: component.config)
        default:
            EmptyView()
        }
    }
}
```

## Business Rules

### Critical Rules to Follow

1. **Campaign Lifecycle is Authoritative**
   - ALWAYS respect `campaign_started` and `campaign_ended` events
   - Hide components immediately when campaign ends
   - Don't show components before campaign starts

2. **Component Type Uniqueness**
   - Only ONE component of each type can be active at a time
   - Example: Only one banner, one countdown, etc.
   - Your iOS app can safely use: `activeComponents.first { $0.type == "banner" }`

3. **Manual Toggle Support**
   - Admins can activate/deactivate components during active campaigns
   - Your app receives `component_status_changed` events
   - Update UI immediately when these events arrive

4. **Deeplink Priority**
   - If `component.config.deeplink` exists, use it instead of `ctaLink`
   - Deeplinks enable in-app navigation (e.g., `myapp://offers/weekly`)
   - Supports custom URL schemes and universal links

## API Endpoints

### Get Active Components
```
GET /api/campaigns/{campaignId}/components
```

Returns array of components with their status and configuration.

### Get Campaign Info
```
GET /api/campaigns/{campaignId}
```

Returns campaign details including `startDate` and `endDate`.

## Testing Scenarios

### Test 1: Campaign Not Started
1. Create campaign with future `startDate`
2. Connect WebSocket → No events received
3. Try to fetch components → Should return empty or inactive components
4. Wait for `startDate` → Receive `campaign_started` event

### Test 2: Active Campaign
1. Create campaign with current dates
2. Connect WebSocket → No immediate event
3. Fetch components → Receive active components
4. Admin toggles component → Receive `component_status_changed`

### Test 3: Campaign Ended
1. Create campaign with past `endDate`
2. Connect WebSocket → Immediately receive `campaign_ended`
3. All components should be hidden

### Test 4: Manual Toggle
1. During active campaign
2. Admin activates component in dashboard
3. iOS app receives `component_status_changed` with `status: "active"`
4. Show component immediately

## Error Handling

```swift
// Handle connection errors
func handleConnectionError(_ error: Error) {
    print("WebSocket error: \(error)")
    
    // Implement exponential backoff retry
    retryCount += 1
    let delay = min(30, pow(2.0, Double(retryCount)))
    
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
        self.connect()
    }
}

// Handle invalid data
func handleInvalidData(_ error: Error, for eventType: String) {
    print("Invalid data for \(eventType): \(error)")
    // Log to analytics
    // Don't crash the app
}

// Handle campaign not found
func handleCampaignNotFound() {
    DispatchQueue.main.async {
        self.isCampaignActive = false
        self.activeComponents.removeAll()
        // Show error to user
    }
}
```

## Best Practices

1. **Always Check Campaign State First**
   - Before showing any component, verify `isCampaignActive == true`

2. **Cache Component Data**
   - Store active components locally
   - Reduce API calls
   - Faster UI updates

3. **Implement Reconnection Logic**
   - WebSocket connections can drop
   - Use exponential backoff (max 5 retries)
   - Refetch components after reconnection

4. **Update UI on Main Thread**
   - All WebSocket handlers should dispatch to main queue
   - Use `@Published` properties for SwiftUI reactivity

5. **Handle Component Types Gracefully**
   - Unknown component types should not crash the app
   - Log and skip unknown types
   - Easy to add new component types later

## Common Issues

### Issue 1: Components Not Showing
**Cause:** Campaign hasn't started yet or has ended
**Solution:** Check campaign dates, wait for `campaign_started` event

### Issue 2: Duplicate Components
**Cause:** Not removing old components when status changes
**Solution:** Always remove before adding in `handleComponentStatusChanged`

### Issue 3: WebSocket Disconnects
**Cause:** Network issues, server restart, idle timeout
**Solution:** Implement heartbeat ping/pong and reconnection logic

### Issue 4: Components Show After Campaign Ends
**Cause:** Not handling `campaign_ended` event
**Solution:** Immediately clear all components when this event arrives

## Summary for Cursor AI

When implementing campaign lifecycle in iOS:

1. **Connect to WebSocket** with campaign ID
2. **Listen for 4 event types**: `campaign_started`, `campaign_ended`, `component_status_changed`, `component_config_updated`
3. **Respect campaign state**: Don't show components if campaign hasn't started or has ended
4. **Update UI immediately** when receiving events
5. **Handle errors gracefully** with reconnection logic
6. **Test all scenarios**: upcoming, active, ended campaigns

The backend automatically manages campaign lifecycle. Your iOS app just needs to:
- ✅ Listen to events
- ✅ Show/hide components based on events
- ✅ Respect campaign dates
- ✅ Handle edge cases (no dates, network errors, etc.)
