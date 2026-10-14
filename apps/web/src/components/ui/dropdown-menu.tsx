"use client";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { ArrowRight, Check } from "@/components/icons";
import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          // Frosted glass panel: hairline light edge, layered soft shadow, springs in from its trigger.
          "z-50 min-w-52 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-2xl bg-popover/90 p-2 text-popover-foreground backdrop-blur-2xl backdrop-saturate-150",
          "shadow-[inset_0_1px_0_rgb(255_255_255/0.7),inset_0_0_0_1px_oklch(0.4_0.05_264/0.06),0_1px_2px_oklch(0.3_0.08_264/0.08),0_20px_44px_-16px_oklch(0.3_0.12_264/0.4)]",
          "dark:bg-popover/92 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_0_0_1px_rgb(255_255_255/0.06),0_24px_52px_-16px_rgb(0_0_0/0.85)]",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

/**
 * Rows: roomy, rounded, a neutral tint on highlight (the same in every menu) with the icon
 * turning brand blue. `group` lets rows animate their own parts (tiles, arrows) on highlight.
 */
const itemClass =
  "group relative flex min-h-11 cursor-default items-center gap-3 rounded-xl px-2.5 text-sm font-medium transition-colors duration-(--dur-1) outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground [&_svg]:transition-colors data-[highlighted]:bg-foreground/[0.05] data-[highlighted]:text-foreground data-[highlighted]:[&_svg]:text-link dark:data-[highlighted]:bg-white/[0.06]";

/** A rounded icon tile for menu rows: soft blue, solid on highlight. */
export function DropdownMenuIcon({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft/70 transition-[background-color,transform] duration-(--dur-3) ease-spring group-data-[highlighted]:scale-105 group-data-[highlighted]:bg-primary dark:bg-white/[0.06] [&_svg]:text-link! group-data-[highlighted]:[&_svg]:text-primary-foreground!",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return <DropdownMenuPrimitive.Item className={cn(itemClass, className)} {...props} />;
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(itemClass, "pr-10 data-[state=checked]:font-semibold", className)}
      {...props}
    >
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="absolute right-2.5 inline-flex size-5 animate-pop items-center justify-center rounded-full bg-primary">
        <Check className="size-3! text-primary-foreground!" strokeWidth={3} />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        "px-2.5 pt-1.5 pb-1 text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("mx-2.5 my-1.5 h-px bg-foreground/[0.07]", className)}
      {...props}
    />
  );
}

const ROW_TONE = {
  default: {
    row: "",
    tile: "",
  },
  /** A highlighted choice (e.g. "Create account"): warm Sun wash and a solid Sun tile. */
  featured: {
    row: "bg-sun/[0.12] data-[highlighted]:bg-sun/[0.2] dark:bg-sun/[0.07] dark:data-[highlighted]:bg-sun/[0.13]",
    tile: "bg-sun! [&_svg]:text-sun-foreground! group-data-[highlighted]:[&_svg]:text-sun-foreground! group-data-[highlighted]:rotate-3",
  },
  /** A destructive action (e.g. "Sign out"). */
  danger: {
    row: "data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive dark:data-[highlighted]:bg-destructive/15",
    tile: "bg-destructive/10 group-data-[highlighted]:bg-destructive! [&_svg]:text-destructive! group-data-[highlighted]:[&_svg]:text-white! dark:bg-destructive/15",
  },
} as const;

/**
 * The reusable rich menu row: icon tile, title, optional one-line description, and a trailing
 * arrow (or a custom `trailing`) that slides in on highlight. Pass `href` for navigation or
 * `onSelect` for an action; `tone` picks default, featured or danger styling. Works inside any
 * DropdownMenuContent, so every menu in the app looks and moves the same way.
 *
 * <DropdownMenuRow href="/sign-up" icon={<UserPlus />} title="Create account"
 *   description="New here? It takes two minutes" tone="featured" />
 */
export function DropdownMenuRow({
  icon,
  title,
  description,
  href,
  onSelect,
  tone = "default",
  trailing,
  badge,
  current,
  className,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  href?: string;
  onSelect?: (event: Event) => void;
  tone?: keyof typeof ROW_TONE;
  /** Replaces the default arrow (pass `null` for none). */
  trailing?: React.ReactNode;
  /** A dot in the tile's corner (e.g. "new"). */
  badge?: boolean;
  /** Marks the current page: semibold title and a Sun dot instead of the arrow. */
  current?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] transition-[background-color,transform] duration-(--dur-3) ease-spring group-data-[highlighted]:scale-105 group-data-[highlighted]:-rotate-3 group-data-[highlighted]:bg-primary dark:bg-white/[0.06] [&_svg]:size-[1.05rem]! [&_svg]:text-link! group-data-[highlighted]:[&_svg]:text-primary-foreground!",
          ROW_TONE[tone].tile,
        )}
      >
        {icon}
        {badge && (
          <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-ember ring-2 ring-popover" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5 leading-tight">
        <span className={cn("truncate", current ? "font-semibold" : "font-medium")}>{title}</span>
        {description && (
          <span className="text-xs font-normal text-muted-foreground">{description}</span>
        )}
      </span>
      {trailing !== undefined ? (
        trailing
      ) : current ? (
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-sun" />
      ) : (
        <ArrowRight
          aria-hidden
          className="shrink-0 -translate-x-1 opacity-0 transition-[opacity,transform] duration-(--dur-2) group-data-[highlighted]:translate-x-0 group-data-[highlighted]:opacity-100"
        />
      )}
    </>
  );
  const rowClass = cn("items-center", ROW_TONE[tone].row, className);
  if (href) {
    return (
      <DropdownMenuItem asChild className={rowClass} onSelect={onSelect}>
        <Link href={href as Route} aria-current={current ? "page" : undefined}>
          {body}
        </Link>
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem className={rowClass} onSelect={onSelect}>
      {body}
    </DropdownMenuItem>
  );
}
