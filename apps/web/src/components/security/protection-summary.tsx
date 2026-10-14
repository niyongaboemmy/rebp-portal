import { ArrowDown, Check, KeyRound, Mail, ShieldCheck, Smartphone } from "@/components/icons";
import { getTranslations } from "next-intl/server";
import { ProgressRing } from "@/components/data/progress-ring";
import { cn } from "@/lib/utils";

interface Check {
  key: "email" | "phone" | "twoStep" | "recovery";
  done: boolean;
  href: string;
}

const ICONS = { email: Mail, phone: Smartphone, twoStep: ShieldCheck, recovery: KeyRound } as const;

/** Codes left below which recovery is flagged (each code works once). */
export const LOW_RECOVERY_CODES = 3;

/**
 * Security at a glance (FR-ACC-004/007): one ring for how protected the account is and a
 * checklist whose open items jump to the card that fixes them. Replaces reading four cards.
 */
export async function ProtectionSummary({
  emailVerified,
  phoneVerified,
  twoStepOn,
  recoveryRemaining,
}: {
  emailVerified: boolean;
  phoneVerified: boolean;
  twoStepOn: boolean;
  recoveryRemaining: number;
}) {
  const t = await getTranslations("security.protection");
  const checks: Check[] = [
    { key: "email", done: emailVerified, href: "#contact" },
    { key: "phone", done: phoneVerified, href: "#contact" },
    { key: "twoStep", done: twoStepOn, href: "#two-step" },
    {
      key: "recovery",
      done: twoStepOn && recoveryRemaining >= LOW_RECOVERY_CODES,
      href: "#two-step",
    },
  ];
  const done = checks.filter((c) => c.done).length;
  const level = done === checks.length ? "strong" : done >= 2 ? "fair" : "weak";

  return (
    <section
      aria-labelledby="protection-title"
      className="flex flex-col gap-5 rounded-3xl border bg-card p-5 raised sm:flex-row sm:items-center sm:gap-8 sm:p-6"
    >
      <div className="flex items-center gap-4 sm:flex-col sm:text-center">
        <ProgressRing
          value={done}
          total={checks.length}
          tone={level === "strong" ? "good" : level === "fair" ? "warning" : "critical"}
          className="size-20 sm:size-24"
          thickness={3.5}
          label={t("score", { done, total: checks.length })}
        >
          <span className="text-xl font-bold num sm:text-2xl">
            {Math.round((done / checks.length) * 100)}
            <span className="text-sm">%</span>
          </span>
        </ProgressRing>
        <div className="flex flex-col gap-0.5">
          <h2 id="protection-title" className="text-lg">
            {t(`level.${level}`)}
          </h2>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
        </div>
      </div>
      <ul className="grid flex-1 gap-2 sm:grid-cols-2">
        {checks.map(({ key, done: ok, href }, i) => {
          const Icon = ICONS[key];
          return (
            <li key={key} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <a
                href={href}
                className={cn(
                  "flex tap-target items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  ok
                    ? "bg-success-soft text-success"
                    : "bg-warning-soft text-warning hover:brightness-95",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{t(`checks.${key}`)}</span>
                {ok ? (
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-success text-card">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    <span className="sr-only">{t("done")}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold">
                    {t("fix")} <ArrowDown className="size-3.5" aria-hidden />
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
