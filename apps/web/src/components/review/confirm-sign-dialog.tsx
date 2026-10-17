"use client";

import { useTranslations } from "next-intl";
import type { LucideIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The last step of a review or a decision (FR-L-010, FR-M-013, UX-036): a plain confirmation —
 * the outcome in a chip, "Not yet" or the signing button. The signature is the explicit approval
 * given in the staff member's two-step-verified session; no password is asked.
 */
export function ConfirmSignDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  outcomeLabel,
  outcome,
  danger = false,
  confirmLabel,
  pending,
  onConfirm,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  description: string;
  outcomeLabel: string;
  outcome: string;
  /** A refusal: the outcome chip in the danger tone. */
  danger?: boolean;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  testId: string;
}) {
  const t = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="items-center text-center sm:max-w-md">
        {/* The signature, breathing so the eye lands on it. */}
        <span className="relative mx-auto inline-flex size-16 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:2.4s]"
          />
          <span className="relative inline-flex size-16 animate-pop items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon className="size-7" aria-hidden />
          </span>
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="max-w-sm">{description}</DialogDescription>
        </div>
        <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-foreground/[0.04] py-1 pr-1 pl-3.5 text-xs font-medium text-muted-foreground dark:bg-white/[0.06]">
          {outcomeLabel}
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm font-semibold",
              danger
                ? "bg-danger-soft text-destructive"
                : "bg-primary-soft text-primary-soft-foreground",
            )}
          >
            {outcome}
          </span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              {t("notYet")}
            </Button>
          </DialogClose>
          <Button type="button" loading={pending} onClick={onConfirm} data-testid={testId}>
            <Icon /> {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
