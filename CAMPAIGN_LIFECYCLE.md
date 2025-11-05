# Campaign Lifecycle Integration Guide for iOS

## Overview

This document explains how the campaign lifecycle system works and how to integrate it into your iOS/Swift application using WebSockets.

## How Campaign Lifecycle Works

### Campaign States

A campaign can be in one of four states based on its lifecycle dates (`startDate`/`endDate`) and manual control (`isPaused`):

1. **Paused** (manually paused by administrator)
   - Campaign has been manually paused using the master control
   - ALL components are hidden, regardless of lifecycle dates
   - Scheduler stops activating components
   - Overrides all other states (highest priority)
   - Can be resumed at any time by administrator

2. **Upcoming** (before `startDate`)
   - Campaign hasn't started yet
   - Components CANNOT be activated, even manually
   - No events are broadcast
   - Waiting for `startDate` to be reached

3. **Active** (between `startDate` and `endDate` AND not paused)
   - Campaign is currently running
   - Components can be activated/deactivated via:
     - Manual toggle by administrators
     - Automatic scheduling
   - All component events are broadcast normally

4. **Ended** (after `endDate`)
   - Campaign has finished
   - All components are automatically hidden
   - `campaign_ended` event is broadcast to all connected clients
   - Cannot be reactivated (lifecycle complete)

### State Priority

The system checks campaign state in this order:

1. **Is paused?** → If yes, campaign is INACTIVE (manual control overrides everything)
2. **Has started?** → If no (upcoming), campaign is INACTIVE
3. **Has ended?** → If yes, campaign is INACTIVE
4. **Otherwise** → Campaign is ACTIVE

### Special Cases

- **No dates set**: Campaign is always active (unless manually paused)
- **Only startDate**: Campaign becomes active after start, never ends (unless paused)
- **Only endDate**: Campaign is active until end date (unless paused)
- **Paused state persists**: When you pause a campaign, it stays paused even after server restart

## WebSocket Events

### Connection Behavior

When your iOS app connects to a campaign's WebSocket (`wss://your-domain/ws/{campaignId}`):

| Campaign State | What Happens |
|---------------|--------------|
| Paused | No immediate event sent, but components should be hidden |
| Ended | Immediately receives `campaign_ended` event |
| Upcoming | No event sent, waits for `campaign_started` |
| Active | No event sent, can fetch and display active components |

**Important:** Always fetch campaign status from API on connection to determine if campaign is paused.

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

#### 3. `campaign_paused`

Sent when an administrator manually pauses the campaign using the master control.

**Payload:**
```json
{
  "type": "campaign_paused",
  "campaignId": 10,
  "timestamp": "2024-12-26T14:30:00Z"
}
```

**What to do:**
- Immediately hide ALL campaign components
- Store paused state locally
- Show "campaign paused" indicator in UI
- Components remain paused until `campaign_resumed` event

#### 4. `campaign_resumed`

Sent when an administrator resumes a paused campaign.

**Payload:**
```json
{
  "type": "campaign_resumed",
  "campaignId": 10,
  "timestamp": "2024-12-26T15:00:00Z"
}
```

**What to do:**
- Clear paused state
- Fetch active components from API
- Re-display components according to their status
- Resume normal component display logic

#### 5. `component_status_changed`

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

#### 6. `component_config_updated`

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
            
        case "campaign_paused":
            handleCampaignPaused(json)
            
        case "campaign_resumed":
            handleCampaignResumed(json)
            
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

private func handleCampaignPaused(_ json: [String: Any]) {
    DispatchQueue.main.async {
        self.isCampaignActive = false
        
        // Hide ALL components immediately
        self.activeComponents.removeAll()
        
        // Update UI to show paused state
        NotificationCenter.default.post(
            name: .campaignPaused, 
            object: nil
        )
        
        print("Campaign paused by administrator, all components hidden")
    }
}

private func handleCampaignResumed(_ json: [String: Any]) {
    DispatchQueue.main.async {
        self.isCampaignActive = true
        
        // Fetch active components from API
        Task {
            await self.loadActiveComponents()
        }
        
        // Update UI
        NotificationCenter.default.post(
            name: .campaignResumed, 
            object: nil
        )
        
        print("Campaign resumed, loading components...")
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

## Reachu Product Components

The system now supports three new product-focused components that integrate with Reachu.io. Each component is designed to be self-contained in the iOS SDK, handling its own data fetching and rendering logic.

### Component Types

#### 1. Product Carousel (`product_carousel`)

A horizontal scrollable carousel displaying multiple Reachu products.

**JSON Structure:**
```json
{
  "type": "product_carousel",
  "name": "Black Friday Products",
  "config": {
    "productIds": ["408841", "408842", "408843", "408844"],
    "autoPlay": true,
    "interval": 3000
  }
}
```

**Config Fields:**
- `productIds` (string[], required): Array of Reachu product IDs in display order
- `autoPlay` (boolean, optional): Enable auto-scroll (default: false)
- `interval` (number, optional): Milliseconds between slides when autoPlay is enabled (default: 3000)

**Swift Implementation:**
```swift
struct ProductCarouselView: View {
    let config: [String: Any]
    @State private var products: [ReachuProduct] = []
    @State private var isLoading = false
    
    var body: some View {
        let productIds = config["productIds"] as? [String] ?? []
        let autoPlay = config["autoPlay"] as? Bool ?? false
        let interval = config["interval"] as? Int ?? 3000
        
        if isLoading {
            ProgressView()
        } else {
            RProductSlider(
                products: products,
                autoPlay: autoPlay,
                interval: TimeInterval(interval / 1000)
            )
            .onAppear {
                loadProducts(ids: productIds)
            }
        }
    }
    
    private func loadProducts(ids: [String]) {
        isLoading = true
        Task {
            do {
                // Call Reachu API with product IDs
                let fetchedProducts = try await ReachuAPI.shared.getProducts(ids: ids)
                DispatchQueue.main.async {
                    self.products = fetchedProducts
                    self.isLoading = false
                }
            } catch {
                print("Error loading products: \(error)")
                isLoading = false
            }
        }
    }
}
```

#### 2. Product Banner (`product_banner`)

A promotional banner featuring a single product with full visual customization support including colors, sizes, alignment, and overlay effects.

**JSON Structure:**

Minimal (uses all defaults):
```json
{
  "type": "product_banner",
  "name": "Featured Product Banner",
  "config": {
    "productId": "408841",
    "backgroundImageUrl": "https://cdn.example.com/banner-bg.jpg",
    "title": "Producto de la Semana",
    "subtitle": "Hasta 40% de descuento",
    "ctaText": "Ver producto"
  }
}
```

Full customization:
```json
{
  "type": "product_banner",
  "name": "Featured Product Banner",
  "config": {
    "productId": "408841",
    "backgroundImageUrl": "https://cdn.example.com/banner-bg.jpg",
    "title": "Producto de la Semana",
    "subtitle": "Hasta 40% de descuento",
    "ctaText": "Ver producto",
    "ctaLink": "https://tienda.com/producto/408841",
    "deeplink": "pregnancy://product/408841",
    "titleColor": "#FFFFFF",
    "subtitleColor": "#F0F0F0",
    "buttonBackgroundColor": "#007AFF",
    "buttonTextColor": "#FFFFFF",
    "overlayOpacity": 0.6,
    "bannerHeight": 220,
    "titleFontSize": 26,
    "subtitleFontSize": 17,
    "buttonFontSize": 15,
    "textAlignment": "center",
    "contentVerticalAlignment": "center"
  }
}
```

**Config Fields:**

*Content (Required):*
- `productId` (string): Reachu product ID
- `backgroundImageUrl` (string): URL of banner background image

*Content (Optional):*
- `title` (string): Custom title (uses product name if empty)
- `subtitle` (string): Additional promotional text
- `ctaText` (string): Button text
- `ctaLink` (string): Web URL for the product
- `deeplink` (string): App deeplink. Takes priority over ctaLink when present

*Colors (Optional, with defaults):*
- `titleColor` (string): Title text color (default: "#FFFFFF")
- `subtitleColor` (string): Subtitle text color (default: "#F0F0F0")
- `buttonBackgroundColor` (string): Button background color (default: "#007AFF" - iOS blue)
- `buttonTextColor` (string): Button text color (default: "#FFFFFF")
- `backgroundColor` (string): Background color with alpha transparency (RGBA format, default: "rgba(0, 0, 0, 0.3)")
  - Set alpha to 0 to remove background completely: `"rgba(0, 0, 0, 0)"`
  - Use the "Remove Background" button in the UI for quick removal

*Layout (Optional, with defaults):*
- `overlayOpacity` (number): Background overlay darkness, 0.0-1.0 (default: 0.5)
- `bannerHeight` (number): Banner height in points (default: 200)
- `titleFontSize` (number): Title font size (default: 24)
- `subtitleFontSize` (number): Subtitle font size (default: 16)
- `buttonFontSize` (number): Button font size (default: 14)

*Alignment (Optional, with defaults):*
- `textAlignment` (string): Horizontal alignment - "left", "center", "right" (default: "center")
- `contentVerticalAlignment` (string): Vertical positioning - "top", "center", "bottom" (default: "center")

**Swift Implementation:**
```swift
struct ProductBannerConfig: Codable {
    // Content
    let productId: String
    let backgroundImageUrl: String
    let title: String?
    let subtitle: String?
    let ctaText: String?
    let ctaLink: String?
    let deeplink: String?
    
    // Colors (with defaults)
    let titleColor: String?
    let subtitleColor: String?
    let buttonBackgroundColor: String?
    let buttonTextColor: String?
    let backgroundColor: String?
    
    // Layout (with defaults)
    let overlayOpacity: Double?
    let bannerHeight: Double?
    let titleFontSize: Double?
    let subtitleFontSize: Double?
    let buttonFontSize: Double?
    
    // Alignment (with defaults)
    let textAlignment: String?
    let contentVerticalAlignment: String?
}

struct ProductBannerView: View {
    let config: ProductBannerConfig
    @State private var product: ReachuProduct?
    @State private var isLoading = false
    
    // Computed properties with defaults
    private var titleColor: Color {
        Color(hex: config.titleColor ?? "#FFFFFF")
    }
    
    private var subtitleColor: Color {
        Color(hex: config.subtitleColor ?? "#F0F0F0")
    }
    
    private var buttonBgColor: Color {
        Color(hex: config.buttonBackgroundColor ?? "#007AFF")
    }
    
    private var buttonTextColor: Color {
        Color(hex: config.buttonTextColor ?? "#FFFFFF")
    }
    
    private var backgroundColor: Color {
        Color(rgba: config.backgroundColor ?? "rgba(0, 0, 0, 0.3)")
    }
    
    private var horizontalAlignment: HorizontalAlignment {
        switch config.textAlignment ?? "center" {
        case "left": return .leading
        case "right": return .trailing
        default: return .center
        }
    }
    
    private var verticalAlignment: Alignment {
        switch config.contentVerticalAlignment ?? "center" {
        case "top": return .top
        case "bottom": return .bottom
        default: return .center
        }
    }
    
    var body: some View {
        ZStack(alignment: verticalAlignment) {
            // Background image with overlay
            AsyncImage(url: URL(string: config.backgroundImageUrl)) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Color.gray
            }
            .overlay(
                Color.black.opacity(config.overlayOpacity ?? 0.5)
            )
            
            // Content with background color
            VStack(alignment: horizontalAlignment, spacing: 8) {
                Text(config.title ?? product?.name ?? "")
                    .font(.system(size: config.titleFontSize ?? 24, weight: .bold))
                    .foregroundColor(titleColor)
                    .multilineTextAlignment(textAlignmentMode)
                
                if let subtitle = config.subtitle {
                    Text(subtitle)
                        .font(.system(size: config.subtitleFontSize ?? 16))
                        .foregroundColor(subtitleColor)
                        .multilineTextAlignment(textAlignmentMode)
                }
                
                Button(action: handleTap) {
                    Text(config.ctaText ?? "Ver producto")
                        .font(.system(size: config.buttonFontSize ?? 14, weight: .medium))
                        .foregroundColor(buttonTextColor)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(buttonBgColor)
                        .cornerRadius(8)
                }
            }
            .padding()
            .background(backgroundColor)
        }
        .frame(height: config.bannerHeight ?? 200)
        .clipped()
        .task {
            await loadProduct()
        }
    }
    
    private var textAlignmentMode: TextAlignment {
        switch config.textAlignment ?? "center" {
        case "left": return .leading
        case "right": return .trailing
        default: return .center
        }
    }
    
    private func handleTap() {
        if let deeplink = config.deeplink {
            openDeeplink(deeplink)
        } else if let link = config.ctaLink ?? product?.url {
            openURL(link)
        }
    }
    
    private func loadProduct() async {
        isLoading = true
        do {
            let fetchedProduct = try await ReachuAPI.shared.getProduct(id: config.productId)
            await MainActor.run {
                self.product = fetchedProduct
                self.isLoading = false
            }
        } catch {
            print("Error loading product: \(error)")
            await MainActor.run {
                isLoading = false
            }
        }
    }
    
    private func openDeeplink(_ deeplink: String) {
        guard let url = URL(string: deeplink) else { return }
        UIApplication.shared.open(url)
    }
    
    private func openURL(_ urlString: String) {
        guard let url = URL(string: urlString) else { return }
        UIApplication.shared.open(url)
    }
}

// Helper extensions for color conversion
extension Color {
    // Hex color conversion
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
    
    // RGBA color conversion - parses "rgba(r, g, b, a)" format
    init(rgba: String) {
        let pattern = #"rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: rgba, range: NSRange(rgba.startIndex..., in: rgba)) else {
            self.init(.sRGB, red: 0, green: 0, blue: 0, opacity: 0.3)
            return
        }
        
        let r = (rgba as NSString).substring(with: match.range(at: 1))
        let g = (rgba as NSString).substring(with: match.range(at: 2))
        let b = (rgba as NSString).substring(with: match.range(at: 3))
        let a = match.range(at: 4).location != NSNotFound 
            ? (rgba as NSString).substring(with: match.range(at: 4)) 
            : "1.0"
        
        self.init(
            .sRGB,
            red: Double(r) ?? 0 / 255,
            green: Double(g) ?? 0 / 255,
            blue: Double(b) ?? 0 / 255,
            opacity: Double(a) ?? 1.0
        )
    }
}
```

#### 3. Product Store (`product_store`)

A grid or list display of products, either all from the channel or a filtered selection.

**JSON Structure (All Products Mode):**
```json
{
  "type": "product_store",
  "name": "Tienda Completa",
  "config": {
    "mode": "all",
    "displayType": "grid",
    "columns": 2
  }
}
```

**JSON Structure (Filtered Mode):**
```json
{
  "type": "product_store",
  "name": "Ofertas Seleccionadas",
  "config": {
    "mode": "filtered",
    "productIds": ["408841", "408842", "408843", "408844", "408845"],
    "displayType": "list",
    "columns": 2
  }
}
```

**Config Fields:**
- `mode` (string, required): `"all"` (all channel products) or `"filtered"` (specific IDs)
- `productIds` (string[], required if mode="filtered"): Array of product IDs to display
- `displayType` (string, optional): `"grid"` or `"list"` (default: "grid")
- `columns` (number, optional): Grid columns (only for grid mode, default: 2)

**Swift Implementation:**
```swift
struct ProductStoreView: View {
    let config: [String: Any]
    let campaignChannelId: String  // From campaign configuration
    
    @State private var products: [ReachuProduct] = []
    @State private var isLoading = false
    @State private var searchText = ""
    
    var filteredProducts: [ReachuProduct] {
        if searchText.isEmpty {
            return products
        }
        return products.filter { product in
            product.name.localizedCaseInsensitiveContains(searchText)
        }
    }
    
    var body: some View {
        let mode = config["mode"] as? String ?? "all"
        let displayType = config["displayType"] as? String ?? "grid"
        let columns = config["columns"] as? Int ?? 2
        let productIds = config["productIds"] as? [String]
        
        VStack {
            // Search bar (SDK handles this)
            SearchBar(text: $searchText)
                .padding()
            
            if isLoading {
                ProgressView()
            } else {
                if displayType == "grid" {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: columns)) {
                        ForEach(filteredProducts) { product in
                            ProductCard(product: product)
                        }
                    }
                } else {
                    List(filteredProducts) { product in
                        ProductRow(product: product)
                    }
                }
            }
        }
        .onAppear {
            if mode == "all" {
                loadAllProducts()
            } else if let ids = productIds {
                loadFilteredProducts(ids: ids)
            }
        }
    }
    
    private func loadAllProducts() {
        isLoading = true
        Task {
            do {
                // Fetch all products from campaign's Reachu channel
                let fetchedProducts = try await ReachuAPI.shared.getChannelProducts(
                    channelId: campaignChannelId
                )
                DispatchQueue.main.async {
                    self.products = fetchedProducts
                    self.isLoading = false
                }
            } catch {
                print("Error loading products: \(error)")
                isLoading = false
            }
        }
    }
    
    private func loadFilteredProducts(ids: [String]) {
        isLoading = true
        Task {
            do {
                let fetchedProducts = try await ReachuAPI.shared.getProducts(ids: ids)
                DispatchQueue.main.async {
                    self.products = fetchedProducts
                    self.isLoading = false
                }
            } catch {
                print("Error loading products: \(error)")
                isLoading = false
            }
        }
    }
}
```

### Component Rendering

Each component should render itself based on its `type`:

```swift
func renderComponent(_ component: Component) -> some View {
    switch component.type {
    case "product_carousel":
        ProductCarouselView(config: component.config)
    case "product_banner":
        ProductBannerView(config: component.config)
    case "product_store":
        ProductStoreView(
            config: component.config,
            campaignChannelId: campaign.reachuChannelId ?? ""
        )
    case "banner":
        BannerView(config: component.config)
    // ... other component types
    default:
        EmptyView()
    }
}
```

### Placement Guidelines

**Overlay Components (ZStack):**
- `banner`
- `offer_banner`
- `product_banner`

**Inline Components (within ScrollView/VStack):**
- `product_carousel`
- `product_store`
- `product_spotlight`
- `carousel_auto`
- `carousel_manual`

