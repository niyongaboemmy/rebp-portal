"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Route } from "next";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DOCUMENT_RULES,
  MB,
  PROFILE_DOCUMENT_TYPES,
  type DocumentStatus,
  type DocumentType,
  type StatusTone,
} from "@rebp/contracts";
import {
  Camera,
  Eye,
  FileText,
  Plus,
  PenLine,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "@/components/icons";
import { HoverCard } from "radix-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { removeDocumentAction } from "@/server/actions/applications";
import { useWizard, type WizardDocument } from "./context";
import { DocumentPreview, FileThumb } from "./document-visuals";

const STATUS_TONE: Record<DocumentStatus, StatusTone> = {
  SCANNING: "info",
  CLEAN: "good",
  VERIFIED: "good",
  INFECTED: "critical",
  REJECTED_FILE: "critical",
  REJECTED: "critical",
};

/** FR-DOC-005: shrink large photos before upload (low bandwidth); keeps ≥ 1600 px on the long side. */
export async function compressImage(file: File, keepPng: boolean): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1.5 * MB) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = keepPng && file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.\w+$/, type === "image/png" ? ".png" : ".jpg");
    return new File([blob], name, { type });
  } catch {
    return file;
  }
}

/** FR-DOC-005: several photographed pages become one PDF, in the browser. */
async function imagesToPdf(files: File[]): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await (await compressImage(file, false)).arrayBuffer());
    const image = file.type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([595.28, 841.89]);
    const scale = Math.min((595.28 - 40) / image.width, (841.89 - 40) / image.height, 1);
    page.drawImage(image, {
      x: (595.28 - image.width * scale) / 2,
      y: (841.89 - image.height * scale) / 2,
      width: image.width * scale,
      height: image.height * scale,
    });
  }
  const bytes = await pdf.save();
  return new File([new Uint8Array(bytes)], `pages-${files.length}.pdf`, {
    type: "application/pdf",
  });
}

function upload(
  form: FormData,
  onProgress: (fraction: number) => void,
  endpoint = "/api/documents",
): Promise<
  { ok: true; data: WizardDocument } | { ok: false; error: string; meta?: Record<string, unknown> }
> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error */
      }
      if (xhr.status >= 200 && xhr.status < 300)
        resolve({ ok: true, data: body as unknown as WizardDocument });
      else
        resolve({
          ok: false,
          error: (body.error as string) ?? "errors.unexpected",
          meta: body.meta as Record<string, unknown>,
        });
    };
    xhr.onerror = () => resolve({ ok: false, error: "errors.network" });
    xhr.send(form);
  });
}

/**
 * One checklist item's uploads (FR-I-003, FR-DOC-001…007): status per file, replace (new version)
 * and remove, upload progress, camera capture on phones, compression and multi-page → PDF.
 */
export function DocumentSlot({
  type,
  required = true,
  reason,
  compact = false,
}: {
  type: DocumentType;
  required?: boolean;
  /** Why a conditional document is needed ("a qualification from abroad"). */
  reason?: string;
  compact?: boolean;
}) {
  const t = useTranslations("wizard.documents");
  const ts = useTranslations("wizard.documentStatus");
  const errorMessage = useErrorMessage();
  const { application, documents, setDocuments, canUpload, locale, documentsApi, cv } = useWizard();
  // In an application, identity documents come from the profile (UX-010): shown, not uploaded.
  const fromProfile =
    !documentsApi &&
    application.accountType === "INDIVIDUAL" &&
    PROFILE_DOCUMENT_TYPES.includes(type);
  const rule = DOCUMENT_RULES[type];
  const files = documents.filter((d) => d.type === type);
  const active = files.filter((d) => d.status !== "INFECTED" && d.status !== "REJECTED_FILE");
  const [progress, setProgress] = useState<number | null>(null);
  // Which file is open in the preview (index into the viewable files), or none.
  const [preview, setPreview] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | undefined>(undefined);
  const editable = canUpload(type) && !fromProfile;
  const acceptsPdf = rule.accept.includes("application/pdf");

  async function send(file: File) {
    // Captured now: the ref is cleared when the batch ends, before a slow upload returns.
    const replacing = replaceTarget.current;
    const prepared = await compressImage(file, type === "photo");
    if (prepared.size > rule.maxBytes) {
      toast.error(errorMessage("errors.fileTooLarge", { maxMb: rule.maxBytes / MB }));
      return;
    }
    const form = new FormData();
    if (!documentsApi) form.set("applicationId", application.id);
    form.set("type", type);
    if (replacing) form.set("replaceId", replacing);
    form.set("file", prepared);
    setProgress(0);
    const result = await upload(form, setProgress, documentsApi?.endpoint);
    setProgress(null);
    if (!result.ok) {
      toast.error(errorMessage(result.error, result.meta));
      return;
    }
    const doc: WizardDocument = {
      ...result.data,
      type,
      officerNote: null,
      ...(documentsApi ? { href: `${documentsApi.base}/${result.data.id}` } : {}),
    };
    // A replacement takes the old file's place, whether it kept its id (application documents,
    // a new version) or got a new one (profile documents).
    setDocuments((docs) =>
      replacing
        ? docs.map((d) => (d.id === replacing || d.id === doc.id ? doc : d))
        : [...docs, doc],
    );
    // Profile and CV: sync what the server renders around the form (hero ring, account photo).
    // The application form keeps its documents in its own state and needs no refresh.
    if (documentsApi) router.refresh();
    if (doc.status === "INFECTED") toast.error(t("infected"));
    else if (doc.status === "REJECTED_FILE") toast.error(t("rejectedFile"));
    else toast.success(t("uploaded", { name: doc.fileName }));
  }

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    if (picked.length > 1 && acceptsPdf && picked.every((f) => f.type.startsWith("image/"))) {
      // Several photographed pages of one document → a single PDF (FR-DOC-005).
      await send(await imagesToPdf(picked));
    } else {
      for (const file of picked.slice(0, Math.max(1, rule.maxFiles - active.length)))
        await send(file);
    }
    replaceTarget.current = undefined;
    if (fileInput.current) fileInput.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  }

  function remove(doc: WizardDocument) {
    startTransition(async () => {
      const result = documentsApi
        ? await documentsApi.remove(doc.id)
        : await removeDocumentAction(doc.id);
      if (!result.ok) toast.error(errorMessage(result.error));
      else {
        setDocuments((docs) => docs.filter((d) => d.id !== doc.id));
        if (documentsApi) router.refresh();
      }
    });
  }

  const accept = rule.accept.join(",");
  const full = active.length >= rule.maxFiles;
  const formats = rule.accept.map((m) => m.split("/")[1]!.toUpperCase().replace("JPEG", "JPG"));
  // The row's state is its worst file: a problem first, then checking, then done.
  const worst =
    files.find((d) => STATUS_TONE[d.status] === "critical") ??
    files.find((d) => d.status === "SCANNING") ??
    files[0];
  const single = files.length === 1 ? files[0]! : null;
  const problems = files.filter(
    (d) => d.status === "INFECTED" || d.status === "REJECTED_FILE" || d.status === "REJECTED",
  );
  const total = files.reduce((n, d) => n + d.size, 0);
  const summary = single
    ? `${single.fileName} · ${formatBytes(single.size, locale)}`
    : files.length > 1
      ? `${t("summaryFiles", { count: files.length })} · ${formatBytes(total, locale)}`
      : `${formats.join(", ")} · ${t("details.maxSize", { mb: rule.maxBytes / MB })}`;
  // What's missing gets a small yellow symbol on its icon (UX-024): "!" when required, a dot when
  // optional. Nothing else changes colour, so the page stays calm.
  const empty = files.length === 0 && (editable || fromProfile);
  const missing = required && empty;
  const optionalEmpty = !required && empty;
  const pickReplace = (doc: WizardDocument) => {
    replaceTarget.current = doc.id;
    fileInput.current?.click();
  };

  return (
    <div
      className={cn(
        "group/slot flex min-w-0 flex-col gap-2 rounded-2xl bg-card px-3 py-2.5 ring-1 ring-foreground/[0.06] transition-colors duration-(--dur-2) dark:bg-surface-2/70 dark:ring-white/[0.06]",
        compact && "py-2",
      )}
      data-document-type={type}
      data-missing={missing || undefined}
    >
      {/* One row (UX-008): state, name and a one-line summary; details on hover, focus or tap. */}
      <div className="flex items-center gap-3">
        {/* What it is, or what was uploaded: the photo itself or a page tile. Opens the preview. */}
        {worst && !problems.includes(worst) ? (
          <button
            type="button"
            onClick={() => setPreview(Math.max(0, files.indexOf(worst)))}
            aria-label={t("preview.open", { name: worst.fileName })}
            className="group/thumb relative rounded-lg transition-transform duration-(--dur-2) ease-(--ease-standard) outline-none hover:-translate-y-px focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <FileThumb type={type} doc={worst} stacked={files.length > 1} />
            {/* Preview lives on the thumbnail: an eye on hover and focus. */}
            <span
              aria-hidden
              className="absolute inset-0 grid place-items-center rounded-lg bg-black/45 text-white opacity-0 transition-opacity duration-(--dur-2) group-hover/thumb:opacity-100 group-focus-visible/thumb:opacity-100"
            >
              <Eye className="size-4" />
            </span>
          </button>
        ) : (
          <span className="relative">
            <FileThumb type={type} doc={worst} stacked={files.length > 1} />
            {/* Only a symbol marks what's missing, to keep the page calm (UX-024). */}
            {missing && (
              <span
                title={t("missing")}
                className="missing-mark absolute -top-1 -right-1 inline-flex size-4 items-center justify-center rounded-full bg-sun text-[0.6rem] font-bold text-sun-foreground ring-2 ring-card"
              >
                <span aria-hidden>!</span>
                <span className="sr-only">{t("missing")}</span>
              </span>
            )}
            {optionalEmpty && (
              <span
                title={t("optionalEmpty")}
                className="missing-mark absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-sun ring-2 ring-card"
              >
                <span className="sr-only">{t("optionalEmpty")}</span>
              </span>
            )}
          </span>
        )}
        <DocumentDetails
          name={t(`types.${type}.name`)}
          hint={t(`types.${type}.hint`)}
          conditional={!required}
          reason={reason}
          formats={formats}
          maxMb={rule.maxBytes / MB}
          maxFiles={rule.maxFiles}
          files={files}
          locale={locale}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">
              {t(`types.${type}.name`)}
              {/* On the CV every upload is optional, so nothing to explain there. */}
              {!required && !cv && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({t("conditional")})
                </span>
              )}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {worst && (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 font-semibold",
                    STATUS_TONE[worst.status] === "critical"
                      ? "text-destructive"
                      : worst.status === "SCANNING"
                        ? "text-link"
                        : "text-link",
                  )}
                >
                  <span aria-hidden className="size-1.5 rounded-full bg-current" />
                  {ts(worst.status)}
                  <span aria-hidden className="font-normal text-muted-foreground">
                    ·
                  </span>
                </span>
              )}
              <span className="truncate">{summary}</span>
            </span>
          </span>
        </DocumentDetails>
        <span className="flex shrink-0 items-center gap-0.5">
          {/* With a file: one Edit menu (pencil), each action named (UX-022). */}
          {editable && files.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="tonal"
                  className="rounded-full"
                  disabled={progress !== null}
                  aria-label={t("editFiles", { name: (single ?? files[0])?.fileName ?? "" })}
                >
                  <PenLine aria-hidden />
                  <span className="max-[380px]:sr-only">{t("edit")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {single && (
                  <DropdownMenuItem onSelect={() => pickReplace(single)}>
                    <Upload aria-hidden /> {t("replaceFile")}
                  </DropdownMenuItem>
                )}
                {!full && (!single || rule.maxFiles > 1) && (
                  <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                    <Plus aria-hidden /> {t("addAnother")}
                  </DropdownMenuItem>
                )}
                {!full && (
                  <DropdownMenuItem
                    className="sm:hidden"
                    onSelect={() => cameraInput.current?.click()}
                  >
                    <Camera aria-hidden /> {t("camera")}
                  </DropdownMenuItem>
                )}
                {single && (
                  <DropdownMenuItem
                    onSelect={() => remove(single)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 aria-hidden /> {t("removeFile")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Empty: the upload itself, and the camera on phones. */}
          {editable && files.length === 0 && (
            <>
              <Button
                type="button"
                size="sm"
                variant="tonal"
                className="rounded-full"
                onClick={() => fileInput.current?.click()}
                disabled={progress !== null}
              >
                <Upload aria-hidden /> {t("upload")}
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="sm:hidden"
                onClick={() => cameraInput.current?.click()}
                disabled={progress !== null}
                aria-label={t("camera")}
              >
                <Camera aria-hidden />
              </Button>
            </>
          )}
          {/* Managed on the profile: one link instead of upload actions (UX-010). */}
          {fromProfile && (
            <Link
              href={
                `/settings/profile?next=${encodeURIComponent(
                  `/applications/${application.id}/wizard?step=b`,
                )}` as Route
              }
              className="rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-link hover:bg-primary-soft"
            >
              {t("fromProfile")}
            </Link>
          )}
        </span>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={accept}
        multiple={rule.maxFiles > 1 || acceptsPdf}
        className="sr-only"
        tabIndex={-1}
        aria-label={t("upload")}
        onChange={(e) => void onFiles(e.target.files)}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("camera")}
        onChange={(e) => void onFiles(e.target.files)}
      />

      {progress !== null && (
        <div className="flex items-center gap-3 pl-14" role="status" aria-live="polite">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <span className="text-xs num text-muted-foreground">
            {t("uploading", { percent: Math.round(progress * 100) })}
          </span>
        </div>
      )}

      {/* Several files: one slim chip each, with its own actions. */}
      {files.length > 1 && (
        <ul className="flex flex-wrap gap-1.5 pl-14">
          {files.map((doc) => {
            const blocked = doc.status === "INFECTED" || doc.status === "REJECTED_FILE";
            return (
              <li
                key={doc.id}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-card py-0.5 pr-0.5 pl-2.5 text-xs shadow-[0_1px_2px_oklch(0.3_0.06_264/0.06)] dark:bg-surface-2 dark:shadow-none"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    STATUS_TONE[doc.status] === "critical"
                      ? "bg-destructive"
                      : doc.status === "SCANNING"
                        ? "bg-primary/60"
                        : "bg-primary",
                  )}
                />
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => setPreview(files.indexOf(doc))}
                  className="truncate rounded-full font-medium hover:text-link disabled:cursor-default disabled:hover:text-current"
                  aria-label={t("view", { name: doc.fileName })}
                >
                  {doc.fileName}
                </button>
                <span className="sr-only">{ts(doc.status)}</span>
                {editable && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="size-7 sm:size-7"
                    aria-label={t("remove", { name: doc.fileName })}
                    onClick={() => remove(doc)}
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Problems never hide in the hover card: what happened and what to do, under the row. */}
      {problems.map((doc) => (
        <p key={doc.id} className="flex items-start gap-1.5 pl-14 text-xs text-destructive">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">{doc.fileName}: </span>
            {doc.status === "INFECTED"
              ? t("infected")
              : doc.status === "REJECTED_FILE"
                ? t("rejectedFile")
                : doc.officerNote
                  ? t("officerNote", { note: doc.officerNote })
                  : ts(doc.status)}
          </span>
        </p>
      ))}
      {files.length === 0 && !editable && (
        <p className="pl-14 text-xs text-muted-foreground">{t("noneLocked")}</p>
      )}
      <DocumentPreview
        type={type}
        files={files.filter((d) => d.status !== "INFECTED" && d.status !== "REJECTED_FILE")}
        index={preview}
        onIndex={setPreview}
        onClose={() => setPreview(null)}
        onReplace={editable ? pickReplace : undefined}
        describe={(doc) => `${doc.fileName} · ${formatBytes(doc.size, locale)} · ${ts(doc.status)}`}
      />
    </div>
  );
}

/** Uploaded / verified read in the primary colour (UX-007); problems red; checking blue. */
function StatusChip({
  status,
  label,
  className,
}: {
  status: DocumentStatus;
  label: string;
  className?: string;
}) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        tone === "critical"
          ? "bg-danger-soft text-destructive"
          : tone === "info"
            ? "bg-primary-soft text-link"
            : "bg-primary-soft text-primary-soft-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}

function formatBytes(bytes: number, locale: string) {
  const units = ["B", "KB", "MB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${units[unit]}`;
}

/**
 * The attachment's details in a hover card (UX-008): what it is, what's accepted, and each file
 * with size, version and status. Opens on hover and keyboard focus; a tap toggles it on touch
 * screens. Everything essential (name, status, problems, actions) is also in the row itself.
 */
function DocumentDetails({
  name,
  hint,
  conditional,
  reason,
  formats,
  maxMb,
  maxFiles,
  files,
  locale,
  children,
}: {
  name: string;
  hint: string;
  conditional: boolean;
  reason?: string;
  formats: string[];
  maxMb: number;
  maxFiles: number;
  files: WizardDocument[];
  locale: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("wizard.documents");
  const ts = useTranslations("wizard.documentStatus");
  const [open, setOpen] = useState(false);
  return (
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={250} closeDelay={120}>
      <HoverCard.Trigger asChild>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={t("details.label", { name })}
          className="flex min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          {children}
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 flex w-80 max-w-[calc(100vw-2rem)] origin-(--radix-hover-card-content-transform-origin) animate-in flex-col gap-3 rounded-2xl bg-popover p-4 text-sm text-popover-foreground shadow-[0_24px_60px_-20px_oklch(0.3_0.1_264/0.4)] ring-1 ring-foreground/[0.06] fade-in-0 zoom-in-95 dark:ring-white/[0.08]"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">{name}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>
            {(conditional || reason) && (
              <span className="text-xs font-medium text-link">
                {reason ? t("details.because", { reason }) : t("conditional")}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t("details.formats")}</dt>
            <dd className="font-medium">{formats.join(", ")}</dd>
            <dt className="text-muted-foreground">{t("details.size")}</dt>
            <dd className="font-medium">{t("details.maxSize", { mb: maxMb })}</dd>
            <dt className="text-muted-foreground">{t("details.filesLabel")}</dt>
            <dd className="font-medium">{t("details.maxFiles", { count: maxFiles })}</dd>
          </dl>
          <div className="flex flex-col gap-1.5 border-t border-foreground/[0.06] pt-3 dark:border-white/[0.08]">
            {files.length === 0 ? (
              <span className="text-xs text-muted-foreground">{t("details.none")}</span>
            ) : (
              files.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 text-xs">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{doc.fileName}</span>
                  <span className="shrink-0 num text-muted-foreground">
                    {formatBytes(doc.size, locale)}
                    {doc.version > 1 && ` · v${doc.version}`}
                  </span>
                  <StatusChip status={doc.status} label={ts(doc.status)} />
                </div>
              ))
            )}
          </div>
          <HoverCard.Arrow className="fill-popover" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
