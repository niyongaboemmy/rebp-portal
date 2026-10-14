"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import { PILOT_BANNER_COOKIE } from "./pilot-banner-cookie";

export function DismissBanner({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        document.cookie = `${PILOT_BANNER_COOKIE}=1; path=/; samesite=lax`;
        router.refresh();
      }}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
    >
      <X className="size-4" aria-hidden />
    </button>
  );
}
