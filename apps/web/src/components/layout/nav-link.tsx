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
        "relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors duration-(--dur-2)",
        variant === "sidebar"
          ? "tap-target px-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
          : "px-3 py-2 text-muted-foreground hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground",
      )}
    >
      {variant === "sidebar" && (
        <>
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-transform duration-(--dur-3) ease-spring",
              active ? "scale-y-100" : "scale-y-0",
            )}
          />
          <Icon
            className={cn(
              "size-[1.15rem] shrink-0",
              active ? "text-link" : "text-muted-foreground",
            )}
            aria-hidden
          />
        </>
      )}
      {t(item.label)}
    </Link>
  );
}
