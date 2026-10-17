"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CV_SECTIONS,
  cvCompletion,
  type Cv,
  type CvSection,
  type SectionContext,
} from "@rebp/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CloudUpload,
  GraduationCap,
  Award,
} from "@/components/icons";
import { HeroCompanion, SettingsHero } from "@/components/layout/settings-hero";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { removeProfileDocumentAction, saveCvAction } from "@/server/actions/profile";
import {
  CvFormProvider,
  useWizard,
  type DocumentsApi,
  type WizardDocument,
} from "@/components/wizard/context";
import { focusField } from "@/components/wizard/focus";
import { SectionEducation } from "@/components/wizard/sections/education";
import { SectionExperience } from "@/components/wizard/sections/experience";
import { SectionTraining } from "@/components/wizard/sections/training";
import { AccountAvatar } from "./account-avatar";
import { CvPreview, type CvPerson } from "./cv-preview";
import { ProfileBuddy, type BuddyMood } from "./profile-buddy";
import { SaveState } from "./profile-form";
import { NextFieldMarker } from "@/components/wizard/next-field";

const DOCUMENTS_API: DocumentsApi = {
  endpoint: "/api/profile/documents",
  base: "/api/profile/documents",
  remove: async (id) => {
    const result = await removeProfileDocumentAction(id);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  },
};

const ICONS = { c: GraduationCap, d: Award, e: Briefcase } as const;

/**
 * The applicant's CV (UX-018): education, training and experience entered once, reused by every
 * application. The wizard's own sections edit it (same fields and checks); beside them, the CV
 * as an officer would read it, updating as the applicant types.
 */
export function CvEditor(props: {
  initial: Cv;
  context: Pick<SectionContext, "today" | "flags">;
  locale: string;
  email: string;
  phone: string | null;
  name: string;
  documents: WizardDocument[];
  person: CvPerson;
  avatar: { percent: number | null; photoHref: string | null; label: string };
  nav?: ReactNode;
  /** Opened at a part, focusing an answer, from somewhere to go back to (UX-021). */
  part?: CvSection;
  focus?: string;
  next?: string;
}) {
  const t = useTranslations("cv");
  const save = useCallback(
    async (section: CvSection, data: unknown) => {
      const result = await saveCvAction(section, data);
      if (!result.ok) return { ok: false, error: result.error };
      toast.success(t("savedToast"), { id: "cv-save", description: t("savedToastBody") });
      return { ok: true };
    },
    [t],
  );
  return (
    <CvFormProvider
      initial={props.initial}
      context={props.context}
      locale={props.locale}
      email={props.email}
      phone={props.phone}
      signatoryName={props.name}
      save={save}
      documents={props.documents}
      documentsApi={DOCUMENTS_API}
    >
      <CvBody
        person={props.person}
        avatar={props.avatar}
        nav={props.nav}
        today={props.context.today}
        part={props.part}
        focus={props.focus}
        next={props.next}
      />
    </CvFormProvider>
  );
}

function CvBody({
  person,
  avatar,
  nav,
  today,
  part,
  focus,
  next,
}: {
  person: CvPerson;
  avatar: { percent: number | null; photoHref: string | null; label: string };
  nav?: ReactNode;
  today: string;
  part?: CvSection;
  focus?: string;
  next?: string;
}) {
  const t = useTranslations("cv");
  const { data, saveState, flush, attempt, documents, issues } = useWizard();
  const cv = data as Cv;
  const completion = cvCompletion(cv, today);
  const [section, setSection] = useState<CvSection>(part ?? "c");
  // Sent to one answer: show it, once the part has rendered.
  useEffect(() => {
    if (!focus) return;
    const id = setTimeout(() => focusField(focus), 300);
    return () => clearTimeout(id);
  }, [focus]);
  const card = useRef<HTMLElement>(null);
  const index = CV_SECTIONS.indexOf(section);
  const left = CV_SECTIONS.reduce((n, key) => n + completion.missing[key], 0);

  const goTo = (next: CvSection) => {
    // Leaving a section highlights what's missing there.
    attempt(section);
    setSection(next);
    requestAnimationFrame(() =>
      card.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  };

  const mood: BuddyMood =
    saveState === "error"
      ? "worried"
      : completion.complete
        ? "celebrate"
        : completion.done === 0 && left === 0
          ? "wave"
          : "write";
  const bubble = t(`buddy.${mood as "wave"}`, { left });
  const firstOpen = CV_SECTIONS.find((key) => completion.missing[key] > 0);

  return (
    <div className="flex flex-col gap-5">
      <SettingsHero
        avatar={
          <AccountAvatar
            name={person.name}
            percent={avatar.percent}
            photoHref={avatar.photoHref}
            label={avatar.label}
          />
        }
        title={completion.complete ? t("completeTitle") : t("title")}
        description={completion.complete ? t("completeBody") : t("subtitle")}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <SaveState state={saveState} />
            {/* The way back to the application that sent the applicant here. */}
            {next && (
              <Link
                href={next as Route}
                onClick={() => void flush()}
                className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-[0_6px_14px_-8px_var(--primary)]"
              >
                <ArrowLeft
                  className="size-3.5 transition-transform group-hover:-translate-x-0.5"
                  aria-hidden
                />
                {t("backToApplication")}
              </Link>
            )}
          </div>
        }
        companion={
          <HeroCompanion
            bubble={bubble}
            label={firstOpen ? `${bubble}. ${t("buddy.action")}` : bubble}
            tone={mood === "worried" ? "danger" : "default"}
            onClick={() => firstOpen && goTo(firstOpen)}
          >
            <ProfileBuddy mood={mood} saving={saveState === "saving"} />
          </HeroCompanion>
        }
      />

      {nav}

      <div className="grid items-start gap-5 @5xl/main:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section
          ref={card}
          aria-label={t("editorLabel")}
          className="glass @container/form flex scroll-mt-24 flex-col gap-6 rounded-[1.75rem] p-5 ring-1 ring-primary/[0.08] sm:p-8 dark:ring-white/[0.06]"
        >
          {/* The CV's three parts: done, what's open, or not started. */}
          <ol aria-label={t("sectionsLabel")} className="grid grid-cols-3 gap-1.5">
            {CV_SECTIONS.map((key) => {
              const Icon = ICONS[key];
              const missing = completion.missing[key];
              const current = key === section;
              const started = Boolean(cv[key]);
              const done = started && missing === 0;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => goTo(key)}
                    aria-current={current ? "step" : undefined}
                    aria-label={`${t(`sections.${key}`)}: ${
                      done
                        ? t("sectionDone")
                        : missing > 0
                          ? t("sectionMissing", { count: missing })
                          : t("sectionEmpty")
                    }`}
                    className={cn(
                      "flex w-full flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-xs font-semibold transition-[background-color,color,box-shadow] duration-(--dur-2) sm:flex-row sm:px-3 sm:text-left sm:text-sm",
                      // Selected is a soft primary tint and edge, not a solid fill (UX-031).
                      current
                        ? "bg-primary/[0.07] text-foreground ring-1 ring-primary/35 dark:bg-primary/[0.14] dark:ring-primary/45"
                        : "text-muted-foreground ring-1 ring-foreground/[0.07] hover:bg-primary/[0.04] hover:text-foreground dark:ring-white/[0.07] dark:hover:bg-surface-3/60",
                    )}
                  >
                    <span
                      className={cn(
                        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                        current
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary-soft text-link dark:bg-primary/15",
                      )}
                    >
                      <Icon className="size-[1.1rem]" aria-hidden />
                      {(done || missing > 0) && (
                        <span
                          aria-hidden
                          className={cn(
                            "absolute -top-1 -right-1 inline-flex size-4 items-center justify-center rounded-full text-[0.6rem] font-bold num ring-2",
                            "ring-card",
                            done
                              ? "bg-primary-soft text-link dark:bg-surface-3"
                              : "bg-destructive text-white",
                          )}
                        >
                          {done ? <Check className="size-2.5" strokeWidth={2.5} /> : missing}
                        </span>
                      )}
                    </span>
                    <span className="leading-tight">{t(`sections.${key}`)}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <NextFieldMarker issues={issues(section)} />
          <div key={section} className="animate-rise [animation-duration:var(--dur-3)]">
            {section === "c" ? (
              <SectionEducation />
            ) : section === "d" ? (
              <SectionTraining />
            ) : (
              <SectionExperience />
            )}
          </div>

          <footer className="sticky bottom-[calc(var(--bottom-nav-h,0px)+0.75rem)] z-20 -mx-2 flex items-center justify-between gap-2 rounded-full bg-card/85 p-1.5 shadow-[0_16px_40px_-14px_oklch(0.3_0.12_264/0.45)] ring-1 ring-foreground/[0.04] backdrop-blur-xl @4xl/main:static @4xl/main:mx-0 dark:bg-[oklch(0.22_0.02_265/0.88)] dark:ring-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              disabled={index === 0}
              onClick={() => goTo(CV_SECTIONS[index - 1]!)}
              className="group rounded-full"
            >
              <ArrowLeft
                aria-hidden
                className="transition-transform group-hover:-translate-x-0.5"
              />
              {t("back")}
            </Button>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="tonal"
                onClick={() => void flush()}
                disabled={saveState === "saved" || saveState === "saving"}
                loading={saveState === "saving"}
                className="rounded-full"
              >
                {saveState === "saved" ? <Check aria-hidden /> : <CloudUpload aria-hidden />}
                {saveState === "saved" ? t("savedButton") : t("saveChanges")}
              </Button>
              {index < CV_SECTIONS.length - 1 && (
                <Button
                  type="button"
                  onClick={() => goTo(CV_SECTIONS[index + 1]!)}
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

        <CvPreview cv={cv} person={person} documents={documents} onSection={goTo} />
      </div>
    </div>
  );
}
