# SDK Integration Requirements - Geographic Targeting & User Segmentation

## Overview

This document outlines the required changes for the Swift SDK to support geographic targeting and user segmentation features. These changes enable A/B testing and regional campaign distribution.

## What Changed on the Backend

The backend now supports filtering campaigns based on:
1. **User's geographic location** (country code)
2. **User percentage** (deterministic A/B testing)

All existing functionality remains unchanged - these are additive features.

## Required SDK Changes

### 1. Add User Information to Configuration

Your SDK's configuration should store:

```swift
struct ReachuConfig {
    let apiKey: String
    let campaignId: Int
    let baseURL: String
    
    // NEW: User identification for targeting
    let userId: String?        // Optional: unique user ID
    let userCountry: String?   // Optional: ISO country code (e.g., "MX", "US")
}
```

### 2. Implement User Detection (if not already present)

Recommended implementation:

```swift
import Foundation
import LocalAuthentication

class UserIdentification {
    /// Get user's device ID (used as userId if not available)
    static func getDeviceId() -> String {
        let defaults = UserDefaults.standard
        let key = "reachu_device_id"
        
        if let existingId = defaults.string(forKey: key) {
            return existingId
        }
        
        let newId = UUID().uuidString
        defaults.set(newId, forKey: key)
        return newId
    }
    
    /// Get user's country from device locale
    static func getUserCountry() -> String? {
        // Priority 1: User's region setting
        if let regionCode = Locale.current.region?.identifier {
            return regionCode // Returns "MX", "US", etc.
        }
        
        // Priority 2: User's language region
        if let languageCode = Locale.preferredLanguages.first,
           let regionCode = Locale(identifier: languageCode).region?.identifier {
            return regionCode
        }
        
        // Priority 3: Default to US if unknown
        return "US"
    }
    
    /// Check if user has enabled location services
    static func requestLocationIfNeeded() -> String? {
        // Optional: Use CLLocationManager for more accurate country detection
        // For now, rely on device locale which is sufficient
        return getUserCountry()
    }
}
```

### 3. Update `/v1/offers` Endpoint Calls

**OLD (Still Works)**
```swift
// This still works - all users see campaigns
GET /v1/offers?apiKey=xxx&campaignId=14
```

**NEW (With Segmentation)**
```swift
// With targeting parameters - filtered by geography and user percentage
GET /v1/offers?apiKey=xxx&campaignId=14&userId=device_or_user_id&userCountry=MX
```

### 4. Implementation Example

```swift
import Foundation

class OffersManager {
    private let config: ReachuConfig
    
    init(config: ReachuConfig) {
        self.config = config
    }
    
    /// Fetch offers with automatic user targeting
    func fetchOffers(completion: @escaping ([Offer]?) -> Void) {
        // Determine user's ID
        let userId = config.userId ?? UserIdentification.getDeviceId()
        
        // Determine user's country
        let userCountry = config.userCountry ?? UserIdentification.getUserCountry() ?? "US"
        
        // Build URL with targeting parameters
        var components = URLComponents(string: "\(config.baseURL)/v1/offers")!
        components.queryItems = [
            URLQueryItem(name: "apiKey", value: config.apiKey),
            URLQueryItem(name: "campaignId", value: "\(config.campaignId)"),
            URLQueryItem(name: "userId", value: userId),
            URLQueryItem(name: "userCountry", value: userCountry),
        ]
        
        guard let url = components.url else {
            completion(nil)
            return
        }
        
        // Make request
        URLSession.shared.dataTask(with: url) { data, response, error in
            guard let data = data, error == nil else {
                completion(nil)
                return
            }
            
            do {
                let offers = try JSONDecoder().decode([Offer].self, from: data)
                completion(offers)
            } catch {
                print("Error decoding offers: \(error)")
                completion(nil)
            }
        }.resume()
    }
}
```

### 5. Update `/v1/sdk/config` Endpoint (Optional)

The SDK can also fetch targeting-aware configuration:

```swift
GET /v1/sdk/config?apiKey=xxx&campaignId=14&userId=device_id&userCountry=MX
```

Response includes components filtered by the user's targeting eligibility.

### 6. Handling Empty Offers

When a user doesn't match the campaign's targeting, the endpoint returns an **empty offers array** (graceful degradation):

```swift
// Response when user is filtered out by segmentation:
[]  // Empty array, not an error

// Your code should handle this naturally:
let offers = try JSONDecoder().decode([Offer].self, from: data)
if offers.isEmpty {
    // No offers for this user (either campaign has no offers, or user is filtered)
    print("No offers available")
}
```

### 7. Testing Locally

To test segmentation without publishing:

1. **Test with different userIds**
   ```swift
   // User passes segmentation
   fetchOffers(userId: "user123", userCountry: "MX")
   
   // Same user always gets same result (deterministic)
   fetchOffers(userId: "user123", userCountry: "MX")  // Same result
   ```

2. **Test geographic filtering**
   ```swift
   // Campaign targets only Mexico
   fetchOffers(userId: "user1", userCountry: "MX")    // ✅ Gets offers
   fetchOffers(userId: "user2", userCountry: "US")    // ❌ Empty offers
   ```

3. **Test percentage filtering**
   ```swift
   // Campaign targets 50% of users
   // Test with 10+ different userIds to verify ~50% get offers
   let testUserIds = (1...10).map { "test_user_\($0)" }
   
   for userId in testUserIds {
       fetchOffers(userId: userId, userCountry: "US")
   }
   // Expect ~5 to return offers
   ```

## Backward Compatibility

✅ **All changes are backward compatible**

- Old requests without userId/userCountry still work
- Campaigns without segmentation enabled show to all users
- Existing code continues to function without modification

## Optional Enhancements

### A. Cache User Country
```swift
class UserIdentification {
    static func cacheUserCountry() {
        let country = getUserCountry() ?? "US"
        UserDefaults.standard.set(country, forKey: "reachu_cached_country")
    }
    
    static func getCachedCountry() -> String {
        return UserDefaults.standard.string(forKey: "reachu_cached_country") ?? "US"
    }
}
```

### B. Detect Country Changes
```swift
func detectLocationChange() {
    let previousCountry = UserIdentification.getCachedCountry()
    let currentCountry = UserIdentification.getUserCountry() ?? "US"
    
    if previousCountry != currentCountry {
        // User moved to different country
        // Refresh offers with new country
        refreshOffers()
    }
}
```

### C. Allow Manual Country Override
```swift
class ReachuConfig {
    var userCountry: String? {
        // 1. Check manual override (user changed country)
        if let override = UserDefaults.standard.string(forKey: "reachu_country_override") {
            return override
        }
        
        // 2. Use detected country
        return UserIdentification.getUserCountry()
    }
    
    static func overrideUserCountry(_ country: String) {
        UserDefaults.standard.set(country, forKey: "reachu_country_override")
    }
}
```

## Validation Checklist

Before deploying the updated SDK, verify:

- [ ] User ID is consistently passed to `/v1/offers` endpoint
- [ ] Country code is detected from device locale
- [ ] Empty offers array is handled gracefully (doesn't show error)
- [ ] Same userID always returns same result (test with same user twice)
- [ ] Different users get different results for same campaign with A/B testing
- [ ] HTTPS URLs are enforced (required for iOS)
- [ ] URL encoding handles special characters properly
- [ ] Error handling doesn't break app if API is unreachable

## Support Matrix

| Feature | Required | Optional |
|---------|----------|----------|
| Pass userId | ✅ Yes | Can use deviceId |
| Pass userCountry | ✅ Yes | Can use device locale |
| Handle empty offers | ✅ Yes | - |
| Caching country | ❌ No | ✅ Recommended |
| Manual country override | ❌ No | ✅ For testing |

## Example Integration Timeline

1. **Phase 1 (Week 1)**: Add UserIdentification utilities
2. **Phase 2 (Week 2)**: Update OffersManager to pass userId/userCountry
3. **Phase 3 (Week 3)**: Test with backend staging environment
4. **Phase 4 (Week 4)**: Deploy to production

## Questions?

Refer to the documentation pages:
- `/docs` - Full integration guide with code examples
- `SEGMENTATION_GUIDE.md` - Admin guide to setting up campaigns
- `replit.md` - Technical architecture overview
