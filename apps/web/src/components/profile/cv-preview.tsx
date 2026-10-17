"use client";

import { useTranslations } from "next-intl";
import { CV_DOCUMENT_TYPES, DOCUMENT_RULES, type Cv, type CvSection } from "@rebp/contracts";
import { Mail, Paperclip, Phone, UserRound } from "@/components/icons";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useWizard, type WizardDocument } from "@/components/wizard/context";

export interface CvPerson {
  name: string;
  occupation?: string;
  email: string;
  phone: string | null;
  photoHref: string | null;
}

/**
 * The CV as an officer reads it (UX-018): who, then education, training and exams, and
 * experience as short timelines, newest first, with how many supporting files each part has.
 * Updates as the applicant types; "Edit" on a part opens it in the editor.
 */
export function CvPreview({
  cv,
  person,
  documents,
  onSection,
}: {
  cv: Cv;
  person: CvPerson;
  documents: WizardDocument[];
  onSection: (section: CvSection) => void;
}) {
  const t = useTranslations("cv.preview");
  const tc = useTranslations("wizard.c");
  const td = useTranslations("wizard.d");
  const te = useTranslations("wizard.e");
  const { locale } = useWizard();
  const day = (value?: string) => (value ? formatDay(value, locale) : "");
  const files = (section: CvSection) =>
    documents.filter(
      (d) =>
        CV_DOCUMENT_TYPES.includes(d.type) &&
        DOCUMENT_RULES[d.type].step === section &&
        d.status !== "INFECTED" &&
        d.status !== "REJECTED_FILE",
    ).length;

  const qualifications = [...(cv.c?.qualifications ?? [])].sort(
    (a, b) => (b.yearCompleted ?? 0) - (a.yearCompleted ?? 0),
  );
  const records = [...(cv.e?.records ?? [])].sort((a, b) =>
    (b.from ?? "").localeCompare(a.from ?? ""),
  );
  const d = cv.d ?? {};

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col overflow-hidden rounded-[1.75rem] bg-card shadow-[0_1px_2px_oklch(0.3_0.08_264/0.06),0_20px_50px_-32px_oklch(0.35_0.15_264/0.45)] @5xl/main:sticky @5xl/main:top-24 dark:shadow-none dark:ring-1 dark:ring-white/[0.06]"
    >
      {/* Who: photo, name, occupation and how to reach them. */}
      <header className="flex items-center gap-4 bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_12%,var(--card)),var(--card))] p-5 dark:bg-[linear-gradient(140deg,color-mix(in_oklch,var(--primary)_24%,transparent),transparent)]">
        <span className="relative inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary-soft-foreground shadow-[0_8px_20px_-12px_var(--primary)]">
          {person.photoHref ? (
            // eslint-disable-next-line @next/next/no-img-element -- authorised, per-user file
            <img src={person.photoHref} alt="" className="size-full object-cover" />
          ) : (
            <UserRound className="size-7" aria-hidden />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[0.65rem] font-bold tracking-widest text-link uppercase">
            {t("eyebrow")}
          </span>
          <span className="truncate font-display text-lg leading-tight font-bold">
            {person.name}
          </span>
          {person.occupation && (
            <span className="truncate text-sm text-muted-foreground">{person.occupation}</span>
          )}
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{person.email}</span>
            </span>
            {person.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5" aria-hidden />
                {person.phone}
              </span>
            )}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-5">
        <Part
          title={t("education")}
          files={files("c")}
          onEdit={() => onSection("c")}
          empty={qualifications.length === 0}
        >
          {cv.c?.highestLevel && (
            <p className="text-xs text-muted-foreground">
              {t("highest", { level: tc(`levels.${cv.c.highestLevel}`) })}
            </p>
          )}
          <Timeline
            items={qualifications.map((q) => ({
              key: q.id,
              title: q.qualification || tc("qualificationN", { n: 1 }),
              detail: [q.institution, q.fieldOfStudy && tc(`fields.${q.fieldOfStudy}`)]
                .filter(Boolean)
                .join(" · "),
              when: q.yearCompleted ? String(q.yearCompleted) : "",
              tag: q.isForeign ? t("abroad") : undefined,
            }))}
          />
        </Part>

        <Part
          title={t("training")}
          files={files("d")}
          onEdit={() => onSection("d")}
          empty={d.trainingCompleted === undefined && d.examPassed === undefined}
        >
          <Timeline
            items={[
              ...(d.trainingCompleted && d.trainingProgramme
                ? [
                    {
                      key: "training",
                      title: td(`programmes.${d.trainingProgramme}`),
                      detail:
                        d.trainingProvider === "OTHER"
                          ? (d.trainingProviderOther ?? "")
                          : d.trainingProvider
                            ? td(`providers.${d.trainingProvider}`)
                            : "",
                      when: day(d.trainingCompletedOn),
                    },
                  ]
                : d.trainingCompleted === false
                  ? [{ key: "training", title: t("noTraining"), detail: "", when: "", muted: true }]
                  : []),
              ...(d.examPassed
                ? [
                    {
                      key: "exam",
                      title: t("exam"),
                      detail: td(`exam.${d.examPassed}`),
                      when: d.examPassed === "YES" ? day(d.examDate) : "",
                      muted: d.examPassed !== "YES",
                    },
                  ]
                : []),
            ]}
          />
        </Part>

        <Part
          title={t("experience")}
          files={files("e")}
          onEdit={() => onSection("e")}
          empty={records.length === 0 && !cv.e?.equivalentRecognised}
        >
          <Timeline
            items={records.map((r) => ({
              key: r.id,
              title: r.firm || te("recordN", { n: 1 }),
              detail: r.category ? te(`categories.${r.category}`) : "",
              when: r.from
                ? `${day(r.from)} – ${r.current ? te("present") : r.to ? day(r.to) : "…"}`
                : "",
            }))}
          />
          {cv.e?.equivalentRecognised && (
            <p className="text-xs font-medium text-link">{t("equivalence")}</p>
          )}
          {cv.e?.refereeName && (
            <p className="text-xs text-muted-foreground">
              {[t("referee", { name: cv.e.refereeName }), cv.e.refereeRole]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </Part>
      </div>
    </aside>
  );
}

function Part({
  title,
  files,
  empty,
  onEdit,
  children,
}: {
  title: string;
  files: number;
  empty: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("cv.preview");
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <h3 className="text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
          {title}
        </h3>
        <span aria-hidden className="h-px flex-1 bg-foreground/[0.08] dark:bg-surface-3" />
        {files > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="size-3.5" aria-hidden />
            {t("files", { count: files })}
          </span>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full px-2 py-0.5 text-xs font-semibold text-link hover:bg-primary-soft"
        >
          {empty ? t("add") : t("edit")}
        </button>
      </div>
      {empty ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : children}
    </section>
  );
}

function Timeline({
  items,
}: {
  items: Array<{
    key: string;
    title: string;
    detail: string;
    when: string;
    tag?: string;
    muted?: boolean;
  }>;
}) {
  if (items.length === 0) return null;
  return (
    <ol className="flex flex-col">
      {items.map((item, i) => (
        <li key={item.key} className="relative flex gap-3 pb-3 last:pb-0">
          {/* The dot and the line to the next entry. */}
          <span aria-hidden className="relative flex w-3 shrink-0 justify-center">
            <span
              className={cn(
                "mt-1.5 size-2.5 rounded-full ring-4 ring-primary-soft",
                item.muted ? "bg-muted-foreground/40" : "bg-primary",
              )}
            />
            {i < items.length - 1 && (
              <span className="absolute top-5 bottom-0 w-px bg-foreground/[0.1] dark:bg-surface-3" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "truncate text-sm font-semibold",
                  item.muted && "text-muted-foreground",
                )}
              >
                {item.title}
              </span>
              {item.when && (
                <span className="shrink-0 text-xs num text-muted-foreground">{item.when}</span>
              )}
            </span>
            {(item.detail || item.tag) && (
              <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                {item.detail}
                {item.tag && (
                  <span className="rounded-full bg-primary-soft px-1.5 text-[0.65rem] font-semibold text-primary-soft-foreground">
                    {item.tag}
                  </span>
                )}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
