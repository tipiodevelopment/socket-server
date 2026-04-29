import { useSponsorCatalog } from "@/hooks/use-sponsor-catalog";
import { Label } from "@/components/ui/label";

/**
 * Shared product picker used by both flows that bind a campaign
 * component to one or more sponsor-catalog products:
 *
 *   - "Add component" form (multi-select for carousel/banner/store/
 *     slider, never invoked for spotlight from there because the Add
 *     form's mutation handles single vs. multi at submit time).
 *   - "Customize component" dialog (single-select for spotlight,
 *     multi-select for the rest).
 *
 * Renders the per-sponsor catalog as a checkbox list with thumbnails.
 * Loading / error / empty states are handled inline so callers don't
 * have to. When `sponsorId` is null/empty, renders a hint and no list
 * (operator must pick a sponsor first).
 *
 * Sprint 2026-04-28 PM polish — replaces the raw "comma-separated
 * productIds" / "single productId" text inputs in the Customize
 * dialog so the operator never has to remember Reachu IDs by hand.
 */
export interface SponsorProductPickerProps {
  /** Sponsor whose catalog to display. Empty string / null → picker
   *  shows a hint. The catalog hook is paused until set. */
  sponsorId: string | null;
  /** Human-readable sponsor name for the label and empty states. */
  sponsorName?: string;
  /** Selection mode. `single` swaps the chosen id (one Set entry at
   *  a time); `multi` toggles like the Add form does today. */
  mode: "single" | "multi";
  /** Currently-selected product ids (string form, matches the
   *  catalog's `String(p.id)` keying). */
  selectedIds: Set<string>;
  /** Fired with the next selection set whenever the operator
   *  toggles a row. */
  onChange: (next: Set<string>) => void;
  /** Optional override for the section label. Default depends on
   *  the sponsor name + mode. */
  label?: string;
  /** Optional hint shown below the list ("No products selected → …"). */
  helperText?: string;
}

export function SponsorProductPicker({
  sponsorId,
  sponsorName,
  mode,
  selectedIds,
  onChange,
  label,
  helperText,
}: SponsorProductPickerProps) {
  const catalog = useSponsorCatalog(
    sponsorId && sponsorId.length > 0 ? sponsorId : null,
    { limit: 100 }
  );

  const labelText =
    label ??
    (sponsorName
      ? `Products from ${sponsorName}'s catalog`
      : "Products from the selected sponsor's catalog");

  if (!sponsorId) {
    return (
      <div className="space-y-2">
        <Label>{labelText}</Label>
        <p className="text-xs text-muted-foreground">
          Pick a sponsor first to load its product catalog.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{labelText}</Label>
      {catalog.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading catalog…</p>
      ) : catalog.isError ? (
        <p className="text-xs text-red-400">
          Failed to load catalog: {(catalog.error as any)?.message ?? "unknown error"}
        </p>
      ) : !catalog.data?.products?.length ? (
        <p className="text-xs text-muted-foreground">
          No products in {sponsorName ? `${sponsorName}'s` : "this sponsor's"} catalog yet.
        </p>
      ) : (
        <>
          <div className="max-h-48 overflow-y-auto space-y-1 rounded border border-white/10 p-2">
            {catalog.data.products.map((p) => {
              const idStr = String(p.id);
              const checked = selectedIds.has(idStr);
              return (
                <label
                  key={idStr}
                  className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-1 py-0.5 rounded"
                >
                  <input
                    type={mode === "single" ? "radio" : "checkbox"}
                    checked={checked}
                    onChange={(e) => {
                      if (mode === "single") {
                        onChange(e.target.checked ? new Set([idStr]) : new Set());
                      } else {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(idStr); else next.delete(idStr);
                        onChange(next);
                      }
                    }}
                    name={mode === "single" ? `single-product-${sponsorId}` : undefined}
                    data-testid={`checkbox-product-${idStr}`}
                  />
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="w-8 h-8 object-contain rounded bg-white/5"
                    />
                  )}
                  <span className="text-sm flex-1 line-clamp-1">{p.name || `Product ${p.id}`}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.price != null ? `${p.price} ${p.currency}` : "—"}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {helperText ??
              (selectedIds.size === 0
                ? "No products selected — placement will use the component template default."
                : `${selectedIds.size} product${selectedIds.size > 1 ? "s" : ""} selected.`)}
          </p>
        </>
      )}
    </div>
  );
}
