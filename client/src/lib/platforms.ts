// Platforms of a surface (migration 0010).
//
// Vocabulary: a **Surface** is the publisher property where Vio runs (VG, TV2);
// a **Platform** is web/iOS/Android/Vev/TV within it. Identifiers are
// per-platform — an iOS bundle id is not an Android package name — which is why
// they live on the platform rather than on the surface.

import {
  Globe, Smartphone, TabletSmartphone, Blocks, Tv, TvMinimal, Cast,
  type LucideIcon,
} from 'lucide-react';

export interface SurfacePlatform {
  id: number;
  kind: string;
  identifier: string | null;
}

export const PLATFORM_KINDS: {
  kind: string; label: string; placeholder: string; icon: LucideIcon; group: 'web' | 'mobile' | 'tv';
}[] = [
  { kind: 'web', label: 'Web', placeholder: 'e.g. vg.no', icon: Globe, group: 'web' },
  { kind: 'vev', label: 'Vev', placeholder: 'Vev project id (optional)', icon: Blocks, group: 'web' },
  { kind: 'ios', label: 'iOS', placeholder: 'Bundle ID — e.g. com.laliga.fanapp', icon: Smartphone, group: 'mobile' },
  { kind: 'android', label: 'Android', placeholder: 'Package name — e.g. com.laliga.fanapp', icon: TabletSmartphone, group: 'mobile' },
  { kind: 'apple-tv', label: 'Apple TV', placeholder: 'Bundle ID (optional)', icon: Tv, group: 'tv' },
  { kind: 'android-tv', label: 'Android TV', placeholder: 'Package name (optional)', icon: TvMinimal, group: 'tv' },
  { kind: 'fire-tv', label: 'Fire TV', placeholder: 'Package name (optional)', icon: Cast, group: 'tv' },
];

export const PLATFORM_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  PLATFORM_KINDS.map((p) => [p.kind, p.icon]),
);

export const PLATFORM_GROUPS: { group: 'web' | 'mobile' | 'tv'; label: string }[] = [
  { group: 'web', label: 'Web' },
  { group: 'mobile', label: 'Mobile' },
  { group: 'tv', label: 'TV' },
];

export const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORM_KINDS.map((p) => [p.kind, p.label]),
);

/** `kind → identifier` map (what the pickers edit) → the API's platforms array. */
export function platformsToPayload(map: Record<string, string>) {
  return Object.entries(map).map(([kind, identifier]) => ({
    kind,
    identifier: identifier.trim() || null,
  }));
}

/** API platforms array → the `kind → identifier` map the pickers edit. */
export function platformsToMap(platforms: SurfacePlatform[] | undefined): Record<string, string> {
  return Object.fromEntries((platforms ?? []).map((p) => [p.kind, p.identifier ?? '']));
}
