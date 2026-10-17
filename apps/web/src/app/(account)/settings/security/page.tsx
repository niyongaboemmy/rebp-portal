import { ArrowDown, ArrowRight, Download } from "@/components/icons";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { requiresMfa } from "@rebp/contracts";
import { ContactCard } from "@/components/security/contact-card";
import { MfaCard } from "@/components/security/mfa-card";
import { ProtectionSummary, protectionChecks } from "@/components/security/protection-summary";
import { SessionsList } from "@/components/security/sessions-list";
import { SignInMethodsCard } from "@/components/security/sign-in-methods-card";
import { StepUpProvider } from "@/components/security/step-up";
import { Alert } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  describeUserAgent,
  formatDate,
  formatDateTime,
  maskEmailForDisplay,
  maskPhoneForDisplay,
} from "@/lib/utils";
import { requireUser, safeNextPath } from "@/server/auth/guards";
import { isMfaEnforced } from "@/server/env";
import { remainingRecoveryCodes } from "@/server/auth/mfa";
import { listActiveSessions } from "@/server/auth/session";
import { db } from "@/server/db";
import { env, isGoogleEnabled } from "@/server/env";
import { SettingsTabs } from "@/components/layout/settings-tabs";
import { HeroCompanion, SettingsHero } from "@/components/layout/settings-hero";
import { AccountAvatar } from "@/components/profile/account-avatar";
import { ProfileBuddy } from "@/components/profile/profile-buddy";
import { accountAvatar } from "@/server/profile/documents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("security"))("title") };
}

/** FR-ACC-004/007/008/010: the user's sign-in, two-step and session preferences in one place. */
export default async function SecurityPage({ searchParams }: PageProps<"/settings/security">) {
  const { user, session } = await requireUser({
    allowPendingMfa: true,
    allowIncompleteProfile: true,
  });
  const params = await searchParams;
  const [t, tAuth, tProfile, google, recoveryRemaining, avatar] = await Promise.all([
    getTranslations("security"),
    getTranslations("auth.oauthErrors"),
    getTranslations("profile"),
    db.oAuthAccount.findUnique({
      where: { userId_provider: { userId: user.id, provider: "google" } },
    }),
    remainingRecoveryCodes(user.id),
    accountAvatar(user),
  ]);
  const error = typeof params.error === "string" ? params.error : null;
  const mfaRequired = requiresMfa(user.roles);
  // FR-ACC-004: mandatory only when enforced; otherwise a recommendation the user may skip.
  const enforced = isMfaEnforced();
  const skipTo = safeNextPath(typeof params.next === "string" ? params.next : null);
  // The hero: how protected the account is, and the companion pointing at what's left (UX-013).
  const protection = protectionChecks({
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    twoStepOn: user.mfaMethods.length > 0,
    recoveryRemaining,
  });
  const open = protection.checks.find((c) => !c.done);
  const bubble = t(`hero.bubble.${open?.key ?? "strong"}`);

  return (
    <StepUpProvider hasPassword={Boolean(user.passwordHash)}>
      <SettingsHero
        avatar={
          <AccountAvatar
            name={user.fullName}
            percent={avatar.percent}
            photoHref={avatar.photoHref}
            label={
              avatar.percent === null
                ? user.fullName
                : tProfile("progress", { percent: avatar.percent })
            }
          />
        }
        title={t("title")}
        description={
          open
            ? t("hero.todo", { left: protection.checks.length - protection.done })
            : t("hero.strong", { total: protection.checks.length })
        }
        companion={
          <HeroCompanion
            bubble={bubble}
            label={open ? `${bubble}. ${t("hero.action")}` : bubble}
            href={open?.href ?? "#two-step"}
          >
            <ProfileBuddy mood={open ? "lock" : "shield"} />
          </HeroCompanion>
        }
      />
      <SettingsTabs current="security" />

      {params.setup === "required" && mfaRequired && user.mfaMethods.length === 0 && (
        // Says what is asked and takes the user straight to where it is done — or onwards.
        <Alert
          variant={enforced ? "warning" : "info"}
          title={t(enforced ? "requiredTitle" : "recommendedTitle")}
        >
          <span className="flex flex-col items-start gap-2">
            {t(enforced ? "requiredShort" : "recommendedShort")}
            <span className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="rounded-full">
                <a href="#two-step" className="text-primary-foreground! no-underline!">
                  {t("requiredCta")} <ArrowDown aria-hidden />
                </a>
              </Button>
              {!enforced && (
                <Button asChild size="sm" variant="ghost" className="rounded-full">
                  <Link href={skipTo as Route} className="text-foreground! no-underline!">
                    {t("skip")} <ArrowRight aria-hidden />
                  </Link>
                </Button>
              )}
            </span>
          </span>
        </Alert>
      )}
      {params.linked === "google" && <Alert variant="success">{t("linked")}</Alert>}
      {error && (
        <Alert variant="danger">
          {tAuth.has(error) ? tAuth(error as "oauthFailed") : tAuth("oauthFailed")}
        </Alert>
      )}

      <ProtectionSummary
        emailVerified={Boolean(user.emailVerifiedAt)}
        phoneVerified={Boolean(user.phoneVerifiedAt)}
        twoStepOn={user.mfaMethods.length > 0}
        recoveryRemaining={recoveryRemaining}
      />

      <MfaCard
        enabled={user.mfaMethods}
        preferred={user.mfaPreferred}
        phoneVerified={Boolean(user.phoneVerifiedAt)}
        destinations={{
          SMS: user.phone ? maskPhoneForDisplay(user.phone) : null,
          EMAIL: maskEmailForDisplay(user.email),
        }}
        recoveryRemaining={recoveryRemaining}
        required={mfaRequired}
        enforced={enforced}
      />

      <div className="grid gap-6 @5xl/main:grid-cols-2">
        <SignInMethodsCard
          hasPassword={Boolean(user.passwordHash)}
          passwordChangedAt={user.passwordChangedAt ? formatDate(user.passwordChangedAt) : null}
          google={{
            linked: Boolean(google),
            email: google?.email ?? null,
            available: isGoogleEnabled(),
            clientId: env().GOOGLE_CLIENT_ID ?? null,
          }}
        />
        <ContactCard
          email={{ value: user.email, verified: Boolean(user.emailVerifiedAt) }}
          phone={{ value: user.phone, verified: Boolean(user.phoneVerifiedAt) }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sessions.title")}</CardTitle>
          <CardDescription>{t("sessions.description")}</CardDescription>
        </CardHeader>
        <Suspense fallback={<Skeleton className="h-40" />}>
          <Sessions userId={user.id} currentId={session.id} />
        </Suspense>
      </Card>

      {/* FR-DSR-001: a machine-readable copy of my personal data. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("data.title")}</CardTitle>
          <CardDescription>{t("data.description")}</CardDescription>
        </CardHeader>
        <Button asChild variant="outline" className="self-start">
          <a href="/api/me/export" download>
            <Download aria-hidden /> {t("data.download")}
          </a>
        </Button>
      </Card>
    </StepUpProvider>
  );
}

/** Streamed separately so the rest of the page renders first. */
async function Sessions({ userId, currentId }: { userId: string; currentId: string }) {
  const sessions = await listActiveSessions(userId);
  return (
    <SessionsList
      sessions={sessions.map((s) => ({
        id: s.id,
        device: describeUserAgent(s.userAgent),
        ipAddress: s.ipAddress,
        lastActive: formatDateTime(s.lastActiveAt),
        method: s.method === "google" ? "Google" : "Password",
        current: s.id === currentId,
      }))}
    />
  );
}
