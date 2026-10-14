"use client";

import { Menu } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Capability } from "@rebp/contracts";
import { PUBLIC_NAV } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppNav } from "./app-nav";
import { NavLink } from "./nav-link";

type MobileNavProps =
  { area: "public" } | { area: "portal" | "backoffice"; capabilities: Capability[] };

/** Drawer navigation for viewports below `lg`. Closes on navigation. */
export function MobileNav(props: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations();
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-full", props.area === "public" ? "md:hidden" : "lg:hidden")}
          aria-label={t("common.openMenu")}
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetTitle className="sr-only">{t("nav.mainNavigation")}</SheetTitle>
        <SheetDescription className="sr-only">{t("brand.tagline")}</SheetDescription>
        <div className="pt-1 pb-2">
          <Logo />
        </div>
        {props.area === "public" ? (
          <nav aria-label={t("nav.mainNavigation")} className="flex flex-col gap-1">
            {PUBLIC_NAV.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={close} />
            ))}
          </nav>
        ) : null}
        {props.area !== "public" && (
          <AppNav area={props.area} capabilities={props.capabilities} onNavigate={close} />
        )}
      </SheetContent>
    </Sheet>
  );
}
