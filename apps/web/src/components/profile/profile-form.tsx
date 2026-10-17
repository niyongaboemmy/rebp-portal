"use client";

import { useTranslations } from "next-intl";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  PROFILE_DOCUMENT_TYPES,
  profileCompletion,
  type SectionB,
  type SectionContext,
} from "@rebp/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudUpload,
  Loader2,
  TriangleAlert,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { removeProfileDocumentAction, saveProfileAction } from "@/server/actions/profile";
import {
  ProfileFormProvider,
  useWizard,
  type Division,
  type DocumentsApi,
  type WizardDocument,
} from "@/components/wizard/context";
import { DocumentSlot } from "@/components/wizard/document-slot";
import { FieldGroup } from "@/components/wizard/fields";
import { useSectionPager, type PagerPage } from "@/components/wizard/section-pager";
import { HeroCompanion, SettingsHero } from "@/components/layout/settings-hero";
import { ProfileAvatar } from "./profile-avatar";
import { ProfileBuddy, type BuddyMood } from "./profile-buddy";
import { SectionPersonal } from "@/components/wizard/sections/personal";
import { NextFieldMarker } from "@/components/wizard/next-field";

/** Profile documents upload and are served under the profile's own routes. */
const DOCUMENTS_API: DocumentsApi = {
  endpoint: "/api/profile/documents",
  base: "/api/profile/documents",
  remove: async (id) => {
    const result = await removeProfileDocumentAction(id);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  },
};

/**
 * The applicant profile (UX-010): personal details entered once and reused by every
 * application. A live completion ring and "still to do" chips (each jumps to its answer), the
 * wizard's own Section B form (same fields, same checks), autosave, and Continue once complete.
 */
export function ProfileForm(props: {
  initial: SectionB;
  context: Pick<SectionContext, "today" | "flags">;
  provinces: Division[];
  locale: string;
  email: string;
  phone: string | null;
  name: string;
  welcome: boolean;
  next: string;
  documents: WizardDocument[];
  /** The settings tabs, rendered under the hero. */
  nav?: ReactNode;
}) {
  const t = useTranslations("profile");
  const save = useCallback(
    async (data: SectionB) => {
      const result = await saveProfileAction(data);
      if (!result.ok) return { ok: false, error: result.error };
      // Each saved change is confirmed (same toast id as a failed save, so it replaces it).
      toast.success(t("savedToast"), { id: "profile-save", description: t("savedToastBody") });
      return { ok: true };
    },
    [t],
  );
  return (
    <ProfileFormProvider
      initial={props.initial}
      context={props.context}
      provinces={props.provinces}
      locale={props.locale}
      email={props.email}
      phone={props.phone}
      signatoryName={props.name}
      save={save}
      documents={props.documents}
      documentsApi={DOCUMENTS_API}
    >
      <ProfileBody
        welcome={props.welcome}
        next={props.next}
        context={props.context}
        nav={props.nav}
      />
    </ProfileFormProvider>
  );
}

function ProfileBody({
  welcome,
  next,
  context,
  nav,
}: {
  welcome: boolean;
  next: string;
  context: Pick<SectionContext, "today" | "flags">;
  nav?: ReactNode;
}) {
  const t = useTranslations("profile");
  const router = useRouter();
  const { data, saveState, flush, attempt, documents, issues } = useWizard();
  // Identity documents count too: a clean file of each (UX-010).
  const present = Object.fromEntries(
    PROFILE_DOCUMENT_TYPES.map((type) => [
      type,
      documents.some(
        (d) => d.type === type && d.status !== "INFECTED" && d.status !== "REJECTED_FILE",
      ),
    ]),
  );
  const completion = profileCompletion(data.b, context, present);
  const detailsComplete = profileCompletion(data.b, context).complete;
  const [leaving, setLeaving] = useState(false);

  // A new or removed photo: refresh the server-rendered shell so the account menu shows it (UX-015).
  const photoId = documents.find((d) => d.type === "photo")?.id ?? null;
  const shownPhoto = useRef(photoId);
  useEffect(() => {
    if (shownPhoto.current === photoId) return;
    shownPhoto.current = photoId;
    router.refresh();
  }, [photoId, router]);

  // The companion acts out where the profile stands (UX-012), and hops when an answer lands.
  const mood: BuddyMood =
    saveState === "error"
      ? "worried"
      : completion.complete
        ? "celebrate"
        : detailsComplete
          ? "documents"
          : completion.percent < 25 || (welcome && completion.percent < 50)
            ? "wave"
            : "write";
  const bubble = t(`buddy.${mood as "wave"}`, { left: completion.missing.length });
  const [hop, setHop] = useState(0);
  const [seen, setSeen] = useState(completion.done);
  if (seen !== completion.done) {
    setSeen(completion.done);
    if (completion.done > seen) setHop((n) => n + 1);
  }

  // One topic per step (UX-011): the wizard's own pager over the same form.
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const pager = useSectionPager(root, "profile", true);
  const open = issues("b");
  const missingOn = (page: PagerPage) =>
    page.has("[data-document-type]")
      ? PROFILE_DOCUMENT_TYPES.filter((type) => !present[type]).length
      : Object.keys(open).filter((path) => page.owns(path)).length;

  const goTo = (index: number) => {
    // Once the applicant moves between steps, what's missing is highlighted at each field.
    attempt("b");
    pager.goTo(index);
    requestAnimationFrame(() =>
      card.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  };

  // Tapping the companion: a hop, and a jump to the first step with something missing.
  const react = () => {
    setHop((n) => n + 1);
    const first = pager.pages.findIndex((page) => missingOn(page) > 0);
    if (!completion.complete && first >= 0) goTo(first);
  };

  const proceed = async () => {
    if (!detailsComplete) {
      // Take the applicant to the first step with something missing.
      const first = pager.pages.findIndex((page) => missingOn(page) > 0);
      goTo(first < 0 ? 0 : first);
      return;
    }
    setLeaving(true);
    if ((await flush()) === false) return setLeaving(false);
    router.push(next as Route);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* The account pages' shared hero (UX-012/013): the photo in its completion ring, where
          the profile stands, and a companion who acts it out — tap it to jump to what's missing. */}
      <SettingsHero
        avatar={
          <ProfileAvatar
            percent={completion.percent}
            label={t("progress", { percent: completion.percent })}
          />
        }
        title={completion.complete ? t("completeTitle") : welcome ? t("welcomeTitle") : t("title")}
        description={
          completion.complete ? t("completeBody") : t("left", { left: completion.missing.length })
        }
        meta={<SaveState state={saveState} className="self-start" />}
        companion={
          <HeroCompanion
            bubble={bubble}
            label={completion.complete ? bubble : `${bubble}. ${t("buddy.action")}`}
            tone={mood === "worried" ? "danger" : "default"}
            onClick={react}
          >
            <ProfileBuddy mood={mood} saving={saveState === "saving"} hop={hop} />
          </HeroCompanion>
        }
      />

      {nav}

      <section
        ref={card}
        aria-label={t("formLabel")}
        className="glass @container/form flex scroll-mt-24 flex-col gap-6 rounded-[1.75rem] p-5 ring-1 ring-primary/[0.08] sm:p-8 dark:ring-white/[0.06]"
      >
        {/* Steps: done (tick), current, or what's missing (a red count). */}
        <ol
          aria-label={t("steps")}
          className="-mx-1 -my-1 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-1 py-1"
        >
          {pager.pages.map((page, index) => {
            const missing = missingOn(page);
            const current = index === pager.page;
            return (
              <li key={index} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={current ? "step" : undefined}
                  aria-label={
                    missing > 0
                      ? `${page.title}: ${t("missingCount", { count: missing })}`
                      : `${page.title}: ${t("stepDone")}`
                  }
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full pr-3.5 pl-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-(--dur-2)",
                    // Selected is a soft primary tint and edge, not a solid fill (UX-031).
                    current
                      ? "bg-primary/[0.07] font-semibold text-foreground ring-1 ring-primary/35 dark:bg-primary/[0.14] dark:ring-primary/45"
                      : "text-muted-foreground ring-1 ring-foreground/[0.07] hover:bg-primary/[0.04] hover:text-foreground dark:ring-white/[0.07] dark:hover:bg-surface-3/60",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs font-bold num",
                      missing > 0
                        ? "bg-destructive text-white"
                        : current
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary-soft text-link dark:bg-primary/15",
                    )}
                  >
                    {missing > 0 ? missing : <Check className="size-3.5" strokeWidth={2.5} />}
                  </span>
                  {page.title}
                </button>
              </li>
            );
          })}
        </ol>

        <NextFieldMarker issues={open} />
        <div ref={root} className={cn(!pager.ready && "invisible")}>
          <SectionPersonal
            withDocuments={false}
            extra={
              // Uploaded once here; every application gets its own copy (UX-010).
              <FieldGroup title={t("documentsTitle")} description={t("documentsHint")}>
                <div className="grid grid-cols-1 gap-3 @2xl/form:grid-cols-2">
                  {PROFILE_DOCUMENT_TYPES.map((type) => (
                    <DocumentSlot key={type} type={type} />
                  ))}
                </div>
              </FieldGroup>
            }
          />
        </div>

        <footer className="sticky bottom-[calc(var(--bottom-nav-h,0px)+0.75rem)] z-20 -mx-2 flex items-center justify-between gap-3 rounded-full bg-card/85 p-1.5 shadow-[0_16px_40px_-14px_oklch(0.3_0.12_264/0.45)] ring-1 ring-foreground/[0.04] backdrop-blur-xl @4xl/main:static @4xl/main:mx-0 dark:bg-[oklch(0.22_0.02_265/0.88)] dark:ring-white/[0.06]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => goTo(pager.page - 1)}
            disabled={pager.isFirst}
            className="group rounded-full"
          >
            <ArrowLeft aria-hidden className="transition-transform group-hover:-translate-x-0.5" />{" "}
            {t("back")}
          </Button>
          <span className="text-xs num text-muted-foreground max-sm:hidden">
            {t("stepOf", { current: pager.page + 1, total: Math.max(1, pager.count) })}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Saves at once on any step (autosave also runs after a pause). */}
            <Button
              type="button"
              variant="tonal"
              onClick={() => void flush()}
              disabled={saveState === "saved" || saveState === "saving"}
              loading={saveState === "saving"}
              className="rounded-full"
            >
              {saveState === "saved" ? <Check aria-hidden /> : <CloudUpload aria-hidden />}
              <span>{saveState === "saved" ? t("savedButton") : t("saveChanges")}</span>
            </Button>
            {pager.isLast ? (
              <Button
                type="button"
                onClick={() => void proceed()}
                loading={leaving}
                className="group rounded-full"
              >
                {detailsComplete ? t("continue") : t("finish")}
                <ArrowRight
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => goTo(pager.page + 1)}
                className="group rounded-full"
              >
                {t("next")}
                <ArrowRight
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

export function SaveState({
  state,
  className,
}: {
  state: "idle" | "saving" | "saved" | "error";
  className?: string;
}) {
  const t = useTranslations("wizard.save");
  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium",
        state === "error" ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {state === "saving" ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : state === "saved" ? (
        <Check className="size-3.5 text-link" aria-hidden />
      ) : state === "error" ? (
        <TriangleAlert className="size-3.5" aria-hidden />
      ) : (
        <CloudUpload className="size-3.5" aria-hidden />
      )}
      {t(state)}
    </span>
  );
}
