"use client";

import { cn } from "@/lib/utils";
import { Input } from "./input";

/**
 * One-time code entry. A single numeric input keeps SMS autofill (autocomplete="one-time-code"),
 * paste and screen readers working, which split-box widgets often break.
 */
export function OtpInput({
  className,
  onChange,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      placeholder="••••••"
      className={cn(
        "h-14 text-center font-mono text-2xl tracking-[0.5em] sm:h-14 sm:text-2xl",
        className,
      )}
      onChange={(event) => {
        event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
        onChange?.(event);
      }}
      {...props}
    />
  );
}
