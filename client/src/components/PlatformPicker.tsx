import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';
import { PLATFORM_KINDS, PLATFORM_GROUPS } from '@/lib/platforms';

// Picker for the platforms of a surface (web/iOS/Android/Vev/TV). Shared by the
// create form and the surface detail dialog so both stay identical.
//
// The value is a `kind → identifier` map: a key being present means the platform
// is selected ('' = selected with no identifier yet). Identifier fields only
// appear for what's selected, so an untouched picker stays compact.

interface PlatformPickerProps {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** Dark surfaces (the detail dialog) need the inputs to sit on a lighter fill. */
  variant?: 'default' | 'dark';
}

export function PlatformPicker({ value, onChange, variant = 'default' }: PlatformPickerProps) {
  const toggle = (kind: string) => {
    const next = { ...value };
    if (kind in next) delete next[kind]; else next[kind] = '';
    onChange(next);
  };

  const selected = PLATFORM_KINDS.filter((p) => p.kind in value);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {PLATFORM_GROUPS.map(({ group, label }) => (
          <div key={group}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_KINDS.filter((p) => p.group === group).map(({ kind, label: kindLabel, icon: Icon }) => {
                const isOn = kind in value;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => toggle(kind)}
                    aria-pressed={isOn}
                    data-testid={`platform-chip-${kind}`}
                    className={`relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      isOn
                        ? 'border-[#3d8b7a] bg-[#3d8b7a]/10 text-[#3d8b7a] dark:text-[#5fb3a0]'
                        : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-white/25 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {kindLabel}
                    {isOn && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#3d8b7a] text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Identifiers</p>
          {selected.map(({ kind, label, placeholder, icon: Icon }) => (
            <div key={kind} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 w-28 shrink-0 text-sm text-muted-foreground">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </span>
              <Input
                value={value[kind] ?? ''}
                onChange={(e) => onChange({ ...value, [kind]: e.target.value })}
                placeholder={placeholder}
                className={`h-9 ${variant === 'dark' ? 'bg-white/5 border-white/10 text-gray-200' : ''}`}
                data-testid={`input-platform-${kind}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
