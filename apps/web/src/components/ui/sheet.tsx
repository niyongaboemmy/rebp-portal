"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "@/components/icons";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

const SIDES = {
  left: "inset-y-0 left-0 w-[min(20rem,85vw)] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
  right:
    "inset-y-0 right-0 w-[min(22rem,90vw)] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
  // Bottom sheet: thumb-reachable on phones, respects the home-indicator safe area.
  bottom:
    "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl border-t pb-[max(1rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
} as const;

/** Slide-in drawer (navigation, filters, details). `bottom` renders a grab handle. */
export function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: keyof typeof SIDES }) {
  const t = useTranslations("common");
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <SheetPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto bg-popover p-4 shadow-(--overlay-drop) duration-(--dur-4) ease-enter data-[state=closed]:animate-out data-[state=closed]:duration-(--dur-2) data-[state=open]:animate-in",
          SIDES[side],
          className,
        )}
        {...props}
      >
        {side === "bottom" && (
          <span
            aria-hidden
            className="mx-auto -mt-1 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-border"
          />
        )}
        {children}
        <SheetPrimitive.Close className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted">
          <X className="size-5" aria-hidden />
          <span className="sr-only">{t("closeMenu")}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
