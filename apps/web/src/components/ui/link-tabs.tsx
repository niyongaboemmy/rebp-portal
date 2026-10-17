import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

interface LinkTab {
  href: Route;
  label: React.ReactNode;
  icon?: React.ReactNode;
  active: boolean;
}

/** URL-driven tabs: each tab is a link, so state is shareable and data loads on the server. */
export function LinkTabs({
  tabs,
  className,
  label,
}: {
  tabs: LinkTab[];
  className?: string;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        // A quiet track (UX-031): the active tab is a lighter surface with a primary icon, no outline.
        "inline-flex w-full gap-1 rounded-2xl bg-foreground/[0.04] p-1 sm:w-auto dark:bg-surface-2/60",
        className,
      )}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          scroll={false}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "inline-flex tap-target flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all sm:flex-none [&_svg]:size-4",
            tab.active
              ? "bg-card text-foreground dark:bg-surface-3 [&_svg]:text-link"
              : "text-muted-foreground hover:bg-card/60 hover:text-foreground dark:hover:bg-surface-3/50",
          )}
        >
          {tab.icon}
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
