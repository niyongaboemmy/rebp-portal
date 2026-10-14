"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Reads and writes query-string state (filters, tabs, pages) so views are shareable and
 * survive reloads. Updates use `replace` inside a transition to keep typing smooth.
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback(
    (updates: Record<string, string | null | undefined>, { resetPage = true } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }
      if (resetPage && !("page" in updates)) params.delete("page");
      const query = params.toString();
      startTransition(() =>
        router.replace((query ? `${pathname}?${query}` : pathname) as never, { scroll: false }),
      );
    },
    [pathname, router, searchParams],
  );

  return { params: searchParams, set, pending };
}
