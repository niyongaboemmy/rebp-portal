"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { RotateCw } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Keeps the overview live (UX-040): re-renders the server data every `seconds` while the tab is
 * visible (and at once when it comes back), with a "Live" pill showing how fresh it is. A manual
 * refresh is one click away. Nothing polls in a hidden tab.
 */
export function LiveRefresh({ seconds = 60 }: { seconds?: number }) {
  const t = useTranslations("boDash.live");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () =>
      startTransition(() => {
        router.refresh();
        setUpdatedAt(Date.now());
      });
    const tick = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible" && Date.now() - updatedAt >= seconds * 1000)
        refresh();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - updatedAt >= seconds * 1000)
        refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds, updatedAt]);

  const age = Math.max(0, Math.round((now - updatedAt) / 1000));
  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() => {
          router.refresh();
          setUpdatedAt(Date.now());
          setNow(Date.now());
        })
      }
      className="group inline-flex h-8 items-center gap-2 rounded-full bg-card/80 px-3 text-xs font-semibold ring-1 ring-foreground/[0.06] transition-colors outline-none hover:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:bg-white/[0.05] dark:ring-white/[0.06]"
      aria-label={t("refresh")}
    >
      <span className="relative inline-flex size-2">
        <span aria-hidden className="live-ping absolute inset-0 rounded-full bg-primary" />
        <span className="relative size-2 rounded-full bg-primary" />
      </span>
      <span>{t("label")}</span>
      <span className="num text-muted-foreground" aria-live="off">
        {age < 10 ? t("now") : t("ago", { seconds: age })}
      </span>
      <RotateCw
        aria-hidden
        className={cn(
          "size-3.5 text-muted-foreground transition-transform group-hover:rotate-90",
          pending && "animate-spin",
        )}
      />
    </button>
  );
}
