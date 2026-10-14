"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

/**
 * Translates an i18n error key ("errors.*" / "validation.*") coming from Zod or a server action.
 * Unknown keys fall back to a generic message so raw keys never reach the user.
 */
export function useErrorMessage() {
  const t = useTranslations();
  return useCallback(
    (key: string | undefined, meta?: Record<string, unknown>) => {
      if (!key) return undefined;
      const seconds = Number(meta?.retryAfterSeconds ?? 0);
      const values = { seconds, minutes: Math.max(1, Math.ceil(seconds / 60)) };
      return t.has(key) ? t(key, values) : t("errors.unexpected");
    },
    [t],
  );
}
