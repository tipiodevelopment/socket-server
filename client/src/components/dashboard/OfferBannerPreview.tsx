import { useEffect, useMemo, useState } from "react";

/**
 * Live HTML/CSS preview of how an `offer_banner` placement will render
 * on the iOS SDK. Approximates the visual proportions of `VOfferBanner`
 * (logo top-left, title + subtitle + analog countdown stacked below;
 * discount badge + CTA button stacked on the right; background image
 * with overlay opacity).
 *
 * Used inside the Add and Customize dialogs so the operator sees the
 * banner update in real time as they type — no need to save and
 * cold-restart the demo to check what they're shipping.
 *
 * Sprint 2026-04-28 PM Phase 2 (3rd ask: previsualización al añadir y
 * editar).
 */
export interface OfferBannerPreviewProps {
  config: Record<string, any>;
  /** Resolved sponsor logo (from VioConfiguration on the SDK side) —
   *  used as fallback when `config.logoUrl` is empty/missing. The
   *  dashboard form passes the selected sponsor's logoUrl here. */
  sponsorLogoUrl?: string | null;
}

export function OfferBannerPreview({ config, sponsorLogoUrl }: OfferBannerPreviewProps) {
  const title = (config.title ?? "").trim() || "Title goes here";
  const subtitle = (config.subtitle ?? "").trim();
  const badgeText = (config.discountBadgeText ?? "").trim() || "Badge";
  const ctaText = (config.ctaText ?? "").trim() || "CTA →";
  const backgroundImageUrl = (config.backgroundImageUrl ?? "").trim();
  const backgroundColor = (config.backgroundColor ?? "").trim() || "#1a1a1a";
  const buttonColor = (config.buttonColor ?? "").trim() || "#FF6B6B";
  const overlayOpacity = typeof config.overlayOpacity === "number" ? config.overlayOpacity : 0.4;
  const logoUrl = ((config.logoUrl ?? "").trim() || sponsorLogoUrl || "").trim();

  // Live ticking countdown — updates every second so the operator can
  // see the timer behavior. When countdownEndDate is empty/invalid we
  // render placeholder zeros.
  const endDate = useMemo(() => {
    const raw = (config.countdownEndDate ?? "").trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [config.countdownEndDate]);

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    if (!endDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const ms = endDate.getTime() - now.getTime();
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const days = Math.floor(ms / (24 * 3600 * 1000));
    const hours = Math.floor((ms % (24 * 3600 * 1000)) / (3600 * 1000));
    const minutes = Math.floor((ms % (3600 * 1000)) / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    return { days, hours, minutes, seconds, expired: false };
  }, [endDate, now]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Live preview
      </div>

      {/* Banner card — proportional to the iOS render (160pt height,
          full width). Rounded corners + drop shadow match
          VOfferBanner's `.vioCardShadow`. */}
      <div
        className="relative overflow-hidden rounded-xl shadow-xl"
        style={{
          aspectRatio: "16 / 6",
          background: backgroundImageUrl
            ? `url("${backgroundImageUrl}") center/cover no-repeat`
            : backgroundColor,
        }}
      >
        {/* Overlay (only when there's a bg image) */}
        {backgroundImageUrl && (
          <div
            className="absolute inset-0"
            style={{ background: `rgba(0, 0, 0, ${overlayOpacity})` }}
          />
        )}

        <div className="relative z-10 flex h-full items-center gap-4 px-4 py-3">
          {/* Left column */}
          <div className="flex flex-col justify-center gap-1 flex-1 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-4 object-contain object-left"
                style={{ maxWidth: "120px" }}
              />
            ) : (
              <div className="h-4 w-16 bg-white/20 rounded" />
            )}

            <div className="text-white text-lg font-bold leading-tight truncate">
              {title}
            </div>

            {subtitle && (
              <div className="text-white/80 text-xs leading-tight line-clamp-2">
                {subtitle}
              </div>
            )}

            {/* Analog countdown — 4 small boxes (dager/time/min/sek) */}
            <div className="flex gap-1 mt-1">
              {[
                { label: "dager", value: pad(remaining.days) },
                { label: "time", value: pad(remaining.hours) },
                { label: "min", value: pad(remaining.minutes) },
                { label: "sek", value: pad(remaining.seconds) },
              ].map((box) => (
                <div
                  key={box.label}
                  className="flex flex-col items-center bg-black/40 rounded px-2 py-0.5 min-w-[28px]"
                >
                  <span className="text-white text-xs font-bold leading-none">
                    {box.value}
                  </span>
                  <span className="text-white/60 text-[8px] leading-none mt-0.5">
                    {box.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — badge + CTA */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="bg-black/70 text-white text-sm font-bold rounded-full px-3 py-1">
              {badgeText}
            </div>
            <div
              className="text-white text-xs font-semibold rounded-full px-3 py-1.5 flex items-center gap-1"
              style={{ background: buttonColor }}
            >
              {ctaText.replace(/→\s*$/, "").trim() || "CTA"}
              <span className="ml-0.5">→</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Approximates the iOS render. Final colors / fonts / countdown formatting
        depend on the device's color scheme + the SDK's typography tokens.
        {remaining.expired && (
          <span className="text-red-400 ml-1">⚠ countdown end date is in the past — banner will show 00 00 00 00.</span>
        )}
      </p>
    </div>
  );
}
