# VioSDK for Android Mobile — Kotlin Spec

Mobile companion SDK for Android. Mirrors `VioSwiftSDK` (iOS), focusing on the
**cart-intent receive path** — the other direction of the TV→Mobile flow
specified in [KOTLIN_TV_SDK_SPEC.md](./KOTLIN_TV_SDK_SPEC.md).

If the partner already ships an Android companion app consuming Vio features
(polls, contests, lineup, store view, cart-intent notifications), this spec
brings it up to the v2 multi-sponsor contract currently implemented on the iOS
side.

**Primary reference**: `/Users/angelo/VioSwiftSDK` (branch `develop` as of 2026-04-23).
Module-by-module the Kotlin package layout matches the Swift module layout.

## 1 — Scope

### In scope (this spec)

1. **v2 SDK config** (`GET /v2/sdk/config`) — multi-sponsor bootstrap consumer.
2. **Cart-intent WS + APNs/FCM receive** — decode activationId + sponsorId,
   dedup by activationId, route product hydration to the correct sponsor's
   Commerce GraphQL key.
3. **Partner webhook / FCM handling** — parse the canonical envelope.
4. **ProductService parity** — `loadProduct(productId, sponsorId?)`.
5. **Demo TV2 Android** — companion to `VioSwiftSDK/Demo/tv2demo`.

### Out of scope (punted)

- Engagement (polls, contests). The iOS SDK has a full `VioEngagementSystem` —
  if the Android partner needs polls, that's a separate spec.
- Apple Pay / Google Pay inside the overlay — Swift ships Apple Pay today; the
  Android demo can stub "Add to cart" until Google Pay wiring is prioritised.
- Casting (`VioCastingUI`). Apple TV → iPhone casting is Swift-only for now.

## 2 — Module layout (mirrors `VioSwiftSDK`)

```
live.vio.mobilesdk/
├── core/                                    ← mirrors VioCore
│   ├── VioConfiguration.kt                  (apiKey, env, primarySponsor, secondarySponsors)
│   ├── managers/
│   │   ├── CampaignManager.kt               (facade, activeCartIntentEvent, dedup)
│   │   ├── CampaignWebSocketManager.kt      (WS connect + identify + cart_intent dispatch)
│   │   └── SessionManager.kt                (heartbeat; optional)
│   ├── models/
│   │   ├── CampaignModels.kt                (SdkBootstrapResponse, CartIntentEvent)
│   │   └── VioSponsor.kt                    (VioSponsor, CommerceBlock)
│   └── sdk/
│       └── commerce/
│           └── CommerceSdkClientProvider.kt (per-sponsor cache; client(forSponsorId))
├── ui/                                      ← mirrors VioUI
│   └── services/
│       └── ProductService.kt                (loadProduct(..., sponsorId: Int?))
└── VioSDK.kt                                ← public facade (object)
```

Distribute as a single AAR `vio-mobile-sdk`. Consumers pull the facade and
wire `CampaignManager.shared` into their push-notification handler.

## 3 — v2 SDK config bootstrap

```kotlin
suspend fun CampaignManager.fetchAndApplySdkBootstrap(apiKey: String) {
    // GET https://<backend>/v2/sdk/config?apiKey={apiKey}
    val response: SdkBootstrapResponse = httpClient.get(url).body()
    VioConfiguration.applySdkBootstrapSponsors(
        primary = response.primarySponsor?.toVioSponsor(),
        secondaries = response.secondarySponsors?.mapNotNull { it.toVioSponsor() } ?: emptyList(),
    )
    VioConfiguration.applySdkBootstrapCommerce(
        apiKey = response.primarySponsor?.commerce?.apiKey,
        graphQLURL = response.endpoints?.commerceGraphQL,
    )
}

data class SdkBootstrapResponse(
    val endpoints: Endpoints?,
    val campaign: Campaign?,
    val primarySponsor: SponsorBlock?,
    val secondarySponsors: List<SponsorBlock>?,
    val features: Features?,
) {
    data class Endpoints(val webSocketBase: String?, val commerceGraphQL: String?)
    data class Campaign(val id: Int, val name: String, val logo: String?, val isActive: Boolean, val isPaused: Boolean)
    data class SponsorBlock(
        val id: Int, val name: String,
        val avatarUrl: String?, val logoUrl: String?,
        val primaryColor: String?, val secondaryColor: String?,
        val commerce: CommerceBlock?,
    )
    data class Features(val shoppable: Boolean?, val lineup: Boolean?)
}
```

See Swift `CampaignManager.fetchAndApplySdkBootstrapNow` at
`Sources/VioCore/Managers/CampaignManager.swift:680`.

## 4 — `VioConfiguration` helpers

Match the Swift surface exactly:

```kotlin
object VioConfiguration {
    var apiKey: String = ""
    var userId: String = ""                 // partner-scoped externalUserId

    var primarySponsor: VioSponsor? = null
    var secondarySponsors: List<VioSponsor> = emptyList()
    var sdkBootstrapCommerceApiKey: String? = null

    fun sponsor(withId: Int): VioSponsor? =
        if (primarySponsor?.id == withId) primarySponsor
        else secondarySponsors.firstOrNull { it.id == withId }

    fun commerce(forSponsorId: Int): VioSponsor.CommerceBlock? =
        sponsor(withId = forSponsorId)?.commerce
}

data class VioSponsor(
    val id: Int,
    val name: String,
    val avatarUrl: String? = null,
    val logoUrl: String? = null,
    val primaryColor: String? = null,
    val secondaryColor: String? = null,
    val commerce: CommerceBlock? = null,
) {
    data class CommerceBlock(
        val apiKey: String,
        val channelId: String? = null,
        val paymentMethods: List<String> = emptyList(),
    )
}
```

## 5 — `CartIntentEvent` — the critical model

Parses the canonical envelope (`vio_payload`) from WebSocket **and** the
flat/APNs/FCM form. Swift reference at `Sources/VioCore/Models/CampaignModels.swift:1044`.

```kotlin
data class CartIntentEvent(
    val type: String,
    val productName: String?,
    val productId: String?,
    val campaignId: Int?,
    val notificationTitle: String?,
    val notificationBody: String?,
    val vioUserId: String?,
    val source: String?,
    val deeplink: String?,

    /** shoppable_ad_activations.id stamped on the originating TV dispatch.
     *  Closes the attribution chain and is the dedup key on the consumer side. */
    val activationId: Int? = null,

    /** Sponsor that owned the originating shoppable_ad. Drives per-sponsor
     *  Commerce routing when the app opens the product overlay. */
    val sponsorId: Int? = null,
) {
    companion object {
        /** Decode the WebSocket JSON body — canonical `vio_payload` envelope
         *  or legacy flat keys. Returns null if no productId resolvable. */
        fun parse(json: JsonObject): CartIntentEvent? { … }

        /** Decode from FCM or local notification userInfo. Accepts
         *  `vio_payload` as a nested object or a stringified JSON. */
        fun from(userInfo: Map<String, Any>): CartIntentEvent? { … }

        /** Resolve productId from a `vio://product/<id>?...` deeplink. */
        fun productIdFromVioDeeplink(url: String?): String? { … }
    }
}
```

Snake-case keys to support:

| Top-level | `vio_notification_version`, `vio_event_type`, `vio_user_id`, `vio_payload` |
| `vio_payload` | `product_id`, `campaign_id`, `product_name`, `notification_title`, `notification_body`, `source`, `deeplink`, **`activation_id`**, **`sponsor_id`** |
| Legacy flat | `type`, `productId`, `campaignId`, `productName`, `userId`, **`vio_cartIntent_productId`**, **`vio_cartIntent_campaignId`**, **`vio_cartIntent_activationId`**, **`vio_cartIntent_sponsorId`**, **`vio_cartIntent_notificationTitle`**, **`vio_cartIntent_notificationBody`** |

## 6 — Dedup by `activationId` (must-have)

Without dedup the overlay opens twice when the backend's dual-delivery sends
the envelope via both WS and FCM (common, `CART_INTENT_DUAL_DELIVERY=true`).

Swift reference: `CampaignManager.publishCartIntentIfChanged(_:)` at
`Sources/VioCore/Managers/CampaignManager.swift:467`.

```kotlin
class CampaignManager {
    private val _activeCartIntentEvent = MutableStateFlow<CartIntentEvent?>(null)
    val activeCartIntentEvent: StateFlow<CartIntentEvent?> = _activeCartIntentEvent

    fun publishCartIntentIfChanged(event: CartIntentEvent, channel: String) {
        val current = _activeCartIntentEvent.value

        // Primary dedup: activationId match → skip. Covers dual-delivery.
        if (event.activationId != null && current?.activationId == event.activationId) {
            Log.d(TAG, "cart_intent [$channel] dedup: activationId=${event.activationId} already published")
            return
        }

        // Fallback for legacy events with no activationId.
        if (event.activationId == null
            && current != null
            && current.activationId == null
            && current.productId == event.productId
            && current.campaignId == event.campaignId) {
            Log.d(TAG, "cart_intent [$channel] dedup: same (productId, campaignId) without activationId")
            return
        }

        _activeCartIntentEvent.value = event
        Log.d(TAG, "cart_intent applied [$channel] productId=${event.productId} activationId=${event.activationId} sponsorId=${event.sponsorId}")
    }
}
```

## 7 — `CommerceSdkClientProvider` — per-sponsor client cache

Swift reference: `Sources/VioCore/Sdk/Core/GraphQL/CommerceSdkClientProvider.swift`.

```kotlin
@Singleton
class CommerceSdkClientProvider {
    // Single "primary" client (legacy + non-attributed flows)
    private var primaryClient: SdkClient? = null
    private var primaryUrl: String? = null
    private var primaryKey: String? = null

    // Per-sponsor cache — populated by client(forSponsorId:)
    private val sponsorClients = mutableMapOf<Int, SdkClientEntry>()
    private data class SdkClientEntry(val client: SdkClient, val url: String, val apiKey: String)

    fun client(configuration: VioConfiguration = VioConfiguration): SdkClient { … }

    /** Returns a GraphQL client bound to the named sponsor's commerceApiKey.
     *  Falls back to the primary client when sponsorId is null, unknown,
     *  or the sponsor is visual-only (no commerce block). */
    fun client(forSponsorId: Int?, configuration: VioConfiguration = VioConfiguration): SdkClient {
        if (forSponsorId == null) return client(configuration)
        val sponsorKey = configuration.commerce(forSponsorId = forSponsorId)?.apiKey
            ?.trim()?.takeIf { it.isNotEmpty() }
            ?: return client(configuration)

        val url = configuration.resolvedCommerceGraphQLUrl
        sponsorClients[forSponsorId]?.takeIf { it.url == url && it.apiKey == sponsorKey }
            ?.let { return it.client }

        val client = sponsorClients[forSponsorId]?.client
            ?.also { it.updateCredentials(baseUrl = url, apiKey = sponsorKey) }
            ?: SdkClient(baseUrl = url, apiKey = sponsorKey)

        sponsorClients[forSponsorId] = SdkClientEntry(client, url, sponsorKey)
        return client
    }

    fun clear() { … }
}
```

Key invariant: **never fall back silently to the primary key when a sponsorId
is requested but unknown.** Return the primary client only when sponsorId is
null or the sponsor is visual-only. The Swift implementation logs
`[ProductService] GraphQL Authorization: per-sponsor (id=X)` when routing
worked and `bootstrap primary` otherwise — replicate that logging.

## 8 — `ProductService.loadProduct(productId, sponsorId?)`

```kotlin
class ProductService {
    suspend fun loadProduct(
        productId: Int,
        currency: String,
        country: String,
        sponsorId: Int? = null,
    ): Product {
        val client = CommerceSdkClientProvider.client(forSponsorId = sponsorId)
        val source: String = when {
            sponsorId != null && VioConfiguration.commerce(forSponsorId) != null -> "per-sponsor (id=$sponsorId)"
            VioConfiguration.sdkBootstrapCommerceApiKey != null -> "bootstrap primary"
            else -> "fallback"
        }
        Log.i(TAG, "loadProduct → id=$productId url=${VioConfiguration.resolvedCommerceGraphQLUrl} auth=$source cc=$country cur=$currency")

        // GraphQL call via client.channel.product.get(...) — retry once on auth failure
        // after CampaignManager.ensureCommerceBootstrapApplied()
    }

    suspend fun loadProducts(
        productIds: List<Int>?,
        currency: String,
        country: String,
        sponsorId: Int? = null,
    ): List<Product> { … }
}
```

## 9 — WebSocket listener

`CampaignWebSocketManager.connect()`:

1. Open WS to `${wsBaseURL}/ws/{campaignId}?userId=${userId}`.
2. After handshake, send `{ "type": "identify", "userId": <userId> }` as the
   first frame. Backend keys its `wsUserMap` on this.
3. Route frames by `type`:
   - `cart_intent` → `CartIntentEvent.parse(json)?.let { onCartIntent?.invoke(it) }`
   - `shoppable_ad` / `product` → (not consumed by mobile SDK directly; log
     at DEBUG for dev)
   - `ping` → respond `{ "type": "pong" }`
4. On disconnect, reconnect with exponential backoff (2 s → 30 s cap), just
   like the Apple TV SDK.

## 10 — FCM / push-notification handling

Android partners use Firebase Cloud Messaging. The SDK exposes a helper that
mirrors Swift's `CampaignManager.handlePushNotificationUserInfo(_:)`:

```kotlin
fun handlePushNotification(userInfo: Map<String, Any>): Boolean {
    if (!isVioCartIntentPayload(userInfo)) return false
    val event = CartIntentEvent.from(userInfo) ?: return false
    publishCartIntentIfChanged(event, channel = "push")
    return true
}

private fun isVioCartIntentPayload(userInfo: Map<String, Any>): Boolean {
    // vio_notification_version present + either vio_payload has product_id
    // or legacy vio_cartIntent_productId is set.
}
```

Call from `FirebaseMessagingService.onMessageReceived(remoteMessage)`:

```kotlin
override fun onMessageReceived(msg: RemoteMessage) {
    val handled = CampaignManager.handlePushNotification(msg.data as Map<String, Any>)
    if (!handled) super.onMessageReceived(msg)   // partner's own handler
}
```

## 11 — Host-app integration (TV2 companion pattern)

```kotlin
// At app init (Application.onCreate):
VioSDK.configureFromAssets(context, fileName = "vio-config.json", userIdOverride = "demo_user_001")

CampaignManager.onCartIntent = { event ->
    // Open product detail with the right sponsor's commerce key
    ProductDetailActivity.start(context, event.productId!!, sponsorId = event.sponsorId)
}

// After login (or at app start in demo):
CampaignManager.userId = session.externalUserId
CampaignManager.fetchAndApplySdkBootstrap()
CampaignManager.connectWebSocket()   // opens /ws/{campaignId} with identify
```

`ProductDetailActivity` should call:

```kotlin
val product = ProductService.loadProduct(
    productId = event.productId.toInt(),
    currency = config.currency,
    country = config.country,
    sponsorId = event.sponsorId,       // ← critical: enables per-sponsor routing
)
```

The iOS demo's `CartIntentProductDetailHost` at
`VioSwiftSDK/Demo/tv2demo/tv2demo/ContentView.swift:76` is the blueprint.

## 12 — Deliverables checklist

- [ ] `VioConfiguration` singleton with `primarySponsor` / `secondarySponsors` /
      `commerce(forSponsorId:)` helpers.
- [ ] `GET /v2/sdk/config` consumer + decode.
- [ ] `CartIntentEvent` parser covering canonical + legacy + FCM userInfo.
- [ ] `CampaignManager.publishCartIntentIfChanged` with dedup by activationId.
- [ ] `CommerceSdkClientProvider.client(forSponsorId:)` per-sponsor cache.
- [ ] `ProductService.loadProduct(..., sponsorId: Int?)`.
- [ ] WebSocket listener with `identify` + `ping/pong` + `cart_intent` handling.
- [ ] FCM handler helper.
- [ ] Demo app opens product detail via the per-sponsor code path.
- [ ] Unit tests:
  - CartIntentEvent parsing canonical + legacy + FCM.
  - Dedup on activationId match + fallback `(productId, campaignId)`.
  - CommerceSdkClientProvider per-sponsor cache + fallback rules.
- [ ] Integration test: emulator receives a cart-intent via mock WS and opens
      the overlay exactly once even when the same event arrives twice.

## 13 — Where to pull source of truth

| Concept | Swift file (VioSwiftSDK) |
|---|---|
| `SdkBootstrapResponse` model | `Sources/VioCore/Models/CampaignModels.swift` |
| `VioSponsor` + bootstrap mapping | `Sources/VioCore/Models/VioSponsor.swift` |
| `VioConfiguration.applySdkBootstrapSponsors` | `Sources/VioCore/Configuration/VioConfiguration.swift` |
| `fetchAndApplySdkBootstrapNow` URL + decode | `Sources/VioCore/Managers/CampaignManager.swift:680` |
| `CartIntentEvent.parse` + notification key constants | `Sources/VioCore/Models/CampaignModels.swift:1034` |
| `publishCartIntentIfChanged` dedup | `Sources/VioCore/Managers/CampaignManager.swift:467` |
| `CommerceSdkClientProvider.client(forSponsorId:)` | `Sources/VioCore/Sdk/Core/GraphQL/CommerceSdkClientProvider.swift` |
| `ProductService.loadProduct(sponsorId:)` | `Sources/VioUI/Services/ProductService.swift` |
| TV2 demo consumer | `Demo/tv2demo/tv2demo/ContentView.swift` (`CartIntentProductDetailHost`) |
| End-to-end flow doc | `VioSwiftSDK/Documentation/CART_INTENT_FLOW.md` |

## 14 — Open questions for the Kotlin dev

1. **DI framework** — Hilt or Koin? Swift uses static singletons; Kotlin can
   and should do better here. Either is fine; pick one and stick with it.
2. **HTTP client** — OkHttp + `kotlinx.serialization` via Ktor-OkHttp engine.
   Same decision as the TV SDK.
3. **Reactive model** — `StateFlow` for `activeCartIntentEvent` (Jetpack
   Compose friendly). Kotlin Channels for cart-intent callbacks also fine.
4. **Does the partner already have a companion Android app?** If yes, this SDK
   ships as a library they add alongside existing notification code. If no,
   the Demo app doubles as the reference integration.
5. **Google Pay in the overlay** — Apple Pay is wired on iOS; Google Pay is
   a larger workstream. For now the demo overlay can stop at "product
   detail", matching the iOS overlay minus Apple Pay button.
