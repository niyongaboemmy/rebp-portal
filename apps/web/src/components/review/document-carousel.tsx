"use client";

import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Upload,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "@/components/icons";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ProgressRing } from "@/components/data/progress-ring";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Mark, type MarkState } from "./marks";
import type { StatusTone } from "@rebp/contracts";

/** One slide: an uploaded document (with its chosen version) or a required one never uploaded. */
export interface CarouselSlide {
  key: string;
  label: string;
  /** Absent for a required document that was never uploaded. */
  doc?: {
    id: string;
    status: string;
    statusLabel: string;
    tone: StatusTone;
    mark: MarkState;
    officerNote: string | null;
    version: number;
    fileName: string;
    mimeType: string;
    size: number;
    createdAt: string;
    /** The stored file exists (false: lost or never written). */
    available: boolean;
    reviewable: boolean;
    unavailableReason?: string;
  };
}

export const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

const fileUrl = (id: string, version: number, download = false) =>
  `/api/documents/${id}?v=${version}${download ? "&download=1" : ""}`;

/**
 * Why a file can't be shown, designed like the app's empty states (UX-034): a soft halo with the
 * document and a small badge, one title, one line of what to do — never a raw error.
 */
export function FileState({
  kind,
  detail,
  compact = false,
  onRetry,
  downloadHref,
}: {
  kind: "unavailable" | "notUploaded" | "blocked" | "noPreview";
  /** For "blocked": the reason (scanning, infected, rejected file). */
  detail?: string;
  compact?: boolean;
  onRetry?: () => void;
  /** For "noPreview": where the file can be downloaded instead. */
  downloadHref?: string;
}) {
  const t = useTranslations("review.viewer.state");
  const Badge =
    kind === "notUploaded" || kind === "noPreview"
      ? kind === "noPreview"
        ? Download
        : Upload
      : kind === "blocked"
        ? ShieldAlert
        : XCircle;
  return (
    <div
      role="status"
      className={cn(
        "flex h-full flex-col items-center justify-center gap-4 p-6 text-center",
        compact ? "min-h-56" : "min-h-[22rem]",
      )}
    >
      <span className="relative inline-flex size-20 animate-pop items-center justify-center">
        <span aria-hidden className="absolute inset-0 rounded-[1.75rem] bg-primary-soft" />
        <span aria-hidden className="absolute -inset-3 rounded-[2.25rem] bg-primary-soft/40" />
        <FileText className="relative size-9 text-link" aria-hidden />
        <span
          aria-hidden
          className={cn(
            "absolute -right-1 -bottom-1 inline-flex size-8 items-center justify-center rounded-full ring-4 ring-card",
            kind === "notUploaded"
              ? "bg-sun text-sun-foreground"
              : "bg-danger-soft text-destructive",
          )}
        >
          <Badge className="size-4" />
        </span>
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-base font-semibold">{t(`${kind}.title`)}</p>
        <p className="text-sm text-muted-foreground">{detail ?? t(`${kind}.body`)}</p>
      </div>
      {downloadHref && kind === "noPreview" && (
        <Button asChild variant="tonal" size="sm" className="rounded-full">
          <a href={downloadHref} download>
            <Download aria-hidden /> {t("download")}
          </a>
        </Button>
      )}
      {onRetry && kind === "unavailable" && (
        <Button variant="tonal" size="sm" className="rounded-full" onClick={onRetry}>
          <RefreshCw aria-hidden /> {t("retry")}
        </Button>
      )}
    </div>
  );
}

/** The file itself: an image (zoom/rotate), an embedded PDF, or why it can't be shown. */
export function SlidePreview({
  slide,
  zoom,
  rotation,
  compact = false,
}: {
  slide: CarouselSlide;
  zoom: number;
  rotation: number;
  compact?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const doc = slide.doc;
  if (!doc) return <FileState kind="notUploaded" compact={compact} />;
  if (!doc.reviewable)
    return <FileState kind="blocked" detail={doc.unavailableReason} compact={compact} />;
  if (!doc.available || failed)
    return (
      <FileState
        kind="unavailable"
        compact={compact}
        onRetry={() => {
          setFailed(false);
          setAttempt((a) => a + 1);
        }}
      />
    );
  const src = `${fileUrl(doc.id, doc.version)}&r=${attempt}`;
  // Browsers render images and PDFs; anything else is offered as a download, never a broken frame.
  if (!doc.mimeType.startsWith("image/") && doc.mimeType !== "application/pdf")
    return (
      <FileState
        kind="noPreview"
        compact={compact}
        detail={doc.fileName}
        downloadHref={fileUrl(doc.id, doc.version, true)}
      />
    );
  return doc.mimeType.startsWith("image/") ? (
    <div className="flex h-full items-center justify-center overflow-auto p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- authorised, streamed file; not optimisable */}
      <img
        src={src}
        alt={slide.label}
        onError={() => setFailed(true)}
        draggable={false}
        className="max-h-full max-w-full origin-center object-contain transition-transform duration-(--dur-3) select-none"
        style={{ transform: `scale(${ZOOMS[zoom]}) rotate(${rotation}deg)` }}
      />
    </div>
  ) : (
    <iframe key={src} src={src} title={slide.label} className="block h-full w-full bg-card" />
  );
}

/**
 * The documents as a full-screen carousel (UX-034): the file large, arrows and swipe to move,
 * ← / → on the keyboard, thumbnails of every document below, zoom and rotate for photos, and the
 * verdict right there. Slides glide in from the side they come from.
 */
export function DocumentCarousel({
  open,
  onOpenChange,
  slides,
  index,
  onIndex,
  locale,
  canVerdict,
  busy,
  onVerify,
  onReject,
  autoNext,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: CarouselSlide[];
  index: number;
  onIndex: (index: number) => void;
  locale: string;
  canVerdict: boolean;
  busy: boolean;
  onVerify: () => void;
  onReject: () => void;
  /** After a verdict: counting down to the next document. */
  autoNext?: {
    seconds: number;
    total: number;
    label: string;
    /** The last document: the pill offers the next step of the review instead. */
    finish?: boolean;
    goNow: () => void;
    stay: () => void;
  } | null;
}) {
  const t = useTranslations("review.viewer");
  const [zoom, setZoom] = useState(2);
  const [rotation, setRotation] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const swipe = useRef<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const slide = slides[index];
  const doc = slide?.doc;
  const isImage = doc?.mimeType.startsWith("image/") ?? false;

  const go = (step: number) => {
    if (slides.length < 2) return;
    setDirection(step > 0 ? 1 : -1);
    setZoom(2);
    setRotation(0);
    onIndex((index + step + slides.length) % slides.length);
  };

  const jump = (i: number) => {
    if (i === index) return;
    setDirection(i > index ? 1 : -1);
    setZoom(2);
    setRotation(0);
    onIndex(i);
  };

  // Keep the active thumbnail in view.
  useEffect(() => {
    strip.current
      ?.querySelector<HTMLElement>(`[data-slide="${index}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index, open]);

  if (!slide) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="document-carousel"
        className="flex h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:h-[88dvh] sm:max-w-6xl sm:p-0"
        onKeyDown={(event) => {
          const target = event.target as HTMLElement;
          if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
          if (event.key === "ArrowRight") go(1);
          else if (event.key === "ArrowLeft") go(-1);
          else if (isImage && (event.key === "+" || event.key === "="))
            setZoom((z) => Math.min(ZOOMS.length - 1, z + 1));
          else if (isImage && event.key === "-") setZoom((z) => Math.max(0, z - 1));
          else if (canVerdict && doc?.reviewable && doc.available && event.key === "v") onVerify();
          else if (canVerdict && doc?.reviewable && event.key === "r") onReject();
          else return;
          event.preventDefault();
        }}
      >
        {/* Header: what this is, where we are, its state. */}
        <div className="flex items-center gap-3 border-b border-foreground/[0.06] py-3 pr-16 pl-4 sm:pl-5 dark:border-white/[0.06]">
          <Mark state={doc?.mark ?? "todo"} />
          <div className="flex min-w-0 flex-1 flex-col">
            <DialogTitle className="truncate text-base font-semibold">{slide.label}</DialogTitle>
            <DialogDescription className="truncate text-xs text-muted-foreground">
              {doc
                ? `${doc.fileName} · ${Math.max(1, Math.round(doc.size / 1024))} KB · ${formatDateTime(doc.createdAt, locale)}`
                : t("state.notUploaded.title")}
            </DialogDescription>
          </div>
          {doc && <StatusBadge tone={doc.tone} label={doc.statusLabel} className="max-sm:hidden" />}
          <span className="shrink-0 rounded-full bg-foreground/[0.05] px-2.5 py-1 text-xs font-semibold num dark:bg-white/[0.06]">
            {t("position", { n: index + 1, total: slides.length })}
          </span>
        </div>

        {/* The stage: the file, arrows on either side, swipe on touch. */}
        <div
          className="relative min-h-0 flex-1 overflow-hidden bg-foreground/[0.03] dark:bg-black/20"
          onPointerDown={(e) => (swipe.current = e.clientX)}
          onPointerUp={(e) => {
            if (swipe.current === null) return;
            const dx = e.clientX - swipe.current;
            swipe.current = null;
            if (Math.abs(dx) > 60 && zoom <= 2) go(dx < 0 ? 1 : -1);
          }}
        >
          <div
            key={slide.key}
            className={cn(
              "h-full animate-in duration-300 ease-out fade-in",
              direction > 0 ? "slide-in-from-right-10" : "slide-in-from-left-10",
            )}
          >
            <SlidePreview slide={slide} zoom={zoom} rotation={rotation} />
          </div>
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label={t("previous")}
                className="absolute top-1/2 left-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/85 text-foreground ring-1 ring-foreground/[0.08] backdrop-blur transition-transform hover:scale-105 active:scale-95 dark:bg-surface-3/85 dark:ring-white/[0.08]"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label={t("next")}
                className="absolute top-1/2 right-3 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/85 text-foreground ring-1 ring-foreground/[0.08] backdrop-blur transition-transform hover:scale-105 active:scale-95 dark:bg-surface-3/85 dark:ring-white/[0.08]"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </>
          )}
          {/* The countdown to the next document (UX-036): a pill with a ring that empties. */}
          {autoNext && (
            <div
              role="status"
              className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 animate-in items-center gap-3 rounded-full bg-card/95 py-1.5 pr-1.5 pl-2 ring-1 ring-primary/20 backdrop-blur duration-300 fade-in slide-in-from-bottom-4 dark:bg-surface-3/95"
            >
              <span className="relative inline-flex size-9 items-center justify-center">
                <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    className="fill-none stroke-primary/15"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    className="fill-none stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={94.25}
                    strokeDashoffset={94.25 * (1 - autoNext.seconds / autoNext.total)}
                  />
                </svg>
                <span className="text-sm font-bold num">{autoNext.seconds}</span>
              </span>
              <span className="flex min-w-0 flex-col pr-1">
                <span className="text-[0.65rem] font-bold tracking-widest text-muted-foreground uppercase">
                  {autoNext.finish ? t("autoNext.allDone") : t("autoNext.next")}
                </span>
                <span className="max-w-56 truncate text-sm font-semibold">{autoNext.label}</span>
              </span>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={autoNext.stay}>
                {t("autoNext.stay")}
              </Button>
              <Button size="sm" className="rounded-full" onClick={autoNext.goNow}>
                {autoNext.finish ? t("autoNext.continue") : t("autoNext.go")}{" "}
                <ChevronRight aria-hidden />
              </Button>
            </div>
          )}
        </div>

        {/* A slim tray (UX-036), so the document gets the space: the verdicts as a hairline of
            segments, then one row — mini pages to jump between, tools, the count and the verdict. */}
        <div className="relative border-t border-foreground/[0.06] dark:border-white/[0.06]">
          {doc?.officerNote && (
            <p className="mx-4 mt-3 rounded-xl bg-danger-soft px-3.5 py-2 text-sm ring-1 ring-destructive/20 sm:mx-5">
              <span className="font-semibold">{t("rejectionReason")}: </span>
              {doc.officerNote}
            </p>
          )}
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <div
              ref={strip}
              role="tablist"
              aria-label={t("document")}
              className="-my-1 flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-2.5 overflow-x-auto px-1.5 py-2.5"
            >
              {slides.map((s, i) => {
                const active = i === index;
                const sd = s.doc;
                const thumbImage =
                  sd?.available && sd.reviewable && sd.mimeType.startsWith("image/");
                const tone = !sd ? "missing" : sd.mark;
                const ext = sd
                  ? (sd.mimeType.split("/")[1] ?? "file").toUpperCase().replace("JPEG", "JPG")
                  : null;
                return (
                  <Tooltip key={s.key} delayDuration={120}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-label={`${s.label}: ${sd ? sd.statusLabel : t("notUploaded")}`}
                        data-slide={i}
                        onClick={() => jump(i)}
                        className={cn(
                          // A tile per document, tinted by its verdict (UX-036).
                          "relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition-[transform,box-shadow] duration-(--dur-3) ease-(--ease-spring) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                          tone === "done" && "bg-primary-soft text-link",
                          tone === "failed" && "bg-danger-soft text-destructive",
                          tone === "todo" &&
                            "bg-[linear-gradient(145deg,color-mix(in_oklch,var(--sun)_22%,var(--card)),var(--card))] text-foreground",
                          tone === "missing" &&
                            "border border-dashed border-sun/70 bg-card text-muted-foreground",
                          active
                            ? "-translate-y-1 scale-110 ring-2 ring-primary ring-offset-2 ring-offset-card"
                            : "hover:-translate-y-0.5 hover:scale-105",
                        )}
                      >
                        {thumbImage ? (
                          // eslint-disable-next-line @next/next/no-img-element -- authorised thumbnail
                          <img
                            src={fileUrl(sd!.id, sd!.version)}
                            alt=""
                            className="size-full rounded-[inherit] object-cover"
                          />
                        ) : sd ? (
                          <span className="flex flex-col items-center gap-0.5">
                            <FileText aria-hidden className="size-4" />
                            <span className="text-[0.5rem] leading-none font-bold tracking-wide">
                              {ext}
                            </span>
                          </span>
                        ) : (
                          <Upload aria-hidden className="size-4" />
                        )}
                        {/* The verdict as a small badge. */}
                        <span
                          aria-hidden
                          className={cn(
                            "absolute -top-1 -right-1 z-10 inline-flex size-3.5 items-center justify-center rounded-full ring-2 ring-card",
                            tone === "done" && "bg-primary text-primary-foreground",
                            tone === "failed" && "bg-destructive text-white",
                            (tone === "todo" || tone === "missing") && "missing-mark bg-sun",
                          )}
                        >
                          {tone === "done" && <Check className="size-2" strokeWidth={3.5} />}
                          {tone === "failed" && <XCircle className="size-2" />}
                        </span>
                      </button>
                    </TooltipTrigger>
                    {/* Name and verdict, as a small card above the tile. */}
                    <TooltipContent side="top" sideOffset={10} className="px-3 py-2">
                      <span className="flex flex-col gap-1">
                        <span className="text-xs font-semibold">{s.label}</span>
                        <span className="inline-flex items-center gap-1.5 text-[0.7rem] opacity-80">
                          <span
                            aria-hidden
                            className={cn(
                              "size-1.5 rounded-full",
                              tone === "done" && "bg-primary",
                              tone === "failed" && "bg-destructive",
                              (tone === "todo" || tone === "missing") && "bg-sun",
                            )}
                          />
                          {sd ? sd.statusLabel : t("notUploaded")}
                          {sd && ` · ${ext}`}
                        </span>
                      </span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            {isImage && doc?.available && doc.reviewable && (
              <div
                className="hidden items-center sm:flex @md:flex"
                role="group"
                aria-label={t("imageTools")}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setZoom((z) => Math.max(0, z - 1))}
                  aria-label={t("zoomOut")}
                >
                  <ZoomOut />
                </Button>
                <span className="w-10 text-center text-xs font-semibold num" aria-live="polite">
                  {Math.round(ZOOMS[zoom]! * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
                  aria-label={t("zoomIn")}
                >
                  <ZoomIn />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRotation((r) => r + 90)}
                  aria-label={t("rotateRight")}
                >
                  <RotateCw />
                </Button>
              </div>
            )}
            {doc?.available && (
              <Button asChild variant="ghost" size="icon-sm" aria-label={t("download")}>
                <a href={fileUrl(doc.id, doc.version, true)} download title={t("download")}>
                  <Download />
                </a>
              </Button>
            )}
            {/* How many are verified, as a ring beside the verdict buttons. */}
            <ProgressRing
              value={slides.filter((x) => x.doc?.status === "VERIFIED").length}
              total={slides.length}
              thickness={4}
              className="size-10 shrink-0"
              label={t("verifiedCount", {
                done: slides.filter((x) => x.doc?.status === "VERIFIED").length,
                total: slides.length,
              })}
            >
              <span className="text-[0.6rem] font-bold num">
                {slides.filter((x) => x.doc?.status === "VERIFIED").length}/{slides.length}
              </span>
            </ProgressRing>
            {canVerdict && doc?.reviewable && (
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReject}
                  disabled={busy}
                  data-testid="reject-document"
                  className="rounded-full text-destructive hover:bg-danger-soft"
                >
                  <XCircle />{" "}
                  <span className="max-sm:sr-only">
                    {doc.status === "REJECTED" ? t("rejectedState") : t("reject")}
                  </span>
                </Button>
                <Button
                  size="sm"
                  onClick={onVerify}
                  loading={busy}
                  data-testid="verify-document"
                  variant={doc.status === "VERIFIED" ? "tonal" : "default"}
                  className="rounded-full"
                >
                  <CheckCircle2 /> {doc.status === "VERIFIED" ? t("verifiedState") : t("verify")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
