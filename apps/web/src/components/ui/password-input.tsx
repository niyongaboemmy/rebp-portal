"use client";

import { ArrowRight, Check, Eye, EyeOff, Lock } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { estimatePasswordStrength, PASSWORD_MIN_LENGTH } from "@rebp/contracts";
import { cn } from "@/lib/utils";
import { Input } from "./input";

/**
 * Password field: a lock icon, a show/hide toggle that swaps its eye with a small spring, and a
 * Caps Lock hint while typing (a common cause of failed sign-ins).
 */
export function PasswordInput({
  className,
  onKeyUp,
  onBlur,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const t = useTranslations("common");
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        type={visible ? "text" : "password"}
        leading={<Lock />}
        className={cn(
          "tracking-wide",
          !visible && "[&:not(:placeholder-shown)]:tracking-[0.2em]",
          className,
        )}
        onKeyUp={(event) => {
          setCaps(event.getModifierState?.("CapsLock") ?? false);
          onKeyUp?.(event);
        }}
        onBlur={(event) => {
          setCaps(false);
          onBlur?.(event);
        }}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
            aria-label={visible ? t("hidePassword") : t("showPassword")}
            aria-pressed={visible}
          >
            <span key={String(visible)} className="inline-flex animate-pop">
              {visible ? (
                <EyeOff className="size-[1.1rem]" aria-hidden />
              ) : (
                <Eye className="size-[1.1rem]" aria-hidden />
              )}
            </span>
          </button>
        }
        {...props}
      />
      {caps && (
        <span
          role="status"
          className="inline-flex w-fit animate-rise items-center gap-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-foreground"
        >
          <ArrowRight className="size-3 -rotate-90" aria-hidden />
          {t("capsLock")}
        </span>
      )}
    </div>
  );
}

const STRENGTH_COLOURS = [
  "bg-destructive",
  "bg-destructive",
  "bg-warning",
  "bg-primary",
  "bg-primary",
];

/** Visual strength hint; the server enforces the actual policy. */
export function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("auth.strength");
  if (!password) return null;
  const score = estimatePasswordStrength(password);
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-(--dur-3)",
              score >= step ? STRENGTH_COLOURS[score] : "bg-foreground/10",
            )}
          />
        ))}
      </div>
      <span className="min-w-20 text-right text-xs font-medium text-muted-foreground">
        <span className="sr-only">{t("label")}: </span>
        {t(String(score) as "0")}
      </span>
    </div>
  );
}

/**
 * W-01: live password rules. Each rule ticks as it's met (spring check), so users see progress
 * while typing rather than an error after submitting. The server still enforces the policy.
 */
export function PasswordChecklist({
  password,
  confirm,
  minLength = PASSWORD_MIN_LENGTH,
}: {
  password: string;
  confirm: string;
  minLength?: number;
}) {
  const t = useTranslations("auth.checklist");
  if (!password) return null;
  const rules = [
    { key: "length", ok: password.length >= minLength, label: t("length", { min: minLength }) },
    { key: "match", ok: confirm.length > 0 && confirm === password, label: t("match") },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-live="polite">
      {rules.map((rule) => (
        <li
          key={rule.key}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium transition-colors duration-(--dur-2)",
            rule.ok ? "text-link" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "inline-flex size-4 items-center justify-center rounded-full border transition-all duration-(--dur-3) ease-spring",
              rule.ok
                ? "scale-100 border-transparent bg-primary text-primary-foreground"
                : "scale-90 border-input",
            )}
            aria-hidden
          >
            {rule.ok && <Check className="size-3" strokeWidth={3.5} />}
          </span>
          <span>
            <span className="sr-only">{rule.ok ? t("met") : t("notMet")}: </span>
            {rule.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
