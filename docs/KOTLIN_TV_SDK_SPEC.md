# VioTVSDK for Android TV — Kotlin Spec

Target SDK for Android TV that mirrors `InteractiveAds-vio` (Apple TV, Swift). Paired
with the backend on `develop` (post Phase 3) and the mobile companion spec in
[`KOTLIN_MOBILE_SDK_SPEC.md`](./KOTLIN_MOBILE_SDK_SPEC.md).

**Primary reference when in doubt**: the Swift implementation at
`/Users/angelo/Documents/GitHub/InteractiveAds-vio` (branch `main`). The
behavioural contract and class-by-class layout should match 1:1; Android-native
APIs (coroutines, `OkHttp`, `StandardWebSocketClient`, Compose) replace their
Swift counterparts.

## 1 — Platform targets

- **Min SDK**: Android TV 10 (API 29). Earlier versions not supported — OkHttp TLS and
  coroutine structured concurrency require this baseline.
- **Language**: Kotlin 2.0+ with coroutines.
- **Distribution**: Maven Central + AAR. Module name `vio-tv-sdk`.
- **UI framework**: Jetpack Compose for TV. Consumers can opt out and host the overlay
  inside a classic `Fragment` via the facade's `VioTVShoppableOverlayView`.

## 2 — Module layout (mirrors Apple TV SDK)

```
live.vio.tvsdk/
├── core/                                        ← mirrors VioTVCore
│   ├── VioTVConfiguration.kt
│   ├── VioTVConfigurationLoader.kt
│   ├── VioTVManager.kt
│   ├── managers/
│   │   ├── VioTVWebSocketManager.kt
│   │   └── VioTVSessionManager.kt
│   └── models/
│       ├── VioTVModels.kt                       (ShoppableAdEvent, ShoppableProduct,
│       │                                         ShoppableSponsor, ProductImage,
│       │                                         ProductPrice, BackendProductEvent)
│       └── VioTVSponsor.kt                      (VioTVSponsor, VioTVSubscribeResponse,
│                                                 VioTVSubscribeFailureReason)
├── commerce/                                    ← mirrors VioTVCommerce
│   └── VioTVCommerceService.kt
├── ui/                                          ← mirrors VioTVUI (Compose)
│   ├── VioTVShoppableOverlay.kt                 @Composable
│   └── VioTVShoppableOverlayView.kt             (AndroidView wrapper for Fragment hosts)
└── VioTV.kt                                     ← public facade (object)
```

The Demo app (Android TV equivalent of `Demo/tv2demo-appletv`) should live in a
separate Gradle module `demo/tv2demo-androidtv` so consumers can drop the
published AAR without pulling demo code.

## 3 — Public facade `VioTV` (Kotlin `object`)

Exact parity with `InteractiveAds-vio/Sources/VioTV/VioTV.swift`. All callbacks
dispatched on `Main` dispatcher.

```kotlin
object VioTV {
    /** Host-app callback when the user taps "Add to cart" and the TV cart-intent
     *  POST returns 2xx. Argument is the productId. */
    var onCartIntent: ((String) -> Unit)? = null

    /** Fires when POST /api/sdk/tv/broadcast/subscribe returns
     *  { subscribed: false, reason }. Default null — SDK stays silent so partner
     *  apps never see errors from broadcasts Vio doesn't know about. */
    var onSubscriptionFailed: ((VioTVSubscribeFailureReason) -> Unit)? = null

    fun configure(
        apiKey: String,
        userId: String = "",
        environment: VioTVEnvironment = VioTVEnvironment.Development,
        defaultCampaignId: Int? = null,
    )

    @Throws(IOException::class)
    fun configureFromBundle(
        fileName: String? = null,     // default searches vio-config.json in assets
        userIdOverride: String? = null,
    )

    fun connect(
        broadcastId: String,
        platform: String = "android-tv",
        tvDeviceId: String? = null,
    )

    /** Convenience — reads broadcastId from bundled config (falls back to
     *  defaultCampaignId stringified, legacy behaviour). */
    fun connect()

    fun disconnect()
}
```

### 3.1 Resolution order for `VioTV.connect()` (no-arg)

1. Explicit `connect(broadcastId:)` arg wins.
2. `VioTVConfiguration.shared.defaultBroadcastId` (JSON key `broadcastId` in
   `vio-config.json`).
3. `defaultCampaignId` stringified — logs a warning; legacy.
4. No-op + console note.

This is identical to Swift. Do not invent new behaviour.

## 4 — Config file (`vio-config.json`)

Same schema as the Apple TV SDK:

```json
{
  "apiKey": "tv2_api_key_...",
  "environment": "development",
  "backendUrl": "https://api-dev.vio.live",
  "webSocketUrl": "wss://api-dev.vio.live",
  "commerceUrl": "https://graph-ql-dev.vio.live/graphql",
  "broadcastId": "barcelona-psg-2026-03-03",
  "country": "NO"
}
```

Keys that the SDK cares about: `apiKey`, `environment`, `broadcastId` (optional,
used by bare `connect()`), `backendUrl` / `webSocketUrl` / `commerceUrl`
(optional overrides).

## 5 — Subscribe + WS lifecycle (`VioTVManager`)

`connect(broadcastId:platform:tvDeviceId:)`:

1. `POST /api/sdk/tv/broadcast/subscribe` (X-API-Key header) with body
   `{ broadcastId, externalUserId, platform, tvDeviceId? }`. Timeout 10 s.
2. Response is `VioTVSubscribeResponse`:
   - On `subscribed = true`, store `sessionId`, `endUserId`, `primarySponsor`,
     `secondarySponsors` on the singleton. Open WS to `response.wsUrl`. Send
     `{ "type": "identify", "userId": externalUserId }` as the first frame.
     Start a 60 s `VioTVSessionManager.heartbeat(sessionId)` coroutine.
   - On `subscribed = false`, invoke `onSubscriptionFailed?(reason)` and stop.
3. All network work runs on `Dispatchers.IO`; callbacks on `Dispatchers.Main`.

### 5.1 WS message handling

Ignore everything that is not `type="shoppable_ad"` or `type="product"`. Respond
to `{ "type": "ping" }` with `{ "type": "pong" }` (same as Swift — the backend
closes the socket after 3 unanswered app-level pings). Do **not** rely on the
OkHttp protocol-level PING frame — the backend uses JSON-level pings.

Decode `ShoppableAdEvent` exactly as in Swift:

```kotlin
data class ShoppableAdEvent(
    val type: String,
    val broadcastId: String? = null,
    val product: ShoppableProduct,
    val sponsor: ShoppableSponsor? = null,
    val timestamp: Double? = null,
    val discountBadge: String? = null,
    val campaignId: Int? = null,
    val activationId: Int? = null,          // backend stamps shoppable_ad_activations.id
    val sponsorId: Int? = null,             // drives commerce key routing
)

data class ShoppableSponsor(
    val id: Int? = null,
    val name: String,
    val avatarUrl: String? = null,          // ← rendered in the overlay. Backend
                                            //   rejects sponsors with no avatar.
    val logoUrl: String? = null,            // ← for sponsor intros / full-screen
                                            //   branding. Do not use as a fallback
                                            //   for avatarUrl.
    val primaryColor: String? = null,
)
```

`BackendProductEvent` (legacy `type="product"` payload) must also be decoded
and mapped to `ShoppableAdEvent` — keep this for back-compat with older
backends / non-TV dispatchers.

## 6 — `VioTVConfiguration` singleton

Hosts the runtime state populated by the subscribe response. Mirror exactly:

```kotlin
object VioTVConfiguration {
    var apiKey: String = ""
        private set
    var commerceApiKey: String = ""     // dev-only fallback; production keys come
                                        // per-sponsor from the subscribe response
        private set
    var userId: String = ""
        private set
    var defaultCampaignId: Int? = null
        private set
    var defaultBroadcastId: String? = null
        private set
    var environment: VioTVEnvironment = VioTVEnvironment.Development
        private set

    // Populated by POST /api/sdk/tv/broadcast/subscribe
    var primarySponsor: VioTVSponsor? = null
        private set
    var secondarySponsors: List<VioTVSponsor> = emptyList()
        private set
    var currentSessionId: Int? = null
        internal set
    var currentEndUserId: Int? = null
        internal set

    fun sponsor(withId: Int): VioTVSponsor? =
        if (primarySponsor?.id == withId) primarySponsor
        else secondarySponsors.firstOrNull { it.id == withId }

    fun commerce(forSponsorId: Int?): VioTVSponsor.CommerceBlock? {
        if (forSponsorId != null) sponsor(withId = forSponsorId)?.commerce?.let { return it }
        if (commerceApiKey.isNotEmpty()) return VioTVSponsor.CommerceBlock(apiKey = commerceApiKey)
        return primarySponsor?.commerce
    }
}
```

## 7 — Cart-intent send (`VioTVManager.sendCartIntent`)

When the user presses OK on the remote (or the Compose overlay's Add-to-cart
button fires), the manager posts to `/api/sdk/tv/cart-intent`:

```kotlin
suspend fun sendCartIntent(
    productId: String,
    campaignId: Int,
    activationId: Int? = null,            // defaults to activeAd?.activationId
    sponsorId: Int? = null,               // defaults to activeAd?.sponsorId
): Boolean {
    val body = buildJsonObject {
        put("externalUserId", config.userId)
        put("productId", productId)
        put("activationId", (activationId ?: activeAd?.activationId)?.toLong())
        // activationId is enough — backend derives campaignId + sponsorId from the row.
        // If activationId is null (ad-hoc, no upstream shoppable_ad), include them explicitly:
        if (activationId == null && activeAd?.activationId == null) {
            put("campaignId", campaignId)
            sponsorId?.let { put("sponsorId", it) }
        }
        put("platform", activePlatform)
    }
    // POST with header "X-API-Key: ${config.apiKey}". Invoke onCartIntent(productId)
    // only on 2xx response. Return true on success.
}
```

Use the **v2 minimal body** whenever `activationId` is resolvable from `activeAd`
— the backend then looks up `shoppable_ad_activations[id]` to fill in
`campaignId` and `sponsorId`. This matches
`/Users/angelo/vio-backend/socket-server/server/routes.ts` (`/api/sdk/tv/cart-intent`
handler post Phase 4 cleanup).

## 8 — Per-sponsor Commerce routing (for product enrichment)

When `ShoppableAdEvent.product` is incomplete (no title, no image, price ≤ 0),
the SDK enriches via Commerce GraphQL. Use the sponsor-scoped commerce key:

```kotlin
val sponsorCommerceKey = VioTVConfiguration.commerce(forSponsorId = event.sponsorId)?.apiKey
```

If null (visual-only sponsor), skip enrichment — the backend guarantees the
initial `product` payload is usable in that case. Never fall back silently to
the primary sponsor's key for a different sponsor's product.

## 9 — Overlay UI (Compose for TV)

- `VioTVShoppableOverlay()` renders `VioTVManager.activeAd`. Show the product
  card when `activeAd != null`, hide when null.
- The overlay reads `activeAd.sponsor.avatarUrl` first, falls back to `logoUrl`
  only for legacy events (pre-Phase 3 backends). Both are URL strings — use
  Coil for image loading.
- Primary CTA ("Add to cart") wires to `VioTVManager.sendCartIntent(...)`.
  Button text comes from `activeAd.product.title` + formatted price using the
  same grouping rule as iOS (`"kr 17.990,-"` with `,-` suffix when whole NOK).
- Dismiss behaviour: any non-OK remote action (Back, Menu) dismisses the
  overlay without firing cart-intent.

## 10 — Session lifecycle

60-second heartbeat via a `CoroutineScope` managed by `VioTVSessionManager`.
`onDisconnect()` cancels the heartbeat and fires
`POST /api/sdk/tv/session/end { sessionId }`. If the app process dies without
calling `disconnect()`, the backend's zombie detection reaps the row after 3
missed pings — document this so partners don't panic about "orphan sessions"
in the admin dashboard.

## 11 — Error modes and callbacks

| Situation | SDK behaviour | Host-app callback |
|---|---|---|
| `subscribed: false, reason: broadcast_not_registered_for_client_app` | Stay idle; no WS opened | `onSubscriptionFailed?(reason)` |
| `subscribed: false, reason: tv_not_enabled_for_this_platform` | Same as above | `onSubscriptionFailed?(reason)` |
| WS drops with non-1000 code | Auto-reconnect with exponential backoff (start 2 s, cap 30 s) | none |
| cart-intent POST returns 4xx/5xx | Log + **do not** fire `onCartIntent` | none |
| Unknown WS message type | Log at `DEBUG`, keep listening | none |

## 12 — Logging conventions

Prefix with `[VioTV]`. Never log raw `commerce.apiKey` — sponsors consider it
sensitive. Apple TV SDK's log format is a good blueprint:

```
[VioTV] Configured - env: development, broadcast: barcelona-psg-2026-03-03
[VioTV] POST subscribe → HTTP 200, primarySponsor=Elkjøp, secondary count=1
[VioTV] WS connected to wss://.../ws/36
[VioTV] identify sent { userId: demo_user_001 }
[VioTV] shoppable_ad received: "Samsung 75" QN85F Neo QLED..." (activationId=24 sponsor=3)
[VioTV] POST cart-intent → HTTP 200 (cartIntentId=5)
```

## 13 — Demo app (`demo/tv2demo-androidtv`)

Replicate the structure of `InteractiveAds-vio/Demo/tv2demo-appletv`:

- `ContentView` hosts a `NavigationStack` (on Android: `NavHost`).
- `BroadcastPickerView` — two Compose cards:
  - Green "Broadcast registrado" → `VioTV.connect("barcelona-psg-2026-03-03")`.
  - Orange "Broadcast desconocido" → `VioTV.connect("broadcast-no-existe-demo")`
    — exercises the `onSubscriptionFailed` callback.
- `TVPlayerView(broadcastId)` — video background + overlay. A top-left
  "Volver" button uses `navController.popBackStack()` and triggers
  `VioTV.disconnect()` so the session closes cleanly.
- `vio-config.json` — minimal, credentials only (no broadcastId hardcoded).
  This mirrors the real TV2 integration pattern.

## 14 — Deliverables checklist

- [ ] Module layout matches §2.
- [ ] `VioTV` facade signatures match §3.
- [ ] `vio-config.json` schema matches §4 and ships with the demo.
- [ ] Subscribe + WS identify + 60 s heartbeat + JSON ping/pong fully wired.
- [ ] `VioTVConfiguration.commerce(forSponsorId:)` helper present.
- [ ] `sendCartIntent` sends the v2 minimal body when `activationId` is available.
- [ ] Overlay renders `sponsor.avatarUrl` (falls back to `logoUrl`).
- [ ] Demo picker exercises both success and soft-miss flows.
- [ ] Unit tests for:
  - `ShoppableAdEvent` JSON decode (happy path + missing optional fields).
  - `BackendProductEvent.toShoppableAdEvent()` mapping.
  - `VioTVConfiguration.commerce(forSponsorId:)` priority order.
  - Subscribe response decode — both `subscribed:true` and `subscribed:false`.
- [ ] Instrumented test against an Android TV emulator for the full connect →
  overlay → cart-intent loop.

## 15 — Open questions for the Kotlin dev to raise

1. Compose for TV is still in flux — fine to use a stable `ComponentActivity`
   + `AndroidView` if the Compose TV dependency is blocking.
2. OkHttp vs Ktor — pick one, don't mix. OkHttp is lighter + already on most
   Android TV partners' BOMs.
3. JSON: use `kotlinx.serialization`. Do **not** depend on Moshi or Gson for
   public models to keep the AAR small.
4. Any sponsor telemetry (impression tracking) is **out of scope** for this
   first cut — mirror what iOS does, which is nothing on the TV side.

## 16 — Where to pull the source of truth

| Concept | Swift file (Apple TV SDK) | Backend reference |
|---|---|---|
| Subscribe body + response | `Sources/VioTVCore/VioTVManager.swift` `subscribe(...)` | `server/routes.ts` `/api/sdk/tv/broadcast/subscribe` |
| WS identify + ping/pong | `Sources/VioTVCore/Managers/VioTVWebSocketManager.swift` | n/a (behavioural contract only) |
| Session heartbeat / end | `Sources/VioTVCore/Managers/VioTVSessionManager.swift` | `/api/sdk/tv/session/{heartbeat,end}` |
| Cart-intent body | `Sources/VioTVCore/VioTVManager.swift` `sendCartIntent(...)` | `/api/sdk/tv/cart-intent` |
| Overlay UI + avatar rendering | `Sources/VioTVUI/VioTVShoppableOverlay.swift` | n/a |
| `VioTVConfiguration` helpers | `Sources/VioTVCore/VioTVConfiguration.swift` | n/a |

Also read `InteractiveAds-vio/docs/SDK_ARCHITECTURE.md` end-to-end before
starting — it's the single most useful Swift-side doc for a Kotlin port.
