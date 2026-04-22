import { useEffect, useState } from 'react';

/// Debounces a value so React-Query keys don't fire on every keystroke.
/// Pass user input through this before using it as part of a queryKey.
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
