import SwiftUI
import ReachuCore

/// Dynamic Offer Banner component that receives configuration from backend
public struct ROfferBanner: View {
    let config: OfferBannerConfig
    @State private var timeRemaining: DateComponents?
    @State private var timer: Timer?
    
    public init(config: OfferBannerConfig) {
        self.config = config
    }
    
    public var body: some View {
        ZStack {
            // Background image
            if let backgroundUrl = config.backgroundImageUrl {
                AsyncImage(url: URL(string: backgroundUrl)) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                }
            } else {
                Rectangle()
                    .fill(Color.gray.opacity(0.3))
            }
            
            // Dark overlay
            Color.black.opacity(config.overlayOpacity ?? 0.4)
            
            // Content
            HStack(alignment: .center, spacing: 16) {
                // Left column: Logo, title, subtitle, countdown
                VStack(alignment: .leading, spacing: 8) {
                    // Logo
                    if let logoUrl = config.logoUrl {
                        AsyncImage(url: URL(string: logoUrl)) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(height: 30)
                        } placeholder: {
                            Rectangle()
                                .fill(Color.clear)
                                .frame(height: 30)
                        }
                    }
                    
                    // Title
                    if let title = config.title {
                        Text(title)
                            .font(.system(size: 24, weight: .bold))
                            .foregroundColor(.white)
                    }
                    
                    // Subtitle
                    if let subtitle = config.subtitle {
                        Text(subtitle)
                            .font(.system(size: 14, weight: .regular))
                            .foregroundColor(.white.opacity(0.9))
                    }
                    
                    // Countdown
                    if let remaining = timeRemaining {
                        CountdownView(timeRemaining: remaining)
                    }
                }
                
                Spacer()
                
                // Right column: Discount badge and CTA
                VStack(spacing: 12) {
                    // Discount badge
                    if let discountText = config.discountBadgeText {
                        Text(discountText)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(Color.black.opacity(0.6))
                            .cornerRadius(20)
                    }
                    
                    // CTA Button
                    if let ctaText = config.ctaText {
                        Button(action: {
                            if let link = config.ctaLink, let url = URL(string: link) {
                                #if os(iOS)
                                UIApplication.shared.open(url)
                                #endif
                            }
                        }) {
                            Text(ctaText)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .background(Color.purple)
                                .cornerRadius(20)
                        }
                    }
                }
            }
            .padding(20)
        }
        .frame(height: 180)
        .cornerRadius(12)
        .onAppear {
            startCountdown()
        }
        .onDisappear {
            timer?.invalidate()
            timer = nil
        }
    }
    
    private func startCountdown() {
        guard let countdownDate = config.countdownEndDate else {
            print("ℹ️ [ROfferBanner] No countdown date provided")
            return
        }
        
        let formatter = ISO8601DateFormatter()
        guard let endDate = formatter.date(from: countdownDate) else { 
            print("❌ [ROfferBanner] Invalid countdown date: \(countdownDate)")
            return 
        }
        
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { timer in
            let now = Date()
            if now >= endDate {
                timer.invalidate()
                timeRemaining = nil
            } else {
                timeRemaining = Calendar.current.dateComponents(
                    [.day, .hour, .minute, .second],
                    from: now,
                    to: endDate
                )
            }
        }
    }
}

/// Countdown display component
struct CountdownView: View {
    let timeRemaining: DateComponents
    
    var body: some View {
        HStack(spacing: 8) {
            TimeUnit(value: timeRemaining.day ?? 0, label: "dager")
            TimeUnit(value: timeRemaining.hour ?? 0, label: "timer")
            TimeUnit(value: timeRemaining.minute ?? 0, label: "min")
            TimeUnit(value: timeRemaining.second ?? 0, label: "sek")
        }
    }
}

/// Individual time unit display
struct TimeUnit: View {
    let value: Int
    let label: String
    
    var body: some View {
        VStack(spacing: 2) {
            Text(String(format: "%02d", value))
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(.white)
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(.white.opacity(0.7))
        }
        .frame(width: 40, height: 50)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .stroke(Color.white.opacity(0.3), lineWidth: 1)
        )
    }
}

/// Container view that manages the offer banner lifecycle
public struct ROfferBannerContainer: View {
    @StateObject private var componentManager: ComponentManager
    
    public init(campaignId: Int) {
        self._componentManager = StateObject(wrappedValue: ComponentManager(campaignId: campaignId))
    }
    
    public var body: some View {
        Group {
            if let bannerConfig = componentManager.activeBanner {
                ROfferBanner(config: bannerConfig)
            }
        }
        .onAppear {
            Task {
                await componentManager.connect()
            }
        }
        .onDisappear {
            componentManager.disconnect()
        }
    }
}

#if DEBUG
/// Preview for development
struct ROfferBanner_Previews: PreviewProvider {
    static var previews: some View {
        ROfferBanner(config: OfferBannerConfig(
            logoUrl: "https://example.com/logo.png",
            title: "Ukens tilbud",
            subtitle: "Se denne ukes beste tilbud",
            backgroundImageUrl: "https://example.com/background.jpg",
            countdownEndDate: "2025-12-31T23:59:59Z",
            discountBadgeText: "Opp til 30%",
            ctaText: "Se alle tilbud →",
            ctaLink: "https://example.com/offers",
            overlayOpacity: 0.4
        ))
        .padding()
        .previewLayout(.sizeThatFits)
    }
}
#endif
