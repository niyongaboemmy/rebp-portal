"use client";

import { FlaskConical, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DevCodeProps {
  code: string | null | undefined;
  /** Fills the code into the form. */
  onUse?: (code: string) => void;
  className?: string;
}

/**
 * APP_ENV=dev only: shows the simulated OTP that would have been emailed / texted.
 * The server never sends a code to the browser outside dev mode, so this renders nothing there.
 */
export function DevCode({ code, onUse, className }: DevCodeProps) {
  const t = useTranslations("devMode");
  if (!code) return null;
  return (
    <div
      data-testid="dev-code"
      aria-live="polite"
      className={cn(
        "flex animate-in flex-wrap items-center gap-3 rounded-xl border border-dashed border-warning/50 bg-warning-soft px-3.5 py-2.5 fade-in slide-in-from-top-1",
        className,
      )}
    >
      <FlaskConical className="size-5 shrink-0 text-warning" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-semibold text-muted-foreground">{t("codeLabel")}</span>
        <span className="font-mono text-lg font-semibold tracking-[0.35em]" data-code={code}>
          {code}
        </span>
      </div>
      {onUse && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          // Keep focus in the code field: a blur would run validation and shift the layout mid-click.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onUse(code)}
        >
          <Wand2 /> {t("useCode")}
        </Button>
      )}
    </div>
  );
}
