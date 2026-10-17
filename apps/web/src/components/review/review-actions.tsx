"use client";

import { Ban, MessageSquare, Play, ShieldCheck, UserPlus } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  conflictSchema,
  INFO_REQUEST_TEMPLATES,
  informationRequestSchema,
  overrideConfirmationSchema,
  SLA,
  type DocumentType,
  type SectionKey,
} from "@rebp/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldControl } from "@/components/ui/field";
import { Input, inputClass } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import {
  assignAction,
  declareConflictAction,
  overrideConfirmationAction,
  requestInformationAction,
  startReviewAction,
} from "@/server/actions/backoffice";

/**
 * Console actions (FR-L-001, FR-L-007, FR-BO-002/003): start the review, take an unassigned file,
 * request information (unlocking sections and documents), and declare a conflict and recuse.
 */
export function ReviewActions({
  applicationId,
  selfId,
  canStart,
  canTake,
  canRequest,
  canRecuse,
  sections,
  documents,
}: {
  applicationId: string;
  selfId: string;
  canStart: boolean;
  canTake: boolean;
  canRequest: boolean;
  canRecuse: boolean;
  sections: readonly SectionKey[];
  documents: readonly DocumentType[];
}) {
  const t = useTranslations("review.actions");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(errorMessage(result.error));
      toast.success(success);
      router.refresh();
    });

  if (!canStart && !canTake && !canRequest && !canRecuse) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canTake && (
        <Button
          variant="tonal"
          loading={busy}
          onClick={() => run(() => assignAction({ applicationId, officerId: selfId }), t("taken"))}
        >
          <UserPlus /> {t("take")}
        </Button>
      )}
      {canStart && (
        <Button
          loading={busy}
          onClick={() => run(() => startReviewAction(applicationId), t("started"))}
          data-testid="start-review"
        >
          <Play /> {t("start")}
        </Button>
      )}
      {canRequest && (
        <RequestInfoDialog
          applicationId={applicationId}
          sections={sections}
          documents={documents}
        />
      )}
      {canRecuse && <ConflictDialog applicationId={applicationId} />}
    </div>
  );
}

function RequestInfoDialog({
  applicationId,
  sections,
  documents,
}: {
  applicationId: string;
  sections: readonly SectionKey[];
  documents: readonly DocumentType[];
}) {
  const t = useTranslations("review.request");
  const tr = useTranslations("review");
  const ts = useTranslations("summary");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, submit, pending } = useActionForm({
    schema: informationRequestSchema,
    defaultValues: {
      applicationId,
      template: "missingDocument",
      message: t("templates.missingDocument.message"),
      sections: [],
      documents: [],
      extraDocument: "",
      dueInDays: SLA.informationResponseDays,
    },
    action: (values) =>
      requestInformationAction({ ...values, extraDocument: values.extraDocument || undefined }),
    successMessage: t("sent"),
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  const errors = form.formState.errors;
  const chosenSections = form.watch("sections");
  const chosenDocuments = form.watch("documents");

  const toggle = <T extends string>(
    field: "sections" | "documents",
    list: readonly T[],
    value: T,
    on: boolean,
  ) =>
    form.setValue(field, (on ? [...list, value] : list.filter((v) => v !== value)) as never, {
      shouldValidate: form.formState.isSubmitted,
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="request-information">
          <MessageSquare /> {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Field label={t("template")} error={errors.template?.message}>
            <FieldControl>
              <select
                {...form.register("template", {
                  onChange: (event) => {
                    const previous = form.getValues("message");
                    const known = INFO_REQUEST_TEMPLATES.some(
                      (k) => t(`templates.${k}.message`) === previous,
                    );
                    if (!previous || known)
                      form.setValue(
                        "message",
                        t(`templates.${event.target.value as "custom"}.message`),
                      );
                  },
                })}
                className={cn(inputClass, "bg-card dark:bg-transparent")}
              >
                {INFO_REQUEST_TEMPLATES.map((key) => (
                  <option key={key} value={key}>
                    {t(`templates.${key}.label`)}
                  </option>
                ))}
              </select>
            </FieldControl>
          </Field>
          <Field
            label={t("message")}
            error={errors.message?.message}
            description={t("messageHint")}
          >
            <FieldControl>
              <textarea
                rows={5}
                maxLength={2000}
                {...form.register("message")}
                className={cn(inputClass, "h-auto py-3")}
              />
            </FieldControl>
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("sections")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {sections.map((key) => (
                <label
                  key={key}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm"
                >
                  <Checkbox
                    checked={chosenSections.includes(key)}
                    onCheckedChange={(on) => toggle("sections", chosenSections, key, on === true)}
                  />
                  <span>
                    <span className="font-semibold">{key.toUpperCase()}</span> ·{" "}
                    {ts(`sections.${key}`)}
                  </span>
                </label>
              ))}
            </div>
            {errors.sections?.message && <FieldError error={errors.sections.message} />}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("documents")}</legend>
            <div className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">
              {documents.map((type) => (
                <label
                  key={type}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm"
                >
                  <Checkbox
                    checked={chosenDocuments.includes(type)}
                    onCheckedChange={(on) =>
                      toggle("documents", chosenDocuments, type, on === true)
                    }
                  />
                  {tr.has(`docTypes.${type}`) ? tr(`docTypes.${type}`) : type}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field
              label={t("extraDocument")}
              description={t("extraDocumentHint")}
              error={errors.extraDocument?.message}
            >
              <FieldControl>
                <Input maxLength={200} {...form.register("extraDocument")} />
              </FieldControl>
            </Field>
            <Field label={t("dueInDays")} error={errors.dueInDays?.message}>
              <FieldControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  {...form.register("dueInDays", { valueAsNumber: true })}
                />
              </FieldControl>
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" loading={pending} data-testid="send-information-request">
              <MessageSquare /> {t("send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ error }: { error: string }) {
  const translate = useErrorMessage();
  return (
    <p role="alert" className="text-xs font-medium text-destructive">
      {translate(error)}
    </p>
  );
}

function ConflictDialog({ applicationId }: { applicationId: string }) {
  const t = useTranslations("review.conflict");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, submit, pending } = useActionForm({
    schema: conflictSchema,
    defaultValues: { applicationId, reason: "" },
    action: declareConflictAction,
    successMessage: t("done"),
    onSuccess: () => {
      setOpen(false);
      router.push("/backoffice/queue");
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <Ban /> {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Field label={t("reason")} error={form.formState.errors.reason?.message}>
            <FieldControl>
              <textarea
                rows={4}
                maxLength={2000}
                {...form.register("reason")}
                className={cn(inputClass, "h-auto py-3")}
              />
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button type="submit" variant="destructive" loading={pending}>
              <Ban /> {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** FR-F-007: an officer confirms on the addressee's behalf, with a recorded reason. */
export function ConfirmationOverride({ id, name }: { id: string; name: string }) {
  const t = useTranslations("review.override");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, submit, pending } = useActionForm({
    schema: overrideConfirmationSchema,
    defaultValues: { id, reason: "" },
    action: overrideConfirmationAction,
    successMessage: t("done"),
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldCheck /> {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { name })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Field label={t("reason")} error={form.formState.errors.reason?.message}>
            <FieldControl>
              <textarea
                rows={4}
                maxLength={2000}
                {...form.register("reason")}
                className={cn(inputClass, "h-auto py-3")}
              />
            </FieldControl>
          </Field>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              <ShieldCheck /> {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
