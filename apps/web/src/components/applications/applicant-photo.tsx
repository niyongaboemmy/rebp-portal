"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Camera, UserRound, ZoomIn } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The applicant's profile photo for staff (UX-035): a portrait in a soft primary ring that lifts
 * on hover and opens full size in a dialog — the way to check the face against the ID. Without a
 * photo it is the initials avatar, not clickable. `size` sm for lists, lg for consoles.
 */
export function ApplicantPhoto({
  name,
  src,
  size = "sm",
  caption,
  expandable = true,
  className,
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "lg" | "xl";
  /** A line under the name in the full view (e.g. the reference). */
  caption?: string;
  /** False inside row links (lists): the photo only shows; the consoles open it full size. */
  expandable?: boolean;
  className?: string;
}) {
  const t = useTranslations("review.photo");
  const [open, setOpen] = useState(false);
  const avatar = (
    <Avatar
      name={name}
      src={src}
      className={cn(
        size === "xs" && "size-7 text-[0.65rem]",
        size === "sm" && "size-9 text-xs",
        size === "lg" && "size-16 text-lg sm:size-20 sm:text-xl",
        // The console portrait: a large rounded square, not a circle (UX-035).
        size === "xl" &&
          "size-24 rounded-[1.4rem] text-2xl sm:size-32 sm:rounded-[1.75rem] sm:text-3xl",
      )}
    />
  );
  const ring = cn(
    "relative inline-flex shrink-0 p-[2px]",
    size === "xl" ? "rounded-[1.55rem] p-[3px] sm:rounded-[1.9rem]" : "rounded-full",
    size === "lg" || size === "xl"
      ? "bg-[conic-gradient(from_140deg,var(--primary),var(--sky),var(--primary-soft),var(--primary))]"
      : "bg-[linear-gradient(145deg,var(--primary-soft),color-mix(in_oklch,var(--primary)_35%,var(--card)))]",
    className,
  );
  // No photo on the consoles (UX-036): a disabled-looking portrait — a muted silhouette in a
  // dashed frame with a small "no photo" badge — so it reads as missing, not as a person's initials.
  if (!src && (size === "lg" || size === "xl"))
    return (
      <span
        role="img"
        aria-label={t("missing", { name })}
        title={t("missing", { name })}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center border-2 border-dashed border-foreground/15 bg-foreground/[0.03] text-muted-foreground/60 dark:border-white/15 dark:bg-white/[0.03]",
          size === "xl"
            ? "size-24 rounded-[1.4rem] sm:size-32 sm:rounded-[1.75rem]"
            : "size-16 rounded-full sm:size-20",
          className,
        )}
      >
        <UserRound
          aria-hidden
          strokeWidth={1.25}
          className={size === "xl" ? "size-12 sm:size-16" : "size-8 sm:size-10"}
        />
        <span
          aria-hidden
          className="absolute -right-1.5 -bottom-1.5 inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-card"
        >
          <Camera className="size-4" />
          <span className="absolute h-0.5 w-5 rotate-45 rounded-full bg-muted-foreground" />
        </span>
      </span>
    );
  if (!src || !expandable) return <span className={ring}>{avatar}</span>;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Inside a row link, the photo opens itself and not the row.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={t("open", { name })}
        className={cn(
          ring,
          "group/photo transition-transform duration-(--dur-3) ease-(--ease-spring) outline-none hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/40 active:scale-95",
        )}
      >
        {avatar}
        {(size === "lg" || size === "xl") && (
          <span
            aria-hidden
            className="absolute -right-1.5 -bottom-1.5 inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-card transition-transform duration-(--dur-3) ease-(--ease-spring) group-hover/photo:scale-110"
          >
            <ZoomIn className="size-4" />
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 sm:max-w-md">
          <div className="flex flex-col gap-0.5 pr-10">
            <DialogTitle className="text-base font-semibold">{name}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {caption ?? t("caption")}
            </DialogDescription>
          </div>
          <div className="overflow-hidden rounded-3xl bg-foreground/[0.04] ring-1 ring-foreground/[0.07] dark:bg-surface-2/60 dark:ring-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised, per-user file */}
            <img
              src={src}
              alt={t("alt", { name })}
              className="mx-auto max-h-[70dvh] w-full animate-in object-contain duration-300 zoom-in-95 fade-in"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
