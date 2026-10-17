"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CATEGORIES, CATEGORY_INFO, type Category } from "@rebp/contracts";
import { AlertTriangle, ArrowRight, Clock3, CloudUpload, ListChecks } from "@/components/icons";
import { EligibilityPerson } from "@/components/eligibility/eligibility-person";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { changeCategoryAction } from "@/server/actions/applications";
import { useWizard } from "./context";
import { NativeSelect } from "./fields";

/**
 * Step A (FR-A-001…005, FR-WIZ-002): reference number, application type and category. In a draft
 * the category can change; data that no longer applies is kept and hidden (FR-WIZ-009).
 */
export function StepIntro({ onNext, steps }: { onNext: () => void; steps: number }) {
  const t = useTranslations("wizard.a");
  const tc = useTranslations("categories.items");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { application, flush } = useWizard();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<Category | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const canChange =
    application.status === "DRAFT" &&
    (application.type === "NEW" || application.type === "UPGRADE") &&
    application.category !== "REBF";
  const options = CATEGORIES.filter(
    (c) => c !== application.category && CATEGORY_INFO[c].applicantType === "INDIVIDUAL",
  );

  const change = () =>
    startTransition(async () => {
      if (!next) return;
      await flush();
      const result = await changeCategoryAction({ applicationId: application.id, category: next });
      if (!result.ok) {
        toast.error(errorMessage(result.error, result.meta));
        return;
      }
      toast.success(t("changed", { category: tc(`${next}.name`) }));
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      {/* One compact screen (UX-006): what to expect, the category, and Start. Reference and type
          are in the page header; documents were listed before the application was created. */}
      <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_10%,var(--card)),var(--card))] p-5 sm:p-6 @xl/form:flex-row @xl/form:items-center dark:bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]">
        <EligibilityPerson mood="working" className="w-24 shrink-0 self-center" />
        <div className="flex min-w-0 flex-col gap-3">
          <span className="text-lg leading-tight font-bold">{t("welcome")}</span>
          <ul className="flex flex-wrap gap-2 text-xs font-medium">
            {[
              { icon: ListChecks, text: t("expect.steps", { count: steps }) },
              { icon: Clock3, text: t("expect.time") },
              { icon: CloudUpload, text: t("expect.save") },
            ].map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-2.5 py-1 dark:bg-surface-2"
              >
                <Icon className="size-3.5 text-link" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("category")}</span>
          <span className="font-semibold">{tc(`${application.category}.name`)}</span>
          {canChange && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full px-2 py-0.5 text-xs font-semibold text-link hover:bg-primary-soft"
            >
              {t("change")}
            </button>
          )}
        </span>
        <Button type="button" size="lg" onClick={onNext} className="group">
          {t("start")} <ArrowRight aria-hidden />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("changeTitle")}</DialogTitle>
            <DialogDescription>{t("changeBody")}</DialogDescription>
          </DialogHeader>
          <div className={cn("flex items-start gap-3 rounded-xl bg-primary-soft p-3.5 text-sm")}>
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-link" aria-hidden />
            {t("changeWarning")}
          </div>
          <NativeSelect
            value={next}
            onChange={(v) => setNext(v as Category | undefined)}
            options={options.map((c) => ({ value: c, label: tc(`${c}.name`) }))}
            aria-label={t("newCategory")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={change} loading={pending} disabled={!next}>
              {t("confirmChange")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
