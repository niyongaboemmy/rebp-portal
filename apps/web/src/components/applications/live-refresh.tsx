"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * Keeps a status page current (UX-028): while the tab is visible, the server data refreshes every
 * 30 seconds (a confirmation arrives, an officer acts) and a small live dot says when it last did.
 * Refreshing again on return to the tab, so a page left open never shows yesterday's state.
 */
export function LiveRefresh({ every = 30_000 }: { every?: number }) {
  const t = useTranslations("lifecycle.live");
  const router = useRouter();
  const [at, setAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setAt(Date.now());
    };
    const poll = setInterval(refresh, every);
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [every, router]);

  const seconds = Math.max(0, Math.round((now - at) / 1000));
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-soft-foreground"
      title={t("hint")}
    >
      <span aria-hidden className="relative inline-flex size-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/60 motion-reduce:hidden" />
        <span className="relative size-2 rounded-full bg-primary" />
      </span>
      {seconds < 15 ? t("justNow") : t("ago", { minutes: Math.max(1, Math.round(seconds / 60)) })}
    </span>
  );
}
