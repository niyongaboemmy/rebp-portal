"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isActivePath, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  item: NavItem;
  variant?: "sidebar" | "header" | "rail";
  onNavigate?: () => void;
}

export function NavLink({ item, variant = "sidebar", onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const active = isActivePath(pathname, item);
  const Icon = item.icon;

  if (variant === "rail") {
    // Navigation rail (md–lg): icon in an active-indicator pill, short label underneath.
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className="group flex flex-col items-center gap-1 rounded-xl py-1 text-center text-[0.68rem] leading-tight font-semibold text-muted-foreground outline-none aria-[current=page]:text-foreground"
      >
        <span
          className={cn(
            "inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-(--dur-2) group-hover:bg-sidebar-accent group-focus-visible:ring-[3px] group-focus-visible:ring-ring/40",
            active && "bg-primary-soft text-primary-soft-foreground group-hover:bg-primary-soft",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="line-clamp-2 px-0.5">{t(item.label)}</span>
      </Link>
    );
  }

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
              active ? "text-primary" : "text-muted-foreground",
            )}
            aria-hidden
          />
        </>
      )}
      {t(item.label)}
    </Link>
  );
}
