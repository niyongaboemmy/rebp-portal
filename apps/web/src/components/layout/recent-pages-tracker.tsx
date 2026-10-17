"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { recordRecentPage } from "@/lib/recent-pages";

/**
 * Remembers each page the viewer opens, for the command palette's "Recent" group. Next streams
 * metadata, so the new route's title ("Work queue · REBP Portal") can land after the path
 * changes: record once the title changes, or after a short wait when two pages share a title.
 */
export function RecentPagesTracker({ storageKey }: { storageKey: string }) {
  const pathname = usePathname();
  const lastTitle = useRef<string | null>(null);

  useEffect(() => {
    const record = (): boolean => {
      // Only pages with their own title; the bare site name is not one.
      const [title, site] = document.title.split(" · ");
      if (!title?.trim() || !site) return false;
      recordRecentPage(storageKey, { href: pathname, title: title.trim() });
      lastTitle.current = document.title;
      return true;
    };
    const changed = () => document.title !== lastTitle.current;
    if (changed() && record()) return;

    const observer = new MutationObserver(() => {
      if (changed() && record()) observer.disconnect();
    });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    const fallback = window.setTimeout(() => {
      observer.disconnect();
      record();
    }, 2000);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [pathname, storageKey]);

  return null;
}
