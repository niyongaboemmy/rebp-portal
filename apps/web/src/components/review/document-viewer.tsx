"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileStack,
  FileText,
  Key,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "@/components/icons";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { useErrorMessage } from "@/hooks/use-error-message";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { documentVerdictAction } from "@/server/actions/backoffice";

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
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Document viewer for the review console (FR-L-003, FR-L-011): inline PDF or image preview with
 * zoom and rotate, version history, a watermarked download, and a Verify / Reject verdict per
 * document. Keyboard: j / k move between documents, v verifies, r rejects, + / − zoom, ? help.
 */
export function DocumentViewer({
  documents,
  canVerdict,
  locale,
}: {
  documents: ViewerDocument[];
  canVerdict: boolean;
  locale: string;
}) {
  const t = useTranslations("review.viewer");
  const tr = useTranslations("review");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [index, setIndex] = useState(0);
  const [version, setVersion] = useState<number | null>(null);
  const [zoom, setZoom] = useState(2);
  const [rotation, setRotation] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [help, setHelp] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [busy, startTransition] = useTransition();

  const doc = documents[Math.min(index, documents.length - 1)];
  const current = doc?.versions.find((v) => v.version === version) ?? doc?.versions[0];
  const isImage = current?.mimeType.startsWith("image/") ?? false;
  const reviewable = doc ? !UNREVIEWABLE.includes(doc.status) : false;
  const src = doc && current ? `/api/documents/${doc.id}?v=${current.version}` : "";

  const select = useCallback(
    (next: number) => {
      if (documents.length === 0) return;
      setIndex((next + documents.length) % documents.length);
      setVersion(null);
      setZoom(2);
      setRotation(0);
    },
    [documents.length],
  );

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
        setRejecting(false);
        setReason("");
        router.refresh();
      });
    },
    [doc, errorMessage, router, t],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      const key = event.key;
      if (key === "j") select(index + 1);
      else if (key === "k") select(index - 1);
      else if (key === "+" || key === "=") setZoom((z) => Math.min(ZOOMS.length - 1, z + 1));
      else if (key === "-") setZoom((z) => Math.max(0, z - 1));
      else if (key === "?") setHelp(true);
      else if (canVerdict && reviewable && key === "v") verdict("VERIFIED");
      else if (canVerdict && reviewable && key === "r") setRejecting(true);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canVerdict, index, reviewable, select, verdict]);

  if (!doc || !current) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-2 px-6 py-12 text-center">
        <FileStack className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      </div>
    );
  }

  const label = (type: string) => (tr.has(`docTypes.${type}`) ? tr(`docTypes.${type}`) : type);

  return (
    <div className="flex flex-col gap-3" data-testid="document-viewer">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => select(index - 1)}
          aria-label={t("previous")}
          disabled={documents.length < 2}
        >
          <ChevronLeft />
        </Button>
        <label className="sr-only" htmlFor="viewer-document">
          {t("document")}
        </label>
        <select
          id="viewer-document"
          value={index}
          onChange={(e) => select(Number(e.target.value))}
          className={cn(inputClass, "h-11 min-w-0 flex-1 bg-card sm:h-10 dark:bg-transparent")}
        >
          {documents.map((d, i) => (
            <option key={d.id} value={i}>
              {i + 1}/{documents.length} · {label(d.type)} · {tr(`docStatus.${d.status}`)}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => select(index + 1)}
          aria-label={t("next")}
          disabled={documents.length < 2}
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          tone={DOCUMENT_STATUS_TONES[doc.status] ?? "neutral"}
          label={tr(`docStatus.${doc.status}`)}
        />
        <span
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          title={current.fileName}
        >
          {current.fileName} · {Math.max(1, Math.round(current.size / 1024))} KB ·{" "}
          {formatDateTime(current.createdAt, locale)}
        </span>
        {doc.versions.length > 1 && (
          <>
            <label className="sr-only" htmlFor="viewer-version">
              {t("version")}
            </label>
            <select
              id="viewer-version"
              value={current.version}
              onChange={(e) => setVersion(Number(e.target.value))}
              className={cn(inputClass, "h-11 w-auto bg-card sm:h-9 dark:bg-transparent")}
            >
              {doc.versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {t("versionN", { version: v.version })}
                  {v.version === doc.versions[0]?.version ? ` · ${t("latest")}` : ""}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {doc.officerNote && (
        <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm">
          <span className="font-semibold">{t("rejectionReason")}: </span>
          {doc.officerNote}
        </p>
      )}

      <div className="relative overflow-hidden rounded-2xl bg-surface-2">
        {!reviewable ? (
          <div className="flex h-[min(70dvh,40rem)] flex-col items-center justify-center gap-3 p-6 text-center">
            <ShieldAlert className="size-8 text-muted-foreground" aria-hidden />
            <p className="max-w-xs text-sm text-muted-foreground">
              {t(`unavailable.${doc.status}`)}
            </p>
          </div>
        ) : isImage ? (
          <div className="flex h-[min(70dvh,40rem)] items-center justify-center overflow-auto p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised, streamed file; not optimisable */}
            <img
              src={src}
              alt={label(doc.type)}
              className="max-h-full max-w-full origin-center object-contain transition-transform duration-(--dur-3)"
              style={{ transform: `scale(${ZOOMS[zoom]}) rotate(${rotation}deg)` }}
            />
          </div>
        ) : (
          <iframe
            key={src}
            src={src}
            title={label(doc.type)}
            className="block h-[min(70dvh,40rem)] w-full bg-card"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isImage && reviewable && (
          <div className="flex items-center gap-1" role="group" aria-label={t("imageTools")}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setZoom((z) => Math.max(0, z - 1))}
              aria-label={t("zoomOut")}
            >
              <ZoomOut />
            </Button>
            <span className="w-12 text-center text-xs font-semibold num" aria-live="polite">
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
              onClick={() => setRotation((r) => r - 90)}
              aria-label={t("rotateLeft")}
            >
              <RotateCcw />
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
        <Button asChild variant="ghost" size="sm">
          <a href={`/api/documents/${doc.id}?v=${current.version}&download=1`} download>
            <Download /> {t("download")}
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={src} target="_blank" rel="noreferrer">
            <FileText /> {t("open")}
          </a>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setHelp(true)}
          aria-label={t("shortcuts")}
          className="ml-auto"
        >
          <Key />
        </Button>
      </div>

      {canVerdict && reviewable && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={doc.status === "VERIFIED" ? "tonal" : "default"}
            onClick={() => verdict("VERIFIED")}
            loading={busy}
            data-testid="verify-document"
          >
            <CheckCircle2 /> {doc.status === "VERIFIED" ? t("verifiedState") : t("verify")}
          </Button>
          <Button variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
            <XCircle /> {t("reject")}
          </Button>
        </div>
      )}

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
            <DialogDescription>
              {t("rejectDescription", { document: label(doc.type) })}
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
                ["+ / −", "zoom"],
                ["?", "shortcuts"],
              ] as const
            ).map(([keys, action]) => (
              <div key={keys} className="contents">
                <dt>
                  <kbd className="inline-flex min-w-8 justify-center rounded-md border bg-surface-2 px-2 py-0.5 font-mono text-xs font-semibold">
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
