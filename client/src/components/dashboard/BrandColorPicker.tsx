import { Label } from "@/components/ui/label";

/**
 * Color picker with brand-aware quick-picks.
 *
 * Wraps the native browser `<input type="color">` for the actual
 * picker UX (works across all desktop browsers + has decent mobile
 * support) and adds:
 *
 *  - hex display (read-only `<code>`) so the operator sees the
 *    exact value being saved
 *  - "Use sponsor primary / secondary" quick swatches when the
 *    selected sponsor has those fields stored on the
 *    `sponsors.primary_color` / `sponsors.secondary_color` columns
 *  - "Clear" button so the operator can return to "use brand
 *    default" / SDK fallback
 *
 * Used in the offer_banner Add + Customize forms (and any other
 * placement form that has a hex color field — drop in to replace
 * the legacy free-text `<Input>` for hex values).
 *
 * Sprint 2026-04-28 PM Phase 2 — 4th polish ask: pick color +
 * surface the brand colors we already store on each sponsor.
 */
export interface BrandColorPickerProps {
  label: string;
  /** Current value; empty string means "no override / use SDK default". */
  value: string | null | undefined;
  onChange: (next: string | undefined) => void;
  /** When set, shows quick-pick swatches for this sponsor's brand
   *  colors. Either or both can be null/empty (no swatch then). */
  sponsorPrimaryColor?: string | null;
  sponsorSecondaryColor?: string | null;
  sponsorName?: string;
  /** Optional helper text rendered below the picker. */
  helperText?: string;
  /** Optional placeholder hex shown in the disabled native picker
   *  when value is empty. Native inputs default to `#000000`; we
   *  pass `#888888` as a more neutral baseline by default. */
  emptyPlaceholder?: string;
  /** Optional test id prefix. */
  testId?: string;
}

export function BrandColorPicker({
  label,
  value,
  onChange,
  sponsorPrimaryColor,
  sponsorSecondaryColor,
  sponsorName,
  helperText,
  emptyPlaceholder = "#888888",
  testId,
}: BrandColorPickerProps) {
  const trimmed = (value ?? "").trim();
  const isSet = trimmed.length > 0;
  // Native `<input type="color">` requires a 7-char hex (#rrggbb).
  // When the operator hasn't set anything yet, fall back to the
  // emptyPlaceholder so the native swatch isn't pure black.
  const pickerValue = isSet && /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : emptyPlaceholder;

  const swatches: Array<{ key: string; label: string; color: string }> = [];
  const primaryHex = (sponsorPrimaryColor ?? "").trim();
  const secondaryHex = (sponsorSecondaryColor ?? "").trim();
  if (primaryHex) {
    swatches.push({
      key: "primary",
      label: sponsorName ? `${sponsorName} primary` : "Sponsor primary",
      color: primaryHex,
    });
  }
  if (secondaryHex && secondaryHex !== primaryHex) {
    swatches.push({
      key: "secondary",
      label: sponsorName ? `${sponsorName} secondary` : "Sponsor secondary",
      color: secondaryHex,
    });
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-14 cursor-pointer rounded border border-white/20 bg-transparent p-0"
          data-testid={testId ? `${testId}-picker` : undefined}
          aria-label={label}
        />
        <code className="text-xs font-mono text-muted-foreground tabular-nums">
          {isSet ? trimmed.toUpperCase() : "(unset → SDK default)"}
        </code>
        {isSet && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
            data-testid={testId ? `${testId}-clear` : undefined}
          >
            Clear
          </button>
        )}
      </div>

      {/* Brand quick-picks. Renders only when we actually have a
          stored color for this sponsor — otherwise the row is
          omitted entirely (no empty placeholder). */}
      {swatches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {swatches.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange(s.color)}
              className="flex items-center gap-1.5 rounded border border-white/20 px-2 py-1 text-[11px] hover:bg-white/5"
              title={`Use ${s.label} (${s.color.toUpperCase()})`}
              data-testid={testId ? `${testId}-swatch-${s.key}` : undefined}
            >
              <span
                className="block h-3 w-3 rounded-sm border border-white/20"
                style={{ background: s.color }}
              />
              <span className="text-muted-foreground">{s.label}</span>
              <code className="font-mono">{s.color.toUpperCase()}</code>
            </button>
          ))}
        </div>
      )}

      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
