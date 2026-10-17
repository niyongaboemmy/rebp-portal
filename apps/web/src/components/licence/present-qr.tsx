"use client";

import { useTranslations } from "next-intl";
import { Check, Copy, QrCode, ShieldCheck, Sun } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCopyToClipboard } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";

/**
 * Show the licence in person (UX-030, FR-N-002): a large QR a client or inspector scans to open
 * the live public record, a scan line sweeping it, the number to read out, and the link to share.
 * The QR is rendered on the server and passed in as SVG markup.
 */
export function PresentQr({
  qr,
  url,
  licenceNo,
  holder,
  category,
  live,
  className,
}: {
  qr: string;
  url: string;
  licenceNo: string;
  holder: string;
  category: string;
  live: boolean;
  className?: string;
}) {
  const t = useTranslations("wallet.present");
  const { copied, copy } = useCopyToClipboard();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={cn("group rounded-full", className)}>
          <QrCode aria-hidden /> {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center pr-0 text-center">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <div className="mx-auto flex w-full max-w-72 flex-col items-center gap-4">
          {/* The code on white, framed by corner marks like a scanner's viewfinder. */}
          <div className="relative w-full rounded-[1.75rem] bg-white p-5 ring-1 ring-foreground/[0.08]">
            {(
              [
                "top-2 left-2 border-t-2 border-l-2",
                "top-2 right-2 border-t-2 border-r-2",
                "bottom-2 left-2 border-b-2 border-l-2",
                "bottom-2 right-2 border-r-2 border-b-2",
              ] as const
            ).map((corner) => (
              <span
                key={corner}
                aria-hidden
                className={cn("absolute size-6 rounded-[0.4rem] border-primary", corner)}
              />
            ))}
            <span
              role="img"
              aria-label={t("qrLabel", { number: licenceNo })}
              className="block aspect-square w-full [&_svg]:size-full"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <span
              aria-hidden
              className="absolute inset-x-6 top-6 h-0.5 animate-scan-beam rounded-full bg-primary/80 [--beam-travel:14rem]"
            />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="font-mono text-lg font-bold num tracking-wide">{licenceNo}</span>
            <span className="text-sm text-muted-foreground">
              {holder} · {category}
            </span>
            <span
              className={cn(
                "mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                live ? "bg-primary-soft text-link" : "bg-danger-soft text-destructive",
              )}
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              {live ? t("live") : t("notLive")}
            </span>
          </div>
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Sun className="size-4 text-sun" aria-hidden /> {t("brightness")}
          </p>
          <Button variant="outline" className="w-full rounded-full" onClick={() => copy(url)}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? t("copied") : t("copy")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
