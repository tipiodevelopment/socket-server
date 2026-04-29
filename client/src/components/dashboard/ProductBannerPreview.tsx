import { useMemo } from "react";

/**
 * Live HTML/CSS preview of how a `product_banner` placement will
 * render on the iOS SDK. Approximates `VProductBanner`'s proportions
 * (variable height per layout preset, full-bleed bg image with dark
 * gradient overlay, title + subtitle + CTA button stack, optional
 * sponsor logo top-right when `showSponsorLogo` is true).
 *
 * Used inside the Add and Customize dialogs alongside the form so
 * the operator sees the banner update live as they type.
 *
 * Sprint 2026-04-28 PM Phase 2 step A.4.
 */
export interface ProductBannerPreviewProps {
  config: Record<string, any>;
  /** Selected sponsor's logo URL — used as the showSponsorLogo
   *  overlay source (mirrors the SDK's resolvedLogoUrl logic on
   *  VProductBanner). */
  sponsorLogoUrl?: string | null;
  /** Selected sponsor's primary brand color — used as fallback for
   *  buttonBackgroundColor when the operator leaves it empty. */
  sponsorPrimaryColor?: string | null;
}

export function ProductBannerPreview({
  config,
  sponsorLogoUrl,
  sponsorPrimaryColor,
}: ProductBannerPreviewProps) {
  // Derive heights / font sizes from the same layout preset table
  // VProductBanner.CachedStyling uses on the SDK side, so the
  // preview matches the live render. Operator's granular fields
  // override the preset (consistent priority).
  const preset = useMemo(() => {
    switch ((config.layout ?? "").toString().toLowerCase()) {
      case "compact": return { height: 120, title: 12, subtitle: 9,  button: 12 };
      case "large":   return { height: 280, title: 18, subtitle: 12, button: 16 };
      default:        return { height: 200, title: 14, subtitle: 10, button: 14 };
    }
  }, [config.layout]);

  const bannerHeight =
    typeof config.bannerHeight === "number" ? config.bannerHeight : preset.height;
  const titleFontSize =
    typeof config.titleFontSize === "number" ? config.titleFontSize : preset.title;
  const subtitleFontSize =
    typeof config.subtitleFontSize === "number" ? config.subtitleFontSize : preset.subtitle;
  const buttonFontSize =
    typeof config.buttonFontSize === "number" ? config.buttonFontSize : preset.button;

  const title = (config.title ?? "").trim() || "Title (will fall back to product name)";
  const subtitle = (config.subtitle ?? "").trim();
  const ctaText = (config.ctaText ?? "").trim() || "CTA";

  const backgroundImageUrl = (config.backgroundImageUrl ?? "").trim();
  // Banner content backdrop (rgba supported on the SDK side; preview
  // takes hex or rgba — both render fine in CSS).
  const backgroundColor = (config.backgroundColor ?? "").trim();
  const overlayOpacity =
    typeof config.overlayOpacity === "number" ? config.overlayOpacity : 0.5;

  // Color fallback chain for each text/button surface mirrors
  // VProductBanner.CachedStyling. When operator leaves a field
  // empty the preview shows a sensible default so the operator
  // sees what the iOS SDK would render.
  const titleColor = (config.titleColor ?? "").trim() || "#FFFFFF";
  const subtitleColor = (config.subtitleColor ?? "").trim() || "#F0F0F0";
  const buttonBackgroundColor =
    (config.buttonBackgroundColor ?? "").trim() ||
    (sponsorPrimaryColor ?? "").trim() ||
    "#007AFF";
  const buttonTextColor = (config.buttonTextColor ?? "").trim() || "#FFFFFF";

  // Text alignment maps onto CSS justify-content / text-align.
  const textAlignment = ((config.textAlignment ?? "left") as string).toLowerCase();
  const cssTextAlign = textAlignment === "right" ? "right" : textAlignment === "center" ? "center" : "left";

  // Vertical alignment maps onto flex justify-content (column).
  const vAlign = ((config.contentVerticalAlignment ?? "bottom") as string).toLowerCase();
  const cssJustifyContent =
    vAlign === "top" ? "flex-start" : vAlign === "center" ? "center" : "flex-end";

  // Sponsor logo overlay (Phase 1 — opt-in).
  const showSponsorLogo = config.showSponsorLogo === true;
  const sponsorLogo =
    showSponsorLogo && (sponsorLogoUrl ?? "").trim().length > 0
      ? (sponsorLogoUrl as string).trim()
      : null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Live preview
      </div>

      <div
        className="relative overflow-hidden rounded-xl shadow-xl"
        style={{
          height: `${bannerHeight}px`,
          background: backgroundImageUrl
            ? `url("${backgroundImageUrl}") center/cover no-repeat`
            : "#1a1a1a",
        }}
      >
        {/* Dark gradient overlay — same intent as the SDK's
            LinearGradient (top → bottom for vertical banners). */}
        {backgroundImageUrl && (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(0,0,0,${overlayOpacity * 0.6}) 0%, rgba(0,0,0,${overlayOpacity}) 100%)`,
            }}
          />
        )}
        {/* Optional solid color overlay (operator's backgroundColor) */}
        {backgroundColor && (
          <div
            className="absolute inset-0"
            style={{ background: backgroundColor }}
          />
        )}

        {/* Sponsor logo — top-right corner overlay, same as SDK. */}
        {sponsorLogo && (
          <img
            src={sponsorLogo}
            alt=""
            className="absolute top-2 right-2 h-6 object-contain"
            style={{ maxWidth: 80 }}
          />
        )}

        {/* Content stack — flex column, vertical align driven by
            contentVerticalAlignment. */}
        <div
          className="relative z-10 h-full flex flex-col px-4 py-3"
          style={{
            justifyContent: cssJustifyContent,
            alignItems: cssTextAlign === "center" ? "center" : cssTextAlign === "right" ? "flex-end" : "flex-start",
            textAlign: cssTextAlign as any,
          }}
        >
          <div
            className="font-bold leading-tight line-clamp-2"
            style={{
              fontSize: `${titleFontSize}px`,
              color: titleColor,
              maxWidth: "70%",
            }}
          >
            {title}
          </div>

          {subtitle && (
            <div
              className="leading-tight line-clamp-2 mt-0.5"
              style={{
                fontSize: `${subtitleFontSize}px`,
                color: subtitleColor,
                maxWidth: "70%",
              }}
            >
              {subtitle}
            </div>
          )}

          <div
            className="inline-flex items-center gap-1 mt-2 rounded-full font-semibold"
            style={{
              fontSize: `${buttonFontSize}px`,
              background: buttonBackgroundColor,
              color: buttonTextColor,
              padding: "6px 14px",
            }}
          >
            {ctaText.replace(/→\s*$/, "").trim() || "CTA"}
            <span className="ml-0.5">→</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Approximates the iOS render. Final fonts / spacing depend on the
        device's typography tokens. Granular fields (bannerHeight,
        titleFontSize, etc.) override the layout preset.
      </p>
    </div>
  );
}
