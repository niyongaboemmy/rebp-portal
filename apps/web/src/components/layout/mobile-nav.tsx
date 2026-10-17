"use client";

import { Menu } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PUBLIC_NAV } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLink } from "./nav-link";

/**
 * Public drawer navigation below `md`. Closes on navigation. (Signed-in areas use the sidebar
 * sheet and the bottom tab bar instead.)
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const t = useTranslations();
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full md:hidden"
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
        <nav aria-label={t("nav.mainNavigation")} className="flex flex-col gap-1">
          {PUBLIC_NAV.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={close} />
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
