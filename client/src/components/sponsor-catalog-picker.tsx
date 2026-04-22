import { useMemo, useState } from 'react';
import { Check, Loader2, Search, ShoppingBag, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSponsorCatalog, type CatalogProduct } from '@/hooks/use-sponsor-catalog';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

type SingleProps = {
  multi?: false;
  value: number | null;
  onChange: (value: number | null) => void;
};

type MultiProps = {
  multi: true;
  value: number[];
  onChange: (value: number[]) => void;
};

type Props = (SingleProps | MultiProps) & {
  sponsorId: number | string | null | undefined;
  /// Used for the "select a sponsor first" empty state copy.
  sponsorPlaceholderText?: string;
  /// Override hard-coded NO/NOK if the campaign is in another market.
  shippingCountryCode?: string;
  currency?: string;
};

/// Browse a sponsor's full Commerce catalog and pick one or many productIds.
/// Uses the sponsor's own commerce key on the backend, so each picker only ever
/// sees that sponsor's channel.
export function SponsorCatalogPicker(props: Props) {
  const {
    sponsorId,
    sponsorPlaceholderText = 'Select a sponsor first to load its catalog.',
    shippingCountryCode,
    currency,
  } = props;

  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim().toLowerCase(), 250);

  const { data, isLoading, isError, error } = useSponsorCatalog(sponsorId, {
    shippingCountryCode,
    currency,
    limit: 200,
  });

  const products = useMemo(() => {
    const all = data?.products ?? [];
    if (!search) return all;
    return all.filter(
      (p: CatalogProduct) =>
        p.name?.toLowerCase().includes(search) ||
        String(p.id).includes(search) ||
        p.sku?.toLowerCase().includes(search),
    );
  }, [data, search]);

  const isSelected = (id: number) =>
    props.multi ? props.value.includes(id) : props.value === id;

  const toggle = (id: number) => {
    if (props.multi) {
      props.onChange(
        props.value.includes(id) ? props.value.filter((x) => x !== id) : [...props.value, id],
      );
    } else {
      props.onChange(props.value === id ? null : id);
    }
  };

  if (!sponsorId) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500" data-testid="catalog-empty-no-sponsor">
        {sponsorPlaceholderText}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
        <Input
          placeholder="Search by name, SKU or id…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-8 h-8 text-xs"
          data-testid="catalog-search-input"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-white/50 py-3" data-testid="catalog-loading">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading sponsor catalog…
        </div>
      ) : isError ? (
        <div className="flex items-start gap-2 text-xs text-red-300 py-3" data-testid="catalog-error">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{(error as Error)?.message ?? 'Failed to load catalog'}</span>
        </div>
      ) : products.length === 0 ? (
        <p className="text-xs text-gray-400 py-3" data-testid="catalog-empty">
          {data?.products?.length === 0 ? 'This sponsor has no products yet.' : 'No products match the search.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1" data-testid="catalog-grid">
          {products.map((p) => {
            const selected = isSelected(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                data-testid={`catalog-product-${p.id}`}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
                  selected
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                }`}
              >
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-white/10 flex-shrink-0 flex items-center justify-center">
                    <ShoppingBag className="w-3.5 h-3.5 text-white/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">{p.name}</p>
                  {p.price != null && (
                    <p className="text-[10px] text-green-400">
                      {p.price} {p.currency}
                    </p>
                  )}
                </div>
                {selected && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {data && (
        <p className="text-[10px] text-white/30 text-right" data-testid="catalog-count">
          {products.length} of {data.total} products{search ? ' (filtered)' : ''}
        </p>
      )}
    </div>
  );
}
