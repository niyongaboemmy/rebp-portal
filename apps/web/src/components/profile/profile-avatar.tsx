"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Eye, Loader2, RefreshCw, Trash2 } from "@/components/icons";
import { ProgressRing } from "@/components/data/progress-ring";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { removeProfileDocumentAction } from "@/server/actions/profile";
import { useWizard, type WizardDocument } from "@/components/wizard/context";
import { compressImage } from "@/components/wizard/document-slot";
import { DocumentPreview, fileUrl } from "@/components/wizard/document-visuals";

/**
 * The profile photo inside the completion ring (UX-011): the applicant's passport photo — the same
 * file every application reuses — framed by how complete the profile is. Click to add, preview,
 * change or remove it.
 */
export function ProfileAvatar({ percent, label }: { percent: number; label: string }) {
  const t = useTranslations("profile.photo");
  const errorMessage = useErrorMessage();
  const { documents, setDocuments, locale } = useWizard();
  const photo = documents.find(
    (d) => d.type === "photo" && d.status !== "INFECTED" && d.status !== "REJECTED_FILE",
  );
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const prepared = await compressImage(file, true);
      const form = new FormData();
      form.set("type", "photo");
      if (photo) form.set("replaceId", photo.id);
      form.set("file", prepared);
      const response = await fetch("/api/profile/documents", { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        toast.error(errorMessage((body.error as string) ?? "errors.unexpected", body));
        return;
      }
      const doc = {
        ...(body as unknown as WizardDocument),
        type: "photo",
        officerNote: null,
        href: `/api/profile/documents/${body.id as string}`,
      } as WizardDocument;
      setLoaded(false);
      setDocuments((docs) => [...docs.filter((d) => d.id !== photo?.id), doc]);
      toast.success(t("saved"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (!photo) return;
    const result = await removeProfileDocumentAction(photo.id);
    if (!result.ok) return void toast.error(errorMessage(result.error));
    setDocuments((docs) => docs.filter((d) => d.id !== photo.id));
    toast.success(t("removed"));
  }

  // The ring and the photo are layered: the ring fills the frame, the photo sits inset, so the
  // progress arc always shows around it.
  const ring = (
    <span className="relative block size-20 @md/main:size-24 @3xl/main:size-28">
      <ProgressRing
        value={percent}
        total={100}
        thickness={3}
        className="absolute inset-0 size-full"
        label={label}
      />
      {/* The ring's arc sits at 36% of the frame from its centre; the photo stops just inside it. */}
      <span className="absolute inset-[15%] overflow-hidden rounded-full bg-primary-soft">
        {photo ? (
          <>
            {!loaded && <span className="absolute inset-0 animate-pulse bg-foreground/[0.06]" />}
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised, per-user file */}
            <img
              src={fileUrl(photo)}
              alt=""
              // A server-rendered image can finish loading before hydration attaches onLoad.
              ref={(img) => {
                if (img?.complete && img.naturalWidth > 0) setLoaded(true);
              }}
              onLoad={() => setLoaded(true)}
              className={cn(
                "size-full object-cover transition-opacity duration-(--dur-3)",
                loaded ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-primary-soft-foreground">
            <Camera className="size-5 @md/main:size-6" aria-hidden />
            <span className="text-[0.6rem] font-semibold @max-md/main:sr-only">{t("add")}</span>
          </span>
        )}
        {/* Hover/focus: the action is a camera over the photo. */}
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity duration-(--dur-2) group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </span>
    </span>
  );

  return (
    <div className="relative shrink-0">
      {photo ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("menu")}
            className="group/avatar rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            {ring}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setPreview(0)}>
              <Eye aria-hidden /> {t("preview")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => input.current?.click()}>
              <RefreshCw aria-hidden /> {t("change")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void remove()} className="text-destructive">
              <Trash2 aria-hidden /> {t("remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={t("add")}
          className="group/avatar rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          {ring}
        </button>
      )}
      {/* The completion rate, as a badge on the ring. */}
      <span
        aria-hidden
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold num text-primary-foreground shadow-[0_4px_10px_-4px_var(--primary)]"
      >
        {percent}%
      </span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("change")}
        onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
      />
      {photo && (
        <DocumentPreview
          type="photo"
          files={[photo]}
          index={preview}
          onIndex={setPreview}
          onClose={() => setPreview(null)}
          onReplace={() => input.current?.click()}
          describe={(doc) =>
            `${doc.fileName} · ${new Intl.NumberFormat(locale).format(Math.round(doc.size / 1024))} KB`
          }
        />
      )}
    </div>
  );
}
