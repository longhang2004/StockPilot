'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export type WorkspaceLocationPatch = Record<string, string | null | undefined>;

/** Small URL helper for workspace filters and object-detail deep links. */
export function useWorkspaceLocation() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const href = useCallback(
    (patch: WorkspaceLocationPatch = {}) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === '')
          next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  const update = useCallback(
    (patch: WorkspaceLocationPatch, mode: 'push' | 'replace' = 'replace') => {
      const target = href(patch);
      if (mode === 'push') router.push(target, { scroll: false });
      else router.replace(target, { scroll: false });
    },
    [href, router],
  );

  return useMemo(
    () => ({ params: searchParams, href, update }),
    [searchParams, href, update],
  );
}
