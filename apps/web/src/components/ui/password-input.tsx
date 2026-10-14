"use client";

import { Check, Eye, EyeOff } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { estimatePasswordStrength, PASSWORD_MIN_LENGTH } from "@rebp/contracts";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("common");
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-12", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

const STRENGTH_COLOURS = [
  "bg-destructive",
  "bg-destructive",
  "bg-warning",
  "bg-success",
  "bg-success",
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
              "h-1.5 flex-1 rounded-full transition-colors",
              score >= step ? STRENGTH_COLOURS[score] : "bg-muted",
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
            rule.ok ? "text-success" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "inline-flex size-4 items-center justify-center rounded-full border transition-all duration-(--dur-3) ease-spring",
              rule.ok
                ? "scale-100 border-transparent bg-success text-card"
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
