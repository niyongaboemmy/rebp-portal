"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

const CODE_LENGTH = 6;

interface OtpCredential extends Credential {
  code: string;
}

/** Sets a value the way a user would, so React Hook Form's onChange sees it. */
function fill(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * One-time code entry. A single numeric input keeps SMS autofill (autocomplete="one-time-code"),
 * paste and screen readers working, which split-box widgets often break.
 *
 * W-04 (gap analysis v2): a pasted full code, or one delivered by the Web OTP API (`webOtp`,
 * Android Chrome SMS autofill), submits the form immediately. Typed codes still use the
 * explicit button, so keyboard and screen-reader users are never surprised.
 */
export function OtpInput({
  className,
  onChange,
  onPaste,
  webOtp = false,
  ref,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { webOtp?: boolean }) {
  const local = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!webOtp || typeof window === "undefined" || !("OTPCredential" in window)) return;
    const abort = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: abort.signal } as CredentialRequestOptions)
      .then((credential) => {
        const input = local.current;
        const code = (credential as OtpCredential | null)?.code?.replace(/\D/g, "");
        if (!input || !code || code.length !== CODE_LENGTH) return;
        fill(input, code);
        input.form?.requestSubmit();
      })
      .catch(() => {
        /* dismissed, aborted or unsupported: the user types or pastes instead */
      });
    return () => abort.abort();
  }, [webOtp]);

  return (
    <Input
      ref={(node) => {
        local.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={CODE_LENGTH}
      placeholder="••••••"
      className={cn(
        "h-14 text-center font-mono text-2xl tracking-[0.5em] sm:h-14 sm:text-2xl",
        className,
      )}
      onChange={(event) => {
        event.target.value = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
        onChange?.(event);
      }}
      onPaste={(event) => {
        onPaste?.(event);
        const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
        if (pasted.length !== CODE_LENGTH) return;
        event.preventDefault();
        const input = event.currentTarget;
        fill(input, pasted);
        // Let React Hook Form record the value before submitting.
        requestAnimationFrame(() => input.form?.requestSubmit());
      }}
      {...props}
    />
  );
}
