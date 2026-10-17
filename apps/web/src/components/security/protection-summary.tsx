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

/** The four protections, how many are on, and the level they add up to (also the hero's status). */
export function protectionChecks({
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
  return { checks, done, level } as const;
}

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
  const { checks, done, level } = protectionChecks({
    emailVerified,
    phoneVerified,
    twoStepOn,
    recoveryRemaining,
  });

  return (
    // One compact row (UX-031): a small ring and the level, then the four checks as slim chips —
    // soft primary ticks when on, a yellow marker and "Fix" when open (each jumps to its card).
    <section
      aria-labelledby="protection-title"
      className="glass flex flex-col gap-4 rounded-[1.75rem] p-4 ring-1 ring-primary/[0.08] sm:p-5 @3xl/main:flex-row @3xl/main:items-center @3xl/main:gap-6 dark:ring-white/[0.06]"
    >
      <div className="flex shrink-0 items-center gap-3">
        <ProgressRing
          value={done}
          total={checks.length}
          tone={level === "weak" ? "critical" : "good"}
          className="size-12"
          thickness={3.5}
          label={t("score", { done, total: checks.length })}
        >
          <span className="text-xs font-bold num">
            {done}/{checks.length}
          </span>
        </ProgressRing>
        <div className="flex flex-col">
          <h2 id="protection-title" className="text-base">
            {t(`level.${level}`)}
          </h2>
          <p className="text-xs text-muted-foreground">
            {level === "strong" ? t("score", { done, total: checks.length }) : t("body")}
          </p>
        </div>
      </div>
      <ul className="flex flex-1 flex-wrap gap-2">
        {checks.map(({ key, done: ok, href }, i) => {
          const Icon = ICONS[key];
          return (
            <li key={key} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <a
                href={href}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full pr-1.5 pl-3 text-xs font-semibold transition-colors",
                  ok
                    ? "bg-primary/[0.06] text-foreground hover:bg-primary/10 dark:bg-primary/[0.12] dark:hover:bg-primary/20"
                    : "bg-card text-foreground ring-1 ring-sun/50 hover:bg-sun/10 dark:bg-surface-2",
                )}
              >
                <Icon className="size-3.5 shrink-0 text-link" aria-hidden />
                {t(`checks.${key}`)}
                {ok ? (
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary-soft text-link ring-1 ring-primary/30 dark:bg-surface-3">
                    <Check className="size-3" strokeWidth={2.5} aria-hidden />
                    <span className="sr-only">{t("done")}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 pr-1.5">
                    <span aria-hidden className="missing-mark size-2 rounded-full bg-sun" />
                    {t("fix")} <ArrowDown className="size-3" aria-hidden />
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
