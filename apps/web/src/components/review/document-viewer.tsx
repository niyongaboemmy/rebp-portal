"use client";

import { ChevronLeft, ChevronRight, FileStack, Key, XCircle } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { StatusTone } from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { inputClass } from "@/components/ui/input";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { documentVerdictAction } from "@/server/actions/backoffice";
import { openConsoleTab } from "./console-tabs";
import { DocumentCarousel, type CarouselSlide } from "./document-carousel";
import { LIST_GROUP, LIST_ROW, Mark, type MarkState } from "./marks";

export interface ViewerDocument {
  id: string;
  type: string;
  status: string;
  officerNote: string | null;
  versions: Array<{
    version: number;
    fileName: string;
    mimeType: string;
    size: number;
    scanStatus: string;
    createdAt: string;
    /** The stored file exists (checked on the server, UX-034). */
    available: boolean;
  }>;
}

export const DOCUMENT_STATUS_TONES: Record<string, StatusTone> = {
  SCANNING: "info",
  CLEAN: "neutral",
  INFECTED: "critical",
  REJECTED_FILE: "critical",
  VERIFIED: "good",
  REJECTED: "critical",
};

const UNREVIEWABLE = ["SCANNING", "INFECTED", "REJECTED_FILE"];

const markOf = (status: string): MarkState =>
  status === "VERIFIED"
    ? "done"
    : ["REJECTED", "INFECTED", "REJECTED_FILE"].includes(status)
      ? "failed"
      : "todo";

/** Seconds before the viewer moves on after a verdict. */
const AUTO_NEXT_SECONDS = 5;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Document viewer for the review console (FR-L-003, FR-L-011; UX-034): every document as a list
 * with its verdict — plus required documents never uploaded — and the chosen one in a compact
 * preview. Choosing a document opens the full-screen carousel (arrows, swipe, ← / →, thumbnails,
 * zoom and rotate, the verdict). A file that can't be shown gets a designed state, never a raw
 * error. Keyboard: j / k move, Enter opens the carousel, v verifies, r rejects, ? help.
 */
export function DocumentViewer({
  documents,
  missing = [],
  canVerdict,
  locale,
}: {
  documents: ViewerDocument[];
  /** Required document types with no upload at all. */
  missing?: string[];
  canVerdict: boolean;
  locale: string;
}) {
  const t = useTranslations("review.viewer");
  const tr = useTranslations("review");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [index, setIndex] = useState(0);
  const [version, setVersion] = useState<number | null>(null);
  const [carousel, setCarousel] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [help, setHelp] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [busy, startTransition] = useTransition();

  const label = (type: string) => (tr.has(`docTypes.${type}`) ? tr(`docTypes.${type}`) : type);
  // Uploaded documents first, then the required ones never uploaded (a yellow marker each).
  const total = documents.length + missing.length;
  const slides: CarouselSlide[] = [
    ...documents.map((d, i) => {
      const v = (i === index && d.versions.find((x) => x.version === version)) || d.versions[0]!;
      return {
        key: `${d.id}:${v.version}`,
        label: label(d.type),
        doc: {
          id: d.id,
          status: d.status,
          statusLabel: tr(`docStatus.${d.status}`),
          tone: DOCUMENT_STATUS_TONES[d.status] ?? "neutral",
          mark: markOf(d.status),
          officerNote: d.officerNote,
          version: v.version,
          fileName: v.fileName,
          mimeType: v.mimeType,
          size: v.size,
          createdAt: v.createdAt,
          available: v.available,
          reviewable: !UNREVIEWABLE.includes(d.status),
          unavailableReason: UNREVIEWABLE.includes(d.status)
            ? t(`unavailable.${d.status}`)
            : undefined,
        },
      } satisfies CarouselSlide;
    }),
    ...missing.map((type) => ({ key: `missing:${type}`, label: label(type) })),
  ];
  const slide = slides[Math.min(index, Math.max(0, total - 1))];
  const doc = index < documents.length ? documents[index] : undefined;
  const reviewable = doc ? !UNREVIEWABLE.includes(doc.status) : false;

  const select = useCallback(
    (next: number) => {
      if (total === 0) return;
      setIndex((next + total) % total);
      setVersion(null);
    },
    [total],
  );

  // After the last document: close the viewer and open the next step (the review form).
  const finish = useCallback(() => {
    setCarousel(false);
    openConsoleTab("review", "review-form");
  }, []);

  // Where the countdown goes: the next document (in order), or — at the end — the first one
  // still without a verdict; only when every document has one does it offer the next step.
  const pending = (k: number) =>
    k < documents.length && k !== index && !["VERIFIED", "REJECTED"].includes(documents[k]!.status);
  const target = index < total - 1 ? index + 1 : (documents.map((_, k) => k).find(pending) ?? null);

  // After a verdict: "Next document in 5…", then move on; any other move or closing cancels it.
  const [countdown, setCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (countdown === null) return;
    const timer = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        if (target !== null) select(target);
        else finish();
      } else setCountdown(countdown - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, finish, select, target]);

  const verdict = useCallback(
    (value: "VERIFIED" | "REJECTED", note?: string) => {
      if (!doc) return;
      startTransition(async () => {
        const result = await documentVerdictAction({
          documentId: doc.id,
          verdict: value,
          reason: note,
        });
        if (!result.ok) return void toast.error(errorMessage(result.error));
        toast.success(value === "VERIFIED" ? t("verified") : t("rejected"));
        // A verdict in the viewer: count down 5 s, then the next document — or, after the last
        // one, close and go on to the next step of the review (UX-036).
        if (carousel) setCountdown(AUTO_NEXT_SECONDS);
        setRejecting(false);
        setReason("");
        router.refresh();
      });
    },
    [carousel, doc, errorMessage, router, t],
  );

  // The console's floating button: open the first document still to check (UX-036).
  useEffect(() => {
    const onNext = () => {
      const i = documents.findIndex((d) => !["VERIFIED", "REJECTED"].includes(d.status));
      select(i >= 0 ? i : documents.length);
      setCarousel(true);
    };
    // An evidence chip in the review form: open that document (or its "not uploaded" slide).
    const onOpen = (e: Event) => {
      const type = (e as CustomEvent<string>).detail;
      const i = documents.findIndex((d) => d.type === type);
      const m = missing.indexOf(type);
      if (i < 0 && m < 0) return;
      select(i >= 0 ? i : documents.length + m);
      setCarousel(true);
    };
    window.addEventListener("review-console:next-document", onNext);
    window.addEventListener("review-console:open-document", onOpen);
    return () => {
      window.removeEventListener("review-console:next-document", onNext);
      window.removeEventListener("review-console:open-document", onOpen);
    };
  }, [documents, missing, select]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      const key = event.key;
      if (key === "j") select(index + 1);
      else if (key === "k") select(index - 1);
      else if (key === "Enter" && !isTyping(event.target) && event.target === document.body)
        setCarousel(true);
      else if (key === "?") setHelp(true);
      else if (canVerdict && reviewable && key === "v") verdict("VERIFIED");
      else if (canVerdict && reviewable && key === "r") setRejecting(true);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canVerdict, index, reviewable, select, verdict]);

  if (!slide) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center ring-1 ring-foreground/[0.07] dark:bg-surface-2/50 dark:ring-white/[0.06]">
        <FileStack className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      </div>
    );
  }

  const verifiedCount = documents.filter((d) => d.status === "VERIFIED").length;

  return (
    <div className="flex flex-col gap-3" data-testid="document-viewer">
      {/* Every document with its verdict (FR-L-011): a soft tick when verified, a Sun dot while
          it waits for the officer, red when rejected or blocked. j / k step through them. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {t("verifiedCount", { done: verifiedCount, total: documents.length })}
            {missing.length > 0 && (
              <span className="text-foreground">
                {" · "}
                {t("missingCount", { count: missing.length })}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => select(index - 1)}
              aria-label={t("previous")}
              disabled={total < 2}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => select(index + 1)}
              aria-label={t("next")}
              disabled={total < 2}
            >
              <ChevronRight />
            </Button>
          </span>
        </div>
        <ul aria-label={t("document")} className={LIST_GROUP}>
          {documents.map((d, i) => {
            const active = i === index;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => {
                    select(i);
                    setCarousel(true);
                  }}
                  aria-current={active ? "true" : undefined}
                  aria-haspopup="dialog"
                  data-testid={`viewer-doc-${d.type}`}
                  className={cn(
                    "flex w-full items-center gap-3 text-left outline-none focus-visible:bg-primary/[0.06] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:ring-inset",
                    LIST_ROW,
                    active && carousel && "bg-primary/[0.07] dark:bg-primary/[0.16]",
                  )}
                >
                  <Mark state={markOf(d.status)} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{label(d.type)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {tr(`docStatus.${d.status}`)}
                      {d.versions.length > 1 &&
                        ` · ${t("versionN", { version: d.versions[0]?.version ?? 1 })}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium num text-muted-foreground">
                    {i + 1}/{total}
                  </span>
                </button>
              </li>
            );
          })}
          {/* Required, never uploaded: listed so the officer sees the gap and can ask for it. */}
          {missing.map((type, j) => {
            const i = documents.length + j;
            return (
              <li key={`missing-${type}`}>
                <button
                  type="button"
                  onClick={() => {
                    select(i);
                    setCarousel(true);
                  }}
                  aria-current={i === index ? "true" : undefined}
                  aria-haspopup="dialog"
                  data-testid={`viewer-missing-${type}`}
                  className={cn(
                    "flex w-full items-center gap-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:ring-inset",
                    LIST_ROW,
                    i === index && carousel && "bg-primary/[0.07] dark:bg-primary/[0.16]",
                  )}
                >
                  <span
                    aria-hidden
                    className="missing-mark inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sun text-[0.65rem] font-bold text-sun-foreground"
                  >
                    !
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{label(type)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t("notUploaded")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium num text-muted-foreground">
                    {i + 1}/{total}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* The list is the panel (UX-035): choosing a document opens it in the carousel, where it
          is previewed, compared and verified. */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setHelp(true)}
          aria-label={t("shortcuts")}
        >
          <Key />
        </Button>
      </div>

      <DocumentCarousel
        open={carousel}
        onOpenChange={(open) => {
          setCarousel(open);
          if (!open) setCountdown(null);
        }}
        slides={slides}
        index={Math.min(index, total - 1)}
        onIndex={(i) => {
          setCountdown(null);
          select(i);
        }}
        autoNext={
          countdown === null
            ? null
            : target !== null
              ? {
                  seconds: countdown,
                  total: AUTO_NEXT_SECONDS,
                  label: slides[target]?.label ?? "",
                  goNow: () => {
                    setCountdown(null);
                    select(target);
                  },
                  stay: () => setCountdown(null),
                }
              : {
                  seconds: countdown,
                  total: AUTO_NEXT_SECONDS,
                  label: t("autoNext.nextStep"),
                  finish: true,
                  goNow: () => {
                    setCountdown(null);
                    finish();
                  },
                  stay: () => setCountdown(null),
                }
        }
        locale={locale}
        canVerdict={canVerdict}
        busy={busy}
        onVerify={() => verdict("VERIFIED")}
        onReject={() => setRejecting(true)}
      />

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
            <DialogDescription>
              {t("rejectDescription", { document: slide.label })}
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim().length < 5) return setReasonError("errors.reasonRequired");
              verdict("REJECTED", reason.trim());
            }}
          >
            <Field label={t("reason")} error={reasonError} description={t("reasonHint")}>
              <FieldControl>
                <textarea
                  value={reason}
                  maxLength={500}
                  rows={4}
                  autoFocus
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReasonError(undefined);
                  }}
                  className={cn(inputClass, "h-auto py-3")}
                />
              </FieldControl>
            </Field>
            <DialogFooter>
              <Button type="submit" variant="destructive" loading={busy}>
                <XCircle /> {t("reject")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("shortcuts")}</DialogTitle>
            <DialogDescription>{t("shortcutsHint")}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
            {(
              [
                ["j", "next"],
                ["k", "previous"],
                ["v", "verify"],
                ["r", "reject"],
                ["Enter", "openViewer"],
                ["← / →", "carouselMove"],
                ["+ / −", "zoom"],
                ["?", "shortcuts"],
              ] as const
            ).map(([keys, action]) => (
              <div key={keys} className="contents">
                <dt>
                  <kbd className="inline-flex min-w-8 justify-center rounded-md bg-foreground/[0.05] px-2 py-0.5 font-mono text-xs font-semibold ring-1 ring-foreground/[0.08] dark:bg-white/[0.06] dark:ring-white/[0.08]">
                    {keys}
                  </kbd>
                </dt>
                <dd>{t(action)}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
