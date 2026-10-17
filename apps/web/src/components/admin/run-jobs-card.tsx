"use client";

import { Play, Timer } from "@/components/icons";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useErrorMessage } from "@/hooks/use-error-message";
import { runJobsAction } from "@/server/actions/backoffice";

type Summary = Record<string, Record<string, number>>;

const JOBS = [
  "licences",
  "drafts",
  "confirmations",
  "payments",
  "issuance",
  "sla",
  "upgrades",
] as const;

/** Dev/staging convenience: run the scheduled jobs now and show what they did (Plan WP-4.3). */
export function RunJobsCard() {
  const t = useTranslations("configuration.jobs");
  const errorMessage = useErrorMessage();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const result = await runJobsAction();
      if (!result.ok) return void toast.error(errorMessage(result.error, result.meta));
      setSummary(result.data as unknown as Summary);
      toast.success(t("done"));
    });

  return (
    <section
      aria-labelledby="jobs-title"
      className="flex flex-col gap-4 rounded-3xl border border-dashed bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
          <Timer className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="jobs-title" className="text-lg">
              {t("title")}
            </h2>
            <Badge variant="accent">{t("devOnly")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button variant="tonal" loading={pending} onClick={run}>
          <Play /> {t("run")}
        </Button>
      </div>
      <div aria-live="polite">
        {summary && (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {JOBS.filter((job) => summary[job]).map((job) => {
              const total = Object.values(summary[job]!).reduce(
                (sum, n) => sum + (typeof n === "number" ? n : 0),
                0,
              );
              return (
                <div
                  key={job}
                  className="flex flex-col gap-0.5 rounded-2xl bg-surface-2 px-3 py-2.5"
                >
                  <dt className="text-xs text-muted-foreground">{t(`names.${job}`)}</dt>
                  <dd className="text-lg font-bold num">{total}</dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>
    </section>
  );
}
