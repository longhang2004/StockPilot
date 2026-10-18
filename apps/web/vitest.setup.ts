import '@testing-library/jest-dom/vitest';
import { useMemo, useSyncExternalStore } from 'react';
import { vi } from 'vitest';

vi.mock('next/navigation', () => {
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const notify = () => listeners.forEach((listener) => listener());
  const navigate = (href: string, replace = false) => {
    if (replace) window.history.replaceState(null, '', href);
    else window.history.pushState(null, '', href);
    notify();
  };
  return {
    usePathname: () =>
      useSyncExternalStore(subscribe, () => window.location.pathname),
    useSearchParams: () => {
      const search = useSyncExternalStore(
        subscribe,
        () => window.location.search,
      );
      return useMemo(() => new URLSearchParams(search), [search]);
    },
    useRouter: () => ({
      push: (href: string) => navigate(href),
      replace: (href: string) => navigate(href, true),
    }),
  };
});
