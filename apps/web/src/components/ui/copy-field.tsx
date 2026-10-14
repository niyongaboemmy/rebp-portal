"use client";

import { Check, Copy } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";

/** A reference, licence or registration number with one-tap copy and a tick morph. */
export function CopyField({
  value,
  label,
  size = "default",
  className,
}: {
  value: string;
  label: string;
  size?: "default" | "lg";
  className?: string;
}) {
  const t = useTranslations("common");
  const { copied, copy } = useCopyToClipboard();
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border bg-surface-2 pl-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col py-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            "truncate font-mono font-semibold num",
            size === "lg" ? "text-xl sm:text-2xl" : "text-base",
          )}
        >
          {value}
        </span>
      </div>
      <button
        type="button"
        onClick={() => copy(value)}
        className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
        aria-label={copied ? t("copied") : `${t("copy")} ${label}`}
      >
        <Copy
          className={cn(
            "absolute size-5 transition-all duration-(--dur-2)",
            copied ? "scale-50 opacity-0" : "scale-100 opacity-100",
          )}
          aria-hidden
        />
        <Check
          className={cn(
            "absolute size-5 text-success transition-all duration-(--dur-3) ease-spring",
            copied ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
          aria-hidden
        />
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
}
