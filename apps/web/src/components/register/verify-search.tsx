"use client";

import { ArrowRight, ScanLine, Search } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// Camera + scanner UI loads only when the user taps "scan" (NFR-PERF-005).
const QrScannerDialog = dynamic(() => import("./qr-scanner-dialog"), { ssr: false });

const noopSubscribe = () => () => {};

/** Where a scanned QR should go: our own /check URLs keep their path; anything else is a number. */
export function destinationForScan(raw: string, origin: string): string {
  try {
    const url = new URL(raw);
    if (url.origin === origin && /\/check\//.test(url.pathname)) return url.pathname;
  } catch {
    /* not a URL: treat as a licence number */
  }
  return `/check/${encodeURIComponent(raw.trim().toUpperCase())}`;
}

/**
 * Hero search for the public register (FR-REG-002) with a camera QR scanner for licence
 * certificates (FR-REG-004). The scanner uses the native BarcodeDetector and only appears
 * where it is supported (Android Chrome); typing a number always works.
 */
export function VerifySearch({
  defaultValue = "",
  className,
}: {
  defaultValue?: string;
  className?: string;
}) {
  const t = useTranslations("verify");
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  // Feature detection without a hydration mismatch: false on the server, real value on the client.
  const canScan = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(window.BarcodeDetector),
    () => false,
  );

  return (
    <>
      <form
        action="/register"
        method="get"
        role="search"
        aria-label={t("label")}
        className={cn(
          "flex items-center gap-1 rounded-2xl border border-input bg-card p-1.5 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30 hover:border-foreground/25",
          className,
        )}
      >
        <Search className="ml-2.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          aria-label={t("placeholder")}
          placeholder={t("placeholder")}
          autoComplete="off"
          enterKeyHint="search"
          className="h-11 min-w-0 flex-1 bg-transparent px-1.5 text-base outline-none placeholder:text-muted-foreground"
        />
        {canScan && (
          <button
            type="button"
            onClick={() => setScanning(true)}
            aria-label={t("scan")}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-link transition-colors hover:bg-primary-soft"
          >
            <ScanLine className="size-5" aria-hidden />
          </button>
        )}
        <button
          type="submit"
          aria-label={t("submit")}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform active:scale-95"
        >
          <ArrowRight className="size-5" aria-hidden />
        </button>
      </form>
      {scanning && (
        <QrScannerDialog
          onClose={() => setScanning(false)}
          onResult={(raw) => {
            setScanning(false);
            router.push(destinationForScan(raw, window.location.origin) as never);
          }}
        />
      )}
    </>
  );
}
