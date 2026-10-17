"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

/** The slice of Google Identity Services this button uses. */
interface GoogleIdentity {
  initialize(config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    nonce: string;
    context: "signin" | "signup" | "use";
    ux_mode: "popup";
    itp_support: boolean;
    use_fedcm_for_button: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type: "standard";
      theme: "outline" | "filled_black";
      size: "large";
      text: "continue_with" | "signup_with";
      shape: "pill";
      logo_alignment: "left";
      width: number;
      locale: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentity } };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";
/** Google reads a bare "en" loosely (it guessed French from the location); give full tags. */
const GSI_LOCALE: Record<string, string> = { en: "en_GB", fr: "fr_FR", rw: "rw_RW" };
let gsiLoading: Promise<GoogleIdentity> | null = null;

/** Loads Google's script once per page; later buttons reuse it. */
function loadGsi(): Promise<GoogleIdentity> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  gsiLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("gsi"));
    script.onerror = () => {
      gsiLoading = null;
      reject(new Error("gsi"));
    };
    document.head.appendChild(script);
  });
  return gsiLoading;
}

/**
 * "Sign in with Google" (FR-ACC-006, ADR-004 amendment): Google's own button, so the browser gets a
 * signed ID token without a client secret. The token is posted to /api/auth/google/id-token with
 * the one-time nonce issued just before; the server answers where to go next.
 */
export function GoogleSignInButton({
  clientId,
  intent = "signin",
  context = "signin",
  next,
}: {
  clientId: string;
  intent?: "signin" | "link";
  context?: "signin" | "signup" | "use";
  next?: string;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const slot = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "busy" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    const el = slot.current;
    if (!el) return;
    (async () => {
      try {
        const [gsi, nonceResponse] = await Promise.all([
          loadGsi(),
          fetch("/api/auth/google/nonce", { method: "POST", cache: "no-store" }),
        ]);
        if (!nonceResponse.ok) throw new Error("nonce");
        const { nonce } = (await nonceResponse.json()) as { nonce: string };
        if (cancelled) return;
        gsi.initialize({
          client_id: clientId,
          nonce,
          context,
          ux_mode: "popup",
          itp_support: true,
          use_fedcm_for_button: true,
          callback: async ({ credential }) => {
            if (!credential) return;
            setState("busy");
            try {
              const response = await fetch("/api/auth/google/id-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential, intent, next }),
              });
              const result = (await response.json()) as { redirect?: string };
              window.location.assign(
                result.redirect ??
                  (intent === "link"
                    ? "/settings/security?error=oauthFailed"
                    : "/sign-in?error=oauthFailed"),
              );
            } catch {
              setState("failed");
            }
          },
        });
        el.replaceChildren();
        gsi.renderButton(el, {
          type: "standard",
          theme: resolvedTheme === "dark" ? "filled_black" : "outline",
          size: "large",
          text: context === "signup" ? "signup_with" : "continue_with",
          shape: "pill",
          logo_alignment: "left",
          // Google draws 200–400 px wide; fill the form column within that range.
          width: Math.max(200, Math.min(400, Math.round(el.getBoundingClientRect().width))),
          locale: GSI_LOCALE[locale] ?? locale,
        });
        setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, context, intent, next, locale, resolvedTheme]);

  return (
    <div className="flex w-full flex-col items-center gap-2" aria-busy={state === "busy"}>
      {/* Reserve the button's height so the form doesn't jump while Google's script loads. */}
      <div className="relative flex min-h-11 w-full max-w-[400px] justify-center">
        <div ref={slot} className="flex w-full justify-center" />
        {state === "loading" && (
          <span
            aria-hidden
            className="absolute inset-0 animate-pulse rounded-full bg-foreground/[0.06]"
          />
        )}
      </div>
      {state === "failed" && (
        <p role="alert" className="text-center text-xs text-muted-foreground">
          {t("googleLoadFailed")}
        </p>
      )}
    </div>
  );
}
