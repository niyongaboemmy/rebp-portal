"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { DocumentType } from "@rebp/contracts";
import {
  Award,
  BadgeCheck,
  BookUser,
  Briefcase,
  Building2,
  Certificate,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  Download,
  FileStack,
  FileText,
  Globe2,
  GraduationCap,
  Handshake,
  Paperclip,
  Receipt,
  RefreshCw,
  RotateCw,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { WizardDocument } from "./context";

/**
 * Attachment visuals (UX-008): an icon that says what each document is, a thumbnail that shows
 * what was actually uploaded (the photo itself, or a page tile for a PDF), and a preview that
 * opens the file in place — images with zoom and rotate, PDFs in the browser's reader.
 */

export const DOCUMENT_ICONS: Record<DocumentType, LucideIcon> = {
  proofOfIdentity: BookUser,
  photo: CircleUserRound,
  educationCertificate: GraduationCap,
  transcript: ScrollText,
  foreignRecognition: Globe2,
  trainingCertificate: Certificate,
  examResult: ClipboardCheck,
  experienceEvidence: Briefcase,
  equivalenceDecision: Scale,
  criminalRecord: ShieldCheck,
  integrityDisclosure: ShieldAlert,
  affiliationEvidence: Building2,
  referralApproval: Handshake,
  independentAuthorisation: BadgeCheck,
  previousLicence: Award,
  appointmentLetter: FileText,
  designationProof: UserCheck,
  managementTraining: Certificate,
  indemnityInsurance: ShieldCheck,
  companyRegistration: Building2,
  fullRegistrationInfo: FileStack,
  taxRegistration: Receipt,
  businessAddressProof: Building2,
  supervisorySystems: Users,
  clientFunds: Wallet,
  directorsIdentity: Users,
  other: Paperclip,
};

const noSubscribe = () => () => {};

/**
 * Where a file is served. The version is in the address, so a replaced file (same id, new
 * version) never shows the browser's cached copy of the old one.
 */
export const fileUrl = (doc: WizardDocument, download = false) =>
  `${doc.href ?? `/api/documents/${doc.id}`}?v=${doc.version}${download ? "&download=1" : ""}`;

const isImage = (doc: WizardDocument) => doc.mimeType.startsWith("image/");
const extension = (doc: WizardDocument) =>
  (doc.mimeType.split("/")[1] ?? "file").toUpperCase().replace("JPEG", "JPG");

/**
 * A 44 px tile: the uploaded photo itself, or a paper page with a folded corner and its format.
 * With nothing uploaded, the document type's icon on a soft tile.
 */
export function FileThumb({
  type,
  doc,
  stacked = false,
  className,
}: {
  type: DocumentType;
  doc?: WizardDocument;
  /** Several files: a second sheet peeks out behind. */
  stacked?: boolean;
  className?: string;
}) {
  const Icon = DOCUMENT_ICONS[type] ?? FileText;
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!doc)
    return (
      <span
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground",
          className,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
    );
  const blocked = doc.status === "INFECTED" || doc.status === "REJECTED_FILE";
  return (
    <span className={cn("relative inline-flex size-11 shrink-0", className)} aria-hidden>
      {stacked && (
        <span className="absolute inset-0 translate-x-1 -translate-y-1 rotate-6 rounded-lg bg-foreground/[0.08] dark:bg-surface-3" />
      )}
      {isImage(doc) && !blocked && !broken ? (
        // The uploaded photo itself: the applicant sees at a glance it's the right picture.
        <>
          {!loaded && <Skeleton className="absolute inset-0 size-11 rounded-lg" />}
          {/* eslint-disable-next-line @next/next/no-img-element -- authorised, per-user file */}
          <img
            src={fileUrl(doc)}
            alt=""
            loading="lazy"
            // A server-rendered image can finish loading before hydration attaches onLoad.
            ref={(img) => {
              if (img?.complete && img.naturalWidth > 0) setLoaded(true);
            }}
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
            className={cn(
              "relative size-11 rounded-lg object-cover shadow-[0_2px_6px_-2px_oklch(0.3_0.08_264/0.35)] transition-opacity duration-(--dur-3)",
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      ) : (
        // A paper page: folded corner, a few text lines, and its format.
        <span
          className={cn(
            "relative flex size-11 flex-col justify-between overflow-hidden rounded-lg bg-card p-1.5 shadow-[0_2px_6px_-2px_oklch(0.3_0.08_264/0.35)] [clip-path:polygon(0_0,72%_0,100%_28%,100%_100%,0_100%)] dark:bg-surface-3",
          )}
        >
          <span className="absolute top-0 right-0 size-3 rounded-bl-[3px] bg-foreground/10 dark:bg-white/20" />
          <span className="flex flex-col gap-[3px] pt-0.5">
            <span className="h-[2px] w-5 rounded-full bg-foreground/15" />
            <span className="h-[2px] w-6 rounded-full bg-foreground/15" />
            <span className="h-[2px] w-4 rounded-full bg-foreground/15" />
          </span>
          <span
            className={cn(
              "self-start rounded-[3px] px-1 text-[0.5rem] leading-[0.8rem] font-bold tracking-wide text-white",
              blocked ? "bg-destructive" : "bg-primary",
            )}
          >
            {extension(doc)}
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * The file, previewed in place: images with zoom and rotate, PDFs in the browser's reader
 * (served same-origin, so it may be framed). Arrows move between a slot's files.
 */
export function DocumentPreview({
  type,
  files,
  index,
  onIndex,
  onClose,
  onReplace,
  describe,
}: {
  type: DocumentType;
  files: WizardDocument[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
  onReplace?: (doc: WizardDocument) => void;
  /** "id.pdf · 240 KB · Uploaded" */
  describe: (doc: WizardDocument) => string;
}) {
  const t = useTranslations("wizard.documents");
  const doc = index === null ? undefined : files[index];
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const Icon = DOCUMENT_ICONS[type] ?? FileText;
  // PDFs are framed only where the browser has a reader (navigator.pdfViewerEnabled).
  const pdfReader = useSyncExternalStore(
    noSubscribe,
    () => navigator.pdfViewerEnabled !== false,
    () => true,
  );

  // A new file starts unzoomed and upright, and shows a page-shaped placeholder until it renders.
  const [shown, setShown] = useState(doc?.id);
  const [ready, setReady] = useState(false);
  if (shown !== doc?.id) {
    setShown(doc?.id);
    setZoom(1);
    setRotation(0);
    setReady(false);
  }

  useEffect(() => {
    if (index === null || files.length < 2) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") onIndex((index + 1) % files.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + files.length) % files.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, files.length, onIndex]);

  return (
    <Dialog open={Boolean(doc)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-4 p-4 sm:w-[min(56rem,calc(100vw-2rem))] sm:max-w-none sm:p-5">
        {doc && (
          <>
            <DialogHeader className="flex-row items-center gap-3 pr-10 text-left">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col">
                <DialogTitle className="truncate text-base">{t(`types.${type}.name`)}</DialogTitle>
                <DialogDescription className="truncate text-xs">{describe(doc)}</DialogDescription>
              </div>
            </DialogHeader>

            <div className="relative flex min-h-[50dvh] flex-1 items-center justify-center overflow-auto rounded-2xl bg-foreground/[0.04] dark:bg-black/30">
              {!ready && (isImage(doc) || pdfReader) && (
                <div
                  role="status"
                  className="pointer-events-none absolute inset-4 flex flex-col gap-3 rounded-lg bg-card/70 p-6 dark:bg-surface-2/70"
                >
                  <span className="sr-only">{t("preview.loading")}</span>
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="mt-4 flex-1 rounded-xl" />
                </div>
              )}
              {isImage(doc) ? (
                // eslint-disable-next-line @next/next/no-img-element -- authorised, per-user file
                <img
                  src={fileUrl(doc)}
                  alt={doc.fileName}
                  onLoad={() => setReady(true)}
                  className="max-h-[62dvh] max-w-full rounded-lg object-contain shadow-lg transition-transform duration-(--dur-3) ease-(--ease-standard)"
                  style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                />
              ) : pdfReader ? (
                <iframe
                  key={doc.id}
                  src={`${fileUrl(doc)}#view=FitH`}
                  title={doc.fileName}
                  onLoad={() => setReady(true)}
                  className="h-[62dvh] w-full rounded-lg bg-white"
                />
              ) : (
                // No built-in PDF reader (many phones): a page, and a way to open the file.
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <FileThumb type={type} doc={doc} className="scale-[2.2]" />
                  <p className="mt-6 max-w-xs text-sm text-muted-foreground">
                    {t("preview.noReader")}
                  </p>
                  <Button asChild variant="tonal" className="rounded-full">
                    <a href={fileUrl(doc)} target="_blank" rel="noreferrer">
                      {t("preview.openTab")}
                    </a>
                  </Button>
                </div>
              )}
              {files.length > 1 && (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full shadow-md"
                    aria-label={t("preview.previous")}
                    onClick={() => onIndex((index! - 1 + files.length) % files.length)}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full shadow-md"
                    aria-label={t("preview.next")}
                    onClick={() => onIndex((index! + 1) % files.length)}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {isImage(doc) && (
                  <>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("preview.zoomOut")}
                      disabled={zoom <= 0.5}
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                    >
                      <ZoomOut aria-hidden />
                    </Button>
                    <span className="w-12 text-center text-xs num text-muted-foreground">
                      {Math.round(zoom * 100)}%
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("preview.zoomIn")}
                      disabled={zoom >= 3}
                      onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                    >
                      <ZoomIn aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t("preview.rotate")}
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                    >
                      <RotateCw aria-hidden />
                    </Button>
                  </>
                )}
                {files.length > 1 && (
                  <span className="ml-1 text-xs num text-muted-foreground">
                    {t("preview.position", { current: index! + 1, total: files.length })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {onReplace && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => {
                      onClose();
                      onReplace(doc);
                    }}
                  >
                    <RefreshCw aria-hidden /> {t("preview.replace")}
                  </Button>
                )}
                <Button asChild variant="tonal" className="rounded-full">
                  <a href={fileUrl(doc, true)}>
                    <Download aria-hidden /> {t("preview.download")}
                  </a>
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
