import { useQuery } from '@tanstack/react-query';

export interface CatalogProduct {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string;
}

export interface CatalogResponse {
  sponsor: { id: number; name: string };
  products: CatalogProduct[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface UseSponsorCatalogOptions {
  shippingCountryCode?: string;
  currency?: string;
  limit?: number;
  offset?: number;
}

/// Fetches the full Commerce catalog of a single sponsor (using that sponsor's
/// commerce_api_key on the backend). Pass `sponsorId = '' | null | 0` to keep the
/// query disabled until a sponsor is picked.
export function useSponsorCatalog(
  sponsorId: number | string | null | undefined,
  opts: UseSponsorCatalogOptions = {},
) {
  const numericId = typeof sponsorId === 'string' ? parseInt(sponsorId) : sponsorId ?? 0;
  const enabled = Number.isFinite(numericId) && (numericId as number) > 0;

  return useQuery<CatalogResponse>({
    queryKey: ['/api/commerce/sponsors', numericId, 'catalog', opts],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (opts.shippingCountryCode) params.set('shippingCountryCode', opts.shippingCountryCode);
      if (opts.currency) params.set('currency', opts.currency);
      if (opts.limit != null) params.set('limit', String(opts.limit));
      if (opts.offset != null) params.set('offset', String(opts.offset));
      const qs = params.toString();
      const url = `/api/commerce/sponsors/${numericId}/catalog${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Catalog fetch failed (${res.status}): ${body}`);
      }
      return res.json();
    },
    enabled,
    staleTime: 60_000,
  });
}
