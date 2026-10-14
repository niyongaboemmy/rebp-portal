"use client";

import { useTranslations } from "next-intl";
import { PUBLIC_NAV } from "@/config/navigation";
import { NavLink } from "./nav-link";

/** Header navigation for public pages. Client-side because nav items carry icon components. */
export function PublicNav() {
  const t = useTranslations("nav");
  return (
    <nav aria-label={t("mainNavigation")} className="hidden items-center gap-1 lg:flex">
      {PUBLIC_NAV.map((item) => (
        <NavLink key={item.href} item={item} variant="header" />
      ))}
    </nav>
  );
}
