// Platforms of a surface (migration 0010).
//
// Vocabulary: a **Surface** is the publisher property where Vio runs (VG, TV2);
// a **Platform** is web/iOS/Android/Vev/TV within it. Identifiers are
// per-platform — an iOS bundle id is not an Android package name — which is why
// they live on the platform rather than on the surface.

export interface SurfacePlatform {
  id: number;
  kind: string;
  identifier: string | null;
}

export const PLATFORM_KINDS: { kind: string; label: string; placeholder: string }[] = [
  { kind: 'web', label: 'Web', placeholder: 'e.g. vg.no' },
  { kind: 'ios', label: 'iOS', placeholder: 'Bundle ID — e.g. com.laliga.fanapp' },
  { kind: 'android', label: 'Android', placeholder: 'Package name — e.g. com.laliga.fanapp' },
  { kind: 'vev', label: 'Vev', placeholder: 'Vev project id (optional)' },
  { kind: 'apple-tv', label: 'Apple TV', placeholder: 'Bundle ID (optional)' },
  { kind: 'android-tv', label: 'Android TV', placeholder: 'Package name (optional)' },
  { kind: 'fire-tv', label: 'Fire TV', placeholder: 'Package name (optional)' },
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
