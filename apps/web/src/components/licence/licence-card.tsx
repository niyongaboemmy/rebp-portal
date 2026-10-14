import QRCode from "qrcode";
import { cn } from "@/lib/utils";

export interface LicenceCardProps {
  holder: string;
  categoryName: string;
  section: string;
  licenceNo: string;
  statusLabel: string;
  expiryLabel: string;
  expiry: string;
  /** URL the QR encodes (the public verification page, FR-N-002). */
  verifyUrl: string;
  /** Labels the card as an illustration, never a real credential. */
  sampleLabel?: string;
  /** Animated scan line over the QR (marketing illustrations only). */
  scanBeam?: boolean;
  className?: string;
}

/**
 * Wallet-pass style licence (FR-N-002/010). Brand surface, Imigongo motif, live-status chip
 * and a real QR to the verification page. Tilts slightly under a mouse (hover devices only;
 * transform only; off under reduced motion via the global rule).
 */
export async function LicenceCard({
  holder,
  categoryName,
  section,
  licenceNo,
  statusLabel,
  expiryLabel,
  expiry,
  verifyUrl,
  sampleLabel,
  scanBeam = false,
  className,
}: LicenceCardProps) {
  const qr = await QRCode.toString(verifyUrl, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0c0f13", light: "#00000000" },
  });

  return (
    <div className={cn("[perspective:1000px]", className)}>
      <article
        className="group relative isolate flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[1.75rem] bg-brand p-5 transition-transform duration-(--dur-4) ease-standard sm:p-6 [@media(hover:hover)]:hover:[transform:rotateX(5deg)_rotateY(-7deg)]"
        aria-label={`${categoryName} — ${holder}`}
      >
        <div aria-hidden className="absolute inset-0 -z-10 bg-imigongo text-white opacity-[0.07]" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-[900ms] ease-standard group-hover:translate-x-[120%]"
        />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-mono text-xs font-semibold opacity-80">{section}</span>
            <span className="line-clamp-2 text-base leading-tight font-bold sm:text-lg">
              {categoryName}
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-brand">
            <span
              className="size-1.5 animate-pulse rounded-full bg-[oklch(0.55_0.15_150)]"
              aria-hidden
            />
            {statusLabel}
          </span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="truncate text-lg font-bold sm:text-xl">{holder}</span>
            <div className="flex gap-5 text-xs">
              <span className="flex flex-col">
                <span className="opacity-75">№</span>
                <span className="font-mono font-semibold num">{licenceNo}</span>
              </span>
              <span className="flex flex-col">
                <span className="opacity-75">{expiryLabel}</span>
                <span className="font-semibold num">{expiry}</span>
              </span>
            </div>
          </div>
          <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white p-1.5 sm:size-20">
            <span
              className="block size-full [&_svg]:size-full"
              aria-hidden
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            {scanBeam && (
              <span
                aria-hidden
                className="absolute inset-x-1 top-1 h-0.5 animate-scan-beam rounded-full bg-sky shadow-[0_0_12px_2px] shadow-sky/70 [--beam-travel:3.5rem] sm:[--beam-travel:4.5rem]"
              />
            )}
          </span>
        </div>
        {sampleLabel && (
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-lg border-2 border-white/60 px-3 py-1 text-sm font-black tracking-[0.3em] uppercase opacity-60">
            {sampleLabel}
          </span>
        )}
      </article>
    </div>
  );
}
