"use client";

import { usePathname } from "next/navigation";
import { splitLocalePrefix } from "@/i18n/routing";

/**
 * Shows the footer's call to action everywhere except the landing page, which already closes
 * on its own brand trust banner (two brand panels back to back would be heavy).
 */
export function FooterCtaSlot({ children }: { children: React.ReactNode }) {
  const path = splitLocalePrefix(usePathname()).path;
  return path === "/" ? null : children;
}
