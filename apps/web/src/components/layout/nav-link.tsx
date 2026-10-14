"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isActivePath, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  item: NavItem;
  variant?: "sidebar" | "header";
  onNavigate?: () => void;
}

export function NavLink({ item, variant = "sidebar", onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const active = isActivePath(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl text-sm font-medium transition-colors",
        variant === "sidebar"
          ? "tap-target px-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
          : "px-3 py-2 text-muted-foreground hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground",
      )}
    >
      {variant === "sidebar" && (
        <Icon
          className={cn(
            "size-[1.15rem] shrink-0",
            active ? "text-primary" : "text-muted-foreground",
          )}
          aria-hidden
        />
      )}
      {t(item.label)}
    </Link>
  );
}
