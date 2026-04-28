import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSponsorCatalog } from "@/hooks/use-sponsor-catalog";

/**
 * Multi-sponsor product picker.
 *
 * Operator picks a sponsor, browses that sponsor's catalog, and adds
 * products to a curated list. They can switch sponsors and keep
 * adding — every entry remembers which sponsor it came from. The
 * SDK uses each entry's sponsorId to route the product fetch
 * through the right per-sponsor commerce key, so the resulting
 * grid can showcase SKUs across sponsors at once.
 *
 * Used in the product_store form (Customize / Add inline). Sprint
 * 2026-04-28 PM Phase 2.
 *
 * Wire-side shape (`customConfig.products`):
 *   [{ productId: string, sponsorId: number }, ...]
 */
export interface ProductEntry {
  productId: string;
  sponsorId: number;
}

export interface MultiSponsorProductPickerProps {
  /** Sponsors available for this campaign (primary + secondaries).
   *  Operator can pick from any of them. */
  campaignSponsors: Array<{
    sponsorId: number;
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
  }>;
  selectedEntries: ProductEntry[];
  onChange: (entries: ProductEntry[]) => void;
  /** Optional override for the section label. */
  label?: string;
  /** Optional helper text rendered below the list. */
  helperText?: string;
}

export function MultiSponsorProductPicker({
  campaignSponsors,
  selectedEntries,
  onChange,
  label = "Products in this store",
  helperText,
}: MultiSponsorProductPickerProps) {
  // Browser state: which sponsor's catalog is currently displayed.
  // Defaults to the first sponsor available (or empty if none).
  const [browseSponsor, setBrowseSponsor] = useState<string>(
    campaignSponsors[0] ? String(campaignSponsors[0].sponsorId) : ""
  );

  const catalog = useSponsorCatalog(
    browseSponsor && browseSponsor.length > 0 ? browseSponsor : null,
    { limit: 100 }
  );

  // Resolve sponsor metadata for the entries already added so we can
  // show a name + brand color badge per row.
  const sponsorById = useMemo(() => {
    const m = new Map<number, { name: string; primaryColor: string | null }>();
    for (const s of campaignSponsors) {
      m.set(s.sponsorId, { name: s.name, primaryColor: s.primaryColor });
    }
    return m;
  }, [campaignSponsors]);

  const isAdded = (productId: string, sponsorId: number) =>
    selectedEntries.some(e => e.productId === productId && e.sponsorId === sponsorId);

  const addEntry = (productId: string, sponsorId: number) => {
    if (isAdded(productId, sponsorId)) return;
    onChange([...selectedEntries, { productId, sponsorId }]);
  };

  const removeEntry = (productId: string, sponsorId: number) => {
    onChange(selectedEntries.filter(e => !(e.productId === productId && e.sponsorId === sponsorId)));
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      {/* Selected entries list — shows what's currently in the store
          ordered as the operator added them. Empty state hints
          how to start. */}
      <div className="rounded border border-white/10 p-2 space-y-1 min-h-[60px]">
        {selectedEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No products yet. Pick a sponsor below + add some.
          </p>
        ) : (
          selectedEntries.map((e, idx) => {
            const meta = sponsorById.get(e.sponsorId);
            return (
              <div
                key={`${e.sponsorId}-${e.productId}-${idx}`}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5"
              >
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: meta?.primaryColor ?? "#444",
                    color: "#fff",
                  }}
                  title={meta?.name ?? `sponsor ${e.sponsorId}`}
                >
                  {meta?.name ?? `S${e.sponsorId}`}
                </span>
                <code className="text-xs font-mono flex-1">{e.productId}</code>
                <button
                  type="button"
                  onClick={() => removeEntry(e.productId, e.sponsorId)}
                  className="text-xs text-muted-foreground hover:text-red-400 px-1"
                  data-testid={`button-remove-entry-${e.productId}-${e.sponsorId}`}
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Browse + add section. Sponsor select drives the catalog fetch. */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <Label htmlFor="multi-sponsor-browse">Add from sponsor</Label>
        <Select value={browseSponsor} onValueChange={setBrowseSponsor}>
          <SelectTrigger data-testid="select-multi-sponsor-browse">
            <SelectValue placeholder="Pick a sponsor" />
          </SelectTrigger>
          <SelectContent>
            {campaignSponsors.map((s) => (
              <SelectItem key={s.sponsorId} value={String(s.sponsorId)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Catalog list for the picked sponsor */}
        {browseSponsor && (
          <div className="space-y-1">
            {catalog.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading catalog…</p>
            ) : catalog.isError ? (
              <p className="text-xs text-red-400">
                Failed to load catalog: {(catalog.error as any)?.message ?? "unknown error"}
              </p>
            ) : !catalog.data?.products?.length ? (
              <p className="text-xs text-muted-foreground">
                No products in this sponsor's catalog.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 rounded border border-white/10 p-2">
                {catalog.data.products.map((p: any) => {
                  const idStr = String(p.id);
                  const sid = parseInt(browseSponsor, 10);
                  const added = isAdded(idStr, sid);
                  return (
                    <div
                      key={idStr}
                      className={`flex items-center gap-2 px-1 py-0.5 rounded ${added ? "opacity-50" : "hover:bg-white/5"}`}
                    >
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt="" className="w-8 h-8 object-contain rounded bg-white/5" />
                      )}
                      <span className="text-sm flex-1 line-clamp-1">{p.name || `Product ${p.id}`}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.price != null ? `${p.price} ${p.currency}` : "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => addEntry(idStr, sid)}
                        disabled={added}
                        className="text-xs px-2 py-0.5 rounded border border-white/20 hover:bg-white/10 disabled:opacity-50"
                        data-testid={`button-add-entry-${idStr}-${sid}`}
                      >
                        {added ? "Added" : "+ Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {(helperText || selectedEntries.length > 0) && (
        <p className="text-xs text-muted-foreground">
          {helperText ??
            `${selectedEntries.length} product${selectedEntries.length === 1 ? "" : "s"} curated. Each routes through its sponsor's commerce key.`}
        </p>
      )}
    </div>
  );
}
