"use client";

import { useTranslations } from "next-intl";
import type { Role } from "@rebp/contracts";
import { ROLE_META } from "@/config/roles";
import { cn } from "@/lib/utils";

export function roleStyle(role: Role): React.CSSProperties {
  return { "--role-hue": ROLE_META[role].hue } as React.CSSProperties;
}

/** Colour-coded role pill. Colour is never the only signal: the name and icon are always shown. */
export function RoleChip({
  role,
  size = "sm",
  className,
}: {
  role: Role;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("roles");
  const Icon = ROLE_META[role].icon;
  return (
    <span
      style={roleStyle(role)}
      className={cn(
        "role-tint inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-xs [&_svg]:size-3" : "px-3 py-1 text-sm [&_svg]:size-4",
        className,
      )}
    >
      <Icon aria-hidden />
      {t(role)}
    </span>
  );
}

export function RoleIcon({ role, className }: { role: Role; className?: string }) {
  const Icon = ROLE_META[role].icon;
  return (
    <span
      style={roleStyle(role)}
      className={cn(
        "role-tint inline-flex size-10 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-5",
        className,
      )}
      aria-hidden
    >
      <Icon />
    </span>
  );
}
